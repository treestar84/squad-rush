import { Vector3 } from "@babylonjs/core"
import { BULLET_FRONT_GLOW_OFFSET } from "./ProjectileMotion"
import { getMeshAlpha, type Trail } from "./ProjectileVisuals"

type ProjectileDebugState = {
  readonly active: number
  readonly shotsCreated: number
  readonly maxTravelRatio: number
  readonly maxPreImpactTravelRatio: number
  readonly maxPreImpactHeadWorldAdvance: number
  readonly maxVisualHeadWorldAdvance: number
  readonly maxNearImpactVisibleRatio: number
  readonly maxPostImpactVisualTravelRatio: number
  readonly maxPostImpactDistance: number
  readonly maxImpactToVisualDistance: number
  readonly minVisualReach: number
  readonly maxImpactDistance: number
  readonly minPreImpactHeadAlpha: number
  readonly minPreImpactTrailAlpha: number
}

declare global {
  interface Window {
    __squadRushProjectileDebug?: ProjectileDebugState
  }
}

const headLocalPosition = new Vector3(0, 0, BULLET_FRONT_GLOW_OFFSET)
const headWorldPosition = new Vector3(0, 0, 0)

export function publishProjectileDebug(enabled: boolean, trails: readonly Trail[], shotsCreated: number): void {
  if (!enabled) {
    return
  }
  let maxTravelRatio = 0
  let maxPreImpactTravelRatio = 0
  let maxPreImpactHeadWorldAdvance = 0
  let maxVisualHeadWorldAdvance = 0
  let maxNearImpactVisibleRatio = 0
  let maxPostImpactVisualTravelRatio = 0
  let maxPostImpactDistance = 0
  let maxImpactToVisualDistance = 0
  let minVisualReach = Number.POSITIVE_INFINITY
  let maxImpactDistance = 0
  let minPreImpactHeadAlpha = Number.POSITIVE_INFINITY
  let minPreImpactTrailAlpha = Number.POSITIVE_INFINITY
  for (const trail of trails) {
    if (trail.travelDistance <= 0) {
      continue
    }
    const travelRatio = trail.traveled / trail.travelDistance
    maxTravelRatio = Math.max(maxTravelRatio, travelRatio)
    minVisualReach = Math.min(minVisualReach, Math.abs(trail.wakeFar.position.z) + Math.max(0, trail.flash.position.z))
    maxImpactDistance = Math.max(maxImpactDistance, trail.travelDistance)
    Vector3.TransformCoordinatesToRef(headLocalPosition, trail.root.getWorldMatrix(), headWorldPosition)
    maxVisualHeadWorldAdvance = Math.max(maxVisualHeadWorldAdvance, Math.max(0, headWorldPosition.z - trail.originZ))
    if (!trail.impactTriggered) {
      const impactRatio = trail.traveled / Math.max(0.1, trail.impactDistance)
      maxPreImpactTravelRatio = Math.max(maxPreImpactTravelRatio, impactRatio)
      maxPreImpactHeadWorldAdvance = Math.max(maxPreImpactHeadWorldAdvance, Math.max(0, headWorldPosition.z - trail.originZ))
      const headAlpha = Math.min(getMeshAlpha(trail.slug), getMeshAlpha(trail.core), getMeshAlpha(trail.tip))
      if (impactRatio >= 0.82 && headAlpha >= 0.72) {
        maxNearImpactVisibleRatio = Math.max(maxNearImpactVisibleRatio, impactRatio)
      }
      minPreImpactHeadAlpha = Math.min(minPreImpactHeadAlpha, headAlpha)
      minPreImpactTrailAlpha = Math.min(
        minPreImpactTrailAlpha,
        getMeshAlpha(trail.streak),
        getMeshAlpha(trail.wakeNear),
        getMeshAlpha(trail.wakeFar),
      )
    } else {
      const postImpactDistance = Math.max(0, trail.traveled - trail.impactDistance)
      maxPostImpactVisualTravelRatio = Math.max(maxPostImpactVisualTravelRatio, travelRatio)
      maxPostImpactDistance = Math.max(maxPostImpactDistance, postImpactDistance)
      maxImpactToVisualDistance = Math.max(maxImpactToVisualDistance, trail.travelDistance - trail.impactDistance)
    }
  }
  window.__squadRushProjectileDebug = {
    active: trails.length,
    shotsCreated,
    maxTravelRatio,
    maxPreImpactTravelRatio,
    maxPreImpactHeadWorldAdvance,
    maxVisualHeadWorldAdvance,
    maxNearImpactVisibleRatio,
    maxPostImpactVisualTravelRatio,
    maxPostImpactDistance,
    maxImpactToVisualDistance,
    minVisualReach: Number.isFinite(minVisualReach) ? minVisualReach : 0,
    maxImpactDistance,
    minPreImpactHeadAlpha: Number.isFinite(minPreImpactHeadAlpha) ? minPreImpactHeadAlpha : 0,
    minPreImpactTrailAlpha: Number.isFinite(minPreImpactTrailAlpha) ? minPreImpactTrailAlpha : 0,
  }
}
