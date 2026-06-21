export type SoldierStats = {
  readonly hp: number
  readonly attackDamage: number
  readonly attackRange: number
  readonly fireRate: number
  readonly bulletSpeed: number
}

export const SOLDIER_BASE: SoldierStats = {
  hp: 3,
  attackDamage: 10,
  attackRange: 25,
  fireRate: 2,
  bulletSpeed: 40,
} as const
