export const MONSTER_BEHAVIORS = {
  basic: "BASIC",
  fast: "FAST",
  tank: "TANK",
} as const

export type MonsterBehavior = (typeof MONSTER_BEHAVIORS)[keyof typeof MONSTER_BEHAVIORS]

export type MonsterConfig = {
  readonly id: string
  readonly hp: number
  readonly speed: number
  readonly damage: number
  readonly scale: number
  readonly behavior: MonsterBehavior
  readonly cssColor: string
}

export type SpawnPattern = "LINE" | "BLOCK" | "V_SHAPE"

export type WaveGroup = {
  readonly configId: string
  readonly count: number
  readonly spawnPattern: SpawnPattern
}

export type WaveConfig = {
  readonly id: string
  readonly monsters: readonly WaveGroup[]
  readonly startZ: number
}

export type ContinuousSpawnConfig = {
  readonly startZ: number
  readonly endZ: number
  readonly spacing: number
  readonly lookAhead: number
}

export const MONSTER_CONFIGS = {
  basic: {
    id: "basic",
    hp: 1,
    speed: 0.24,
    damage: 1,
    scale: 0.4,
    behavior: MONSTER_BEHAVIORS.basic,
    cssColor: "#DC2626",
  },
  fast: {
    id: "fast",
    hp: 2,
    speed: 0.36,
    damage: 1,
    scale: 0.33,
    behavior: MONSTER_BEHAVIORS.fast,
    cssColor: "#D97706",
  },
  tank: {
    id: "tank",
    hp: 42,
    speed: 0.24,
    damage: 3,
    scale: 1.08,
    behavior: MONSTER_BEHAVIORS.tank,
    cssColor: "#7C3AED",
  },
} as const satisfies Record<string, MonsterConfig>

export const CONTINUOUS_SPAWN: ContinuousSpawnConfig = {
  startZ: 48,
  endZ: 366,
  spacing: 1.22,
  lookAhead: 60,
} as const

export const WAVE_CONFIGS = {
  wave_1: {
    id: "wave_1",
    startZ: 60,
    monsters: [
      { configId: "basic", count: 60, spawnPattern: "BLOCK" },
      { configId: "fast", count: 14, spawnPattern: "LINE" },
    ],
  },
  wave_2: {
    id: "wave_2",
    startZ: 130,
    monsters: [
      { configId: "basic", count: 32, spawnPattern: "BLOCK" },
      { configId: "tank", count: 6, spawnPattern: "LINE" },
      { configId: "fast", count: 14, spawnPattern: "V_SHAPE" },
    ],
  },
} as const satisfies Record<string, WaveConfig>
