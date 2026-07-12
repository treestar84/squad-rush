import { Vector3 } from "@babylonjs/core"
import { BULLET_FRONT_GLOW_OFFSET, BULLET_POST_IMPACT_HEAD_FADE_DISTANCE } from "./ProjectileMotion"
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

let peakTravelRatio = 0
let peakPreImpactTravelRatio = 0
let peakPreImpactHeadWorldAdvance = 0
let peakVisualHeadWorldAdvance = 0
let peakNearImpactVisibleRatio = 0
let peakPostImpactVisualTravelRatio = 0
let peakPostImpactDistance = 0
let peakImpactToVisualDistance = 0
let peakImpactDistance = 0
let lowestVisualReach = Number.POSITIVE_INFINITY
let lowestPreImpactHeadAlpha = Number.POSITIVE_INFINITY
let lowestPreImpactTrailAlpha = Number.POSITIVE_INFINITY

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
      maxPreImpactTravelRatio = Math.max(maxPreImpactTravelRatio, 1)
      maxNearImpactVisibleRatio = Math.max(
        maxNearImpactVisibleRatio,
        postImpactDistance <= BULLET_POST_IMPACT_HEAD_FADE_DISTANCE ? 1 : 0,
      )
      maxPostImpactVisualTravelRatio = Math.max(maxPostImpactVisualTravelRatio, travelRatio)
      maxPostImpactDistance = Math.max(maxPostImpactDistance, postImpactDistance)
      maxImpactToVisualDistance = Math.max(maxImpactToVisualDistance, trail.travelDistance - trail.impactDistance)
    }
  }
  peakTravelRatio = Math.max(peakTravelRatio, maxTravelRatio)
  peakPreImpactTravelRatio = Math.max(peakPreImpactTravelRatio, maxPreImpactTravelRatio)
  peakPreImpactHeadWorldAdvance = Math.max(peakPreImpactHeadWorldAdvance, maxPreImpactHeadWorldAdvance)
  peakVisualHeadWorldAdvance = Math.max(peakVisualHeadWorldAdvance, maxVisualHeadWorldAdvance)
  peakNearImpactVisibleRatio = Math.max(peakNearImpactVisibleRatio, maxNearImpactVisibleRatio)
  peakPostImpactVisualTravelRatio = Math.max(peakPostImpactVisualTravelRatio, maxPostImpactVisualTravelRatio)
  peakPostImpactDistance = Math.max(peakPostImpactDistance, maxPostImpactDistance)
  peakImpactToVisualDistance = Math.max(peakImpactToVisualDistance, maxImpactToVisualDistance)
  peakImpactDistance = Math.max(peakImpactDistance, maxImpactDistance)
  if (Number.isFinite(minVisualReach)) {
    lowestVisualReach = Math.min(lowestVisualReach, minVisualReach)
  }
  if (Number.isFinite(minPreImpactHeadAlpha)) {
    lowestPreImpactHeadAlpha = Math.min(lowestPreImpactHeadAlpha, minPreImpactHeadAlpha)
  }
  if (Number.isFinite(minPreImpactTrailAlpha)) {
    lowestPreImpactTrailAlpha = Math.min(lowestPreImpactTrailAlpha, minPreImpactTrailAlpha)
  }
  window.__squadRushProjectileDebug = {
    active: trails.length,
    shotsCreated,
    maxTravelRatio: peakTravelRatio,
    maxPreImpactTravelRatio: peakPreImpactTravelRatio,
    maxPreImpactHeadWorldAdvance: peakPreImpactHeadWorldAdvance,
    maxVisualHeadWorldAdvance: peakVisualHeadWorldAdvance,
    maxNearImpactVisibleRatio: peakNearImpactVisibleRatio,
    maxPostImpactVisualTravelRatio: peakPostImpactVisualTravelRatio,
    maxPostImpactDistance: peakPostImpactDistance,
    maxImpactToVisualDistance: peakImpactToVisualDistance,
    minVisualReach: Number.isFinite(lowestVisualReach) ? lowestVisualReach : 0,
    maxImpactDistance: peakImpactDistance,
    minPreImpactHeadAlpha: Number.isFinite(lowestPreImpactHeadAlpha) ? lowestPreImpactHeadAlpha : 0,
    minPreImpactTrailAlpha: Number.isFinite(lowestPreImpactTrailAlpha) ? lowestPreImpactTrailAlpha : 0,
  }
}
