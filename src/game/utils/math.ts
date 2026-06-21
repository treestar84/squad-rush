export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(current: number, target: number, rate: number): number {
  return current + (target - current) * clamp(rate, 0, 1)
}

export function distance2d(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx
  const dz = az - bz
  return Math.hypot(dx, dz)
}
