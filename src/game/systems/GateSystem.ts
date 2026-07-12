import {
  Mesh,
  Scene,
  Vector3,
} from "@babylonjs/core"
import {
  GATE_CONFIGS,
  GATE_SPAWNS,
  GATE_TYPES,
  LEFT_GATE_REWARD_POOL,
  RIGHT_GATE_REWARD_POOL,
  type GateConfig,
  type GateSpawn,
  type SquadBuffs,
  type WeightedGateReward,
} from "../data/gateData"
import { DEFENSE_BALANCE_CURVE } from "../data/defenseBalanceCurve"
import {
  UNIT_TYPES,
  type UnitType,
} from "../data/squadRosterData"
import {
  createGateBarrierVisual,
  createGateVisual,
  GATE_ARROW_BASE_Y,
  GATE_LEFT_X,
  GATE_RIGHT_X,
  GATE_VISUAL_SCALE,
  type GateVisual,
  type GateBarrierVisual,
} from "./GateVisualFactory"
import type { FXSystem } from "./FXSystem"
import { getStageContentLength, projectBaseStageZ } from "./StageContentSchedule"
import type { SquadSystem } from "./SquadSystem"
import type { DifficultyProfile } from "../data/difficultyData"
import { GAME_MODE_IDS, type GameModeProfile } from "../data/gameModeData"

const GATE_CAMERA_FOCUS_DISTANCE = 12
const GATE_SPAWN_LOOKAHEAD_DISTANCE = 96
const GATE_CAMERA_CLOSE_RELEASE_DISTANCE = 7.2
const GATE_RIGHT_LANE_X = 2.2
const GATE_LEFT_LANE_X = -2.2
const GATE_BARRIER_BASE_HP = 8
const GATE_BARRIER_SCORE_HP = 3
const GATE_BARRIER_PROGRESS_HP_RAMP_START = 0.28
const GATE_BARRIER_PROGRESS_HP_RAMP_END = 0.86
const GATE_BARRIER_MAX_PROGRESS_HP_MULTIPLIER = 2.6
const GATE_BARRIER_CENTER_Z_OFFSET = -3.1
const GATE_BARRIER_DEPTH = 0.42
const GATE_BARRIER_HALF_WIDTH = 1.725
const GATE_BARRIER_AIM_PADDING = 0.42
const GATE_BARRIER_MIN_IMPACT_DISTANCE = 0.05
const GATE_BARRIER_IMPACT_HEIGHT = 1.16
const GATE_BARRIER_BREAK_SECONDS = 0.34
const GATE_BARRIER_HIT_PULSE_SECONDS = 0.12

type GateBarrier = {
  hp: number
  readonly maxHp: number
  readonly progressHpMultiplier: number
  readonly visual: GateBarrierVisual
  hitPulse: number
  breakLife: number
  destroyed: boolean
  impacts: number
}

type GatePair = {
  z: number
  readonly choices: readonly [GateConfig, GateConfig]
  readonly visuals: readonly [GateVisual, GateVisual]
  readonly allMeshes: readonly Mesh[]
  readonly animatedMeshes: readonly Mesh[]
  readonly rightBarrier: GateBarrier
  revealed: boolean
  passed: boolean
}

type ScheduledGateSpawn = GateSpawn & {
  readonly authoredZ: number
}

export type GateDebugState = {
  readonly z: number
  readonly choices: readonly string[]
  readonly visibleChoices: readonly string[]
  readonly passed: boolean
    readonly rightBarrier: {
      readonly hp: number
      readonly maxHp: number
      readonly progressHpMultiplier: number
      readonly hpRatio: number
      readonly impacts: number
    readonly destroyed: boolean
  }
}

export type GateBarrierShotTarget = {
  readonly distance: number
  readonly impact: Vector3
  readonly hp: number
  readonly maxHp: number
  applyImpact: (damage: number) => boolean
}

export type GateUnitDelta = {
  readonly unit: UnitType
  readonly count: number
}

export type GateApplyResult = {
  readonly addedUnits: readonly GateUnitDelta[]
}

export class GateSystem {
  private readonly gates: GatePair[] = []
  private readonly scheduledSpawns: readonly ScheduledGateSpawn[]
  private readonly stageLength: number
  private readonly onPassCallbacks: Array<(cfg: GateConfig, position: Vector3, result: GateApplyResult) => void> = []
  private spawnIndex = 0
  private previousSquadZ = 0

  constructor(
    private readonly scene: Scene,
    private readonly squad: SquadSystem,
    private readonly fx: FXSystem,
    difficulty: DifficultyProfile,
    private readonly mode: GameModeProfile,
  ) {
    this.stageLength = getStageContentLength(difficulty)
    const gateSpawns = mode.id === GAME_MODE_IDS.defense ? [] : GATE_SPAWNS
    this.scheduledSpawns = gateSpawns.map((spawn) => ({
      ...spawn,
      authoredZ: spawn.z,
      z: projectBaseStageZ(spawn.z, this.stageLength, mode, difficulty),
    }))
    this.previousSquadZ = squad.squadZ
  }

  onPass(cb: (cfg: GateConfig, position: Vector3, result: GateApplyResult) => void): void {
    this.onPassCallbacks.push(cb)
  }

  getStats(): SquadBuffs {
    return this.squad.getCombatStats()
  }

  getDebugState(): readonly GateDebugState[] {
    return this.gates.map((gate) => ({
      z: gate.z,
      choices: gate.choices.map((choice) => choice.displayText),
      visibleChoices: gate.revealed ? gate.choices.map((choice) => choice.displayText) : [gate.choices[0].displayText, "?"],
      passed: gate.passed,
      rightBarrier: {
        hp: gate.rightBarrier.hp,
        maxHp: gate.rightBarrier.maxHp,
        progressHpMultiplier: gate.rightBarrier.progressHpMultiplier,
        hpRatio: this.getBarrierHpRatio(gate.rightBarrier),
        impacts: gate.rightBarrier.impacts,
        destroyed: gate.rightBarrier.destroyed,
      },
    }))
  }

  applyBonus(cfg: GateConfig): void {
    this.applyGate(cfg)
  }

  getApproachFocus(squadZ: number): number {
    for (const gate of this.gates) {
      const distance = gate.z - squadZ
      if (gate.passed || distance < 0 || distance > GATE_CAMERA_FOCUS_DISTANCE) {
        continue
      }
      const approachFocus = Math.sin((1 - distance / GATE_CAMERA_FOCUS_DISTANCE) * Math.PI)
      const closeRelease = Math.min(1, distance / GATE_CAMERA_CLOSE_RELEASE_DISTANCE) ** 3
      return approachFocus * closeRelease
    }
    return 0
  }

  update(dt: number, spawnProgressZ = this.squad.squadZ, scrollSpeed = 0): void {
    const currentSquadZ = this.squad.squadZ
    let nextSpawn = this.scheduledSpawns[this.spawnIndex]
    while (nextSpawn !== undefined && spawnProgressZ >= nextSpawn.z - GATE_SPAWN_LOOKAHEAD_DISTANCE) {
      const spawn = this.scheduledSpawns[this.spawnIndex]
      if (spawn !== undefined) {
        this.spawnGatePair(spawn)
      }
      this.spawnIndex += 1
      nextSpawn = this.scheduledSpawns[this.spawnIndex]
    }

    for (const gate of this.gates) {
      if (!gate.passed) {
        const previousGateZ = gate.z
        if (scrollSpeed > 0) {
          this.moveGate(gate, -scrollSpeed * dt)
        }
        this.animateGate(gate)
        this.damageRightBarrier(gate, dt)
        const crossedGate = scrollSpeed > 0
          ? previousGateZ >= currentSquadZ && gate.z <= currentSquadZ
          : this.previousSquadZ <= gate.z && currentSquadZ >= gate.z
        const nearGate = Math.abs(currentSquadZ - gate.z) <= 2.4
        if (gate.passed || (!crossedGate && !nearGate)) {
          continue
        }
        gate.passed = true
        const picked = this.pickChoice(gate)
        for (const mesh of gate.allMeshes) {
          mesh.setEnabled(false)
        }
        if (picked === null) {
          continue
        }
        const result = this.applyGate(picked)
        const effectPos = new Vector3(this.squad.squadX, 2, gate.z)
        for (const cb of this.onPassCallbacks) {
          cb(picked, effectPos, result)
        }
      }
    }
    this.previousSquadZ = currentSquadZ
  }

  findBarrierTarget(x: number, z: number, range: number): GateBarrierShotTarget | null {
    let bestGate: GatePair | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    let bestImpactX = 0

    for (const gate of this.gates) {
      if (gate.passed || gate.rightBarrier.hp <= 0 || this.squad.squadX <= GATE_RIGHT_LANE_X) {
        continue
      }
      const impactZ = this.getBarrierImpactZ(gate)
      const distance = impactZ - z
      const lateralMiss = Math.abs(x - GATE_RIGHT_X)
      if (
        distance <= GATE_BARRIER_MIN_IMPACT_DISTANCE
        || distance > range
        || lateralMiss > GATE_BARRIER_HALF_WIDTH + GATE_BARRIER_AIM_PADDING
      ) {
        continue
      }
      if (distance < bestDistance) {
        bestGate = gate
        bestDistance = distance
        bestImpactX = Math.max(
          GATE_RIGHT_X - GATE_BARRIER_HALF_WIDTH,
          Math.min(GATE_RIGHT_X + GATE_BARRIER_HALF_WIDTH, x),
        )
      }
    }

    if (bestGate === null) {
      return null
    }
    const impact = new Vector3(bestImpactX, GATE_BARRIER_IMPACT_HEIGHT, this.getBarrierImpactZ(bestGate))
    return {
      distance: bestDistance,
      impact,
      hp: bestGate.rightBarrier.hp,
      maxHp: bestGate.rightBarrier.maxHp,
      applyImpact: (damage) => this.applyBarrierImpact(bestGate, damage, impact),
    }
  }

  private spawnGatePair(spawn: ScheduledGateSpawn): void {
    const choices = this.createGateChoices(spawn)
    if (choices === null) {
      return
    }
    const [left, right] = choices
    const hideRightReward = spawn.kind === "rewardPool"
    const leftVisual = createGateVisual(this.scene, left, { x: GATE_LEFT_X, z: spawn.z })
    const rightVisual = createGateVisual(this.scene, right, { x: GATE_RIGHT_X, z: spawn.z, hiddenLabel: hideRightReward })
    const rightBarrierVisual = createGateBarrierVisual(this.scene, { x: GATE_RIGHT_X, z: spawn.z })
    const rightBarrier = this.createRightBarrier(right, rightBarrierVisual, spawn.rightBarrier !== false, spawn.z)
    this.gates.push({
      z: spawn.z,
      choices: [left, right],
      visuals: [leftVisual, rightVisual],
      allMeshes: [...leftVisual.allMeshes, ...rightVisual.allMeshes, ...rightBarrierVisual.allMeshes],
      animatedMeshes: [...leftVisual.animatedMeshes, ...rightVisual.animatedMeshes],
      rightBarrier,
      revealed: !hideRightReward,
      passed: false,
    })
  }

  private createGateChoices(spawn: ScheduledGateSpawn): readonly [GateConfig, GateConfig] | null {
    switch (spawn.kind) {
      case undefined:
      case "fixed":
        return this.createFixedGateChoices(spawn.gateIds)
      case "rewardPool":
        return this.createRewardPoolGateChoices(spawn.authoredZ)
      default:
        return this.assertNeverGateSpawn(spawn)
    }
  }

  private createFixedGateChoices(gateIds: readonly [string, string]): readonly [GateConfig, GateConfig] | null {
    const left = GATE_CONFIGS[gateIds[0]]
    const right = GATE_CONFIGS[gateIds[1]]
    return left === undefined || right === undefined ? null : [left, right]
  }

  private createRewardPoolGateChoices(z: number): readonly [GateConfig, GateConfig] | null {
    if (this.mode.id !== GAME_MODE_IDS.defense) {
      const left = this.pickWeightedReward(LEFT_GATE_REWARD_POOL, z)
      const right = this.pickWeightedReward(RIGHT_GATE_REWARD_POOL, z)
      return left === null || right === null ? null : [left, right]
    }
    const segment = this.getDefenseGateSegment(z)
    const left = this.pickWeightedReward(segment.left, z)
    let right = this.pickWeightedReward(segment.right, z)
    if (left !== null && right !== null && this.needsPairReroll(left, right)) {
      right = this.pickWeightedReward(segment.right, z)
    }
    return left === null || right === null ? null : [left, right]
  }

  private getDefenseGateSegment(authoredZ: number): (typeof DEFENSE_BALANCE_CURVE.gateSegments)[number] {
    const segment = DEFENSE_BALANCE_CURVE.gateSegments.find((entry) => authoredZ < entry.maxAuthoredZ)
    if (segment !== undefined) {
      return segment
    }
    const fallback = DEFENSE_BALANCE_CURVE.gateSegments[DEFENSE_BALANCE_CURVE.gateSegments.length - 1]
    if (fallback !== undefined) {
      return fallback
    }
    throw new Error("Defense gate segment data is empty.")
  }

  private needsPairReroll(left: GateConfig, right: GateConfig): boolean {
    if (left.id === right.id) {
      return true
    }
    return left.type === GATE_TYPES.numberIncrease && right.type === GATE_TYPES.numberIncrease
  }

  private pickWeightedReward(pool: readonly WeightedGateReward[], z: number): GateConfig | null {
    let totalWeight = 0
    const candidates: WeightedGateReward[] = []
    for (const reward of pool) {
      if (reward.minZ !== undefined && z < reward.minZ) {
        continue
      }
      candidates.push(reward)
      totalWeight += reward.weight
    }
    if (totalWeight <= 0) {
      return null
    }
    let roll = Math.random() * totalWeight
    for (const reward of candidates) {
      roll -= reward.weight
      if (roll <= 0) {
        return GATE_CONFIGS[reward.gateId] ?? null
      }
    }
    const last = candidates[candidates.length - 1]
    return last === undefined ? null : GATE_CONFIGS[last.gateId] ?? null
  }

  private animateGate(gate: GatePair): void {
    const phase = this.squad.squadZ * 0.35 + gate.z * 0.11
    for (const mesh of gate.animatedMeshes) {
      if (mesh.name.includes("gate_choice_arrow")) {
        mesh.position.y = GATE_ARROW_BASE_Y + Math.sin(phase + mesh.position.x) * 0.035 * GATE_VISUAL_SCALE
      } else {
        mesh.scaling.y = 1 + Math.sin(phase + mesh.position.x) * 0.05
      }
    }
  }

  private moveGate(gate: GatePair, deltaZ: number): void {
    gate.z += deltaZ
    for (const mesh of gate.allMeshes) {
      mesh.position.z += deltaZ
    }
  }

  private applyGate(cfg: GateConfig): GateApplyResult {
    switch (cfg.type) {
      case GATE_TYPES.numberIncrease: {
        const result = this.squad.increaseMostCommon(cfg.mode, cfg.value)
        return result === null ? this.emptyApplyResult() : this.createAddedUnitResult(result.unit, result.gained)
      }
      case GATE_TYPES.enlist:
        return this.createAddedUnitResult(UNIT_TYPES.soldier, this.squad.enlistAll())
      case GATE_TYPES.removeMostCommon: {
        this.squad.removeMostCommon(cfg.value)
        return this.emptyApplyResult()
      }
      case GATE_TYPES.unitRecruit:
        return this.createAddedUnitResult(cfg.unit, this.squad.recruitSpecial(cfg.unit, cfg.count))
      case GATE_TYPES.permanentAttackUp:
        this.squad.multiplyPermanentAttack(cfg.multiplier)
        return this.emptyApplyResult()
      case GATE_TYPES.unitDamageMultiplier:
        this.squad.multiplyUnitDamage(cfg.unit, cfg.multiplier)
        return this.emptyApplyResult()
      default:
        this.assertNeverGateConfig(cfg)
    }
  }

  private createAddedUnitResult(unit: UnitType, count: number): GateApplyResult {
    const addedCount = Math.max(0, Math.floor(count))
    return addedCount <= 0 ? this.emptyApplyResult() : { addedUnits: [{ unit, count: addedCount }] }
  }

  private emptyApplyResult(): GateApplyResult {
    return { addedUnits: [] }
  }

  private pickChoice(gate: GatePair): GateConfig | null {
    if (this.squad.squadX < GATE_LEFT_LANE_X) {
      return gate.choices[0]
    }
    if (this.squad.squadX > GATE_RIGHT_LANE_X && gate.rightBarrier.hp <= 0) {
      return gate.choices[1]
    }
    return null
  }

  private createRightBarrier(choice: GateConfig, visual: GateBarrierVisual, enabled: boolean, progressZ: number): GateBarrier {
    if (!enabled) {
      for (const mesh of visual.allMeshes) {
        mesh.setEnabled(false)
      }
      return {
        hp: 0,
        maxHp: 0,
        progressHpMultiplier: 0,
        visual,
        hitPulse: 0,
        breakLife: 0,
        destroyed: true,
        impacts: 0,
      }
    }
    const baseHp = GATE_BARRIER_BASE_HP + Math.max(0, choice.effectScore) * GATE_BARRIER_SCORE_HP
    const progressHpMultiplier = this.getBarrierProgressHpMultiplier(progressZ)
    const maxHp = Math.round(baseHp * progressHpMultiplier)
    return {
      hp: maxHp,
      maxHp,
      progressHpMultiplier,
      visual,
      hitPulse: 0,
      breakLife: 0,
      destroyed: false,
      impacts: 0,
    }
  }

  private getBarrierProgressHpMultiplier(progressZ: number): number {
    const stageRatio = Math.max(0, Math.min(1, progressZ / this.stageLength))
    if (stageRatio <= GATE_BARRIER_PROGRESS_HP_RAMP_START) {
      return 1
    }
    if (stageRatio >= GATE_BARRIER_PROGRESS_HP_RAMP_END) {
      return GATE_BARRIER_MAX_PROGRESS_HP_MULTIPLIER
    }
    const linear = (stageRatio - GATE_BARRIER_PROGRESS_HP_RAMP_START)
      / (GATE_BARRIER_PROGRESS_HP_RAMP_END - GATE_BARRIER_PROGRESS_HP_RAMP_START)
    const eased = linear * linear * (3 - 2 * linear)
    return 1 + (GATE_BARRIER_MAX_PROGRESS_HP_MULTIPLIER - 1) * eased
  }

  private damageRightBarrier(gate: GatePair, dt: number): void {
    const barrier = gate.rightBarrier
    if (barrier.hitPulse > 0) {
      barrier.hitPulse = Math.max(0, barrier.hitPulse - dt)
      const pulse = barrier.hitPulse / GATE_BARRIER_HIT_PULSE_SECONDS
      barrier.visual.wall.scaling.set(1 + pulse * 0.045, 1 - pulse * 0.025, 1 + pulse * 0.08)
    }
    if (barrier.hitPulse <= 0 && barrier.hp > 0) {
      barrier.visual.wall.scaling.set(1, 1, 1)
    }
    if (!barrier.destroyed || barrier.breakLife <= 0) {
      return
    }
    barrier.breakLife = Math.max(0, barrier.breakLife - dt)
    const age = 1 - barrier.breakLife / GATE_BARRIER_BREAK_SECONDS
    for (let index = 0; index < barrier.visual.breakMeshes.length; index += 1) {
      const mesh = barrier.visual.breakMeshes[index]
      if (mesh === undefined) {
        continue
      }
      const direction = index === 1 ? -1 : index === 2 ? 1 : 0
      mesh.position.x += direction * dt * 1.65
      mesh.position.y = Math.max(0.18, mesh.position.y - dt * (0.55 + index * 0.12))
      mesh.rotation.z = direction * age * 0.32
      mesh.rotation.x = age * 0.16
      mesh.scaling.setAll(Math.max(0.08, 1 - age * 0.18))
    }
    if (barrier.breakLife > 0) {
      return
    }
    for (const mesh of barrier.visual.allMeshes) {
      mesh.setEnabled(false)
    }
  }

  private applyBarrierImpact(gate: GatePair, damage: number, impact: Vector3): boolean {
    const barrier = gate.rightBarrier
    if (gate.passed || barrier.hp <= 0) {
      return false
    }
    barrier.hp = Math.max(0, barrier.hp - damage)
    barrier.hitPulse = GATE_BARRIER_HIT_PULSE_SECONDS
    barrier.impacts += 1
    this.fx.playHitSpark(impact)
    this.updateBarrierVisual(gate, impact)
    return true
  }

  private updateBarrierVisual(gate: GatePair, impact: Vector3): void {
    const barrier = gate.rightBarrier
    const hpRatio = this.getBarrierHpRatio(barrier)
    barrier.visual.hpFill.scaling.x = Math.max(0.001, hpRatio)
    barrier.visual.hpFill.position.x = GATE_RIGHT_X - (1 - hpRatio) * 1.58
    if (barrier.hp > 0) {
      return
    }
    barrier.destroyed = true
    barrier.breakLife = GATE_BARRIER_BREAK_SECONDS
    this.revealGate(gate)
    this.fx.playExplosion(impact, 1.35)
    barrier.visual.hpFill.setEnabled(false)
    for (const mesh of barrier.visual.breakMeshes) {
      mesh.setEnabled(true)
    }
  }

  private getBarrierHpRatio(barrier: GateBarrier): number {
    return barrier.maxHp <= 0 ? 0 : barrier.hp / barrier.maxHp
  }

  private getBarrierImpactZ(gate: GatePair): number {
    return gate.z + GATE_BARRIER_CENTER_Z_OFFSET - GATE_BARRIER_DEPTH * 0.5
  }

  private revealGate(gate: GatePair): void {
    if (gate.revealed) {
      return
    }
    gate.revealed = true
    gate.visuals[0].setDisplayText(gate.choices[0].displayText)
    gate.visuals[1].setDisplayText(gate.choices[1].displayText)
  }

  private assertNeverGateConfig(value: never): never {
    throw new Error(`Unhandled gate config: ${JSON.stringify(value)}`)
  }

  private assertNeverGateSpawn(value: never): never {
    throw new Error(`Unhandled gate spawn: ${JSON.stringify(value)}`)
  }
}
