import { Vector3 } from "@babylonjs/core"
import { SOLDIER_BASE } from "../data/soldierData"
import type { MonsterInstance } from "../pools/MonsterPool"
import type { CollisionSystem } from "./CollisionSystem"
import type { GateSystem } from "./GateSystem"
import type { MonsterWaveSystem } from "./MonsterWaveSystem"
import type { BulletStyle } from "./ProjectileMotion"
import type { ProjectileSystem } from "./ProjectileSystem"
import { ShootingHitDebug } from "./ShootingHitDebug"
import type { SquadSystem } from "./SquadSystem"

const FORWARD_FIRE_AIM_HALF_WIDTH = 0.72
const BULLET_IMPACT_HEIGHT = 0.38
const LATERAL_TARGET_WEIGHT = 4
const MIN_PROJECTILE_IMPACT_DISTANCE = 0.1
const BULLET_IMPACT_VISUAL_SYNC_TOLERANCE = 0.35
const BULLET_IMPACT_REACH_PADDING = 0.22
const MONSTER_FRONT_SURFACE_INSET = 0.04

export class ShootingSystem {
  private readonly timers: number[] = []
  private readonly reservedTargets = new Set<MonsterInstance>()
  private readonly lethalReservedTargets = new Set<MonsterInstance>()
  private readonly shotFrom = new Vector3(0, 0, 0)
  private readonly shotTo = new Vector3(0, 0, 0)
  private readonly shotImpact = new Vector3(0, 0, 0)
  private readonly hitDebug = new ShootingHitDebug()
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
  ) {
    for (let index = 0; index < maxSoldiers; index += 1) {
      this.timers.push(0)
    }
  }

  update(dt: number): void {
    const stats = this.gates.getStats()
    const cooldown = 1 / SOLDIER_BASE.fireRate
    const damage = SOLDIER_BASE.attackDamage * stats.attackMultiplier
    const range = SOLDIER_BASE.attackRange
    const muzzlePositions = this.squad.getMuzzlePositions()

    for (let index = 0; index < muzzlePositions.length; index += 1) {
      this.timers[index] = (this.timers[index] ?? 0) - dt
      if ((this.timers[index] ?? 0) > 0) {
        continue
      }
      const position = muzzlePositions[index]
      if (position === undefined) {
        continue
      }
      const target = this.findForwardTarget(position.x, position.z, range)
      if (target === null) {
        this.timers[index] = cooldown
        this.shotFrom.copyFrom(position)
        this.setUntargetedImpactPoint(range)
        this.projectiles.addBullet(
          this.shotFrom,
          this.shotTo,
          SOLDIER_BASE.bulletSpeed,
          {
            power: stats.attackMultiplier,
            effectiveRange: range,
          },
          () => {},
          this.shotImpact,
        )
        this.onShot?.(stats.attackMultiplier)
        continue
      }
      this.timers[index] = cooldown
      this.reservedTargets.add(target)
      if (damage >= target.hp) {
        this.lethalReservedTargets.add(target)
      }
      const targetSpawnId = target.spawnId
      const targetBehavior = target.config?.behavior ?? null
      const bulletStyle: BulletStyle = {
        power: stats.attackMultiplier,
        effectiveRange: range,
      }
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
        bulletStyle,
        () => {
          this.reservedTargets.delete(target)
          this.lethalReservedTargets.delete(target)
          if (!target.alive || target.spawnId !== targetSpawnId) {
            this.hitDebug.recordStaleImpact(targetBehavior)
            return
          }
          this.applyImpactDamage(target, damage, targetBehavior)
        },
        this.shotImpact,
      )
      if (!bulletCreated) {
        this.reservedTargets.delete(target)
        this.lethalReservedTargets.delete(target)
        this.applyImpactDamage(target, damage)
      }
      this.onShot?.(stats.attackMultiplier)
    }
    this.hitDebug.publish(this.reservedTargets.size)
  }

  willReservedImpactKill(target: MonsterInstance): boolean {
    return this.lethalReservedTargets.has(target)
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
    target.hp -= damage
    if (target.hp > 0) {
      this.waves.markHit(target)
    }
    this.onDamage?.(damage, target)
    if (target.hp <= 0) {
      this.waves.kill(target)
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

  private findForwardTarget(x: number, z: number, range: number): MonsterInstance | null {
    const candidates = this.collision.getBulletsInRange(x, z, range)
    let target: MonsterInstance | null = null
    let bestScore = Number.POSITIVE_INFINITY
    for (const monster of candidates) {
      const dx = monster.mesh.position.x - x
      const dz = monster.mesh.position.z - z
      const targetFrontDistance = dz - monster.hitHalfDepth
      const targetBackDistance = dz + monster.hitHalfDepth
      const aimHalfWidth = FORWARD_FIRE_AIM_HALF_WIDTH + monster.hitRadius
      if (
        this.reservedTargets.has(monster)
        || targetBackDistance <= 0
        || targetFrontDistance <= 0.05
        || targetFrontDistance > range
        || Math.abs(dx) > aimHalfWidth
      ) {
        continue
      }
      const visibleDistance = Math.max(0, targetFrontDistance)
      const lateralMiss = Math.max(0, Math.abs(dx) - monster.hitRadius)
      const score = visibleDistance + lateralMiss * LATERAL_TARGET_WEIGHT
      if (score < bestScore) {
        target = monster
        bestScore = score
      }
    }
    return target
  }
}
