export type BulletStyle = {
  readonly power: number
  readonly effectiveRange: number
}

export const BULLET_MIN_LIFE_SECONDS = 0.08
export const BULLET_LIFE_PADDING_SECONDS = 0.08
export const BULLET_VISUAL_LENGTH = 6.2
export const BULLET_FRAME_VISIBILITY_SECONDS = 0.28
export const BULLET_EFFECTIVE_RANGE_VISUAL_RATIO = 0.88
export const BULLET_FRONT_GLOW_OFFSET = 0.08
export const BULLET_WAKE_NEAR_OFFSET_RATIO = 1.14
export const BULLET_WAKE_FAR_OFFSET_RATIO = 2.35
export const BULLET_TAIL_CLEAR_RATIO = 0.55
export const BULLET_TAIL_CLEAR_MIN_DISTANCE = 3
export const BULLET_POST_IMPACT_HEAD_FADE_DISTANCE = 0.5
export const BULLET_TRAIL_ALPHA = 0.108
export const BULLET_WAKE_ALPHA = 0.18
export const BULLET_WAKE_MIN_ALPHA = 0.018
export const BULLET_TRAIL_MIN_ALPHA = 0.028
export const BULLET_CORE_MIN_ALPHA = 0.94
export const BULLET_FLASH_MIN_ALPHA = 0.22
export const IMPACT_FLASH_DURATION_SECONDS = 0.16
export const IMPACT_FLASH_BASE_SCALE = 0.18

export function getProjectileMotionMetrics(distance: number, speed: number, effectiveRange: number) {
  const requiredVisualReach = Math.max(distance, effectiveRange) * BULLET_EFFECTIVE_RANGE_VISUAL_RATIO
  const visualLength = Math.min(
    BULLET_VISUAL_LENGTH,
    Math.max(2.4, distance * 0.08, requiredVisualReach / BULLET_WAKE_FAR_OFFSET_RATIO, speed * BULLET_FRAME_VISIBILITY_SECONDS),
  )
  const tailClearDistance = Math.max(BULLET_TAIL_CLEAR_MIN_DISTANCE, visualLength * BULLET_TAIL_CLEAR_RATIO)
  const lifeSeconds = Math.max(
    BULLET_MIN_LIFE_SECONDS,
    (distance + tailClearDistance) / speed + BULLET_LIFE_PADDING_SECONDS,
  )
  return { visualLength, tailClearDistance, lifeSeconds }
}
