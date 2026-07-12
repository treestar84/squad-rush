import {
  AnimationGroup,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import { LEVEL_1 } from "../data/levelData"
import { SOLDIER_BASE } from "../data/soldierData"
import {
  BASE_SQUAD_LIMIT,
  UNIT_DEFINITIONS,
  UNIT_ORDER,
  UNIT_TYPES,
  createEmptyUnitCounts,
  getTotalUnitCount,
  getUnitDefinition,
  type UnitCounts,
  type UnitType,
} from "../data/squadRosterData"
import { ObjectPool } from "../pools/ObjectPool"
import type { GltfAsset } from "../utils/assetLoader"
import { cloneGltfInstance } from "../utils/assetLoader"
import { clamp } from "../utils/math"
import { ACTOR_GROUND_Y, FALLBACK_SOLDIER_ROOT_Y } from "../WorldGeometry"
import {
  DEFENSE_DISPLACEMENT_ORDER,
  DEFENSE_RESERVE_PROMOTION_COST,
  DEFENSE_SPECIALIST_BRANCHES,
  DEFENSE_TIER_PROMOTION_RULES,
  DEFENSE_TIER_PROMOTION_THRESHOLD,
  DEFENSE_UNIT_POWER_OVERRIDES,
  type DefenseSpecialistBranchId,
} from "./DefenseSquadProgression"
import { readSquadQaOptions } from "./SquadQaOptions"
import { attachSoldierHeadMarkers, attachSoldierRoleKit } from "./SoldierVisualKit"
import { applySoldierUnitVisual } from "./SoldierUpgradeVisual"
import { resolvePromotionChain, type PromotionResolutionEvent } from "./SquadPromotionEngine"

type Soldier = {
  readonly index: number
  readonly mesh: Mesh
  readonly soldierMesh: Mesh
  readonly soldierRunAnimation: AnimationGroup | null
  pangyoMesh: Mesh | null
  pangyoRunAnimation: AnimationGroup | null
  offsetX: number
  offsetZ: number
  hp: number
  alive: boolean
  runPhase: number
  unit: UnitType
  runAnimation: AnimationGroup | null
  visualKind: SquadVisualKind
}

type SquadVisualKind = "soldier" | "pangyo"

export type SquadRosterEntry = {
  readonly type: UnitType
  readonly label: string
  readonly shortLabel: string
  readonly count: number
  readonly color: string
  readonly portraitSrc: string
  readonly tier: 1 | 2 | 3
}

export type SquadUnitDelta = {
  readonly unit: UnitType
  readonly count: number
}

export type SquadCombatStats = {
  readonly attackMultiplier: number
  readonly projectileCount: number
  readonly effectiveAttackPower: number
  readonly monsterSpawnMultiplier: number
  readonly shield: number
  readonly squadLimit: number
}

export type CareerChoiceKey = "military" | "overtime" | "fired"

export type CareerChoiceState = {
  readonly active: boolean
  readonly pangyoCount: number
  readonly requiredPangyo: number
}

export type PromotionSummary = {
  readonly labels: readonly string[]
  readonly promotedCount: number
}

export type SquadPromotionEvent = {
  readonly label: string
  readonly requirements: readonly SquadPromotionUnit[]
  readonly result: SquadPromotionUnit
}

export type SquadPromotionUnit = {
  readonly label: string
  readonly count: number
  readonly color: string
  readonly portraitSrc: string
}

export type SquadTimedSkillState = {
  readonly id: "officer_spawn" | "unemployed_event"
  readonly label: string
  readonly detail: string
  readonly remainingSeconds: number
  readonly intervalSeconds: number
  readonly progress: number
  readonly source: SquadPromotionUnit
  readonly result: SquadPromotionUnit
}

export type SquadTimedSkillEvent = {
  readonly label: string
  readonly message: string
  readonly result: SquadPromotionUnit
}

export type DefenseProgressionState = {
  readonly enabled: boolean
  readonly maxed: boolean
  readonly reserveUnemployed: number
  readonly promotionCost: number
  readonly promotionCount: number
  readonly nextUnit: UnitType
  readonly nextUnitLabel: string
  readonly nextUnitColor: string
  readonly branches: readonly {
    readonly id: DefenseSpecialistBranchId
    readonly label: string
    readonly base: number
    readonly middle: number
    readonly top: number
  }[]
}

export type DefenseReinforcementResult = {
  readonly requested: number
  readonly activeSoldiersAdded: number
  readonly reserveAdded: number
  readonly promotions: number
  readonly displacedUnits: number
}

export type SquadSystemOptions = {
  readonly squadLimit?: number
  readonly promotionTreeEnabled?: boolean
  readonly defenseProgressionEnabled?: boolean
  readonly startingUnit?: UnitType
  readonly formationMaxColumns?: number
  readonly formationSpacing?: number
  readonly formationRowDepth?: number
  readonly formationRowStagger?: number
  readonly maxFireEmitters?: number
  readonly maxAnimatedSoldiers?: number
  readonly maxLateralX?: number
}

export type SquadFormationDebugState = {
  readonly count: number
  readonly columns: number
  readonly rows: number
  readonly frontRowCount: number
  readonly spacing: number
  readonly rowDepth: number
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
  readonly width: number
  readonly depth: number
}

const SOLDIER_HIDDEN_PART_NAMES = [
  "GrenadeLauncher",
  "Knife_1",
  "Knife_2",
  "Pistol",
  "Revolver",
  "Revolver_Small",
  "RocketLauncher",
  "ShortCannon",
  "Shotgun",
  "Shovel",
  "SMG",
  "Sniper",
  "Sniper_2",
] as const
const SOLDIER_MUZZLE_OFFSET = new Vector3(0.34, 0.58, 0.78)
const SOLDIER_VISUAL_SCALE = 0.468
const PANGYO_RUNNER_VISUAL_SCALE = 1.06
const PANGYO_RUNNER_VISUAL_Y = 0
const PANGYO_RUNNER_VISUAL_ROTATION_Y = -Math.PI * 0.5
const SOLDIER_FORMATION_SPACING = 0.5
const SOLDIER_FORMATION_ROW_DEPTH = 0.24
const SOLDIER_FORMATION_MAX_COLUMNS = 3
const CAREER_CHOICE_PANGYO_COST = 3
const OFFICER_SPAWN_BASE_SECONDS = 25
const OFFICER_SPAWN_STEP_SECONDS = 5
const OFFICER_SPAWN_MIN_SECONDS = 5
const UNEMPLOYED_EVENT_SECONDS = 10
const UNEMPLOYED_EVENT_MIN_COUNT = 2
const UNEMPLOYED_EVENT_CHANGE_CHANCE = 0.5
const CEO_BONUS_BASE_CHANCE = 0.3
const CEO_BONUS_STEP_CHANCE = 0.2
const SENIOR_DEVELOPER_ATTACK_BONUS = 0.2
const DEVELOPER_SLOWDOWN_PER_UNIT = 0.2
const MIN_DEVELOPER_SLOWDOWN = 0.25
const SQUAD_RUSH_PER_EXTRA_UNIT = 0.15
const MONSTER_SPAWN_ATTACK_THRESHOLD = 6
const MONSTER_SPAWN_ATTACK_STEP = 2
const MONSTER_SPAWN_ATTACK_STEP_MULTIPLIER = 0.25
const MONSTER_SPAWN_ATTACK_MAX_MULTIPLIER = 2
const MAX_PENDING_DEFENSE_PROMOTION_EVENTS = 3
const STARTING_PANGYO = 1
export const MAX_SQUAD_SOLDIERS = 60

function createUnitDamageMultipliers(): UnitCounts {
  const multipliers = createEmptyUnitCounts()
  for (const unit of UNIT_ORDER) {
    multipliers[unit] = 1
  }
  return multipliers
}

export class SquadSystem {
  squadX = 0
  squadZ = 10
  private readonly soldiers: Soldier[] = []
  private readonly pool: ObjectPool<Soldier>
  private readonly alivePositions: Vector3[] = []
  private readonly alivePositionView: Vector3[] = []
  private readonly muzzlePositions: Vector3[] = []
  private readonly muzzlePositionView: Vector3[] = []
  private readonly trackHalf = LEVEL_1.trackWidth / 2
  private readonly movementHalf: number
  private readonly helmetMat: StandardMaterial
  private readonly visorMat: StandardMaterial
  private readonly rifleMat: StandardMaterial
  private readonly muzzleMat: StandardMaterial
  private readonly speedMultiplier: number
  private readonly rootY: number
  private readonly visualCapacity: number
  private readonly promotionTreeEnabled: boolean
  private readonly defenseProgressionEnabled: boolean
  private readonly formationMaxColumns: number
  private readonly formationSpacing: number
  private readonly formationRowDepth: number
  private readonly formationRowStagger: number
  private readonly maxFireEmitters: number
  private readonly maxAnimatedSoldiers: number
  private readonly roster: UnitCounts = createEmptyUnitCounts()
  private readonly squadLimit: number
  private shield = 0
  private officerSpawnTimer = 0
  private unemployedEventTimer = 0
  private permanentAttackMultiplier = 1
  private defenseReserveUnemployed = 0
  private defensePromotionCount = 0
  private defenseTieBreakBranch: DefenseSpecialistBranchId = "command"
  private readonly combatStats = {
    attackMultiplier: 1,
    projectileCount: 1,
    effectiveAttackPower: 1,
    monsterSpawnMultiplier: 1,
    shield: 0,
    squadLimit: 1,
  }
  private readonly unitDamageMultipliers: UnitCounts = createUnitDamageMultipliers()
  private readonly pendingPromotionEvents: SquadPromotionEvent[] = []
  private readonly pendingTimedSkillEvents: SquadTimedSkillEvent[] = []
  private formationColumns = 0
  private formationRows = 0

  private get hasAuthoredActorAsset(): boolean {
    return this.asset?.isReal === true || this.pangyoRunnerAsset?.isReal === true
  }

  constructor(
    private readonly scene: Scene,
    private readonly asset: GltfAsset | null,
    private readonly pangyoRunnerAsset: GltfAsset | null,
    maxCount: number,
    options: SquadSystemOptions = {},
  ) {
    this.rootY = this.hasAuthoredActorAsset ? ACTOR_GROUND_Y : FALLBACK_SOLDIER_ROOT_Y
    this.movementHalf = Math.max(0.5, Math.min(this.trackHalf, options.maxLateralX ?? this.trackHalf))
    this.squadLimit = Math.max(1, Math.floor(options.squadLimit ?? BASE_SQUAD_LIMIT))
    this.promotionTreeEnabled = options.promotionTreeEnabled !== false
    this.defenseProgressionEnabled = options.defenseProgressionEnabled === true
    this.formationMaxColumns = Math.max(1, Math.floor(options.formationMaxColumns ?? SOLDIER_FORMATION_MAX_COLUMNS))
    this.formationSpacing = clamp(options.formationSpacing ?? SOLDIER_FORMATION_SPACING, 0.28, 1.2)
    this.formationRowDepth = clamp(options.formationRowDepth ?? SOLDIER_FORMATION_ROW_DEPTH, 0.14, 0.8)
    this.formationRowStagger = clamp(options.formationRowStagger ?? 0.16, 0, 0.5)
    this.visualCapacity = Math.min(Math.max(1, maxCount), this.squadLimit, MAX_SQUAD_SOLDIERS)
    this.maxFireEmitters = Math.max(1, Math.min(
      this.visualCapacity,
      Math.floor(options.maxFireEmitters ?? this.visualCapacity),
    ))
    this.maxAnimatedSoldiers = Math.max(1, Math.min(
      this.visualCapacity,
      Math.floor(options.maxAnimatedSoldiers ?? this.visualCapacity),
    ))
    const qaStartUnitLimit = this.defenseProgressionEnabled
      ? this.squadLimit + DEFENSE_RESERVE_PROMOTION_COST * this.squadLimit * 2
      : this.squadLimit
    const qaOptions = readSquadQaOptions(qaStartUnitLimit, this.squadZ)
    this.squadZ = qaOptions.startZ
    this.speedMultiplier = qaOptions.speedMultiplier
    this.helmetMat = new StandardMaterial("squadHelmetMat", scene)
    this.helmetMat.diffuseColor = new Color3(0.05, 0.09, 0.12)
    this.helmetMat.specularColor = new Color3(0.55, 0.62, 0.68)
    this.visorMat = new StandardMaterial("squadVisorMat", scene)
    this.visorMat.diffuseColor = new Color3(0.12, 0.7, 1)
    this.visorMat.emissiveColor = new Color3(0.02, 0.18, 0.35)
    this.rifleMat = new StandardMaterial("squadRifleMat", scene)
    this.rifleMat.diffuseColor = new Color3(0.08, 0.08, 0.07)
    this.muzzleMat = new StandardMaterial("squadMuzzleMat", scene)
    this.muzzleMat.diffuseColor = new Color3(1, 0.72, 0.16)
    this.muzzleMat.emissiveColor = new Color3(0.8, 0.32, 0.02)
    this.pool = new ObjectPool<Soldier>(
      (index) => this.createSoldier(index),
      (soldier) => {
        soldier.mesh.setEnabled(false)
        soldier.soldierRunAnimation?.pause()
        soldier.pangyoRunAnimation?.pause()
        soldier.runAnimation = null
        soldier.alive = false
      },
      Math.min(this.visualCapacity, BASE_SQUAD_LIMIT),
      this.visualCapacity,
    )
    for (let index = 0; index < this.visualCapacity; index += 1) {
      this.alivePositions.push(new Vector3(0, 0, 0))
      this.muzzlePositions.push(new Vector3(0, 0, 0))
    }
    this.addUnits(options.startingUnit ?? UNIT_TYPES.pangyo, STARTING_PANGYO)
    if (qaOptions.startPangyoOverridden) {
      this.addUnits(UNIT_TYPES.pangyo, qaOptions.startPangyo)
    }
    if (qaOptions.startSoldiersOverridden) {
      this.addUnits(UNIT_TYPES.soldier, qaOptions.startSoldiers)
    }
  }

  private createSoldier(index: number): Soldier {
    const visual = this.createSoldierVisual(index)
    visual.mesh.setEnabled(false)
    return {
      index,
      mesh: visual.mesh,
      soldierMesh: visual.soldierMesh,
      soldierRunAnimation: visual.soldierRunAnimation,
      pangyoMesh: null,
      pangyoRunAnimation: null,
      offsetX: 0,
      offsetZ: 0,
      hp: SOLDIER_BASE.hp,
      alive: false,
      runPhase: index * 0.73,
      unit: UNIT_TYPES.soldier,
      runAnimation: visual.soldierRunAnimation,
      visualKind: "soldier",
    }
  }

  private createSoldierVisual(index: number): {
    readonly mesh: Mesh
    readonly soldierMesh: Mesh
    readonly soldierRunAnimation: AnimationGroup | null
  } {
    const root = new Mesh(`squad_member_${index}`, this.scene)
    root.isPickable = false
    const soldierVisual = this.createSoldierActorVisual(index)
    soldierVisual.mesh.parent = root
    return {
      mesh: root,
      soldierMesh: soldierVisual.mesh,
      soldierRunAnimation: soldierVisual.runAnimation,
    }
  }

  private createSoldierActorVisual(index: number): { readonly mesh: Mesh; readonly runAnimation: AnimationGroup | null } {
    if (this.asset?.isReal === true) {
      const instance = cloneGltfInstance(this.asset, `soldier_${index}`, this.scene)
      const mesh = instance.root
      mesh.scaling.setAll(SOLDIER_VISUAL_SCALE)
      this.hideUnusedSoldierParts(mesh)
      attachSoldierHeadMarkers(mesh, index, this.scene)
      attachSoldierRoleKit(mesh, index, this.scene)
      const runAnimation = this.getRunAnimation(instance.animationGroups)
      if (index < this.maxAnimatedSoldiers) {
        runAnimation?.start(true, 1.18)
      }
      return { mesh, runAnimation }
    }

    const mesh = this.createFallbackSoldier(index)
    this.decorateSoldier(mesh, index)
    attachSoldierHeadMarkers(mesh, index, this.scene)
    attachSoldierRoleKit(mesh, index, this.scene)
    return { mesh, runAnimation: null }
  }

  private createPangyoActorVisual(index: number): { readonly mesh: Mesh; readonly runAnimation: AnimationGroup | null } | null {
    if (this.pangyoRunnerAsset?.isReal !== true) {
      return null
    }
    const instance = cloneGltfInstance(this.pangyoRunnerAsset, `pangyo_runner_${index}`, this.scene)
    const mesh = instance.root
    mesh.scaling.setAll(PANGYO_RUNNER_VISUAL_SCALE)
    mesh.position.y = PANGYO_RUNNER_VISUAL_Y
    mesh.rotation.y = PANGYO_RUNNER_VISUAL_ROTATION_Y
    this.attachCivilianBadge(mesh, index, this.scene)
    const runAnimation = this.getRunAnimation(instance.animationGroups)
    if (index < this.maxAnimatedSoldiers) {
      runAnimation?.start(true, 1.08)
    }
    return { mesh, runAnimation }
  }

  private decorateSoldier(mesh: Mesh, index: number): void {
    const helmet = MeshBuilder.CreateSphere(`soldier_helmet_${index}`, { diameter: 0.48, segments: 12 }, this.scene)
    helmet.material = this.helmetMat
    helmet.parent = mesh
    helmet.position.set(0, 1.04, 0.02)

    const visor = MeshBuilder.CreateBox(`soldier_visor_${index}`, { width: 0.34, height: 0.1, depth: 0.05 }, this.scene)
    visor.material = this.visorMat
    visor.parent = mesh
    visor.position.set(0, 1.06, 0.25)

    const rifle = MeshBuilder.CreateBox(`soldier_rifle_${index}`, { width: 0.1, height: 0.12, depth: 0.78 }, this.scene)
    rifle.material = this.rifleMat
    rifle.parent = mesh
    rifle.position.set(0.34, 0.58, 0.34)

    const muzzle = MeshBuilder.CreateSphere(`soldier_muzzle_${index}`, { diameter: 0.12, segments: 8 }, this.scene)
    muzzle.material = this.muzzleMat
    muzzle.parent = mesh
    muzzle.position.set(0.34, 0.58, 0.78)
  }

  private attachCivilianBadge(mesh: Mesh, index: number, scene: Scene): void {
    const badgeMat = new StandardMaterial(`civilian_career_badge_mat_${index}`, scene)
    badgeMat.diffuseColor = new Color3(0.05, 0.12, 0.18)
    badgeMat.emissiveColor = new Color3(0.02, 0.12, 0.2)
    const badge = MeshBuilder.CreateBox(`civilian_career_badge_${index}`, { width: 0.34, height: 0.22, depth: 0.07 }, scene)
    badge.material = badgeMat
    badge.parent = mesh
    badge.position.set(0, 0.54, 0.28)
  }

  private createFallbackSoldier(index: number): Mesh {
    const mesh = MeshBuilder.CreateCylinder(`soldier_${index}`, { height: 1.8, diameter: 0.65, tessellation: 8 }, this.scene)
    const mat = new StandardMaterial(`soldierMat_${index}`, this.scene)
    mat.diffuseColor = new Color3(0.08, 0.47, 0.92)
    mat.emissiveColor = new Color3(0.01, 0.05, 0.1)
    mesh.material = mat
    return mesh
  }

  private hideUnusedSoldierParts(mesh: Mesh): void {
    for (const child of mesh.getChildMeshes(false)) {
      if (SOLDIER_HIDDEN_PART_NAMES.some((partName) => child.name.includes(partName))) {
        child.setEnabled(false)
      }
    }
  }

  addSoldiers(count: number): void {
    this.addUnits(UNIT_TYPES.soldier, count)
  }

  addUnits(unit: UnitType, count: number): number {
    if (this.defenseProgressionEnabled && unit === UNIT_TYPES.soldier) {
      const result = this.addDefenseReinforcements(count)
      return result.activeSoldiersAdded + result.reserveAdded
    }
    return this.addActiveUnits(unit, count)
  }

  addDefenseReinforcements(count: number): DefenseReinforcementResult {
    const requested = Math.max(0, Math.floor(count))
    if (!this.defenseProgressionEnabled) {
      const activeSoldiersAdded = this.addActiveUnits(UNIT_TYPES.soldier, requested)
      return { requested, activeSoldiersAdded, reserveAdded: 0, promotions: 0, displacedUnits: 0 }
    }

    const activeSoldiersAdded = Math.min(requested, this.squadLimit - this.totalRosterCount)
    if (activeSoldiersAdded > 0) {
      this.roster[UNIT_TYPES.soldier] += activeSoldiersAdded
    }
    const reserveAdded = requested - activeSoldiersAdded
    this.defenseReserveUnemployed += reserveAdded
    let promotions = 0
    let displacedUnits = 0
    while (this.defenseReserveUnemployed >= DEFENSE_RESERVE_PROMOTION_COST) {
      this.defenseReserveUnemployed -= DEFENSE_RESERVE_PROMOTION_COST
      const result = this.promoteDefenseReserve()
      if (!result.applied) {
        this.defenseReserveUnemployed += DEFENSE_RESERVE_PROMOTION_COST
        break
      }
      promotions += 1
      displacedUnits += result.displaced ? 1 : 0
    }
    this.syncSoldierVisuals()
    return { requested, activeSoldiersAdded, reserveAdded, promotions, displacedUnits }
  }

  private addActiveUnits(unit: UnitType, count: number): number {
    const requested = Math.max(0, Math.floor(count))
    const addableCount = Math.min(requested, this.squadLimit - this.totalRosterCount)
    if (addableCount <= 0) {
      return 0
    }
    this.roster[unit] += addableCount
    this.applyEngineMilestones()
    this.syncSoldierVisuals()
    return addableCount
  }

  increaseMostCommon(mode: "ADD" | "MULTIPLY", value: number): { readonly unit: UnitType; readonly gained: number } | null {
    const unit = this.pickMostCommonUnit()
    if (unit === null) {
      return null
    }
    const gained = mode === "MULTIPLY" ? this.roster[unit] * (value - 1) : value
    const added = this.addUnits(unit, gained)
    return { unit, gained: added }
  }

  removeMostCommon(count: number): { readonly unit: UnitType; readonly removed: number } | null {
    const unit = this.pickMostCommonUnit()
    if (unit === null) {
      return null
    }
    const removed = Math.min(this.roster[unit], Math.max(0, Math.floor(count)))
    if (removed <= 0) {
      return { unit, removed: 0 }
    }
    this.roster[unit] -= removed
    this.syncSoldierVisuals()
    return { unit, removed }
  }

  recruitSpecial(unit: UnitType, count: number): number {
    return this.addUnits(unit, count)
  }

  multiplyPermanentAttack(multiplier: number): void {
    this.permanentAttackMultiplier *= Math.max(1, multiplier)
  }

  multiplyUnitDamage(unit: UnitType, multiplier: number): void {
    this.unitDamageMultipliers[unit] *= Math.max(1, multiplier)
  }

  chooseCareer(choice: CareerChoiceKey): boolean {
    if (!this.promotionTreeEnabled || !this.hasCareerChoiceReady()) {
      return false
    }
    this.roster[UNIT_TYPES.pangyo] -= CAREER_CHOICE_PANGYO_COST
    const unit = this.getCareerChoiceUnit(choice)
    this.addUnits(unit, 1)
    return true
  }

  getCareerChoiceState(): CareerChoiceState {
    return {
      active: this.promotionTreeEnabled && this.hasCareerChoiceReady(),
      pangyoCount: this.roster[UNIT_TYPES.pangyo],
      requiredPangyo: CAREER_CHOICE_PANGYO_COST,
    }
  }

  enlistAll(): number {
    const converted = this.roster[UNIT_TYPES.pangyo] + this.roster[UNIT_TYPES.unemployed]
    if (converted <= 0) {
      return 0
    }
    this.roster[UNIT_TYPES.pangyo] = 0
    this.roster[UNIT_TYPES.unemployed] = 0
    this.roster[UNIT_TYPES.soldier] += converted
    this.applyEngineMilestones()
    this.syncSoldierVisuals()
    return converted
  }

  promoteAvailable(): PromotionSummary {
    if (!this.promotionTreeEnabled) {
      return { labels: [], promotedCount: 0 }
    }
    const result = resolvePromotionChain(this.roster)
    for (const unit of UNIT_ORDER) {
      this.roster[unit] = result.counts[unit]
    }
    this.pendingPromotionEvents.push(...result.events.map((event) => this.createPromotionEvent(event)))
    this.applyCeoPromotionBonus(result.promotedCount)
    this.syncSoldierVisuals()
    return { labels: result.labels, promotedCount: result.promotedCount }
  }

  consumePromotionEvents(): readonly SquadPromotionEvent[] {
    return this.pendingPromotionEvents.splice(0)
  }

  consumeTimedSkillEvents(): readonly SquadTimedSkillEvent[] {
    return this.pendingTimedSkillEvents.splice(0)
  }

  private addVisualSoldiers(count: number): void {
    const firstAddedIndex = this.soldiers.length
    const addableCount = Math.min(Math.max(0, count), this.visualCapacity - this.soldiers.length)
    for (let index = 0; index < addableCount; index += 1) {
      const soldier = this.pool.get()
      if (soldier === null) {
        break
      }
      soldier.alive = true
      soldier.hp = SOLDIER_BASE.hp
      soldier.mesh.setEnabled(true)
      this.soldiers.push(soldier)
    }
    this.recalcFormation()
    for (let index = firstAddedIndex; index < this.soldiers.length; index += 1) {
      const soldier = this.soldiers[index]
      if (soldier !== undefined) {
        soldier.mesh.position.set(this.squadX + soldier.offsetX, this.rootY, this.squadZ + soldier.offsetZ)
      }
    }
  }

  removeSoldiers(count: number): readonly SquadUnitDelta[] {
    const casualties = this.consumeWeakestUnits(Math.max(0, Math.floor(count)))
    this.syncSoldierVisuals()
    return casualties
  }

  private removeVisualSoldiers(count: number): void {
    for (let removed = 0; removed < count && this.soldiers.length > 0; removed += 1) {
      const soldier = this.soldiers.pop()
      if (soldier !== undefined) {
        this.pool.release(soldier)
      }
    }
    this.recalcFormation()
  }

  get soldierCount(): number {
    return this.totalRosterCount
  }

  get soldierCapacity(): number {
    return this.visualCapacity
  }

  get squadCapacity(): number {
    return this.squadLimit
  }

  get isAtMaxSoldiers(): boolean {
    return this.totalRosterCount >= this.squadLimit
  }

  get isPromotionTreeEnabled(): boolean {
    return this.promotionTreeEnabled
  }

  get shieldCount(): number {
    return this.shield
  }

  grantShield(amount: number): void {
    this.shield += Math.max(0, Math.floor(amount))
  }

  absorbShieldDamage(amount: number): number {
    const absorbed = Math.min(this.shield, Math.max(0, Math.floor(amount)))
    this.shield -= absorbed
    return absorbed
  }

  getRosterEntries(): readonly SquadRosterEntry[] {
    return UNIT_ORDER.map((unit) => {
      const definition = getUnitDefinition(unit)
      return {
        type: unit,
        label: definition.label,
        shortLabel: definition.shortLabel,
        count: this.roster[unit],
        color: definition.color,
        portraitSrc: definition.portraitSrc,
        tier: definition.tier,
      }
    })
  }

  getDefenseProgressionState(): DefenseProgressionState {
    const promotionPlan = this.getDefensePromotionPlan()
    const nextBranch = promotionPlan?.branch ?? this.getNextDefenseBranch()
    const nextUnit = promotionPlan?.refinement?.result
      ?? (promotionPlan === null ? nextBranch.units[2] : nextBranch.baseUnit)
    const nextDefinition = UNIT_DEFINITIONS[nextUnit]
    return {
      enabled: this.defenseProgressionEnabled,
      maxed: this.defenseProgressionEnabled && promotionPlan === null,
      reserveUnemployed: this.defenseReserveUnemployed,
      promotionCost: DEFENSE_RESERVE_PROMOTION_COST,
      promotionCount: this.defensePromotionCount,
      nextUnit,
      nextUnitLabel: promotionPlan === null ? "최종 전직 완료" : nextDefinition.label,
      nextUnitColor: nextDefinition.color,
      branches: DEFENSE_SPECIALIST_BRANCHES.map((branch) => ({
        id: branch.id,
        label: branch.label,
        base: this.roster[branch.units[0]],
        middle: this.roster[branch.units[1]],
        top: this.roster[branch.units[2]],
      })),
    }
  }

  getCombatStats(): SquadCombatStats {
    const projectileCount = this.getFireEmitterCount()
    const effectiveAttackPower = Math.max(0.5, this.getTotalPower())
      * (this.defenseProgressionEnabled
        ? 1
        : 1 + this.roster[UNIT_TYPES.seniorDeveloper] * SENIOR_DEVELOPER_ATTACK_BONUS)
      * this.permanentAttackMultiplier
    const attackMultiplier = effectiveAttackPower / Math.max(1, projectileCount)
    this.combatStats.attackMultiplier = attackMultiplier
    this.combatStats.projectileCount = projectileCount
    this.combatStats.effectiveAttackPower = effectiveAttackPower
    this.combatStats.monsterSpawnMultiplier = this.getMonsterSpawnMultiplier(effectiveAttackPower)
    this.combatStats.shield = this.shield
    this.combatStats.squadLimit = this.squadLimit
    return this.combatStats
  }

  getEffectSummaries(): readonly string[] {
    const summaries: string[] = []
    const developerCount = this.roster[UNIT_TYPES.developer]
    const seniorCount = this.roster[UNIT_TYPES.seniorDeveloper]
    const officerCount = this.roster[UNIT_TYPES.officer]
    const generalCount = this.roster[UNIT_TYPES.general]
    const ceoCount = this.roster[UNIT_TYPES.ceo]
    const gamerCount = this.roster[UNIT_TYPES.gamer]
    if (developerCount > 0 && !this.defenseProgressionEnabled) {
      summaries.push(`전진 속도 -${Math.round((1 - this.getDeveloperSlowMultiplier()) * 100)}%`)
    }
    if (seniorCount > 0 && !this.defenseProgressionEnabled) {
      summaries.push(`승급 요구 -${seniorCount}, 전체 화력 +${Math.round(seniorCount * SENIOR_DEVELOPER_ATTACK_BONUS * 100)}%`)
    }
    if (this.permanentAttackMultiplier > 1) {
      summaries.push(`전체 화력 +${Math.round((this.permanentAttackMultiplier - 1) * 100)}%`)
    }
    if (this.unitDamageMultipliers[UNIT_TYPES.pangyo] > 1) {
      summaries.push(`판교인 화력 x${this.unitDamageMultipliers[UNIT_TYPES.pangyo].toFixed(1)}`)
    }
    if (officerCount > 0 && !this.defenseProgressionEnabled) {
      summaries.push(`장교 병사 생성 ${this.getOfficerSpawnInterval(officerCount)}초마다`)
    }
    if (generalCount > 0) {
      summaries.push(`장군 보정 화력 +${generalCount}`)
    }
    if (ceoCount > 0) {
      summaries.push(`CEO 승급 보너스 ${Math.round(this.getCeoBonusChance() * 100)}%`)
    }
    if (gamerCount > 0 && seniorCount > 0) {
      summaries.push("게이머 화력 2배")
    }
    if (this.promotionTreeEnabled && this.totalRosterCount > 1) {
      summaries.push(`대형 스쿼드 전진 +${Math.round((this.getSquadRushMultiplier() - 1) * 100)}%`)
    }
    return summaries
  }

  getTimedSkillStates(): readonly SquadTimedSkillState[] {
    if (!this.promotionTreeEnabled) {
      return []
    }
    const states: SquadTimedSkillState[] = []
    const officers = this.roster[UNIT_TYPES.officer]
    if (officers > 0) {
      const interval = this.getOfficerSpawnInterval(officers)
      states.push({
        id: "officer_spawn",
        label: "장교 지휘",
        detail: "병사 자동 합류",
        remainingSeconds: Math.max(0, interval - this.officerSpawnTimer),
        intervalSeconds: interval,
        progress: clamp(this.officerSpawnTimer / interval, 0, 1),
        source: this.createPromotionUnit(UNIT_TYPES.officer, officers),
        result: this.createPromotionUnit(UNIT_TYPES.soldier, 1),
      })
    }
    const unemployed = this.roster[UNIT_TYPES.unemployed]
    if (unemployed >= UNEMPLOYED_EVENT_MIN_COUNT) {
      states.push({
        id: "unemployed_event",
        label: "백수 변수",
        detail: "랜덤 전환 판정",
        remainingSeconds: Math.max(0, UNEMPLOYED_EVENT_SECONDS - this.unemployedEventTimer),
        intervalSeconds: UNEMPLOYED_EVENT_SECONDS,
        progress: clamp(this.unemployedEventTimer / UNEMPLOYED_EVENT_SECONDS, 0, 1),
        source: this.createPromotionUnit(UNIT_TYPES.unemployed, unemployed),
        result: this.createPromotionUnit(UNIT_TYPES.unemployed, 1),
      })
    }
    return states
  }

  getAlivePositions(): readonly Vector3[] {
    if (this.alivePositionView.length !== this.soldiers.length) {
      this.alivePositionView.length = 0
      for (let index = 0; index < this.soldiers.length; index += 1) {
        const position = this.alivePositions[index]
        if (position !== undefined) {
          this.alivePositionView.push(position)
        }
      }
    }
    for (let index = 0; index < this.soldiers.length; index += 1) {
      const soldier = this.soldiers[index]
      const position = this.alivePositions[index]
      if (soldier !== undefined && position !== undefined) {
        position.copyFrom(soldier.mesh.position)
      }
    }
    return this.alivePositionView
  }

  getFormationDebugState(): SquadFormationDebugState {
    if (this.soldiers.length === 0) {
      return {
        count: 0,
        columns: 0,
        rows: 0,
        frontRowCount: 0,
        spacing: this.formationSpacing,
        rowDepth: this.formationRowDepth,
        minX: 0,
        maxX: 0,
        minZ: 0,
        maxZ: 0,
        width: 0,
        depth: 0,
      }
    }
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY
    for (const soldier of this.soldiers) {
      minX = Math.min(minX, soldier.mesh.position.x)
      maxX = Math.max(maxX, soldier.mesh.position.x)
      minZ = Math.min(minZ, soldier.mesh.position.z)
      maxZ = Math.max(maxZ, soldier.mesh.position.z)
    }
    return {
      count: this.soldiers.length,
      columns: this.formationColumns,
      rows: this.formationRows,
      frontRowCount: Math.min(this.soldiers.length, this.formationColumns),
      spacing: this.formationSpacing,
      rowDepth: this.formationRowDepth,
      minX,
      maxX,
      minZ,
      maxZ,
      width: maxX - minX,
      depth: maxZ - minZ,
    }
  }

  getMuzzlePositions(): readonly Vector3[] {
    const emitterCount = this.getFireEmitterCount()
    if (this.muzzlePositionView.length !== emitterCount) {
      this.muzzlePositionView.length = 0
      for (let index = 0; index < emitterCount; index += 1) {
        const position = this.muzzlePositions[index]
        if (position !== undefined) {
          this.muzzlePositionView.push(position)
        }
      }
    }
    for (let index = 0; index < emitterCount; index += 1) {
      const soldier = this.soldiers[index]
      const position = this.muzzlePositions[index]
      if (soldier !== undefined && position !== undefined) {
        Vector3.TransformCoordinatesToRef(SOLDIER_MUZZLE_OFFSET, soldier.mesh.getWorldMatrix(), position)
      }
    }
    return this.muzzlePositionView
  }

  getFireEmitterCount(): number {
    return Math.min(this.soldiers.length, this.maxFireEmitters)
  }

  get fireEmitterCapacity(): number {
    return this.maxFireEmitters
  }

  update(deltaX: number, dt: number, forwardMultiplier = 1): void {
    this.updateEngineEffects(dt)
    this.squadX = clamp(this.squadX + deltaX, -this.movementHalf, this.movementHalf)
    this.squadZ += LEVEL_1.forwardSpeed * this.speedMultiplier * forwardMultiplier * this.getDeveloperSlowMultiplier() * this.getSquadRushMultiplier() * dt

    for (const soldier of this.soldiers) {
      const targetX = this.squadX + soldier.offsetX
      const targetZ = this.squadZ + soldier.offsetZ
      const follow = Math.min(dt * 12, 1)
      soldier.runPhase += dt * 11.5
      soldier.mesh.position.x += (targetX - soldier.mesh.position.x) * follow
      soldier.mesh.position.z += (targetZ - soldier.mesh.position.z) * follow
      soldier.mesh.position.y = this.rootY + Math.abs(Math.sin(soldier.runPhase)) * 0.035
      soldier.mesh.rotation.x = Math.sin(soldier.runPhase) * 0.035
      soldier.mesh.rotation.z = Math.cos(soldier.runPhase * 0.5) * 0.025
      soldier.mesh.rotation.y = Math.sin(this.squadZ * 0.8 + soldier.offsetX) * 0.08
    }
  }

  private getRunAnimation(groups: readonly AnimationGroup[]): AnimationGroup | null {
    return groups.find((group) => group.name.includes("Run_Gun"))
      ?? groups.find((group) => group.name.includes("Run"))
      ?? groups[0]
      ?? null
  }

  private recalcFormation(): void {
    const count = this.soldiers.length
    const preferredColumns = Math.max(1, Math.ceil(Math.sqrt(count * 1.35)))
    const cols = Math.min(this.formationMaxColumns, preferredColumns)
    this.formationColumns = count > 0 ? cols : 0
    this.formationRows = count > 0 ? Math.ceil(count / cols) : 0
    for (let index = 0; index < count; index += 1) {
      const soldier = this.soldiers[index]
      if (soldier === undefined) {
        continue
      }
      const col = index % cols
      const row = Math.floor(index / cols)
      const rowShift = row % 2 === 0
        ? -this.formationSpacing * this.formationRowStagger
        : this.formationSpacing * this.formationRowStagger
      soldier.offsetX = (col - (cols - 1) / 2) * this.formationSpacing + rowShift
      soldier.offsetZ = -row * this.formationRowDepth
    }
  }

  private get totalRosterCount(): number {
    return getTotalUnitCount(this.roster)
  }

  private syncSoldierVisuals(): void {
    const target = Math.min(this.totalRosterCount, this.visualCapacity)
    if (this.soldiers.length < target) {
      this.addVisualSoldiers(target - this.soldiers.length)
    }
    if (this.soldiers.length > target) {
      this.removeVisualSoldiers(this.soldiers.length - target)
    }
    const units = this.expandVisualUnits(target)
    for (let index = 0; index < this.soldiers.length; index += 1) {
      const soldier = this.soldiers[index]
      const unit = units[index] ?? UNIT_TYPES.soldier
      if (soldier !== undefined) {
        soldier.unit = unit
        this.applyVisualForUnit(soldier, unit)
      }
    }
  }

  private applyVisualForUnit(soldier: Soldier, unit: UnitType): void {
    const visualKind = this.getVisualKind(unit)
    if (soldier.visualKind !== visualKind) {
      this.setActiveVisual(soldier, visualKind)
    }
    const activeMesh = visualKind === "pangyo" && soldier.pangyoMesh !== null ? soldier.pangyoMesh : soldier.soldierMesh
    applySoldierUnitVisual(activeMesh, unit, UNIT_DEFINITIONS[unit].color)
  }

  private getVisualKind(unit: UnitType): SquadVisualKind {
    if (this.pangyoRunnerAsset?.isReal === true) {
      switch (unit) {
        case UNIT_TYPES.pangyo:
        case UNIT_TYPES.developer:
        case UNIT_TYPES.seniorDeveloper:
        case UNIT_TYPES.unemployed:
        case UNIT_TYPES.ceo:
        case UNIT_TYPES.gamer:
          return "pangyo"
        case UNIT_TYPES.soldier:
        case UNIT_TYPES.officer:
        case UNIT_TYPES.general:
        case UNIT_TYPES.qa:
        case UNIT_TYPES.entrepreneur:
        case UNIT_TYPES.ai:
          return "soldier"
      }
    }
    return "soldier"
  }

  private setActiveVisual(soldier: Soldier, visualKind: SquadVisualKind): void {
    if (visualKind === "pangyo") {
      const pangyoVisual = this.ensurePangyoVisual(soldier)
      if (pangyoVisual === null) {
        this.setActiveVisual(soldier, "soldier")
        return
      }
      soldier.visualKind = "pangyo"
      soldier.soldierMesh.setEnabled(false)
      soldier.soldierRunAnimation?.pause()
      pangyoVisual.mesh.setEnabled(true)
      if (soldier.index < this.maxAnimatedSoldiers) {
        pangyoVisual.runAnimation?.play(true)
      } else {
        pangyoVisual.runAnimation?.pause()
      }
      soldier.runAnimation = pangyoVisual.runAnimation
      return
    }
    soldier.visualKind = "soldier"
    soldier.pangyoMesh?.setEnabled(false)
    soldier.pangyoRunAnimation?.pause()
    soldier.soldierMesh.setEnabled(true)
    if (soldier.index < this.maxAnimatedSoldiers) {
      soldier.soldierRunAnimation?.play(true)
    } else {
      soldier.soldierRunAnimation?.pause()
    }
    soldier.runAnimation = soldier.soldierRunAnimation
  }

  private ensurePangyoVisual(soldier: Soldier): { readonly mesh: Mesh; readonly runAnimation: AnimationGroup | null } | null {
    if (soldier.pangyoMesh !== null) {
      return { mesh: soldier.pangyoMesh, runAnimation: soldier.pangyoRunAnimation }
    }
    const visual = this.createPangyoActorVisual(soldier.index)
    if (visual === null) {
      return null
    }
    visual.mesh.parent = soldier.mesh
    soldier.pangyoMesh = visual.mesh
    soldier.pangyoRunAnimation = visual.runAnimation
    return visual
  }

  private expandVisualUnits(limit: number): readonly UnitType[] {
    const units: UnitType[] = []
    for (const unit of UNIT_ORDER) {
      for (let count = 0; count < this.roster[unit] && units.length < limit; count += 1) {
        units.push(unit)
      }
    }
    return units
  }

  private pickMostCommonUnit(): UnitType | null {
    const candidates = UNIT_ORDER.filter((unit) => this.roster[unit] > 0)
    if (candidates.length === 0) {
      return null
    }
    let bestCount = 0
    for (const unit of candidates) {
      bestCount = Math.max(bestCount, this.roster[unit])
    }
    const tied = candidates.filter((unit) => this.roster[unit] === bestCount)
    return tied[Math.floor(Math.random() * tied.length)] ?? null
  }

  private applyEngineMilestones(): void {
    if (this.promotionTreeEnabled) {
      this.promoteAvailable()
    }
  }

  private promoteDefenseReserve(): { readonly applied: boolean; readonly displaced: boolean } {
    const plan = this.getDefensePromotionPlan()
    if (plan === null) {
      return { applied: false, displaced: false }
    }
    const { branch, refinement } = plan
    this.defenseTieBreakBranch = branch.id === "command" ? "technology" : "command"
    if (refinement !== undefined) {
      this.roster[refinement.source] -= 1
      this.roster[refinement.result] += 1
      this.defensePromotionCount += 1
      this.queueDefensePromotionEvent({
        label: `백수 ${DEFENSE_RESERVE_PROMOTION_COST}명 훈련: ${UNIT_DEFINITIONS[refinement.source].label} → ${UNIT_DEFINITIONS[refinement.result].label}`,
        requirements: [this.createPromotionUnit(refinement.source, 1)],
        result: this.createPromotionUnit(refinement.result, 1),
      })
      this.resolveDefenseTierPromotions()
      return { applied: true, displaced: false }
    }
    let displaced = false
    if (this.totalRosterCount >= this.squadLimit) {
      const displacedUnit = DEFENSE_DISPLACEMENT_ORDER.find((unit) => this.roster[unit] > 0)
      if (displacedUnit !== undefined) {
        this.roster[displacedUnit] -= 1
        this.defenseReserveUnemployed += 1
        displaced = true
      }
    }
    this.roster[branch.baseUnit] += 1
    this.defensePromotionCount += 1
    this.queueDefensePromotionEvent({
      label: `백수 ${DEFENSE_RESERVE_PROMOTION_COST}명 → ${UNIT_DEFINITIONS[branch.baseUnit].label}`,
      requirements: [this.createPromotionUnit(UNIT_TYPES.unemployed, DEFENSE_RESERVE_PROMOTION_COST)],
      result: this.createPromotionUnit(branch.baseUnit, 1),
    })
    this.resolveDefenseTierPromotions()
    return { applied: true, displaced }
  }

  private resolveDefenseTierPromotions(): void {
    let promoted = true
    while (promoted) {
      promoted = false
      for (const rule of DEFENSE_TIER_PROMOTION_RULES) {
        if (this.roster[rule.source] < DEFENSE_TIER_PROMOTION_THRESHOLD) {
          continue
        }
        this.roster[rule.source] -= 1
        this.roster[rule.result] += 1
        this.defensePromotionCount += 1
        this.queueDefensePromotionEvent({
          label: rule.label,
          requirements: [this.createPromotionUnit(rule.source, DEFENSE_TIER_PROMOTION_THRESHOLD)],
          result: this.createPromotionUnit(rule.result, 1),
        })
        promoted = true
      }
    }
  }

  private getNextDefenseBranch(): (typeof DEFENSE_SPECIALIST_BRANCHES)[number] {
    const command = DEFENSE_SPECIALIST_BRANCHES[0]
    const technology = DEFENSE_SPECIALIST_BRANCHES[1]
    const commandCount = this.getDefenseBranchCount(command.units)
    const technologyCount = this.getDefenseBranchCount(technology.units)
    if (commandCount < technologyCount) {
      return command
    }
    if (technologyCount < commandCount) {
      return technology
    }
    return this.defenseTieBreakBranch === "command" ? command : technology
  }

  private getDefensePromotionPlan(): {
    readonly branch: (typeof DEFENSE_SPECIALIST_BRANCHES)[number]
    readonly refinement?: (typeof DEFENSE_TIER_PROMOTION_RULES)[number]
  } | null {
    const preferredBranch = this.getNextDefenseBranch()
    if (this.totalRosterCount < this.squadLimit || this.roster[UNIT_TYPES.soldier] > 0) {
      return { branch: preferredBranch }
    }
    const preferredRefinement = this.getDefenseRefinement(preferredBranch.units)
    if (preferredRefinement !== undefined) {
      return { branch: preferredBranch, refinement: preferredRefinement }
    }
    const alternateBranch = DEFENSE_SPECIALIST_BRANCHES.find((branch) => branch.id !== preferredBranch.id)
    if (alternateBranch === undefined) {
      return null
    }
    const alternateRefinement = this.getDefenseRefinement(alternateBranch.units)
    return alternateRefinement === undefined
      ? null
      : { branch: alternateBranch, refinement: alternateRefinement }
  }

  private getDefenseRefinement(
    units: readonly [UnitType, UnitType, UnitType],
  ): (typeof DEFENSE_TIER_PROMOTION_RULES)[number] | undefined {
    const [base, middle] = units
    const source = this.roster[base] > 0 ? base : this.roster[middle] > 0 ? middle : null
    return source === null
      ? undefined
      : DEFENSE_TIER_PROMOTION_RULES.find((rule) => rule.source === source)
  }

  private queueDefensePromotionEvent(event: SquadPromotionEvent): void {
    while (this.pendingPromotionEvents.length >= MAX_PENDING_DEFENSE_PROMOTION_EVENTS) {
      this.pendingPromotionEvents.shift()
    }
    this.pendingPromotionEvents.push(event)
  }

  private getDefenseBranchCount(units: readonly UnitType[]): number {
    let count = 0
    for (const unit of units) {
      count += this.roster[unit]
    }
    return count
  }

  private applyCeoPromotionBonus(promotedCount: number): void {
    if (promotedCount > 0 && this.getCeoBonusChance() > 0 && Math.random() < this.getCeoBonusChance()) {
      this.addRandomBranchUnit()
    }
  }

  private updateEngineEffects(dt: number): void {
    if (!this.promotionTreeEnabled) {
      return
    }
    this.updateOfficerGeneration(dt)
    this.updateUnemployedEvents(dt)
  }

  private updateOfficerGeneration(dt: number): void {
    const officers = this.roster[UNIT_TYPES.officer]
    if (officers <= 0) {
      this.officerSpawnTimer = 0
      return
    }
    this.officerSpawnTimer += dt
    const interval = this.getOfficerSpawnInterval(officers)
    while (this.officerSpawnTimer >= interval) {
      this.officerSpawnTimer -= interval
      if (this.addUnits(UNIT_TYPES.soldier, 1) <= 0) {
        return
      }
      this.pendingTimedSkillEvents.push({
        label: "장교 지휘",
        message: "장교 지휘: 병사 자동 합류",
        result: this.createPromotionUnit(UNIT_TYPES.soldier, 1),
      })
    }
  }

  private updateUnemployedEvents(dt: number): void {
    if (this.roster[UNIT_TYPES.unemployed] < UNEMPLOYED_EVENT_MIN_COUNT) {
      this.unemployedEventTimer = 0
      return
    }
    this.unemployedEventTimer += dt
    while (this.unemployedEventTimer >= UNEMPLOYED_EVENT_SECONDS) {
      this.unemployedEventTimer -= UNEMPLOYED_EVENT_SECONDS
      this.applyUnemployedEvent()
    }
  }

  private applyUnemployedEvent(): void {
    if (Math.random() >= UNEMPLOYED_EVENT_CHANGE_CHANCE) {
      this.pendingTimedSkillEvents.push({
        label: "백수 변수",
        message: "백수 변수: 변화 없음",
        result: this.createPromotionUnit(UNIT_TYPES.unemployed, 1),
      })
      return
    }
    if (this.roster[UNIT_TYPES.soldier] > 0 && Math.random() < 0.5) {
      this.roster[UNIT_TYPES.soldier] -= 1
      this.roster[UNIT_TYPES.unemployed] += 1
      this.promoteAvailable()
      this.syncSoldierVisuals()
      this.pendingTimedSkillEvents.push({
        label: "백수 변수",
        message: "백수 변수: 병사 1명 전환",
        result: this.createPromotionUnit(UNIT_TYPES.unemployed, 1),
      })
      return
    }
    if (this.roster[UNIT_TYPES.pangyo] > 0) {
      this.roster[UNIT_TYPES.pangyo] -= 1
      this.roster[UNIT_TYPES.unemployed] += 1
      this.promoteAvailable()
      this.syncSoldierVisuals()
      this.pendingTimedSkillEvents.push({
        label: "백수 변수",
        message: "백수 변수: 판교인 1명 전환",
        result: this.createPromotionUnit(UNIT_TYPES.unemployed, 1),
      })
    }
  }

  private createPromotionEvent(event: PromotionResolutionEvent): SquadPromotionEvent {
    return {
      label: event.label,
      requirements: event.requirements.map((requirement) => this.createPromotionUnit(requirement.unit, requirement.count)),
      result: this.createPromotionUnit(event.result, event.resultCount),
    }
  }

  private createPromotionUnit(unit: UnitType, count: number): SquadPromotionUnit {
    const definition = UNIT_DEFINITIONS[unit]
    return {
      label: definition.label,
      count,
      color: definition.color,
      portraitSrc: definition.portraitSrc,
    }
  }

  private getOfficerSpawnInterval(officers: number): number {
    return Math.max(OFFICER_SPAWN_MIN_SECONDS, OFFICER_SPAWN_BASE_SECONDS - Math.max(0, officers - 1) * OFFICER_SPAWN_STEP_SECONDS)
  }

  private getDeveloperSlowMultiplier(): number {
    return Math.max(MIN_DEVELOPER_SLOWDOWN, 1 - this.roster[UNIT_TYPES.developer] * DEVELOPER_SLOWDOWN_PER_UNIT)
  }

  private getSquadRushMultiplier(): number {
    return 1 + Math.max(0, this.totalRosterCount - 1) * SQUAD_RUSH_PER_EXTRA_UNIT
  }

  private getMonsterSpawnMultiplier(effectiveAttackPower: number): number {
    if (effectiveAttackPower < MONSTER_SPAWN_ATTACK_THRESHOLD) {
      return 1
    }
    const steps = Math.floor((effectiveAttackPower - MONSTER_SPAWN_ATTACK_THRESHOLD) / MONSTER_SPAWN_ATTACK_STEP) + 1
    return Math.min(
      MONSTER_SPAWN_ATTACK_MAX_MULTIPLIER,
      1 + steps * MONSTER_SPAWN_ATTACK_STEP_MULTIPLIER,
    )
  }

  private getCeoBonusChance(): number {
    const ceoCount = this.roster[UNIT_TYPES.ceo]
    if (ceoCount <= 0) {
      return 0
    }
    return Math.min(1, CEO_BONUS_BASE_CHANCE + (ceoCount - 1) * CEO_BONUS_STEP_CHANCE)
  }

  private hasCareerChoiceReady(): boolean {
    return this.roster[UNIT_TYPES.pangyo] >= CAREER_CHOICE_PANGYO_COST
  }

  private getCareerChoiceUnit(choice: CareerChoiceKey): UnitType {
    switch (choice) {
      case "military":
        return UNIT_TYPES.soldier
      case "overtime":
        return UNIT_TYPES.developer
      case "fired":
        return UNIT_TYPES.unemployed
    }
  }

  private addRandomBranchUnit(): void {
    const units = [UNIT_TYPES.soldier, UNIT_TYPES.developer, UNIT_TYPES.unemployed] as const
    const unit = units[Math.floor(Math.random() * units.length)] ?? UNIT_TYPES.soldier
    this.addUnits(unit, 1)
  }

  private consumeWeakestUnits(count: number): readonly SquadUnitDelta[] {
    let remaining = count
    const casualties: SquadUnitDelta[] = []
    const damageOrder: readonly UnitType[] = this.defenseProgressionEnabled
      ? DEFENSE_DISPLACEMENT_ORDER
      : [
        UNIT_TYPES.pangyo,
        UNIT_TYPES.unemployed,
        UNIT_TYPES.soldier,
        UNIT_TYPES.developer,
        UNIT_TYPES.gamer,
        UNIT_TYPES.qa,
        UNIT_TYPES.officer,
        UNIT_TYPES.entrepreneur,
        UNIT_TYPES.seniorDeveloper,
        UNIT_TYPES.general,
        UNIT_TYPES.ceo,
        UNIT_TYPES.ai,
      ]
    for (const unit of damageOrder) {
      if (remaining <= 0) {
        return casualties
      }
      const removed = Math.min(this.roster[unit], remaining)
      if (removed > 0) {
        casualties.push({ unit, count: removed })
      }
      this.roster[unit] -= removed
      remaining -= removed
    }
    return casualties
  }

  private getTotalPower(): number {
    let power = 0
    if (this.defenseProgressionEnabled) {
      for (const unit of UNIT_ORDER) {
        const definition = UNIT_DEFINITIONS[unit]
        const defensePower = DEFENSE_UNIT_POWER_OVERRIDES[
          unit as keyof typeof DEFENSE_UNIT_POWER_OVERRIDES
        ]
        power += this.roster[unit] * (defensePower ?? definition.basePower) * this.unitDamageMultipliers[unit]
      }
      return power
    }
    const hasSenior = this.roster[UNIT_TYPES.seniorDeveloper] > 0
    const hasCeo = this.roster[UNIT_TYPES.ceo] > 0
    for (const unit of UNIT_ORDER) {
      const definition = UNIT_DEFINITIONS[unit]
      let unitPower = definition.basePower * this.unitDamageMultipliers[unit]
      if (unit === UNIT_TYPES.gamer && hasSenior) {
        unitPower *= 2
      }
      if (unit === UNIT_TYPES.seniorDeveloper && hasCeo) {
        unitPower *= 2
      }
      if (unit === UNIT_TYPES.officer && hasCeo) {
        unitPower *= 1.5
      }
      if (unit === UNIT_TYPES.general) {
        unitPower += Math.min(4, this.roster[UNIT_TYPES.soldier] * 0.1 + this.roster[UNIT_TYPES.officer] * 0.4)
      }
      power += this.roster[unit] * unitPower
    }
    return power
  }
}
