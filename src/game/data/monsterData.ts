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

export const MONSTER_CONFIGS: Record<string, MonsterConfig> = {
  basic: {
    id: "basic",
    hp: 30,
    speed: 3.5,
    damage: 1,
    scale: 1,
    behavior: MONSTER_BEHAVIORS.basic,
    cssColor: "#DC2626",
  },
  fast: {
    id: "fast",
    hp: 15,
    speed: 6,
    damage: 1,
    scale: 0.78,
    behavior: MONSTER_BEHAVIORS.fast,
    cssColor: "#D97706",
  },
  tank: {
    id: "tank",
    hp: 120,
    speed: 1.5,
    damage: 3,
    scale: 1.6,
    behavior: MONSTER_BEHAVIORS.tank,
    cssColor: "#7C3AED",
  },
} as const

export const WAVE_CONFIGS: Record<string, WaveConfig> = {
  wave_1: {
    id: "wave_1",
    startZ: 60,
    monsters: [
      { configId: "basic", count: 60, spawnPattern: "BLOCK" },
      { configId: "fast", count: 20, spawnPattern: "LINE" },
    ],
  },
  wave_2: {
    id: "wave_2",
    startZ: 130,
    monsters: [
      { configId: "basic", count: 40, spawnPattern: "BLOCK" },
      { configId: "tank", count: 10, spawnPattern: "LINE" },
      { configId: "fast", count: 20, spawnPattern: "V_SHAPE" },
    ],
  },
} as const
