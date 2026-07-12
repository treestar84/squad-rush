import { Vector3 } from "@babylonjs/core"
import { MONSTER_BEHAVIORS, MONSTER_KILL_REASONS } from "../data/monsterData"
import { SOLDIER_BASE } from "../data/soldierData"
import { GAME_MODE_IDS, type GameModeProfile } from "../data/gameModeData"
import type { MonsterInstance } from "../pools/MonsterPool"
import type { CollisionSystem } from "./CollisionSystem"
import type { GateBarrierShotTarget, GateSystem } from "./GateSystem"
import type { MonsterWaveSystem } from "./MonsterWaveSystem"
import type { ProjectileSystem } from "./ProjectileSystem"
import { ShootingHitDebug } from "./ShootingHitDebug"
import type { SquadCombatStats, SquadSystem } from "./SquadSystem"

const FORWARD_FIRE_AIM_HALF_WIDTH = 0.72
const BULLET_IMPACT_HEIGHT = 0.38
const LATERAL_TARGET_WEIGHT = 4
const MIN_PROJECTILE_IMPACT_DISTANCE = 0.1
const BULLET_IMPACT_VISUAL_SYNC_TOLERANCE = 0.35
const BULLET_IMPACT_REACH_PADDING = 0.22
const MONSTER_FRONT_SURFACE_INSET = 0.04
const DEFENSE_ATTACK_RANGE = 24
const DEFENSE_MAX_SHOTS_PER_UPDATE = 2
const NOOP_PROJECTILE_IMPACT = (): void => {}

type DefenseFireDebugState = {
  readonly emitterCount: number
  readonly observedEmitterCount: number
  readonly staggerIntervalSeconds: number
  readonly configuredMaxShotsPerUpdate: number
  readonly shots: number
  readonly shotUpdates: number
  readonly lastUpdateShots: number
  readonly maxShotsPerUpdate: number
  readonly maxSameUpdateOriginWidth: number
  readonly minShotGapMs: number
  readonly averageShotGapMs: number
  readonly shotsPerSecond: number
}

declare global {
  interface Window {
    __squadRushDefenseFireDebug?: DefenseFireDebugState
  }
}

type MonsterShotTarget = {
  readonly monster: MonsterInstance
  readonly distance: number
}

type ForwardShotTarget =
  | { readonly kind: "monster"; readonly target: MonsterShotTarget }
  | { readonly kind: "barrier"; readonly target: GateBarrierShotTarget }

export class ShootingSystem {
  private readonly timers: number[] = []
  private readonly reservedTargets = new Set<MonsterInstance>()
  private readonly lethalReservedTargets = new Set<MonsterInstance>()
  private readonly tankReservationCounts = new Map<MonsterInstance, number>()
  private readonly tankLethalReservationCounts = new Map<MonsterInstance, number>()
  private readonly shotFrom = new Vector3(0, 0, 0)
  private readonly shotTo = new Vector3(0, 0, 0)
  private readonly shotImpact = new Vector3(0, 0, 0)
  private readonly bulletStyle = { power: 1, effectiveRange: SOLDIER_BASE.attackRange }
  private readonly hitDebug = new ShootingHitDebug()
  private readonly immortalMonsterQa = window.location.search.includes("qaImmortalMonsters=1")
  private readonly defenseFireStaggerEnabled: boolean
  private readonly defenseStaggerIntervalSeconds: number
  private readonly defenseFireDebugEnabled = window.location.search.includes("qa=defense-fire")
  private defenseEmitterCursor = 0
  private debugShots = 0
  private debugShotUpdates = 0
  private debugLastUpdateShots = 0
  private debugMaxShotsPerUpdate = 0
  private debugMaxSameUpdateOriginWidth = 0
  private debugCurrentUpdateShots = 0
  private debugCurrentUpdateMinX = Number.POSITIVE_INFINITY
  private debugCurrentUpdateMaxX = Number.NEGATIVE_INFINITY
  private debugObservedEmitterMask = 0
  private debugFirstShotAt = 0
  private debugLastShotAt = 0
  private debugMinShotGapMs = Number.POSITIVE_INFINITY
  private debugTotalShotGapMs = 0
  private debugShotGapCount = 0
  onMonsterKilled?: (monster: MonsterInstance) => void
  onDamage?: (damage: number, target: MonsterInstance) => void
  onShot?: (power: number) => void

  constructor(
    private readonly squad: SquadSystem,
    private readonly waves: MonsterWaveSystem,
    private readonly collision: CollisionSystem,
    private readonly gates: GateSystem,
    private readonly projectiles: ProjectileSystem,
    maxSoldiers: number,
    private readonly mode: GameModeProfile,
  ) {
    this.defenseFireStaggerEnabled = mode.id === GAME_MODE_IDS.defense
    const staggerEmitterCount = Math.max(1, this.squad.fireEmitterCapacity)
    const cooldown = 1 / SOLDIER_BASE.fireRate
    this.defenseStaggerIntervalSeconds = this.defenseFireStaggerEnabled
      ? cooldown / staggerEmitterCount
      : 0
    for (let index = 0; index < maxSoldiers; index += 1) {
      this.timers.push(this.defenseFireStaggerEnabled
        ? (index % staggerEmitterCount) * this.defenseStaggerIntervalSeconds
        : 0)
    }
  }

  update(dt: number, stats: SquadCombatStats): void {
    this.beginDefenseFireDebugUpdate()
    const cooldown = 1 / SOLDIER_BASE.fireRate
    const damage = SOLDIER_BASE.attackDamage * stats.attackMultiplier
    const range = this.getAttackRange()
    const emitterCount = this.squad.getFireEmitterCount()
    let hasReadyEmitter = false
    for (let index = 0; index < emitterCount; index += 1) {
      this.timers[index] = (this.timers[index] ?? 0) - dt
      hasReadyEmitter ||= (this.timers[index] ?? 0) <= 0
    }
    if (!hasReadyEmitter) {
      this.hitDebug.publish(this.reservedTargets.size)
      this.publishDefenseFireDebug(emitterCount)
      return
    }

    const muzzlePositions = this.squad.getMuzzlePositions()
    this.bulletStyle.power = stats.attackMultiplier
    this.bulletStyle.effectiveRange = range

    const maxShotsThisUpdate = this.defenseFireStaggerEnabled
      ? Math.min(DEFENSE_MAX_SHOTS_PER_UPDATE, emitterCount)
      : emitterCount
    let checkedEmitters = 0
    let firedEmitters = 0
    let index = this.defenseFireStaggerEnabled && emitterCount > 0
      ? this.defenseEmitterCursor % emitterCount
      : 0
    while (checkedEmitters < emitterCount && firedEmitters < maxShotsThisUpdate) {
      const position = muzzlePositions[index]
      if ((this.timers[index] ?? 0) <= 0 && position !== undefined) {
        this.fireEmitter(index, position, stats, damage, range, cooldown)
        firedEmitters += 1
      }
      checkedEmitters += 1
      index = emitterCount > 0 ? (index + 1) % emitterCount : 0
    }
    if (this.defenseFireStaggerEnabled && emitterCount > 0) {
      this.defenseEmitterCursor = index
    }
    this.hitDebug.publish(this.reservedTargets.size)
    this.publishDefenseFireDebug(emitterCount)
  }

  private fireEmitter(
    index: number,
    position: Vector3,
    stats: SquadCombatStats,
    damage: number,
    range: number,
    cooldown: number,
  ): void {
    this.timers[index] = cooldown
    const forwardTarget = this.findForwardTarget(position.x, position.z, range)
    if (forwardTarget === null) {
      this.shotFrom.copyFrom(position)
      this.setUntargetedImpactPoint(range)
      this.projectiles.addBullet(
        this.shotFrom,
        this.shotTo,
        SOLDIER_BASE.bulletSpeed,
        this.bulletStyle,
        NOOP_PROJECTILE_IMPACT,
        this.shotImpact,
      )
      this.notifyShot(stats.attackMultiplier, index, position)
      return
    }
    if (forwardTarget.kind === "barrier") {
      const barrier = forwardTarget.target
      this.shotFrom.copyFrom(position)
      this.shotTo.copyFrom(barrier.impact)
      this.shotImpact.copyFrom(barrier.impact)
      const bulletCreated = this.projectiles.addBullet(
        this.shotFrom,
        this.shotTo,
        SOLDIER_BASE.bulletSpeed,
        this.bulletStyle,
        () => {
          barrier.applyImpact(damage)
        },
        this.shotImpact,
      )
      if (!bulletCreated) {
        barrier.applyImpact(damage)
      }
      this.notifyShot(stats.attackMultiplier, index, position)
      return
    }
    const target = forwardTarget.target.monster
    const reservedAsLethal = this.waves.previewProjectileDamage(target, damage) >= target.hp
    this.reserveShotTarget(target, reservedAsLethal)
    const targetSpawnId = target.spawnId
    const targetBehavior = target.config?.behavior ?? null
    const stopProjectileAtImpact = targetBehavior === MONSTER_BEHAVIORS.tank
    this.shotFrom.copyFrom(position)
    this.setPredictedImpactPoint(target)
    this.hitDebug.recordShot({
      target,
      impactInset: this.shotImpact.z - (target.mesh.position.z - target.hitHalfDepth),
    })
    const bulletCreated = this.projectiles.addBullet(
      this.shotFrom,
      this.shotTo,
      SOLDIER_BASE.bulletSpeed,
      this.bulletStyle,
      () => {
        this.releaseShotTarget(target, reservedAsLethal)
        if (!target.alive || target.spawnId !== targetSpawnId) {
          this.hitDebug.recordStaleImpact(targetBehavior)
          return
        }
        this.applyImpactDamage(target, damage, targetBehavior)
      },
      this.shotImpact,
      stopProjectileAtImpact,
    )
    if (!bulletCreated) {
      this.releaseShotTarget(target, reservedAsLethal)
      this.applyImpactDamage(target, damage)
    }
    this.notifyShot(stats.attackMultiplier, index, position)
  }

  private notifyShot(power: number, emitterIndex: number, position: Vector3): void {
    this.onShot?.(power)
    if (!this.defenseFireDebugEnabled) {
      return
    }
    const now = performance.now()
    if (this.debugShots === 0) {
      this.debugFirstShotAt = now
    } else {
      const gap = now - this.debugLastShotAt
      this.debugMinShotGapMs = Math.min(this.debugMinShotGapMs, gap)
      this.debugTotalShotGapMs += gap
      this.debugShotGapCount += 1
    }
    this.debugLastShotAt = now
    this.debugShots += 1
    this.debugCurrentUpdateShots += 1
    this.debugCurrentUpdateMinX = Math.min(this.debugCurrentUpdateMinX, position.x)
    this.debugCurrentUpdateMaxX = Math.max(this.debugCurrentUpdateMaxX, position.x)
    this.debugObservedEmitterMask |= 1 << emitterIndex
  }

  private beginDefenseFireDebugUpdate(): void {
    if (!this.defenseFireDebugEnabled) {
      return
    }
    this.debugCurrentUpdateShots = 0
    this.debugCurrentUpdateMinX = Number.POSITIVE_INFINITY
    this.debugCurrentUpdateMaxX = Number.NEGATIVE_INFINITY
  }

  private publishDefenseFireDebug(emitterCount: number): void {
    if (!this.defenseFireDebugEnabled) {
      return
    }
    this.debugLastUpdateShots = this.debugCurrentUpdateShots
    if (this.debugCurrentUpdateShots > 0) {
      this.debugShotUpdates += 1
      this.debugMaxShotsPerUpdate = Math.max(this.debugMaxShotsPerUpdate, this.debugCurrentUpdateShots)
      this.debugMaxSameUpdateOriginWidth = Math.max(
        this.debugMaxSameUpdateOriginWidth,
        this.debugCurrentUpdateMaxX - this.debugCurrentUpdateMinX,
      )
    }
    const elapsedSeconds = Math.max(0.001, (performance.now() - this.debugFirstShotAt) / 1000)
    window.__squadRushDefenseFireDebug = {
      emitterCount,
      observedEmitterCount: this.countObservedDebugEmitters(),
      staggerIntervalSeconds: this.defenseStaggerIntervalSeconds,
      configuredMaxShotsPerUpdate: DEFENSE_MAX_SHOTS_PER_UPDATE,
      shots: this.debugShots,
      shotUpdates: this.debugShotUpdates,
      lastUpdateShots: this.debugLastUpdateShots,
      maxShotsPerUpdate: this.debugMaxShotsPerUpdate,
      maxSameUpdateOriginWidth: this.debugMaxSameUpdateOriginWidth,
      minShotGapMs: Number.isFinite(this.debugMinShotGapMs) ? this.debugMinShotGapMs : 0,
      averageShotGapMs: this.debugShotGapCount > 0 ? this.debugTotalShotGapMs / this.debugShotGapCount : 0,
      shotsPerSecond: this.debugShots / elapsedSeconds,
    }
  }

  private countObservedDebugEmitters(): number {
    let mask = this.debugObservedEmitterMask
    let count = 0
    while (mask > 0) {
      count += mask & 1
      mask >>>= 1
    }
    return count
  }

  private reserveShotTarget(target: MonsterInstance, lethal: boolean): void {
    const wasAlreadyReserved = this.reservedTargets.has(target)
    this.reservedTargets.add(target)
    if (target.config?.behavior !== MONSTER_BEHAVIORS.tank) {
      if (lethal) {
        this.lethalReservedTargets.add(target)
      }
      return
    }
    const concurrentReservations = (this.tankReservationCounts.get(target) ?? 0) + 1
    this.tankReservationCounts.set(target, concurrentReservations)
    if (lethal) {
      const lethalReservations = (this.tankLethalReservationCounts.get(target) ?? 0) + 1
      this.tankLethalReservationCounts.set(target, lethalReservations)
      this.lethalReservedTargets.add(target)
    }
    this.hitDebug.recordTankReservation(concurrentReservations, wasAlreadyReserved)
  }

  private releaseShotTarget(target: MonsterInstance, lethal: boolean): void {
    if (target.config?.behavior !== MONSTER_BEHAVIORS.tank) {
      this.reservedTargets.delete(target)
      if (lethal) {
        this.lethalReservedTargets.delete(target)
      }
      return
    }
    const remainingReservations = Math.max(0, (this.tankReservationCounts.get(target) ?? 1) - 1)
    if (remainingReservations > 0) {
      this.tankReservationCounts.set(target, remainingReservations)
    } else {
      this.tankReservationCounts.delete(target)
      this.reservedTargets.delete(target)
    }
    if (!lethal) {
      return
    }
    const remainingLethalReservations = Math.max(0, (this.tankLethalReservationCounts.get(target) ?? 1) - 1)
    if (remainingLethalReservations > 0) {
      this.tankLethalReservationCounts.set(target, remainingLethalReservations)
    } else {
      this.tankLethalReservationCounts.delete(target)
      this.lethalReservedTargets.delete(target)
    }
  }

  willReservedImpactKill(target: MonsterInstance): boolean {
    return this.lethalReservedTargets.has(target)
  }

  private getAttackRange(): number {
    return this.mode.id === GAME_MODE_IDS.defense ? DEFENSE_ATTACK_RANGE : SOLDIER_BASE.attackRange
  }

  private applyImpactDamage(target: MonsterInstance, damage: number, behavior = target.config?.behavior ?? null): void {
    const wasAlive = target.alive
    this.applyDamage(target, damage)
    this.hitDebug.recordImpact({
      wasAlive,
      killed: wasAlive && !target.alive,
      damagedTargets: 1,
      behavior,
    })
  }

  private applyDamage(target: MonsterInstance, damage: number): void {
    if (!target.alive) {
      return
    }
    const resolvedDamage = this.waves.resolveProjectileDamage(target, damage)
    if (this.immortalMonsterQa) {
      this.waves.markHit(target)
      this.onDamage?.(resolvedDamage, target)
      return
    }
    target.hp -= resolvedDamage
    if (target.hp > 0) {
      this.waves.markHit(target)
    }
    this.onDamage?.(resolvedDamage, target)
    if (target.hp <= 0) {
      this.waves.kill(target, MONSTER_KILL_REASONS.projectile)
      this.onMonsterKilled?.(target)
    }
  }

  private setPredictedImpactPoint(target: MonsterInstance): void {
    const targetFrontZ = target.mesh.position.z - target.hitHalfDepth + MONSTER_FRONT_SURFACE_INSET
    const impactZ = Math.max(
      this.shotFrom.z + MIN_PROJECTILE_IMPACT_DISTANCE,
      targetFrontZ,
    ) + BULLET_IMPACT_REACH_PADDING
    this.shotImpact.set(target.mesh.position.x, BULLET_IMPACT_HEIGHT, impactZ)
    this.shotTo.copyFrom(this.shotImpact)
    if (this.shotTo.z + BULLET_IMPACT_VISUAL_SYNC_TOLERANCE < this.shotImpact.z) {
      this.shotTo.z = this.shotImpact.z
    }
  }

  private setUntargetedImpactPoint(range: number): void {
    const impactZ = this.shotFrom.z + range
    this.shotImpact.set(this.shotFrom.x, BULLET_IMPACT_HEIGHT, impactZ)
    this.shotTo.copyFrom(this.shotImpact)
  }

  private findForwardTarget(x: number, z: number, range: number): ForwardShotTarget | null {
    const monster = this.findForwardMonsterTarget(x, z, range)
    const barrier = this.gates.findBarrierTarget(x, z, range)
    if (barrier !== null && (monster === null || barrier.distance < monster.distance)) {
      return { kind: "barrier", target: barrier }
    }
    if (monster === null) {
      return null
    }
    return { kind: "monster", target: monster }
  }

  private findForwardMonsterTarget(x: number, z: number, range: number): MonsterShotTarget | null {
    const blockingTank = this.findBlockingTankTarget(x, z, range)
    const foregroundTarget = this.findForegroundMonsterTarget(x, z, range, blockingTank?.distance ?? null)
    return foregroundTarget ?? blockingTank
  }

  private findBlockingTankTarget(x: number, z: number, range: number): MonsterShotTarget | null {
    let target: MonsterInstance | null = null
    let targetDistance = Number.POSITIVE_INFINITY
    for (const monster of this.collision.getAliveMonsters()) {
      if (monster.config?.behavior !== MONSTER_BEHAVIORS.tank) {
        continue
      }
      const dx = monster.mesh.position.x - x
      const dz = monster.mesh.position.z - z
      const targetReach = range + monster.projectileHitRadius
      if (dx * dx + dz * dz > targetReach * targetReach) {
        continue
      }
      // The enlarged projectile depth is rear-only for interception. Using it on
      // the visible front would make the boss shield regular monsters ahead of it.
      const targetFrontDistance = dz - monster.hitHalfDepth
      const targetBackDistance = dz + monster.projectileHitHalfDepth
      if (
        targetBackDistance <= 0
        || targetFrontDistance <= 0.05
        || targetFrontDistance > range
        || Math.abs(dx) > monster.projectileHitRadius
      ) {
        continue
      }
      const visibleDistance = Math.max(0, targetFrontDistance)
      if (visibleDistance < targetDistance) {
        target = monster
        targetDistance = visibleDistance
      }
    }
    return target === null ? null : { monster: target, distance: targetDistance }
  }

  private findForegroundMonsterTarget(
    x: number,
    z: number,
    range: number,
    blockingDistance: number | null,
  ): MonsterShotTarget | null {
    let target: MonsterInstance | null = null
    let targetDistance = Number.POSITIVE_INFINITY
    let bestScore = Number.POSITIVE_INFINITY
    for (const monster of this.collision.getAliveMonsters()) {
      if (monster.config?.behavior === MONSTER_BEHAVIORS.tank) {
        continue
      }
      const dx = monster.mesh.position.x - x
      const dz = monster.mesh.position.z - z
      const targetReach = range + monster.projectileHitRadius
      if (dx * dx + dz * dz > targetReach * targetReach) {
        continue
      }
      const targetFrontDistance = dz - monster.projectileHitHalfDepth
      const targetBackDistance = dz + monster.projectileHitHalfDepth
      const aimHalfWidth = monster.projectileHitRadius + FORWARD_FIRE_AIM_HALF_WIDTH
      if (
        // Normal targets avoid overkill. A mid-boss is handled separately and
        // deliberately accepts every projectile intersecting its silhouette.
        this.reservedTargets.has(monster)
        || targetBackDistance <= 0
        || targetFrontDistance <= 0.05
        || targetFrontDistance > range
        || (blockingDistance !== null && targetFrontDistance >= blockingDistance)
        || Math.abs(dx) > aimHalfWidth
      ) {
        continue
      }
      const visibleDistance = Math.max(0, targetFrontDistance)
      const lateralMiss = Math.max(0, Math.abs(dx) - monster.projectileHitRadius)
      const score = (visibleDistance + lateralMiss * LATERAL_TARGET_WEIGHT)
        * this.waves.getTargetPriorityMultiplier(monster)
      if (score < bestScore) {
        target = monster
        targetDistance = visibleDistance
        bestScore = score
      }
    }
    return target === null ? null : { monster: target, distance: targetDistance }
  }
}
