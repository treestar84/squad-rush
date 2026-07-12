import { StandardMaterial, type Scene } from "@babylonjs/core"
import type { DifficultyProfile } from "../data/difficultyData"
import { GAME_MODE_IDS, type GameModeProfile } from "../data/gameModeData"
import { LEVEL_1 } from "../data/levelData"
import type { MonsterBehavior, MonsterConfig, MonsterKillReason, SpawnPattern } from "../data/monsterData"
import { CONTINUOUS_SPAWN, MONSTER_BEHAVIORS, MONSTER_CONFIGS, MONSTER_KILL_REASONS } from "../data/monsterData"
import {
  applyMonsterProjectileDamage,
  getMonsterContactDamageMultiplier,
  getMonsterDamageAttributionBehavior,
  getMonsterRoleSpeedMultiplier,
  getMonsterSplitChildCount,
  getMonsterSplitChildForwardOffset,
  getMonsterSplitChildLateralOffset,
  getMonsterTargetPriorityMultiplier,
  MONSTER_CHARGE_PHASES,
  previewMonsterProjectileDamage,
  shouldSpawnMonsterSplitChildren,
  updateMonsterRoleState,
} from "../MonsterRoleSystem"
import {
  getAttackCombatRoleSpawnCounts,
  getDefenseCombatRoleSpawnCounts,
} from "../MonsterRoleSchedule"
import {
  DEFENSE_BALANCE_CURVE,
  getDefenseBasicMonsterHp,
  getDefenseBossEffectiveHp,
  getDefenseMonsterMix,
} from "../data/defenseBalanceCurve"
import { MonsterPool, type MonsterInstance } from "../pools/MonsterPool"
import type { MonsterModelAssets } from "../pools/MonsterVisualFactory"
import { getDefenseWaveMultipliers, type DefensePressureState } from "./DefenseWaveTuning"
import type { QualitySettings } from "./QualitySystem"

type SpawnBatch = {
  readonly config: MonsterConfig
  readonly count: number
  readonly maxCount?: number
  readonly pattern: SpawnPattern
  readonly absolute?: boolean
}

type MonsterDebugState = {
  readonly active: number
  readonly authoredVisuals: number
  readonly proceduralFallbackVisuals: number
  readonly midBosses: number
  readonly midBossHpBars: number
  readonly midBossRedHpFills: number
  readonly midBossGrayHpFills: number
  readonly dyingMidBosses: number
  readonly maxMidBossDeathTiltRadians: number
  readonly lowestDyingMidBossScaleYRatio: number
  readonly damagedMidBosses: number
  readonly lowestMidBossHpRatio: number
  readonly largestMidBossHitRadius: number
  readonly largestMidBossHitHalfDepth: number
  readonly lowestMidBossHpBarY: number
  readonly largestMonsterScale: number
  readonly averageAbsX: number
  readonly maxAbsX: number
  readonly nearestDistance: number
  readonly basicBounceAmplitude: number
  readonly tankWaddleAmplitude: number
  readonly tankWaddleRollAmplitude: number
  readonly dyingBasics: number
  readonly dyingRegulars: number
  readonly dyingGrayMonsters: number
  readonly maxDeathFallRadians: number
  readonly spawnProgressZ: number
  readonly spawnDensityMultiplier: number
  readonly endlessSpawnDensityMultiplier: number
  readonly endlessStage: number
  readonly squadPowerSpawnMultiplier: number
  readonly healthMultiplier: number
  readonly maxActivePressure: number
  readonly pressureState: DefensePressureState
  readonly defenseCarpet: {
    readonly columns: number
    readonly rowSpacing: number
    readonly nearDistance: number
    readonly farDistance: number
    readonly occupiedRows: number
    readonly fillRatio: number
  }
  readonly openingGrace: {
    readonly active: boolean
    readonly ramping: boolean
    readonly elapsedSeconds: number
    readonly remainingSeconds: number
  }
  readonly visiblePressureBands: {
    readonly upper: number
    readonly center: number
    readonly bottom: number
  }
  readonly visibleCombatBandDensity: number
  readonly centerPressureBandDensity: number
  readonly bottomBreachProximity: number
  readonly visibleTargetMin: number
  readonly visibleTargetMax: number
  readonly bossSoakShots: number
  readonly bossDamageEvents: number
  readonly bossLowestHpRatio: number
  readonly bossNearestDistance: number
  readonly bossNearestAbsX: number
  readonly bossRearBacklog: number
  readonly monsterConfigCounts: Readonly<Record<string, number>>
  readonly combatRoles: {
    readonly shieldTotal: number
    readonly shielded: number
    readonly visibleShieldCues: number
    readonly lowestShieldRatio: number
    readonly chargerTotal: number
    readonly windingUpChargers: number
    readonly chargingChargers: number
    readonly visibleChargeCues: number
    readonly splitterTotal: number
    readonly splitlingTotal: number
    readonly visibleSplitterCues: number
    readonly splitEvents: number
    readonly splitChildrenSpawned: number
    readonly splitChildrenDropped: number
  }
  readonly bossJamPickupRisk: {
    readonly active: boolean
    readonly centerThreats: number
  }
}

type MonsterWaveUpdate = {
  readonly squadZ: number
  readonly dt: number
  readonly spawnProgressZ?: number
  readonly incomingScrollSpeed?: number
  readonly squadPowerSpawnMultiplier?: number
}

export type EscapedMonsterThreat = {
  readonly count: number
  readonly damage: number
  readonly behavior: MonsterBehavior
}

const MONSTER_BEHAVIOR_ORDER = [
  MONSTER_BEHAVIORS.splitter,
  MONSTER_BEHAVIORS.charger,
  MONSTER_BEHAVIORS.shield,
  MONSTER_BEHAVIORS.tank,
  MONSTER_BEHAVIORS.fast,
  MONSTER_BEHAVIORS.basic,
] as const satisfies readonly MonsterBehavior[]

declare global {
  interface Window {
    __squadRushMonsterDebug?: MonsterDebugState
  }
}

const LANE_X = [-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2] as const
const SIDE_LANE_X = [-4.4, -3.3, -2.2, 2.2, 3.3, 4.4] as const
const HORDE_OFFSET_X = [-4.2, -3.5, -2.8, -2.1, -1.4, -0.7, 0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2] as const
const SWARM_OFFSET_X = [-4.8, -4.2, -3.6, -3, -2.4, -1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 4.8] as const
const DEFENSE_CARPET_X = [-4.55, -3.64, -2.73, -1.82, -0.91, 0, 0.91, 1.82, 2.73, 3.64, 4.55] as const
const DEFENSE_CARPET_ROW_STAGE_SPACING = 0.94
const DEFENSE_CARPET_NEAR_DISTANCE = 6
const DEFENSE_CARPET_SPAWN_BUDGET_PER_FRAME = DEFENSE_CARPET_X.length
const DEFENSE_OPENING_GRACE_SECONDS = 5
const DEFENSE_OPENING_PRESSURE_RAMP_SECONDS = 2
const DEFENSE_OPENING_GRACE_NEAR_DISTANCE = 18
const DEFENSE_OPENING_GRACE_ROW_COUNT = 6
const DEFENSE_OPENING_GRACE_MAX_MONSTERS = DEFENSE_CARPET_X.length * DEFENSE_OPENING_GRACE_ROW_COUNT
const DEFENSE_OPENING_GRACE_MAX_START_Z = 12
const DEFENSE_CROWD_OPENING_FILL_RATIO = 0.9
const DEFENSE_CROWD_FINAL_FILL_RATIO = 0.98
const DEFENSE_BOSS_REAR_OFFSET = 3.8
const DEFENSE_MONSTER_CAPACITY_MULTIPLIER = 1.5
const HORDE_ROW_DEPTH = 0.24
const LINE_ROW_DEPTH = 0.3
const SIDE_ROW_DEPTH = 0.26
const BATCH_LAYER_DEPTH = 0.18
const MEDIUM_LOD_DISTANCE = 24
const FAR_LOD_DISTANCE = 42
const FAR_LOD_EXTRA_SKIP = 3
const DEFENSE_DENSE_LOD_START = 80
const DEFENSE_DENSE_LOD_STEP = 40
const DEFENSE_DENSE_LOD_MAX_EXTRA_SKIP = 6
const DEFENSE_EARLY_BOSS_HP_RATIO = 0.75
const DEFENSE_BOSS_FULL_HP_PROGRESS_RATIO = 0.6
const MEDIUM_LOD_EXTRA_SKIP = 1
const FRAME_ORDINAL_WRAP = 6000
const DEBUG_PUBLISH_INTERVAL_SECONDS = 0.1
const HIT_PULSE_DURATION = 0.12
const HIT_PULSE_WIDE_SCALE = 0.14
const HIT_PULSE_FLAT_SCALE = 0.1
const BASIC_WALK_HOP_RATE = 9.86
const BASIC_WALK_ROOT_BOB_HEIGHT = 0.035
const BASIC_WALK_VISUAL_HOP_HEIGHT = 0.72
const BASIC_WALK_PITCH_RADIANS = 0.16
const BASIC_WALK_ROLL_RADIANS = 0.11
const BASIC_WALK_GROUND_SQUASH = 0.12
const BASIC_WALK_AIR_STRETCH = 0.06
const BASIC_WALK_SHADOW_WIDE_SCALE = 0.28
const BASIC_WALK_SHADOW_NARROW_SCALE = 0.34
const TANK_WADDLE_ROOT_SWAY = 0.11
const TANK_WADDLE_VISUAL_SWAY = 0.24
const TANK_WADDLE_HEIGHT = 0.11
const TANK_WADDLE_TILT_RADIANS = 0.14
const TANK_WADDLE_ROLL_RADIANS = 0.24
const TANK_WADDLE_YAW_RADIANS = 0.12
const TANK_WADDLE_SPEED_MULTIPLIER = 1.64
const MID_BOSS_SPAWN_Z = [96, 116, 136, 156, 176, 196, 216, 236, 256, 276, 296, 316, 336, 356] as const
const DEFENSE_MID_BOSS_SPAWN_Z = [86, 106, 126, 146, 166, 186, 206, 226, 246, 266, 286, 306, 326, 346] as const
const MAX_ACTIVE_PRESSURE_MONSTERS = 360
const INFINITE_ACTIVE_DOGURI_TARGET = 200
const ATTACK_DENSITY_BOOST_PROGRESS = LEVEL_1.totalLength * 0.25
const ATTACK_LATE_DENSITY_MULTIPLIER = 1.34
const ATTACK_SPEED_MULTIPLIER = 1.45
const DEFENSE_BOSS_INTRO_LOCK_PROGRESS_Z = LEVEL_1.totalLength * 0.1
const DEFENSE_SPAWN_LOOKAHEAD = 38
const DEFENSE_MIN_BOSS_BASE_Z = DEFENSE_BOSS_INTRO_LOCK_PROGRESS_Z + DEFENSE_SPAWN_LOOKAHEAD
const DEFENSE_HARD_OPENING_CAP_RAMP_START_RATIO = 0.03
const DEFENSE_HARD_OPENING_CAP_RAMP_END_RATIO = 0.18
const DEFENSE_OPENING_NO_DAMAGE_END_RATIO = 0.22
const DEFENSE_OPENING_DAMAGE_CAP_END_RATIO = 0.36
const DEFENSE_OPENING_MAX_ESCAPED_DAMAGE = 1
const DEFENSE_HARD_OPENING_SPEED_MULTIPLIER = 0.8
const ENDLESS_ATTACK_OPENING_ACTIVE_CAP = 58
const ENDLESS_ATTACK_OPENING_CAP_RAMP_START_RATIO = 0.08
const ENDLESS_ATTACK_OPENING_CAP_RAMP_END_RATIO = 0.28
const ENDLESS_OPENING_SPAWN_RELIEF_MULTIPLIER = 0.68
const ENDLESS_DEFENSE_OPENING_SPAWN_RELIEF_MULTIPLIER = 0.25
const ENDLESS_DEFENSE_BASIC_ONLY_END_RATIO = 0.24
const ENDLESS_OPENING_SPAWN_RELIEF_START_RATIO = 0.08
const ENDLESS_OPENING_SPAWN_RELIEF_END_RATIO = 0.24
const DIFFICULTY_BUILDUP_GRACE_PROGRESS_RATIO = 0.1
const DIFFICULTY_BUILDUP_RAMP_END_PROGRESS_RATIO = 0.46
const ATTACK_OPENING_ACTIVE_CAP = 96
const ATTACK_OPENING_CAP_RAMP_START_RATIO = 0.06
const ATTACK_OPENING_CAP_RAMP_END_RATIO = 0.22
const BREACH_LINE_BACK_BUFFER = 1.2
const CENTER_CONVERGE_DISTANCE = 70
const CENTER_CONVERGE_MIN_RETAIN = 0.42
const STALE_SPAWN_BACK_DISTANCE = 8
const BASIC_DEATH_DURATION = 0.46
const BASIC_DEATH_FALL_ROTATION = Math.PI * 0.48
const BASIC_DEATH_FORWARD_ROTATION = Math.PI * 0.12
const BASIC_DEATH_SINK_DISTANCE = 0.08
const BASIC_DEATH_SQUASH = 0.18
const MID_BOSS_DEATH_DURATION = 0.46
const MID_BOSS_DEATH_FALL_PROGRESS = 0.72
const MID_BOSS_DEATH_SINK_DISTANCE = 0.08
const MID_BOSS_DEATH_ROLL_RADIANS = 0.42
const DEBUG_UPPER_BAND_MIN = 26
const DEBUG_UPPER_BAND_MAX = 32
const DEBUG_CENTER_BAND_MIN = 10
const DEBUG_CENTER_BAND_MAX = 26
const DEBUG_BOTTOM_BAND_MAX = 10
const DEBUG_BOSS_BACKLOG_DEPTH = 12
const DEBUG_BOSS_FIRE_RANGE = 42
const MAX_ACTIVE_ATTACK_MID_BOSSES = 2
const MAX_ACTIVE_DEFENSE_MID_BOSSES = 1
const DEFENSE_ORANGE_INTRO_Z = 86
const DEFENSE_HEAVY_ORANGE_INTRO_Z = 250
const DEFENSE_SQUAD_POWER_HEALTH_SCALE = 0.85
const DEFENSE_SQUAD_POWER_BOSS_HEALTH_SCALE = 1.15
const ATTACK_SQUAD_POWER_HEALTH_SCALE = 1.15
const ENDLESS_STAGE_LENGTH_Z = 86
const ENDLESS_MID_BOSS_INTERVAL_Z = 18.3
const ENDLESS_PRESSURE_STEP = 0.09
const ENDLESS_SPAWN_DENSITY_STEP = 0.08
const ENDLESS_HEALTH_STEP = 0.2
const ENDLESS_HEALTH_CHECKPOINT_STEP = 0.18
const ENDLESS_DAMAGE_STEP = 0.035
const ENDLESS_SPEED_STEP = 0.012
const SQUAD_POWER_HEALTH_RAMP_START_RATIO = 0.25
const SQUAD_POWER_HEALTH_RAMP_END_RATIO = 0.62
const SPLITTER_CHILD_POOL_RESERVE = 16
const SPLITTER_CHILD_LIVE_OVERFLOW = 4
const SPLITTER_CHILD_TRACK_HALF_WIDTH = LEVEL_1.trackWidth * 0.5 - 0.25

export class MonsterWaveSystem {
  private readonly pool: MonsterPool
  private readonly monsterCapacity: number
  private nextSpawnZ = CONTINUOUS_SPAWN.startZ
  private spawnOrdinal = 0
  private frameOrdinal = 0
  private escapedSinceLastConsume = 0
  private escapedDamageSinceLastConsume = 0
  private readonly escapedDamageByBehavior: Record<MonsterBehavior, number> = {
    [MONSTER_BEHAVIORS.basic]: 0,
    [MONSTER_BEHAVIORS.fast]: 0,
    [MONSTER_BEHAVIORS.shield]: 0,
    [MONSTER_BEHAVIORS.charger]: 0,
    [MONSTER_BEHAVIORS.splitter]: 0,
    [MONSTER_BEHAVIORS.tank]: 0,
  }
  private readonly escapedThreatSnapshot = {
    count: 0,
    damage: 0,
    behavior: MONSTER_BEHAVIORS.basic as MonsterBehavior,
  }
  private spawnProgressZ = 0
  private squadPowerSpawnMultiplier = 1
  private bossSoakShots = 0
  private bossDamageEvents = 0
  private splitEvents = 0
  private splitChildrenSpawned = 0
  private splitChildrenDropped = 0
  private defenseCarpetPrimed = false
  private defenseOpeningGraceEnabled = false
  private defenseElapsedSeconds = 0
  private defenseGraceLastSpawnZ = Number.NEGATIVE_INFINITY
  private currentSquadZ = 10
  private readonly aliveCache: MonsterInstance[] = []
  private readonly debugEnabled = window.location.search.includes("qa=monsters")
  private debugPublishCooldown = 0
  private shieldWarningAnnounced = false
  private chargerWarningAnnounced = false
  private splitterWarningAnnounced = false
  onRoleWarning?: (behavior: MonsterBehavior) => void

  constructor(
    scene: Scene,
    monsterAssets: MonsterModelAssets | null,
    private readonly quality: QualitySettings,
    private readonly difficulty: DifficultyProfile,
    private readonly mode: GameModeProfile,
  ) {
    this.monsterCapacity = mode.id === GAME_MODE_IDS.defense
      ? Math.min(MAX_ACTIVE_PRESSURE_MONSTERS, Math.round(quality.maxMonsters * DEFENSE_MONSTER_CAPACITY_MULTIPLIER))
      : quality.maxMonsters
    this.pool = new MonsterPool(scene, monsterAssets, this.monsterCapacity + SPLITTER_CHILD_POOL_RESERVE, {
      hordeContactShadows: false,
      compactHordeVisuals: true,
    })
  }

  update(params: MonsterWaveUpdate): void {
    const { squadZ, dt } = params
    const spawnProgressZ = params.spawnProgressZ ?? squadZ
    const incomingScrollSpeed = this.getIncomingScrollSpeed(params.incomingScrollSpeed ?? 0, spawnProgressZ)
    this.frameOrdinal = (this.frameOrdinal + 1) % FRAME_ORDINAL_WRAP
    this.spawnProgressZ = spawnProgressZ
    this.currentSquadZ = squadZ
    this.squadPowerSpawnMultiplier = params.squadPowerSpawnMultiplier ?? 1
    this.primeDefenseCarpet(spawnProgressZ)
    if (this.defenseOpeningGraceEnabled) {
      this.defenseElapsedSeconds += dt
    }
    this.skipStaleSpawnGroups(this.mode.id === GAME_MODE_IDS.defense ? spawnProgressZ : squadZ)
    let spawnBudget = this.mode.id === GAME_MODE_IDS.defense
      ? DEFENSE_CARPET_SPAWN_BUDGET_PER_FRAME
      : Number.POSITIVE_INFINITY
    while (spawnBudget > 0 && this.canSpawnAhead(spawnProgressZ)) {
      const spawned = this.spawnContinuousGroup(this.nextSpawnZ, this.spawnOrdinal, spawnBudget)
      this.nextSpawnZ += this.getSpawnSpacing()
      this.spawnOrdinal += 1
      spawnBudget -= spawned
    }

    const active = this.pool.getActive()
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const monster = active[index]
      if (monster === undefined) {
        continue
      }
      if (!monster.alive) {
        this.updateDeathAnimation(monster, dt, incomingScrollSpeed)
        continue
      }
      const distanceAhead = monster.mesh.position.z - squadZ
      this.updateHitPulse(monster, dt)
      this.updateCombatRole(monster, distanceAhead, dt)
      if (this.shouldAnimateMonster(monster, distanceAhead)) {
        monster.swayPhase += monster.swaySpeed * dt
        this.applyWalkMotion(monster, distanceAhead)
      }
      monster.mesh.position.z += (monster.velocityZ - incomingScrollSpeed) * dt
      if (this.hasCrossedSquadLine(monster, squadZ)) {
        this.registerEscapedMonster(monster)
      }
    }
    this.rebuildAliveCache()
    this.updateDebugState(squadZ, dt)
  }

  markHit(monster: MonsterInstance): void {
    if (!monster.alive) {
      return
    }
    monster.hitPulse = HIT_PULSE_DURATION
    if (monster.config?.behavior === MONSTER_BEHAVIORS.tank) {
      this.bossSoakShots += 1
      this.bossDamageEvents += 1
    }
    this.pool.updateHpBar(monster)
  }

  previewProjectileDamage(monster: MonsterInstance, damage: number): number {
    const config = monster.config
    return config === null
      ? Math.max(0, damage)
      : previewMonsterProjectileDamage(monster.roleState, config, damage)
  }

  resolveProjectileDamage(monster: MonsterInstance, damage: number): number {
    const config = monster.config
    if (config === null) {
      return Math.max(0, damage)
    }
    const shieldHpBefore = monster.roleState.shieldHp
    const resolvedDamage = applyMonsterProjectileDamage(monster.roleState, config, damage)
    if (monster.roleState.shieldHp !== shieldHpBefore) {
      this.pool.updateRoleCue(monster)
    }
    return resolvedDamage
  }

  getTargetPriorityMultiplier(monster: MonsterInstance): number {
    const config = monster.config
    return config === null ? 1 : getMonsterTargetPriorityMultiplier(monster.roleState, config)
  }

  getMonsterContactDamage(monster: MonsterInstance): number {
    const config = monster.config
    if (config === null) {
      return 1
    }
    return Math.max(1, Math.ceil(
      config.damage * getMonsterContactDamageMultiplier(monster.roleState, config),
    ))
  }

  getMonsterDamageBehavior(monster: MonsterInstance): MonsterBehavior {
    return getMonsterDamageAttributionBehavior(monster.config)
  }

  kill(
    monster: MonsterInstance,
    reason: MonsterKillReason = MONSTER_KILL_REASONS.projectile,
  ): void {
    if (!monster.alive) {
      return
    }
    const config = monster.config
    monster.alive = false
    monster.hp = 0
    monster.hitPulse = 0
    this.pool.updateHpBar(monster)
    this.pool.updateRoleCue(monster)
    if (
      config !== null
      && shouldSpawnMonsterSplitChildren(config, reason === MONSTER_KILL_REASONS.projectile)
    ) {
      this.spawnSplitterChildren(monster, config)
    }
    if (config?.behavior === MONSTER_BEHAVIORS.tank) {
      monster.deathDuration = MID_BOSS_DEATH_DURATION
      monster.deathTimer = MID_BOSS_DEATH_DURATION
      monster.deathStartY = monster.mesh.position.y
      monster.deathFallDirection = 1
      this.pool.applyDeathMaterial(monster)
      return
    }
    monster.deathDuration = BASIC_DEATH_DURATION
    monster.deathTimer = BASIC_DEATH_DURATION
    monster.deathStartY = monster.mesh.position.y
    monster.deathFallDirection = monster.mesh.position.x < monster.originX ? -1 : 1
    this.pool.applyDeathMaterial(monster)
  }

  getAlive(): readonly MonsterInstance[] {
    return this.aliveCache
  }

  aliveCount(): number {
    return this.pool.activeCount()
  }

  consumeEscapedCount(): number {
    const count = this.escapedSinceLastConsume
    this.escapedSinceLastConsume = 0
    return count
  }

  consumeEscapedDamage(): number {
    const damage = this.escapedDamageSinceLastConsume
    this.escapedDamageSinceLastConsume = 0
    const resolvedDamage = this.resolveIncomingDamage(damage)
    this.resetEscapedBehaviorDamage()
    return resolvedDamage
  }

  consumeEscapedThreat(): EscapedMonsterThreat {
    let behavior: MonsterBehavior = MONSTER_BEHAVIORS.basic
    let dominantDamage = 0
    for (const candidate of MONSTER_BEHAVIOR_ORDER) {
      const candidateDamage = this.escapedDamageByBehavior[candidate]
      if (candidateDamage > dominantDamage) {
        dominantDamage = candidateDamage
        behavior = candidate
      }
    }
    this.escapedThreatSnapshot.count = this.escapedSinceLastConsume
    this.escapedThreatSnapshot.damage = this.resolveIncomingDamage(this.escapedDamageSinceLastConsume)
    this.escapedThreatSnapshot.behavior = behavior
    this.escapedSinceLastConsume = 0
    this.escapedDamageSinceLastConsume = 0
    this.resetEscapedBehaviorDamage()
    return this.escapedThreatSnapshot
  }

  resolveIncomingDamage(damage: number): number {
    if (this.mode.id !== GAME_MODE_IDS.defense || this.difficulty.endless) {
      return damage
    }
    const progressRatio = this.getStageProgressRatio(this.spawnProgressZ)
    if (progressRatio < DEFENSE_OPENING_NO_DAMAGE_END_RATIO) {
      return 0
    }
    if (progressRatio < DEFENSE_OPENING_DAMAGE_CAP_END_RATIO) {
      return Math.min(damage, DEFENSE_OPENING_MAX_ESCAPED_DAMAGE)
    }
    return damage
  }

  private registerEscapedMonster(monster: MonsterInstance): void {
    const behavior = this.getMonsterDamageBehavior(monster)
    const damage = this.getMonsterContactDamage(monster)
    this.escapedSinceLastConsume += 1
    this.escapedDamageSinceLastConsume += damage
    this.escapedDamageByBehavior[behavior] += damage
    this.kill(monster, MONSTER_KILL_REASONS.escaped)
  }

  private spawnSplitterChildren(parent: MonsterInstance, parentConfig: MonsterConfig): void {
    const split = parentConfig.role?.split
    const childCount = getMonsterSplitChildCount(parentConfig)
    if (split === undefined || childCount <= 0) {
      return
    }
    if (!this.splitterWarningAnnounced) {
      this.splitterWarningAnnounced = true
      this.onRoleWarning?.(MONSTER_BEHAVIORS.splitter)
    }
    this.splitEvents += 1
    const childConfig = this.scaleConfig(MONSTER_CONFIGS.splitling, this.spawnProgressZ)
    const forwardOffset = getMonsterSplitChildForwardOffset(parentConfig)
    let availableAliveSlots = Math.max(
      0,
      this.monsterCapacity + SPLITTER_CHILD_LIVE_OVERFLOW - this.countAlivePoolMonsters(),
    )
    for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
      if (availableAliveSlots <= 0) {
        this.splitChildrenDropped += 1
        continue
      }
      const x = Math.max(
        -SPLITTER_CHILD_TRACK_HALF_WIDTH,
        Math.min(
          SPLITTER_CHILD_TRACK_HALF_WIDTH,
          parent.mesh.position.x + getMonsterSplitChildLateralOffset(parentConfig, childIndex),
        ),
      )
      const z = parent.mesh.position.z + forwardOffset + childIndex * 0.04
      if (this.pool.spawn(childConfig, x, z) === null) {
        this.splitChildrenDropped += 1
      } else {
        this.splitChildrenSpawned += 1
        availableAliveSlots -= 1
      }
    }
  }

  private countAlivePoolMonsters(): number {
    let alive = 0
    for (const monster of this.pool.getActive()) {
      if (monster.alive) {
        alive += 1
      }
    }
    return alive
  }

  private resetEscapedBehaviorDamage(): void {
    for (const behavior of MONSTER_BEHAVIOR_ORDER) {
      this.escapedDamageByBehavior[behavior] = 0
    }
  }

  private hasCrossedSquadLine(monster: MonsterInstance, squadZ: number): boolean {
    return monster.mesh.position.z + monster.hitHalfDepth < squadZ - BREACH_LINE_BACK_BUFFER
  }

  private canSpawnAhead(spawnProgressZ: number): boolean {
    if (
      this.isDefenseOpeningGraceActive()
      && this.nextSpawnZ > this.defenseGraceLastSpawnZ + 0.001
    ) {
      return false
    }
    return (this.difficulty.endless || this.nextSpawnZ <= this.getContinuousSpawnEndZ())
      && spawnProgressZ + this.getSpawnLookAhead() >= this.nextSpawnZ
      && this.pool.activeCount() < this.maxActivePressure
  }

  private primeDefenseCarpet(spawnProgressZ: number): void {
    if (this.mode.id !== GAME_MODE_IDS.defense || this.defenseCarpetPrimed) {
      return
    }
    this.defenseCarpetPrimed = true
    this.defenseOpeningGraceEnabled = this.currentSquadZ <= DEFENSE_OPENING_GRACE_MAX_START_Z
    const openingNearDistance = this.defenseOpeningGraceEnabled
      ? DEFENSE_OPENING_GRACE_NEAR_DISTANCE
      : DEFENSE_CARPET_NEAR_DISTANCE
    this.nextSpawnZ = spawnProgressZ + openingNearDistance
    this.defenseGraceLastSpawnZ = this.nextSpawnZ
      + (DEFENSE_OPENING_GRACE_ROW_COUNT - 1) * DEFENSE_CARPET_ROW_STAGE_SPACING
    this.spawnOrdinal = Math.max(0, Math.floor(this.nextSpawnZ / DEFENSE_CARPET_ROW_STAGE_SPACING))
  }

  private getSpawnSpacing(): number {
    return this.mode.id === GAME_MODE_IDS.defense
      ? DEFENSE_CARPET_ROW_STAGE_SPACING
      : CONTINUOUS_SPAWN.spacing
  }

  private getSpawnLookAhead(): number {
    if (this.mode.id === GAME_MODE_IDS.defense) {
      return this.getDefenseSpawnLookAhead()
    }
    return CONTINUOUS_SPAWN.lookAhead
  }

  private getDefenseSpawnLookAhead(): number {
    return DEFENSE_SPAWN_LOOKAHEAD
  }

  private skipStaleSpawnGroups(referenceZ: number): void {
    const staleThreshold = this.mode.id === GAME_MODE_IDS.defense
      ? referenceZ + DEFENSE_CARPET_NEAR_DISTANCE
      : referenceZ - STALE_SPAWN_BACK_DISTANCE
    while (this.nextSpawnZ < staleThreshold) {
      this.nextSpawnZ += this.getSpawnSpacing()
      this.spawnOrdinal += 1
    }
  }

  private get maxActivePressure(): number {
    if (this.mode.id === GAME_MODE_IDS.defense) {
      const tuning = getDefenseWaveMultipliers(this.mode, this.difficulty, this.spawnProgressZ)
      const rawPressure = Math.round(
        Math.max(tuning.pressure, tuning.visibleTargetMax)
        * this.squadPowerSpawnMultiplier
        * this.getEndlessDefenseInfluxMultiplier(this.spawnProgressZ),
      )
      const pressureTarget = Math.min(
        this.monsterCapacity,
        MAX_ACTIVE_PRESSURE_MONSTERS,
        Math.max(rawPressure, this.getDefenseCrowdTarget(this.spawnProgressZ)),
      )
      return this.getDefenseOpeningPressureCap(pressureTarget)
    }
    const basePressure = Math.min(
      this.monsterCapacity,
      Math.round(
        MAX_ACTIVE_PRESSURE_MONSTERS
        * this.getDifficultyPressureMultiplier(this.spawnProgressZ)
        * this.mode.monsterPressureMultiplier
        * this.squadPowerSpawnMultiplier
        * this.getPressureMultiplier(this.spawnProgressZ)
        * this.getEndlessPressureMultiplier(this.spawnProgressZ),
      ),
    )
    const pressureTarget = this.getInfiniteActivePressureTarget(basePressure)
    return Math.min(pressureTarget, this.getAttackOpeningActiveCap(pressureTarget))
  }

  private getDefenseCrowdTarget(progressZ: number): number {
    const progressRatio = this.getStageProgressRatio(progressZ)
    const eased = progressRatio * progressRatio * (3 - 2 * progressRatio)
    const fillRatio = DEFENSE_CROWD_OPENING_FILL_RATIO
      + (DEFENSE_CROWD_FINAL_FILL_RATIO - DEFENSE_CROWD_OPENING_FILL_RATIO) * eased
    return Math.round(Math.min(this.monsterCapacity, MAX_ACTIVE_PRESSURE_MONSTERS) * fillRatio)
  }

  private getDefenseOpeningPressureCap(pressureTarget: number): number {
    if (!this.defenseOpeningGraceEnabled) {
      return pressureTarget
    }
    const openingTarget = Math.min(pressureTarget, DEFENSE_OPENING_GRACE_MAX_MONSTERS)
    if (this.defenseElapsedSeconds <= DEFENSE_OPENING_GRACE_SECONDS) {
      return openingTarget
    }
    const ramp = Math.min(
      1,
      (this.defenseElapsedSeconds - DEFENSE_OPENING_GRACE_SECONDS)
        / DEFENSE_OPENING_PRESSURE_RAMP_SECONDS,
    )
    const eased = ramp * ramp * (3 - 2 * ramp)
    return Math.round(openingTarget + (pressureTarget - openingTarget) * eased)
  }

  private isDefenseOpeningGraceActive(): boolean {
    return this.mode.id === GAME_MODE_IDS.defense
      && this.defenseOpeningGraceEnabled
      && this.defenseElapsedSeconds < DEFENSE_OPENING_GRACE_SECONDS
  }

  private rebuildAliveCache(): void {
    this.aliveCache.length = 0
    for (const monster of this.pool.getActive()) {
      if (monster.alive) {
        this.aliveCache.push(monster)
      }
    }
  }

  private getInfiniteActivePressureTarget(basePressure: number): number {
    if (!this.difficulty.endless) {
      return basePressure
    }
    return Math.min(this.monsterCapacity, INFINITE_ACTIVE_DOGURI_TARGET)
  }

  private getIncomingScrollSpeed(baseSpeed: number, progressZ: number): number {
    if (this.mode.id !== GAME_MODE_IDS.defense || this.difficulty.id !== "hard" || this.difficulty.endless) {
      return baseSpeed
    }
    const openingProgress = this.getRatioRampProgress(
      progressZ,
      DEFENSE_HARD_OPENING_CAP_RAMP_START_RATIO,
      DEFENSE_HARD_OPENING_CAP_RAMP_END_RATIO,
    )
    const multiplier = DEFENSE_HARD_OPENING_SPEED_MULTIPLIER
      + (1 - DEFENSE_HARD_OPENING_SPEED_MULTIPLIER) * openingProgress
    return baseSpeed * multiplier
  }

  private getRatioRampProgress(progressZ: number, startRatio: number, endRatio: number): number {
    const stageRatio = this.getStageProgressRatio(progressZ)
    if (stageRatio <= startRatio) {
      return 0
    }
    if (stageRatio >= endRatio) {
      return 1
    }
    const linear = (stageRatio - startRatio) / (endRatio - startRatio)
    return linear * linear * (3 - 2 * linear)
  }

  private getAttackOpeningActiveCap(pressureTarget: number): number {
    if (this.difficulty.endless) {
      return this.getEndlessAttackOpeningActiveCap(pressureTarget)
    }
    const ratio = this.getStageProgressRatio(this.spawnProgressZ)
    if (ratio <= ATTACK_OPENING_CAP_RAMP_START_RATIO) {
      return Math.min(pressureTarget, ATTACK_OPENING_ACTIVE_CAP)
    }
    if (ratio >= ATTACK_OPENING_CAP_RAMP_END_RATIO) {
      return pressureTarget
    }
    const progress = (ratio - ATTACK_OPENING_CAP_RAMP_START_RATIO)
      / (ATTACK_OPENING_CAP_RAMP_END_RATIO - ATTACK_OPENING_CAP_RAMP_START_RATIO)
    return Math.round(ATTACK_OPENING_ACTIVE_CAP + (pressureTarget - ATTACK_OPENING_ACTIVE_CAP) * progress)
  }

  private getEndlessAttackOpeningActiveCap(pressureTarget: number): number {
    const ratio = this.getStageProgressRatio(this.spawnProgressZ)
    if (ratio <= ENDLESS_ATTACK_OPENING_CAP_RAMP_START_RATIO) {
      return Math.min(pressureTarget, ENDLESS_ATTACK_OPENING_ACTIVE_CAP)
    }
    if (ratio >= ENDLESS_ATTACK_OPENING_CAP_RAMP_END_RATIO) {
      return pressureTarget
    }
    const progress = (ratio - ENDLESS_ATTACK_OPENING_CAP_RAMP_START_RATIO)
      / (ENDLESS_ATTACK_OPENING_CAP_RAMP_END_RATIO - ENDLESS_ATTACK_OPENING_CAP_RAMP_START_RATIO)
    const eased = progress * progress * (3 - 2 * progress)
    return Math.round(ENDLESS_ATTACK_OPENING_ACTIVE_CAP + (pressureTarget - ENDLESS_ATTACK_OPENING_ACTIVE_CAP) * eased)
  }

  private getContinuousSpawnEndZ(): number {
    return CONTINUOUS_SPAWN.endZ * this.getStageDurationMultiplier()
  }

  private getStageDurationMultiplier(): number {
    if (this.difficulty.endless) {
      return 1
    }
    return this.difficulty.stageDurationMultiplier
  }

  private getStageCurveProgressZ(progressZ: number): number {
    return progressZ / this.getStageDurationMultiplier()
  }

  private getDefenseDifficultyRamp(progressZ: number): number {
    const stageRatio = this.getStageProgressRatio(progressZ)
    const rampLength = DIFFICULTY_BUILDUP_RAMP_END_PROGRESS_RATIO - DIFFICULTY_BUILDUP_GRACE_PROGRESS_RATIO
    const linear = Math.max(0, Math.min(1, (stageRatio - DIFFICULTY_BUILDUP_GRACE_PROGRESS_RATIO) / rampLength))
    return linear * linear * (3 - 2 * linear)
  }

  private getStageProgressRatio(progressZ: number): number {
    return Math.max(0, Math.min(1, this.getStageCurveProgressZ(progressZ) / LEVEL_1.totalLength))
  }

  private shouldAnimateMonster(monster: MonsterInstance, distanceAhead: number): boolean {
    const skipRate = this.getLodSkipRate(monster, distanceAhead)
    return skipRate === 0 || this.frameOrdinal % (skipRate + 1) === 0
  }

  private getLodSkipRate(monster: MonsterInstance, distanceAhead: number): number {
    const config = monster.config
    if (config?.behavior === MONSTER_CONFIGS.tank.behavior) {
      return 0
    }

    const distanceSkip = distanceAhead > FAR_LOD_DISTANCE ? FAR_LOD_EXTRA_SKIP : MEDIUM_LOD_EXTRA_SKIP
    const denseDefenseSkip = this.getDenseDefenseLodSkip()
    if (denseDefenseSkip > 0) {
      const proximityRelief = distanceAhead < 8
        ? denseDefenseSkip
        : distanceAhead < 14
          ? 4
          : distanceAhead < MEDIUM_LOD_DISTANCE
            ? 2
            : 0
      const resolvedDenseSkip = Math.max(0, denseDefenseSkip - proximityRelief)
      if (resolvedDenseSkip > 0) {
        return this.quality.animationSkipRate + distanceSkip + resolvedDenseSkip
      }
    }
    if (distanceAhead < MEDIUM_LOD_DISTANCE) {
      return 0
    }
    return this.quality.animationSkipRate + distanceSkip
  }

  private getDenseDefenseLodSkip(): number {
    if (this.mode.id !== GAME_MODE_IDS.defense) {
      return 0
    }
    const activeOverBudget = this.pool.activeCount() - DEFENSE_DENSE_LOD_START
    if (activeOverBudget <= 0) {
      return 0
    }
    return Math.min(DEFENSE_DENSE_LOD_MAX_EXTRA_SKIP, Math.ceil(activeOverBudget / DEFENSE_DENSE_LOD_STEP))
  }

  private updateHitPulse(monster: MonsterInstance, dt: number): void {
    if (monster.hitPulse <= 0) {
      if (
        monster.mesh.scaling.x !== monster.variantScale
        || monster.mesh.scaling.y !== monster.variantScale
        || monster.mesh.scaling.z !== monster.variantScale
      ) {
        monster.mesh.scaling.setAll(monster.variantScale)
      }
      return
    }

    monster.hitPulse = Math.max(0, monster.hitPulse - dt)
    const pulse = monster.hitPulse / HIT_PULSE_DURATION
    monster.mesh.scaling.set(
      monster.variantScale * (1 + pulse * HIT_PULSE_WIDE_SCALE),
      monster.variantScale * (1 - pulse * HIT_PULSE_FLAT_SCALE),
      monster.variantScale * (1 + pulse * HIT_PULSE_WIDE_SCALE * 0.65),
    )
  }

  private applyWalkMotion(monster: MonsterInstance, distanceAhead: number): void {
    const centerPull = this.getCenterPull(distanceAhead)
    const baseX = monster.originX * centerPull
    if (monster.config?.behavior === MONSTER_BEHAVIORS.tank) {
      this.applyTankWaddle(monster, baseX)
      return
    }

    this.applyBasicHop(monster, baseX)
  }

  private updateCombatRole(monster: MonsterInstance, distanceAhead: number, dt: number): void {
    const config = monster.config
    if (config?.role === undefined) {
      return
    }
    const previousChargePhase = monster.roleState.chargePhase
    updateMonsterRoleState(monster.roleState, config, distanceAhead, dt)
    monster.velocityZ = -config.speed * getMonsterRoleSpeedMultiplier(monster.roleState, config)
    this.pool.updateRoleCue(monster)
    if (
      config.behavior === MONSTER_BEHAVIORS.shield
      && !this.shieldWarningAnnounced
      && monster.roleState.shieldHp > 0
      && distanceAhead <= 18
    ) {
      this.shieldWarningAnnounced = true
      this.onRoleWarning?.(config.behavior)
    }
    if (
      config.behavior === MONSTER_BEHAVIORS.charger
      && !this.chargerWarningAnnounced
      && previousChargePhase === MONSTER_CHARGE_PHASES.approach
      && monster.roleState.chargePhase === MONSTER_CHARGE_PHASES.windup
    ) {
      this.chargerWarningAnnounced = true
      this.onRoleWarning?.(config.behavior)
    }
    if (
      config.behavior === MONSTER_BEHAVIORS.splitter
      && !this.splitterWarningAnnounced
      && distanceAhead <= 20
    ) {
      this.splitterWarningAnnounced = true
      this.onRoleWarning?.(config.behavior)
    }
  }

  private applyBasicHop(monster: MonsterInstance, baseX: number): void {
    const visual = monster.visualMotionRoot
    const shadow = monster.contactShadow
    const lateral = Math.sin(monster.swayPhase) * monster.swayAmplitude
    const stride = monster.swayPhase * BASIC_WALK_HOP_RATE
    const lift = (1 - Math.cos(stride)) * 0.5
    const groundSquash = (1 - lift) ** 2
    const rootBob = lift * BASIC_WALK_ROOT_BOB_HEIGHT * monster.variantScale
    const visualHop = lift * BASIC_WALK_VISUAL_HOP_HEIGHT
    monster.mesh.position.x = baseX + lateral
    monster.mesh.position.y = monster.baseY + rootBob
    monster.mesh.rotation.x = Math.sin(stride) * BASIC_WALK_PITCH_RADIANS * 0.35
    monster.mesh.rotation.y = monster.baseRotationY + Math.sin(monster.swayPhase) * 0.045
    monster.mesh.rotation.z = Math.sin(monster.swayPhase) * BASIC_WALK_ROLL_RADIANS * 0.35
    if (visual !== null) {
      visual.position.x = Math.sin(monster.swayPhase + Math.PI * 0.18) * 0.04
      visual.position.y = visualHop
      visual.rotation.x = Math.sin(stride) * BASIC_WALK_PITCH_RADIANS
      visual.rotation.y = Math.sin(monster.swayPhase) * 0.035
      visual.rotation.z = Math.sin(monster.swayPhase) * BASIC_WALK_ROLL_RADIANS
      visual.scaling.set(
        1 + groundSquash * BASIC_WALK_GROUND_SQUASH,
        1 - groundSquash * BASIC_WALK_GROUND_SQUASH + lift * BASIC_WALK_AIR_STRETCH,
        1 + groundSquash * BASIC_WALK_GROUND_SQUASH * 0.6,
      )
    }
    if (shadow !== null) {
      shadow.scaling.set(
        1.25 + groundSquash * BASIC_WALK_SHADOW_WIDE_SCALE - lift * BASIC_WALK_SHADOW_NARROW_SCALE,
        0.7 + groundSquash * BASIC_WALK_SHADOW_WIDE_SCALE * 0.42 - lift * BASIC_WALK_SHADOW_NARROW_SCALE * 0.36,
        1,
      )
    }
    monster.lastBounceOffsetY = rootBob + visualHop * monster.variantScale
    monster.lastWaddleTiltRadians = 0
    monster.lastWaddleRollRadians = 0
  }

  private applyTankWaddle(monster: MonsterInstance, baseX: number): void {
    const visual = monster.visualMotionRoot
    const phase = monster.swayPhase * TANK_WADDLE_SPEED_MULTIPLIER
    const waddle = Math.sin(phase)
    const step = Math.abs(Math.sin(phase))
    const tilt = Math.sin(phase * 2) * TANK_WADDLE_TILT_RADIANS
    const roll = waddle * TANK_WADDLE_ROLL_RADIANS
    monster.mesh.position.x = baseX + waddle * TANK_WADDLE_ROOT_SWAY
    monster.mesh.position.y = monster.baseY + step * TANK_WADDLE_HEIGHT * monster.variantScale * 0.35
    monster.mesh.rotation.x = tilt * 0.45
    monster.mesh.rotation.y = monster.baseRotationY + waddle * TANK_WADDLE_YAW_RADIANS * 0.45
    monster.mesh.rotation.z = roll * 0.4
    if (visual !== null) {
      visual.position.x = waddle * TANK_WADDLE_VISUAL_SWAY
      visual.position.y = step * TANK_WADDLE_HEIGHT
      visual.rotation.x = tilt
      visual.rotation.y = waddle * TANK_WADDLE_YAW_RADIANS
      visual.rotation.z = roll
      visual.scaling.set(
        1 + step * 0.025,
        1 - step * 0.018,
        1 + step * 0.018,
      )
    }
    monster.lastBounceOffsetY = 0
    monster.lastWaddleTiltRadians = tilt
    monster.lastWaddleRollRadians = roll
  }

  private updateDeathAnimation(monster: MonsterInstance, dt: number, incomingScrollSpeed: number): void {
    if (monster.deathTimer <= 0 || monster.deathDuration <= 0) {
      this.pool.release(monster)
      return
    }

    monster.deathTimer = Math.max(0, monster.deathTimer - dt)
    const progress = 1 - monster.deathTimer / monster.deathDuration
    if (monster.config?.behavior === MONSTER_BEHAVIORS.tank) {
      const fall = Math.min(1, progress / MID_BOSS_DEATH_FALL_PROGRESS)
      const thump = Math.sin(progress * Math.PI) * 0.035
      monster.mesh.rotation.x = -MID_BOSS_DEATH_ROLL_RADIANS * fall * 0.5
      monster.mesh.rotation.z = MID_BOSS_DEATH_ROLL_RADIANS * fall
      monster.mesh.position.y = monster.deathStartY - MID_BOSS_DEATH_SINK_DISTANCE * fall
      monster.mesh.position.z -= incomingScrollSpeed * dt
      monster.mesh.scaling.set(
        monster.variantScale * (1 + thump),
        monster.variantScale,
        monster.variantScale * (1 + thump * 0.7),
      )
      if (monster.deathTimer <= 0) {
        this.pool.release(monster)
      }
      return
    }

    const eased = 1 - (1 - progress) ** 3
    monster.mesh.rotation.x = -BASIC_DEATH_FORWARD_ROTATION * eased
    monster.mesh.rotation.z = BASIC_DEATH_FALL_ROTATION * monster.deathFallDirection * eased
    monster.mesh.position.y = monster.deathStartY - BASIC_DEATH_SINK_DISTANCE * eased
    monster.mesh.position.z -= incomingScrollSpeed * dt
    monster.mesh.scaling.set(
      monster.variantScale * (1 - BASIC_DEATH_SQUASH * 0.4 * eased),
      monster.variantScale * (1 - BASIC_DEATH_SQUASH * eased),
      monster.variantScale * (1 + BASIC_DEATH_SQUASH * 0.25 * eased),
    )

    if (monster.deathTimer <= 0) {
      this.pool.release(monster)
    }
  }

  private updateDebugState(squadZ: number, dt: number): void {
    if (!this.debugEnabled) {
      return
    }
    this.debugPublishCooldown -= dt
    if (this.debugPublishCooldown > 0) {
      return
    }
    this.debugPublishCooldown = DEBUG_PUBLISH_INTERVAL_SECONDS
    let totalAbsX = 0
    let maxAbsX = 0
    let midBosses = 0
    let midBossHpBars = 0
    let midBossRedHpFills = 0
    let midBossGrayHpFills = 0
    let dyingMidBosses = 0
    let maxMidBossDeathTiltRadians = 0
    let lowestDyingMidBossScaleYRatio = 1
    let damagedMidBosses = 0
    let lowestMidBossHpRatio = 1
    let largestMidBossHitRadius = 0
    let largestMidBossHitHalfDepth = 0
    let lowestMidBossHpBarY = Number.POSITIVE_INFINITY
    let largestMonsterScale = 0
    let authoredVisuals = 0
    let proceduralFallbackVisuals = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    let basicBounceAmplitude = 0
    let tankWaddleAmplitude = 0
    let tankWaddleRollAmplitude = 0
    let dyingBasics = 0
    let dyingRegulars = 0
    let dyingGrayMonsters = 0
    let maxDeathFallRadians = 0
    let upperBand = 0
    let centerBand = 0
    let bottomBand = 0
    let bossRearBacklog = 0
    let bossNearestDistance = Number.POSITIVE_INFINITY
    let bossNearestAbsX = Number.POSITIVE_INFINITY
    let defenseCarpetMonsters = 0
    let shieldTotal = 0
    let shielded = 0
    let visibleShieldCues = 0
    let lowestShieldRatio = 1
    let chargerTotal = 0
    let windingUpChargers = 0
    let chargingChargers = 0
    let visibleChargeCues = 0
    let splitterTotal = 0
    let splitlingTotal = 0
    let visibleSplitterCues = 0
    const defenseCarpetRows = new Set<number>()
    const monsterConfigCounts: Record<string, number> = {}
    const active = this.pool.getActive()
    for (const monster of active) {
      const absX = Math.abs(monster.mesh.position.x)
      const distanceAhead = monster.mesh.position.z - squadZ
      if (monster.visualUsesAuthored) {
        authoredVisuals += 1
      } else {
        proceduralFallbackVisuals += 1
      }
      const configId = monster.config?.id
      if (configId !== undefined) {
        monsterConfigCounts[configId] = (monsterConfigCounts[configId] ?? 0) + 1
      }
      if (monster.alive && monster.config?.behavior === MONSTER_BEHAVIORS.shield) {
        shieldTotal += 1
        if (monster.roleState.shieldHp > 0) {
          shielded += 1
        }
        if (monster.roleCue?.isEnabled() === true) {
          visibleShieldCues += 1
        }
        const shieldRatio = monster.roleState.shieldMaxHp <= 0
          ? 0
          : monster.roleState.shieldHp / monster.roleState.shieldMaxHp
        lowestShieldRatio = Math.min(lowestShieldRatio, shieldRatio)
      }
      if (monster.alive && monster.config?.behavior === MONSTER_BEHAVIORS.charger) {
        chargerTotal += 1
        if (monster.roleState.chargePhase === MONSTER_CHARGE_PHASES.windup) {
          windingUpChargers += 1
        } else if (monster.roleState.chargePhase === MONSTER_CHARGE_PHASES.charge) {
          chargingChargers += 1
        }
        if (monster.roleCue?.isEnabled() === true) {
          visibleChargeCues += 1
        }
      }
      if (monster.alive && monster.config?.behavior === MONSTER_BEHAVIORS.splitter) {
        splitterTotal += 1
        if (monster.roleCue?.isEnabled() === true) {
          visibleSplitterCues += 1
        }
      }
      if (monster.alive && monster.config?.id === MONSTER_CONFIGS.splitling.id) {
        splitlingTotal += 1
      }
      totalAbsX += absX
      maxAbsX = Math.max(maxAbsX, absX)
      largestMonsterScale = Math.max(largestMonsterScale, monster.variantScale)
      if (monster.alive) {
        if (monster.config?.behavior === MONSTER_BEHAVIORS.tank) {
          tankWaddleAmplitude = Math.max(tankWaddleAmplitude, Math.abs(monster.lastWaddleTiltRadians))
          tankWaddleRollAmplitude = Math.max(tankWaddleRollAmplitude, Math.abs(monster.lastWaddleRollRadians))
        } else {
          basicBounceAmplitude = Math.max(basicBounceAmplitude, monster.lastBounceOffsetY)
          if (
            this.mode.id === GAME_MODE_IDS.defense
            && distanceAhead >= 0
            && distanceAhead <= DEFENSE_SPAWN_LOOKAHEAD + DEFENSE_BOSS_REAR_OFFSET
          ) {
            defenseCarpetMonsters += 1
            defenseCarpetRows.add(Math.round(distanceAhead / DEFENSE_CARPET_ROW_STAGE_SPACING))
          }
        }
        if (distanceAhead >= DEBUG_UPPER_BAND_MIN && distanceAhead < DEBUG_UPPER_BAND_MAX) {
          upperBand += 1
        } else if (distanceAhead >= DEBUG_CENTER_BAND_MIN && distanceAhead < DEBUG_CENTER_BAND_MAX) {
          centerBand += 1
        } else if (distanceAhead >= 0 && distanceAhead < DEBUG_BOTTOM_BAND_MAX) {
          bottomBand += 1
        }
      }
      if (monster.config?.behavior === MONSTER_CONFIGS.tank.behavior) {
        midBosses += 1
        if (monster.alive && Math.abs(distanceAhead) < bossNearestDistance) {
          bossNearestDistance = Math.abs(distanceAhead)
          bossNearestAbsX = absX
        }
        if (!monster.alive) {
          dyingMidBosses += 1
          maxMidBossDeathTiltRadians = Math.max(
            maxMidBossDeathTiltRadians,
            Math.abs(monster.mesh.rotation.x),
            Math.abs(monster.mesh.rotation.z),
          )
          lowestDyingMidBossScaleYRatio = Math.min(
            lowestDyingMidBossScaleYRatio,
            monster.variantScale <= 0 ? 0 : monster.mesh.scaling.y / monster.variantScale,
          )
        }
        const hpRatio = monster.maxHp <= 0 ? 0 : Math.max(0, Math.min(1, monster.hp / monster.maxHp))
        lowestMidBossHpRatio = Math.min(lowestMidBossHpRatio, hpRatio)
        if (hpRatio < 1) {
          damagedMidBosses += 1
        }
        largestMidBossHitRadius = Math.max(largestMidBossHitRadius, monster.hitRadius)
        largestMidBossHitHalfDepth = Math.max(largestMidBossHitHalfDepth, monster.hitHalfDepth)
        if (monster.hpBarRoot?.isEnabled(false) === true) {
          midBossHpBars += 1
          if (this.isRedHpFill(monster)) {
            midBossRedHpFills += 1
          } else {
            midBossGrayHpFills += 1
          }
          const hpBarWorldY = monster.mesh.position.y + monster.hpBarRoot.position.y * monster.mesh.scaling.y
          lowestMidBossHpBarY = Math.min(lowestMidBossHpBarY, hpBarWorldY)
        }
      }
      if (!monster.alive && monster.config?.behavior === MONSTER_BEHAVIORS.basic) {
        dyingBasics += 1
        maxDeathFallRadians = Math.max(maxDeathFallRadians, Math.abs(monster.mesh.rotation.z))
      }
      if (!monster.alive && monster.config?.behavior !== MONSTER_BEHAVIORS.tank) {
        dyingRegulars += 1
        maxDeathFallRadians = Math.max(maxDeathFallRadians, Math.abs(monster.mesh.rotation.z))
      }
      if (!monster.alive && monster.deathMaterialApplied) {
        dyingGrayMonsters += 1
      }
      nearestDistance = Math.min(nearestDistance, Math.abs(monster.mesh.position.z - squadZ))
    }
    bossRearBacklog = this.countBossRearBacklog(active)
    const tuning = getDefenseWaveMultipliers(this.mode, this.difficulty, this.spawnProgressZ)
    const openingGraceActive = this.isDefenseOpeningGraceActive()
    const openingPressureRamping = this.defenseOpeningGraceEnabled
      && this.defenseElapsedSeconds >= DEFENSE_OPENING_GRACE_SECONDS
      && this.defenseElapsedSeconds < DEFENSE_OPENING_GRACE_SECONDS + DEFENSE_OPENING_PRESSURE_RAMP_SECONDS
    const debugNearDistance = openingGraceActive
      ? DEFENSE_OPENING_GRACE_NEAR_DISTANCE
      : DEFENSE_CARPET_NEAR_DISTANCE
    const expectedCarpetPopulation = Math.min(
      this.maxActivePressure,
      Math.ceil((DEFENSE_SPAWN_LOOKAHEAD - debugNearDistance) / DEFENSE_CARPET_ROW_STAGE_SPACING)
        * DEFENSE_CARPET_X.length,
    )
    window.__squadRushMonsterDebug = {
      active: active.length,
      authoredVisuals,
      proceduralFallbackVisuals,
      midBosses,
      midBossHpBars,
      midBossRedHpFills,
      midBossGrayHpFills,
      dyingMidBosses,
      maxMidBossDeathTiltRadians,
      lowestDyingMidBossScaleYRatio: dyingMidBosses === 0 ? 1 : lowestDyingMidBossScaleYRatio,
      damagedMidBosses,
      lowestMidBossHpRatio: midBosses === 0 ? 0 : lowestMidBossHpRatio,
      largestMidBossHitRadius,
      largestMidBossHitHalfDepth,
      lowestMidBossHpBarY: Number.isFinite(lowestMidBossHpBarY) ? lowestMidBossHpBarY : 0,
      largestMonsterScale,
      averageAbsX: active.length === 0 ? 0 : totalAbsX / active.length,
      maxAbsX,
      nearestDistance,
      basicBounceAmplitude,
      tankWaddleAmplitude,
      tankWaddleRollAmplitude,
      dyingBasics,
      dyingRegulars,
      dyingGrayMonsters,
      maxDeathFallRadians,
      spawnProgressZ: this.spawnProgressZ,
      spawnDensityMultiplier: this.getSpawnDensityMultiplier(this.spawnProgressZ),
      endlessSpawnDensityMultiplier: this.getEndlessSpawnDensityMultiplier(this.spawnProgressZ),
      endlessStage: this.getEndlessStage(this.spawnProgressZ),
      squadPowerSpawnMultiplier: this.squadPowerSpawnMultiplier,
      healthMultiplier: this.getHealthMultiplier(this.spawnProgressZ),
      maxActivePressure: this.maxActivePressure,
      pressureState: tuning.state,
      defenseCarpet: {
        columns: DEFENSE_CARPET_X.length,
        rowSpacing: DEFENSE_CARPET_ROW_STAGE_SPACING,
        nearDistance: debugNearDistance,
        farDistance: DEFENSE_SPAWN_LOOKAHEAD,
        occupiedRows: defenseCarpetRows.size,
        fillRatio: expectedCarpetPopulation <= 0 ? 0 : Math.min(1, defenseCarpetMonsters / expectedCarpetPopulation),
      },
      openingGrace: {
        active: openingGraceActive,
        ramping: openingPressureRamping,
        elapsedSeconds: this.defenseElapsedSeconds,
        remainingSeconds: Math.max(0, DEFENSE_OPENING_GRACE_SECONDS - this.defenseElapsedSeconds),
      },
      visiblePressureBands: {
        upper: upperBand,
        center: centerBand,
        bottom: bottomBand,
      },
      visibleCombatBandDensity: upperBand + centerBand + bottomBand,
      centerPressureBandDensity: centerBand,
      bottomBreachProximity: bottomBand,
      visibleTargetMin: tuning.visibleTargetMin,
      visibleTargetMax: tuning.visibleTargetMax,
      bossSoakShots: this.bossSoakShots,
      bossDamageEvents: this.bossDamageEvents,
      bossLowestHpRatio: midBosses === 0 ? 0 : lowestMidBossHpRatio,
      bossNearestDistance: Number.isFinite(bossNearestDistance) ? bossNearestDistance : 0,
      bossNearestAbsX: Number.isFinite(bossNearestAbsX) ? bossNearestAbsX : 0,
      bossRearBacklog,
      monsterConfigCounts,
      combatRoles: {
        shieldTotal,
        shielded,
        visibleShieldCues,
        lowestShieldRatio: shieldTotal === 0 ? 0 : lowestShieldRatio,
        chargerTotal,
        windingUpChargers,
        chargingChargers,
        visibleChargeCues,
        splitterTotal,
        splitlingTotal,
        visibleSplitterCues,
        splitEvents: this.splitEvents,
        splitChildrenSpawned: this.splitChildrenSpawned,
        splitChildrenDropped: this.splitChildrenDropped,
      },
      bossJamPickupRisk: {
        active: bossNearestDistance <= DEBUG_BOSS_FIRE_RANGE && centerBand > 0,
        centerThreats: centerBand,
      },
    }
  }

  private countBossRearBacklog(active: readonly MonsterInstance[]): number {
    let backlog = 0
    const bosses = active.filter((monster) => monster.alive && monster.config?.behavior === MONSTER_CONFIGS.tank.behavior)
    for (const boss of bosses) {
      for (const monster of active) {
        if (!monster.alive || monster === boss || monster.config?.behavior === MONSTER_CONFIGS.tank.behavior) {
          continue
        }
        const dz = monster.mesh.position.z - boss.mesh.position.z
        if (dz > 0 && dz <= DEBUG_BOSS_BACKLOG_DEPTH && Math.abs(monster.mesh.position.x - boss.mesh.position.x) <= 3.6) {
          backlog += 1
        }
      }
    }
    return backlog
  }

  private isRedHpFill(monster: MonsterInstance): boolean {
    const material = monster.hpBarFill?.material
    if (!(material instanceof StandardMaterial)) {
      return false
    }
    return material.diffuseColor.r >= 0.9
      && material.diffuseColor.g <= 0.22
      && material.diffuseColor.b <= 0.26
  }

  private spawnContinuousGroup(baseZ: number, ordinal: number, spawnBudget: number): number {
    const remainingCapacity = Math.min(
      this.maxActivePressure - this.pool.activeCount(),
      spawnBudget,
    )
    if (remainingCapacity <= 0) {
      return 0
    }
    let spawned = 0
    let batchIndex = 0
    for (const batch of this.getSpawnBatches(baseZ, ordinal)) {
      const capacityLeft = remainingCapacity - spawned
      if (capacityLeft <= 0) {
        return spawned
      }
      const scaledCount = batch.absolute === true
        ? Math.ceil(batch.count)
        : Math.ceil(
          batch.count
          * this.getDifficultySpawnMultiplier(batch.config, baseZ)
          * this.getRegularSpawnMultiplier(batch.config, baseZ)
          * this.mode.monsterSpawnMultiplier
          * this.squadPowerSpawnMultiplier
          * this.getSpawnDensityMultiplier(baseZ)
          * this.getEndlessSpawnDensityMultiplier(baseZ)
          * this.getEndlessOpeningSpawnReliefMultiplier(baseZ),
        )
      const batchLimit = batch.maxCount ?? Number.POSITIVE_INFINITY
      const count = Math.min(scaledCount, batchLimit, capacityLeft)
      if (count <= 0) {
        batchIndex += 1
        continue
      }
      spawned += this.spawnGroup(
        this.scaleConfig(batch.config, baseZ),
        count,
        baseZ + batchIndex * BATCH_LAYER_DEPTH,
        batch.pattern,
      )
      batchIndex += 1
    }
    return spawned
  }

  private getSpawnBatches(baseZ: number, ordinal: number): readonly SpawnBatch[] {
    if (this.mode.id === GAME_MODE_IDS.defense) {
      return this.getDefenseSpawnBatches(baseZ, ordinal)
    }
    const curveZ = this.getStageCurveProgressZ(baseZ)
    const roleSpawns = getAttackCombatRoleSpawnCounts(curveZ, ordinal)
    if (curveZ < 132) {
      return [
        { config: MONSTER_CONFIGS.tank, count: this.getMidBossCount(baseZ), maxCount: 1, pattern: "LINE" },
        {
          config: MONSTER_CONFIGS.charger,
          count: roleSpawns.charger,
          maxCount: 1,
          pattern: "LINE",
          absolute: true,
        },
        { config: MONSTER_CONFIGS.basic, count: 7 + (ordinal % 3), pattern: "BLOCK" },
        { config: MONSTER_CONFIGS.fast, count: ordinal % 4 === 0 ? 2 : 1, pattern: "LINE" },
      ]
    }
    if (curveZ < 190) {
      return [
        { config: MONSTER_CONFIGS.tank, count: this.getMidBossCount(baseZ), maxCount: 1, pattern: "LINE" },
        { config: MONSTER_CONFIGS.shield, count: roleSpawns.shield, maxCount: 1, pattern: "LINE", absolute: true },
        { config: MONSTER_CONFIGS.charger, count: roleSpawns.charger, maxCount: 1, pattern: "LINE", absolute: true },
        { config: MONSTER_CONFIGS.basic, count: 16 + (ordinal % 5), pattern: "BLOCK" },
        { config: MONSTER_CONFIGS.fast, count: ordinal % 3 === 0 ? 5 : 4, pattern: "LINE" },
      ]
    }
    if (curveZ < 250) {
      return [
        { config: MONSTER_CONFIGS.tank, count: this.getMidBossCount(baseZ), maxCount: 1, pattern: "LINE" },
        { config: MONSTER_CONFIGS.shield, count: roleSpawns.shield, maxCount: 1, pattern: "LINE", absolute: true },
        { config: MONSTER_CONFIGS.charger, count: roleSpawns.charger, maxCount: 1, pattern: "LINE", absolute: true },
        { config: MONSTER_CONFIGS.splitter, count: roleSpawns.splitter, maxCount: 1, pattern: "LINE", absolute: true },
        { config: MONSTER_CONFIGS.basic, count: 28 + (ordinal % 7), pattern: "BLOCK" },
        { config: MONSTER_CONFIGS.fast, count: ordinal % 2 === 0 ? 9 : 7, pattern: "BLOCK" },
      ]
    }
    return [
      { config: MONSTER_CONFIGS.tank, count: this.getMidBossCount(baseZ), maxCount: 1, pattern: "LINE" },
      { config: MONSTER_CONFIGS.shield, count: roleSpawns.shield, maxCount: 1, pattern: "LINE", absolute: true },
      { config: MONSTER_CONFIGS.charger, count: roleSpawns.charger, maxCount: 1, pattern: "LINE", absolute: true },
      { config: MONSTER_CONFIGS.splitter, count: roleSpawns.splitter, maxCount: 1, pattern: "LINE", absolute: true },
      { config: MONSTER_CONFIGS.basic, count: 34 + (ordinal % 8), pattern: "BLOCK" },
      { config: MONSTER_CONFIGS.fast, count: ordinal % 2 === 0 ? 11 : 9, pattern: "BLOCK" },
    ]
  }

  private getDefenseSpawnBatches(baseZ: number, ordinal: number): readonly SpawnBatch[] {
    const curveZ = this.getStageCurveProgressZ(baseZ)
    const progressRatio = this.getStageProgressRatio(baseZ)
    const mix = getDefenseMonsterMix(progressRatio)
    const basicOnlyOpening = this.difficulty.endless && progressRatio < ENDLESS_DEFENSE_BASIC_ONLY_END_RATIO
    const rowConfig = basicOnlyOpening
      ? MONSTER_CONFIGS.basic
      : this.getDefenseCarpetRowConfig(curveZ, mix, ordinal)
    const roleSpawns = basicOnlyOpening
      ? { shield: 0, charger: 0, splitter: 0 }
      : getDefenseCombatRoleSpawnCounts(progressRatio, ordinal)
    return [
      {
        config: MONSTER_CONFIGS.tank,
        count: basicOnlyOpening ? 0 : this.getMidBossCount(baseZ),
        maxCount: 1,
        pattern: "LINE",
        absolute: true,
      },
      {
        config: MONSTER_CONFIGS.shield,
        count: roleSpawns.shield,
        maxCount: 1,
        pattern: "LINE",
        absolute: true,
      },
      {
        config: MONSTER_CONFIGS.charger,
        count: roleSpawns.charger,
        maxCount: 1,
        pattern: "LINE",
        absolute: true,
      },
      {
        config: MONSTER_CONFIGS.splitter,
        count: roleSpawns.splitter,
        maxCount: 1,
        pattern: "LINE",
        absolute: true,
      },
      { config: rowConfig, count: DEFENSE_CARPET_X.length, pattern: "BLOCK", absolute: true },
    ]
  }

  private getDefenseCarpetRowConfig(
    curveZ: number,
    mix: ReturnType<typeof getDefenseMonsterMix>,
    ordinal: number,
  ): MonsterConfig {
    const roll = Math.abs(Math.sin(ordinal * 12.9898 + curveZ * 0.173) * 43758.5453) % 1
    const bruteShare = curveZ >= DEFENSE_HEAVY_ORANGE_INTRO_Z ? mix.brute : 0
    if (roll < bruteShare) {
      return MONSTER_CONFIGS.brute
    }
    const fastShare = curveZ >= DEFENSE_ORANGE_INTRO_Z ? mix.fast : 0
    if (roll < bruteShare + fastShare) {
      return MONSTER_CONFIGS.fast
    }
    return MONSTER_CONFIGS.basic
  }

  private getMidBossCount(baseZ: number): number {
    if (!this.isMidBossSpawn(baseZ)) {
      return 0
    }
    const maxActiveBosses = this.mode.id === GAME_MODE_IDS.defense
      ? MAX_ACTIVE_DEFENSE_MID_BOSSES
      : MAX_ACTIVE_ATTACK_MID_BOSSES
    if (this.countActiveMidBosses() >= maxActiveBosses) {
      return 0
    }
    if (this.mode.id === GAME_MODE_IDS.defense && baseZ < DEFENSE_MIN_BOSS_BASE_Z) {
      return 0
    }
    return 1
  }

  private countActiveMidBosses(): number {
    let count = 0
    for (const monster of this.pool.getActive()) {
      if (monster.config?.behavior === MONSTER_BEHAVIORS.tank) {
        count += 1
      }
    }
    return count
  }

  private getDifficultySpawnMultiplier(config: MonsterConfig, progressZ: number): number {
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      return 1
    }
    const ramp = this.getDefenseDifficultyRamp(progressZ)
    return 1 + (this.difficulty.spawnMultiplier - 1) * ramp
  }

  private getRegularSpawnMultiplier(config: MonsterConfig, progressZ: number): number {
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      return 1
    }
    const ramp = this.getDefenseDifficultyRamp(progressZ)
    return 1 + (this.difficulty.regularSpawnMultiplier - 1) * ramp
  }

  private getDifficultyPressureMultiplier(progressZ: number): number {
    const ramp = this.getDefenseDifficultyRamp(progressZ)
    return 1 + (this.difficulty.pressureMultiplier - 1) * ramp
  }

  private getAttackDensityMultiplier(progressZ: number): number {
    if (this.mode.id !== GAME_MODE_IDS.run || this.getStageCurveProgressZ(progressZ) < ATTACK_DENSITY_BOOST_PROGRESS) {
      return 1
    }
    return ATTACK_LATE_DENSITY_MULTIPLIER
  }

  private getPressureMultiplier(progressZ: number): number {
    return this.getAttackDensityMultiplier(progressZ) * getDefenseWaveMultipliers(this.mode, this.difficulty, progressZ).pressure
  }

  private getSpawnDensityMultiplier(progressZ: number): number {
    return this.getAttackDensityMultiplier(progressZ) * getDefenseWaveMultipliers(this.mode, this.difficulty, progressZ).spawnDensity
  }

  private getHealthMultiplier(progressZ: number): number {
    return this.difficulty.healthMultiplier
      * getDefenseWaveMultipliers(this.mode, this.difficulty, progressZ).health
      * this.getSquadPowerHealthMultiplier(progressZ)
      * this.getEndlessHealthMultiplier(progressZ)
  }

  private getSquadPowerHealthMultiplier(progressZ: number): number {
    const ramp = this.getSquadPowerHealthRamp(progressZ)
    const scale = this.mode.id === GAME_MODE_IDS.defense ? DEFENSE_SQUAD_POWER_HEALTH_SCALE : ATTACK_SQUAD_POWER_HEALTH_SCALE
    return 1 + Math.max(0, this.squadPowerSpawnMultiplier - 1) * scale * ramp
  }

  private getSquadPowerHealthRamp(progressZ: number): number {
    const ratio = this.getStageProgressRatio(progressZ)
    if (ratio <= SQUAD_POWER_HEALTH_RAMP_START_RATIO) {
      return 0
    }
    if (ratio >= SQUAD_POWER_HEALTH_RAMP_END_RATIO) {
      return 1
    }
    const progress = (ratio - SQUAD_POWER_HEALTH_RAMP_START_RATIO)
      / (SQUAD_POWER_HEALTH_RAMP_END_RATIO - SQUAD_POWER_HEALTH_RAMP_START_RATIO)
    return progress * progress * (3 - 2 * progress)
  }

  private isMidBossSpawn(baseZ: number): boolean {
    const curveZ = this.getStageCurveProgressZ(baseZ)
    if (this.difficulty.endless && curveZ >= LEVEL_1.totalLength) {
      const offset = (curveZ - LEVEL_1.totalLength) % ENDLESS_MID_BOSS_INTERVAL_Z
      return offset <= this.getSpawnSpacing() * 0.5
        || ENDLESS_MID_BOSS_INTERVAL_Z - offset <= this.getSpawnSpacing() * 0.5
    }
    const spawnSchedule = this.mode.id === GAME_MODE_IDS.defense ? DEFENSE_MID_BOSS_SPAWN_Z : MID_BOSS_SPAWN_Z
    return spawnSchedule.some((spawnZ) => Math.abs(curveZ - spawnZ) <= this.getSpawnSpacing() * 0.5)
  }

  private scaleConfig(config: MonsterConfig, progressZ: number): MonsterConfig {
    if (this.mode.id === GAME_MODE_IDS.defense) {
      return this.scaleDefenseConfig(config, progressZ)
    }
    const healthMultiplier = this.getHealthMultiplier(progressZ)
    const hpMultiplier = this.getScaledHpMultiplier(config, progressZ, healthMultiplier)
    if (
      this.difficulty.id === "easy"
      && hpMultiplier === 1
      && this.getSpeedMultiplier(progressZ) === 1
      && this.getDamageMultiplier(progressZ) === 1
    ) {
      return config
    }
    return {
      ...config,
      hp: Math.max(1, Math.round(config.hp * hpMultiplier)),
      speed: config.speed * this.getSpeedMultiplier(progressZ),
      damage: this.getScaledDamage(config, progressZ),
    }
  }

  private scaleDefenseConfig(config: MonsterConfig, progressZ: number): MonsterConfig {
    const progressRatio = this.getStageProgressRatio(progressZ)
    const squadHealthScale = this.getSquadPowerHealthMultiplier(progressZ)
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      return {
        ...config,
        hp: Math.max(1, Math.round(
          getDefenseBossEffectiveHp(progressRatio, this.difficulty.id)
          * this.getEndlessDefenseHpMultiplier(progressZ)
          * squadHealthScale,
        )),
        speed: config.speed * this.getSpeedMultiplier(progressZ),
        damage: this.getScaledDamage(config, progressZ),
        scale: config.scale * (DEFENSE_BALANCE_CURVE.boss.defenseScale / 1.08),
      }
    }
    const speed = config.behavior === MONSTER_BEHAVIORS.fast
      ? config.speed * DEFENSE_BALANCE_CURVE.defenseFastSpeedMultiplier
      : config.speed
    return {
      ...config,
      hp: Math.max(1, Math.round(
        getDefenseBasicMonsterHp(progressRatio)
        * config.hp
        * this.getEndlessDefenseHpMultiplier(progressZ)
        * squadHealthScale,
      )),
      speed: speed * this.getSpeedMultiplier(progressZ),
      damage: this.getScaledDamage(config, progressZ),
    }
  }

  private getScaledDamage(config: MonsterConfig, progressZ: number): number {
    const scaledDamage = config.damage * this.getDamageMultiplier(progressZ)
    if (this.mode.id === GAME_MODE_IDS.defense && config.damage <= 1) {
      return Math.max(1, Math.round(scaledDamage))
    }
    return Math.max(1, Math.ceil(scaledDamage))
  }

  private getScaledHpMultiplier(config: MonsterConfig, progressZ: number, healthMultiplier: number): number {
    const behaviorHealthMultiplier = this.getBehaviorHealthMultiplier(config, progressZ)
    if (
      this.mode.id === GAME_MODE_IDS.defense
      && config.behavior === MONSTER_BEHAVIORS.tank
      && this.getStageCurveProgressZ(progressZ) / LEVEL_1.totalLength < DEFENSE_BOSS_FULL_HP_PROGRESS_RATIO
    ) {
      return healthMultiplier * behaviorHealthMultiplier * this.getDefenseBossPowerHealthMultiplier(progressZ) * DEFENSE_EARLY_BOSS_HP_RATIO
    }
    if (this.mode.id === GAME_MODE_IDS.defense && config.behavior === MONSTER_BEHAVIORS.tank) {
      return healthMultiplier * behaviorHealthMultiplier * this.getDefenseBossPowerHealthMultiplier(progressZ)
    }
    return healthMultiplier * behaviorHealthMultiplier
  }

  private getDefenseBossPowerHealthMultiplier(progressZ: number): number {
    if (this.mode.id !== GAME_MODE_IDS.defense) {
      return 1
    }
    const ramp = this.getSquadPowerHealthRamp(progressZ)
    return 1 + Math.max(0, this.squadPowerSpawnMultiplier - 1) * DEFENSE_SQUAD_POWER_BOSS_HEALTH_SCALE * ramp
  }

  private getBehaviorHealthMultiplier(config: MonsterConfig, progressZ: number): number {
    const ramp = this.getDefenseDifficultyRamp(progressZ)
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      return 1 + (this.difficulty.midBossHealthMultiplier - 1) * ramp
    }
    return 1 + (this.difficulty.regularHealthMultiplier - 1) * ramp
  }

  private getEndlessStage(progressZ: number): number {
    const curveZ = this.getStageCurveProgressZ(progressZ)
    if (!this.difficulty.endless || curveZ < LEVEL_1.totalLength) {
      return 0
    }
    return Math.floor((curveZ - LEVEL_1.totalLength) / ENDLESS_STAGE_LENGTH_Z) + 1
  }

  private getEndlessPressureMultiplier(progressZ: number): number {
    return 1 + this.getEndlessStage(progressZ) * ENDLESS_PRESSURE_STEP
  }

  private getEndlessSpawnDensityMultiplier(progressZ: number): number {
    return 1 + this.getEndlessStage(progressZ) * ENDLESS_SPAWN_DENSITY_STEP
  }

  private getEndlessDefenseInfluxMultiplier(progressZ: number): number {
    if (!this.difficulty.endless || this.mode.id !== GAME_MODE_IDS.defense) {
      return 1
    }
    return 1 + this.getEndlessStage(progressZ) * DEFENSE_BALANCE_CURVE.endless.influxStepPerStage
  }

  private getEndlessOpeningSpawnReliefMultiplier(progressZ: number): number {
    if (!this.difficulty.endless) {
      return 1
    }
    const baseMultiplier = this.mode.id === GAME_MODE_IDS.defense
      ? ENDLESS_DEFENSE_OPENING_SPAWN_RELIEF_MULTIPLIER
      : ENDLESS_OPENING_SPAWN_RELIEF_MULTIPLIER
    const ratio = this.getStageProgressRatio(progressZ)
    if (ratio <= ENDLESS_OPENING_SPAWN_RELIEF_START_RATIO) {
      return baseMultiplier
    }
    if (ratio >= ENDLESS_OPENING_SPAWN_RELIEF_END_RATIO) {
      return 1
    }
    const progress = (ratio - ENDLESS_OPENING_SPAWN_RELIEF_START_RATIO)
      / (ENDLESS_OPENING_SPAWN_RELIEF_END_RATIO - ENDLESS_OPENING_SPAWN_RELIEF_START_RATIO)
    const eased = progress * progress * (3 - 2 * progress)
    return baseMultiplier + (1 - baseMultiplier) * eased
  }

  private getEndlessHealthMultiplier(progressZ: number): number {
    const stage = this.getEndlessStage(progressZ)
    const checkpointBonus = Math.floor(stage / 4) * ENDLESS_HEALTH_CHECKPOINT_STEP
    return 1 + stage * ENDLESS_HEALTH_STEP + checkpointBonus
  }

  private getEndlessDefenseHpMultiplier(progressZ: number): number {
    if (!this.difficulty.endless || this.mode.id !== GAME_MODE_IDS.defense) {
      return 1
    }
    return 1 + this.getEndlessStage(progressZ) * DEFENSE_BALANCE_CURVE.endless.hpStepPerStage
  }

  private getSpeedMultiplier(progressZ: number): number {
    const endlessSpeed = 1 + this.getEndlessStage(progressZ) * ENDLESS_SPEED_STEP
    const modeSpeed = this.mode.id === GAME_MODE_IDS.run ? ATTACK_SPEED_MULTIPLIER : 1
    return this.difficulty.speedMultiplier * endlessSpeed * modeSpeed * this.getDefenseHardOpeningSpeedMultiplier(progressZ)
  }

  private getDefenseHardOpeningSpeedMultiplier(progressZ: number): number {
    if (this.mode.id !== GAME_MODE_IDS.defense || this.difficulty.id !== "hard" || this.difficulty.endless) {
      return 1
    }
    const openingProgress = this.getRatioRampProgress(
      progressZ,
      DEFENSE_HARD_OPENING_CAP_RAMP_START_RATIO,
      DEFENSE_HARD_OPENING_CAP_RAMP_END_RATIO,
    )
    return DEFENSE_HARD_OPENING_SPEED_MULTIPLIER
      + (1 - DEFENSE_HARD_OPENING_SPEED_MULTIPLIER) * openingProgress
  }

  private getDamageMultiplier(progressZ: number): number {
    const endlessDamage = 1 + this.getEndlessStage(progressZ) * ENDLESS_DAMAGE_STEP
    return this.difficulty.damageMultiplier * endlessDamage
  }

  private spawnGroup(config: MonsterConfig, count: number, baseZ: number, pattern: SpawnPattern): number {
    if (this.mode.id === GAME_MODE_IDS.defense) {
      return this.spawnDefenseCarpetGroup(config, count, baseZ)
    }
    let spawned = 0
    for (let index = 0; index < count; index += 1) {
      let x = 0
      let z = baseZ
      const rowOffset = this.getRowOffset(baseZ)
      switch (pattern) {
        case "LINE":
          x = this.getLaneX(index + rowOffset) + this.getScatter(index, baseZ, 0.16)
          z = baseZ + Math.floor(index / LANE_X.length) * LINE_ROW_DEPTH + this.getScatter(index + 11, baseZ, 0.05)
          break
        case "BLOCK":
          x = this.getHordeX(index + rowOffset) + this.getScatter(index, baseZ, 0.24)
          z = baseZ + Math.floor(index / SWARM_OFFSET_X.length) * HORDE_ROW_DEPTH + this.getScatter(index + 11, baseZ, 0.05)
          break
        case "V_SHAPE":
          x = this.getSideLaneX(index + rowOffset) + this.getScatter(index, baseZ, 0.2)
          z = baseZ + Math.floor(index / SIDE_LANE_X.length) * SIDE_ROW_DEPTH + this.getScatter(index + 7, baseZ, 0.05)
          break
      }
      if (this.pool.spawn(config, x, z) !== null) {
        spawned += 1
      }
    }
    return spawned
  }

  private spawnDefenseCarpetGroup(config: MonsterConfig, count: number, baseZ: number): number {
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      const z = this.projectDefenseSpawnZ(baseZ) + DEFENSE_BOSS_REAR_OFFSET
      return this.pool.spawn(config, 0, z) === null ? 0 : 1
    }
    let spawned = 0
    const rowOffset = this.getRowOffset(baseZ)
    for (let index = 0; index < count; index += 1) {
      const column = (index + rowOffset) % DEFENSE_CARPET_X.length
      const row = Math.floor(index / DEFENSE_CARPET_X.length)
      const authoredRowZ = baseZ + row * DEFENSE_CARPET_ROW_STAGE_SPACING
      const baseX = DEFENSE_CARPET_X[column] ?? 0
      const x = baseX + this.getScatter(index, baseZ, 0.045)
      const z = this.projectDefenseSpawnZ(authoredRowZ) + this.getScatter(index + 11, baseZ, 0.025)
      if (this.pool.spawn(config, x, z) !== null) {
        spawned += 1
      }
    }
    return spawned
  }

  private projectDefenseSpawnZ(authoredZ: number): number {
    return Math.max(
      this.currentSquadZ + DEFENSE_CARPET_NEAR_DISTANCE,
      this.currentSquadZ + authoredZ - this.spawnProgressZ,
    )
  }

  private getLaneX(index: number): number {
    return LANE_X[index % LANE_X.length] ?? 0
  }

  private getSideLaneX(index: number): number {
    return SIDE_LANE_X[index % SIDE_LANE_X.length] ?? 0
  }

  private getHordeX(index: number): number {
    return SWARM_OFFSET_X[index % SWARM_OFFSET_X.length]
      ?? HORDE_OFFSET_X[index % HORDE_OFFSET_X.length]
      ?? 0
  }

  private getRowOffset(baseZ: number): number {
    return Math.abs(Math.floor(Math.sin(baseZ * 8.17) * 1000))
  }

  private getCenterPull(distanceAhead: number): number {
    if (this.mode.monsterCenterConvergeMultiplier <= 0) {
      return 1
    }
    const convergeDistance = CENTER_CONVERGE_DISTANCE / this.mode.monsterCenterConvergeMultiplier
    return Math.max(CENTER_CONVERGE_MIN_RETAIN, Math.min(1, distanceAhead / convergeDistance))
  }

  private getScatter(index: number, baseZ: number, amount: number): number {
    return Math.sin(index * 2.31 + baseZ * 0.37) * amount
  }
}
