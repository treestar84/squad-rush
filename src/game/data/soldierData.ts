export type SoldierStats = {
  readonly hp: number
  readonly attackDamage: number
  readonly attackRange: number
  readonly fireRate: number
  readonly bulletSpeed: number
}

export const SOLDIER_BASE: SoldierStats = {
  hp: 3,
  attackDamage: 18,
  attackRange: 31,
  fireRate: 2.8,
  bulletSpeed: 40,
} as const
