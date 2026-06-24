export type SoldierStats = {
  readonly hp: number
  readonly attackDamage: number
  readonly attackRange: number
  readonly fireRate: number
  readonly bulletSpeed: number
}

export const SOLDIER_BASE: SoldierStats = {
  hp: 3,
  attackDamage: 1,
  attackRange: 42,
  fireRate: 4,
  bulletSpeed: 68,
} as const
