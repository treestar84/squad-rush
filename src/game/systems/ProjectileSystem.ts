import { Scene, Vector3 } from "@babylonjs/core"
import { ObjectPool } from "../pools/ObjectPool"
import {
  BULLET_CORE_MIN_ALPHA,
  BULLET_FLASH_MIN_ALPHA,
  BULLET_FRONT_GLOW_OFFSET,
  BULLET_POST_IMPACT_HEAD_FADE_DISTANCE,
  BULLET_TRAIL_ALPHA,
  BULLET_TRAIL_MIN_ALPHA,
  BULLET_WAKE_FAR_OFFSET_RATIO,
  BULLET_WAKE_ALPHA,
  BULLET_WAKE_MIN_ALPHA,
  BULLET_WAKE_NEAR_OFFSET_RATIO,
  IMPACT_FLASH_BASE_SCALE,
  IMPACT_FLASH_DURATION_SECONDS,
  getProjectileMotionMetrics,
  type BulletStyle,
} from "./ProjectileMotion"
import { publishProjectileDebug } from "./ProjectileDebug"
import {
  createImpactFlash,
  createMuzzleFlash,
  createTrail,
  setMeshAlpha,
  type ImpactFlash,
  type MuzzleFlash,
  type Trail,
} from "./ProjectileVisuals"
import { configureBulletStyle, configureMuzzleFlash } from "./ProjectileStyling"

const PROJECTILE_PREWARM_CAPACITY = 96
const FLASH_PREWARM_CAPACITY = 72

export type ProjectileSystemOptions = {
  readonly compactVisuals?: boolean
  readonly effectStride?: number
  readonly prewarmCapacity?: number
}

export class ProjectileSystem {
  private readonly pool: ObjectPool<Trail>
  private readonly muzzlePool: ObjectPool<MuzzleFlash>
  private readonly impactPool: ObjectPool<ImpactFlash>
  private readonly debugEnabled = window.location.search.includes("qa=projectile")
  private readonly compactVisuals: boolean
  private readonly effectStride: number
  private shotsCreated = 0
  private impactsCreated = 0

  constructor(
    private readonly scene: Scene,
    capacity: number,
    options: ProjectileSystemOptions = {},
  ) {
    this.compactVisuals = options.compactVisuals === true
    this.effectStride = Math.max(1, Math.floor(options.effectStride ?? 1))
    const trailPrewarm = Math.min(capacity, options.prewarmCapacity ?? PROJECTILE_PREWARM_CAPACITY)
    const flashPrewarm = Math.min(capacity, this.compactVisuals ? 16 : FLASH_PREWARM_CAPACITY)
    this.pool = new ObjectPool<Trail>(
      (index) => {
        const trail = createTrail(this.scene, index)
        if (this.compactVisuals) {
          trail.wakeNear.setEnabled(false)
          trail.wakeFar.setEnabled(false)
          trail.tip.setEnabled(false)
          trail.flash.setEnabled(false)
        }
        return trail
      },
      (trail) => {
        trail.root.setEnabled(false)
        trail.root.position.set(0, 0, 0)
        trail.root.rotation.set(0, 0, 0)
        trail.root.scaling.set(1, 1, 1)
        trail.life = 0
        trail.travelDistance = 0
        trail.impactDistance = 0
        trail.tailClearDistance = 0
        trail.traveled = 0
        trail.originZ = 0
        trail.velocityX = 0
        trail.velocityY = 0
        trail.velocityZ = 0
        trail.impactX = 0
        trail.impactY = 0
        trail.impactZ = 0
        trail.impactTriggered = false
        trail.stopAtImpact = false
        trail.onImpact = null
      },
      trailPrewarm,
      capacity,
    )
    this.muzzlePool = new ObjectPool<MuzzleFlash>(
      (index) => createMuzzleFlash(this.scene, index),
      (flash) => {
        flash.mesh.setEnabled(false)
        flash.life = 0
      },
      flashPrewarm,
      capacity,
    )
    this.impactPool = new ObjectPool<ImpactFlash>(
      (index) => createImpactFlash(this.scene, index),
      (flash) => {
        flash.core.setEnabled(false)
        flash.ring.setEnabled(false)
        flash.core.position.set(0, 0, 0)
        flash.ring.position.set(0, 0, 0)
        flash.core.scaling.set(1, 1, 1)
        flash.ring.scaling.set(1, 1, 1)
        flash.life = 0
      },
      flashPrewarm,
      capacity,
    )
  }

  addBullet(
    from: Vector3,
    to: Vector3,
    speed: number,
    style: BulletStyle,
    onImpact: () => void,
    impactAt = to,
    stopAtImpact = false,
  ): boolean {
    const trail = this.pool.get()
    if (trail === null) {
      return false
    }
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const length = Math.hypot(dx, dy, dz)
    if (length < 0.1) {
      this.pool.release(trail)
      return false
    }

    const metrics = getProjectileMotionMetrics(length, speed, style.effectiveRange)
    trail.root.position.copyFrom(from)
    trail.root.rotation.y = Math.atan2(dx, dz)
    trail.root.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz))
    trail.streak.scaling.z = metrics.visualLength
    trail.streak.position.z = -metrics.visualLength * 0.48
    if (!this.compactVisuals) {
      trail.wakeNear.scaling.setAll(1)
      trail.wakeFar.scaling.setAll(1)
      trail.wakeNear.position.z = -metrics.visualLength * BULLET_WAKE_NEAR_OFFSET_RATIO
      trail.wakeFar.position.z = -metrics.visualLength * BULLET_WAKE_FAR_OFFSET_RATIO
    }
    trail.slug.position.z = BULLET_FRONT_GLOW_OFFSET * 0.58
    trail.slug.scaling.setAll(1)
    trail.core.position.z = 0
    if (!this.compactVisuals) {
      trail.tip.position.z = BULLET_FRONT_GLOW_OFFSET
      trail.flash.position.z = BULLET_FRONT_GLOW_OFFSET
    }
    trail.core.scaling.setAll(1)
    if (!this.compactVisuals) {
      trail.tip.scaling.setAll(1)
      trail.flash.scaling.setAll(1)
    }
    trail.travelDistance = length
    const impactDx = impactAt.x - from.x
    const impactDy = impactAt.y - from.y
    const impactDz = impactAt.z - from.z
    trail.impactDistance = Math.min(length, Math.max(0.1, Math.hypot(impactDx, impactDy, impactDz)))
    trail.tailClearDistance = metrics.tailClearDistance
    trail.life = metrics.lifeSeconds
    trail.traveled = 0
    trail.originZ = from.z
    trail.velocityX = (dx / length) * speed
    trail.velocityY = (dy / length) * speed
    trail.velocityZ = (dz / length) * speed
    trail.impactX = impactAt.x
    trail.impactY = impactAt.y
    trail.impactZ = impactAt.z
    trail.impactTriggered = false
    trail.stopAtImpact = stopAtImpact
    trail.onImpact = onImpact
    configureBulletStyle(trail, style)
    this.shotsCreated += 1
    if (this.shotsCreated % this.effectStride === 0) {
      this.playMuzzleFlash(from, style)
    }
    setMeshAlpha(trail.streak, BULLET_TRAIL_ALPHA)
    if (!this.compactVisuals) {
      setMeshAlpha(trail.wakeNear, BULLET_WAKE_ALPHA)
      setMeshAlpha(trail.wakeFar, BULLET_WAKE_ALPHA * 0.74)
    }
    setMeshAlpha(trail.slug, 1)
    setMeshAlpha(trail.core, 1)
    if (!this.compactVisuals) {
      setMeshAlpha(trail.tip, 1)
      setMeshAlpha(trail.flash, 0.32)
    }
    trail.root.setEnabled(true)
    return true
  }

  update(dt: number): void {
    if (dt <= 0) {
      publishProjectileDebug(this.debugEnabled, this.pool.getActive(), this.shotsCreated)
      return
    }

    const activeTrails = this.pool.getActive()
    for (let index = activeTrails.length - 1; index >= 0; index -= 1) {
      const trail = activeTrails[index]
      if (trail === undefined) {
        continue
      }
      const stepX = trail.velocityX * dt
      const stepY = trail.velocityY * dt
      const stepZ = trail.velocityZ * dt
      const stepDistance = Math.hypot(stepX, stepY, stepZ)
      if (stepDistance <= 0) {
        this.pool.release(trail)
        continue
      }

      const releaseDistance = trail.impactDistance + (trail.stopAtImpact ? 0 : trail.tailClearDistance)
      const remainingDistance = Math.max(0, releaseDistance - trail.traveled)
      const clampedDistance = Math.min(stepDistance, remainingDistance)
      const stepRatio = clampedDistance / stepDistance
      trail.root.position.x += stepX * stepRatio
      trail.root.position.y += stepY * stepRatio
      trail.root.position.z += stepZ * stepRatio
      trail.traveled += clampedDistance
      trail.life -= dt
      if (!trail.impactTriggered && trail.traveled >= trail.impactDistance) {
        trail.impactTriggered = true
        this.impactsCreated += 1
        if (this.impactsCreated % this.effectStride === 0) {
          this.playImpactFlash(trail)
        }
        trail.onImpact?.()
        trail.onImpact = null
      }
      if (trail.traveled >= releaseDistance) {
        this.pool.release(trail)
        continue
      }

      const progress = Math.min(1, trail.traveled / trail.travelDistance)
      const tailProgress = trail.impactTriggered
        ? Math.min(1, (trail.traveled - trail.impactDistance) / trail.tailClearDistance)
        : 0
      const postImpactDistance = trail.impactTriggered ? Math.max(0, trail.traveled - trail.impactDistance) : 0
      const impactHeadFade = trail.impactTriggered
        ? Math.max(0, 1 - postImpactDistance / BULLET_POST_IMPACT_HEAD_FADE_DISTANCE)
        : 1
      const fade = (1 - progress * 0.06) * (1 - tailProgress * 0.28)
      trail.root.scaling.set(1 + progress * 0.08, 1 + progress * 0.08, 1)
      trail.slug.scaling.setAll(1 + progress * 0.05)
      if (!this.compactVisuals) {
        trail.tip.scaling.setAll(1 + progress * 0.18)
        trail.flash.scaling.setAll(1 + progress * 0.24)
      }
      trail.streak.scaling.x = Math.max(0.58, 1 - progress * 0.1)
      trail.streak.scaling.y = Math.max(0.58, 1 - progress * 0.1)
      if (!this.compactVisuals) {
        trail.wakeNear.scaling.setAll(1 + progress * 0.08)
        trail.wakeFar.scaling.setAll(1 + progress * 0.05)
      }
      setMeshAlpha(trail.streak, Math.max(BULLET_TRAIL_MIN_ALPHA * (1 - tailProgress * 0.72), fade * BULLET_TRAIL_ALPHA))
      if (!this.compactVisuals) {
        setMeshAlpha(trail.wakeNear, Math.max(BULLET_WAKE_MIN_ALPHA * (1 - tailProgress), fade * BULLET_WAKE_ALPHA))
        setMeshAlpha(trail.wakeFar, Math.max(BULLET_WAKE_MIN_ALPHA * (1 - tailProgress), fade * BULLET_WAKE_ALPHA * 0.74))
      }
      setMeshAlpha(trail.slug, Math.max(0, Math.max(BULLET_CORE_MIN_ALPHA * (1 - tailProgress * 0.72), fade) * impactHeadFade))
      setMeshAlpha(trail.core, Math.max(0, Math.max(BULLET_CORE_MIN_ALPHA * (1 - tailProgress * 0.78), fade) * impactHeadFade))
      if (!this.compactVisuals) {
        setMeshAlpha(trail.tip, Math.max(0, Math.max(BULLET_CORE_MIN_ALPHA * (1 - tailProgress * 0.78), fade) * impactHeadFade))
        setMeshAlpha(
          trail.flash,
          Math.max(
            0,
            Math.max(BULLET_FLASH_MIN_ALPHA * (1 - tailProgress * 0.56), 0.32 - progress * 0.04 - tailProgress * 0.12) *
              impactHeadFade,
          ),
        )
      }
    }

    const activeMuzzles = this.muzzlePool.getActive()
    for (let index = activeMuzzles.length - 1; index >= 0; index -= 1) {
      const muzzle = activeMuzzles[index]
      if (muzzle === undefined) {
        continue
      }
      muzzle.life -= dt
      const age = 1 - Math.max(0, muzzle.life / muzzle.duration)
      muzzle.mesh.scaling.setAll(muzzle.baseScale * (1.2 + age * 1.9))
      setMeshAlpha(muzzle.mesh, Math.max(0, 0.82 - age))
      if (muzzle.life <= 0) {
        this.muzzlePool.release(muzzle)
      }
    }

    const activeImpacts = this.impactPool.getActive()
    for (let index = activeImpacts.length - 1; index >= 0; index -= 1) {
      const impact = activeImpacts[index]
      if (impact === undefined) {
        continue
      }
      impact.life -= dt
      const age = 1 - Math.max(0, impact.life / impact.duration)
      impact.core.scaling.setAll(impact.baseScale * (1.4 + age * 1.4))
      impact.ring.scaling.setAll(impact.baseScale * (1.1 + age * 2.2))
      setMeshAlpha(impact.core, Math.max(0, 0.78 - age * 1.05))
      setMeshAlpha(impact.ring, Math.max(0, 0.62 - age))
      if (impact.life <= 0) {
        this.impactPool.release(impact)
      }
    }
    publishProjectileDebug(this.debugEnabled, this.pool.getActive(), this.shotsCreated)
  }

  private playMuzzleFlash(from: Vector3, style: BulletStyle): void {
    const flash = this.muzzlePool.get()
    if (flash === null) {
      return
    }
    flash.mesh.position.copyFrom(from)
    flash.mesh.position.y += 0.04
    configureMuzzleFlash(flash, style)
    flash.mesh.setEnabled(true)
  }

  private playImpactFlash(trail: Trail): void {
    const flash = this.impactPool.get()
    if (flash === null) {
      return
    }
    flash.duration = IMPACT_FLASH_DURATION_SECONDS
    flash.life = flash.duration
    flash.baseScale = IMPACT_FLASH_BASE_SCALE
    flash.core.position.set(trail.impactX, trail.impactY, trail.impactZ)
    flash.ring.position.set(trail.impactX, trail.impactY, trail.impactZ)
    flash.ring.rotation.x = Math.PI * 0.5
    flash.core.scaling.setAll(flash.baseScale)
    flash.ring.scaling.setAll(flash.baseScale)
    setMeshAlpha(flash.core, 0.78)
    setMeshAlpha(flash.ring, 0.62)
    flash.core.setEnabled(true)
    flash.ring.setEnabled(true)
  }
}
