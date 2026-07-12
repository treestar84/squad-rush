import { UNIT_TYPES, type UnitType } from "../data/squadRosterData"

export type BonusPickupSpawn = {
  readonly z: number
  readonly x: number
  readonly unit: UnitType
  readonly count: number
}

export const PICKUP_REWARD_UNIT_RATIO = {
  pangyo: 18,
  soldier: 2,
} as const

export const DEFENSE_REINFORCEMENT_TRACK = {
  startZ: 18,
  endZ: 374,
  spacing: 3,
  segmentLength: 6,
  laneX: 4.15,
} as const

export function createDefenseReinforcementSpawns(): readonly BonusPickupSpawn[] {
  const count = Math.floor(
    (DEFENSE_REINFORCEMENT_TRACK.endZ - DEFENSE_REINFORCEMENT_TRACK.startZ)
      / DEFENSE_REINFORCEMENT_TRACK.spacing,
  ) + 1
  return Array.from({ length: count }, (_, index) => {
    const segment = Math.floor(index / DEFENSE_REINFORCEMENT_TRACK.segmentLength)
    const side = segment % 2 === 0 ? 1 : -1
    return {
      z: DEFENSE_REINFORCEMENT_TRACK.startZ + index * DEFENSE_REINFORCEMENT_TRACK.spacing,
      x: side * DEFENSE_REINFORCEMENT_TRACK.laneX,
      unit: UNIT_TYPES.soldier,
      count: 1,
    }
  })
}

export const PICKUP_SPAWNS: readonly BonusPickupSpawn[] = [
  { z: 24, x: 0, unit: UNIT_TYPES.pangyo, count: 2 },
  { z: 52, x: 0.95, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 70, x: -1.05, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 88, x: 1.25, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 106, x: -1.25, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 124, x: -1.45, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 142, x: 1.6, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 160, x: -1.65, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 178, x: 1.7, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 196, x: -1.75, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 214, x: -1.55, unit: UNIT_TYPES.soldier, count: 1 },
  { z: 232, x: 1.55, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 250, x: -1.7, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 268, x: 1.75, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 286, x: -1.55, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 304, x: 1.35, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 322, x: -1.35, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 340, x: 1.55, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 352, x: -1.65, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 364, x: 1.65, unit: UNIT_TYPES.pangyo, count: 1 },
  { z: 374, x: -1.45, unit: UNIT_TYPES.soldier, count: 1 },
] as const
