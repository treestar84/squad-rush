export const MONSTER_BEHAVIORS = {
  basic: "BASIC",
  fast: "FAST",
  shield: "SHIELD",
  charger: "CHARGER",
  splitter: "SPLITTER",
  tank: "TANK",
} as const

export type MonsterBehavior = (typeof MONSTER_BEHAVIORS)[keyof typeof MONSTER_BEHAVIORS]

export const MONSTER_KILL_REASONS = {
  projectile: "PROJECTILE",
  contact: "CONTACT",
  escaped: "ESCAPED",
} as const

export type MonsterKillReason = (typeof MONSTER_KILL_REASONS)[keyof typeof MONSTER_KILL_REASONS]

export type MonsterShieldRoleConfig = {
  readonly hpRatio: number
  readonly damageReduction: number
}

export type MonsterChargeRoleConfig = {
  readonly triggerDistance: number
  readonly windupSeconds: number
  readonly windupSpeedMultiplier: number
  readonly chargeSpeedMultiplier: number
  readonly chargeDamageMultiplier: number
}

export type MonsterSplitRoleConfig = {
  readonly childCount: number
  readonly lateralOffset: number
  readonly forwardOffset: number
}

export type MonsterRoleConfig = {
  readonly shield?: MonsterShieldRoleConfig
  readonly charge?: MonsterChargeRoleConfig
  readonly split?: MonsterSplitRoleConfig
}

export type MonsterConfig = {
  readonly id: string
  readonly hp: number
  readonly speed: number
  readonly damage: number
  readonly scale: number
  readonly behavior: MonsterBehavior
  readonly cssColor: string
  readonly role?: MonsterRoleConfig
}

export type MonsterTacticalGuidance = {
  readonly label: string
  readonly warning: string
  readonly counter: string
}

export const MONSTER_TACTICAL_GUIDANCE: Record<MonsterBehavior, MonsterTacticalGuidance> = {
  [MONSTER_BEHAVIORS.basic]: {
    label: "군집 도구리",
    warning: "군집이 전열을 압박합니다.",
    counter: "한쪽에 오래 머물지 말고 인원이 얇은 라인으로 사선을 옮기세요.",
  },
  [MONSTER_BEHAVIORS.fast]: {
    label: "기동 도구리",
    warning: "빠른 적이 방어선을 파고듭니다.",
    counter: "주황색 개체가 가까워지기 전에 같은 라인에서 우선 처치하세요.",
  },
  [MONSTER_BEHAVIORS.shield]: {
    label: "방패 도구리",
    warning: "방패형 출현 · 사선을 바꿔 우회",
    counter: "청색 정면 방패는 탄환 피해를 줄입니다. 옆 라인으로 사선을 바꾸거나 집중 사격으로 방패부터 파괴하세요.",
  },
  [MONSTER_BEHAVIORS.charger]: {
    label: "돌진 도구리",
    warning: "돌진 경고 · 황색 신호 중 좌우 회피",
    counter: "황색 경고선이 켜진 준비 시간에 우선 처치하거나, 신호가 향한 라인에서 벗어나세요.",
  },
  [MONSTER_BEHAVIORS.splitter]: {
    label: "분열 도구리",
    warning: "분열형 출현 · 전선 도달 전에 처치",
    counter: "자홍색 쌍핵 개체는 처치 시 소형 2개로 갈라집니다. 먼 거리에서 먼저 처치해 분열체를 정리할 시간을 확보하세요.",
  },
  [MONSTER_BEHAVIORS.tank]: {
    label: "중장 도구리",
    warning: "중장 개체가 화력을 흡수합니다.",
    counter: "보스가 사선을 막을 때 병력을 한 라인에 모아 집중 화력을 유지하세요.",
  },
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
    speed: 0.36,
    damage: 1,
    scale: 0.4,
    behavior: MONSTER_BEHAVIORS.basic,
    cssColor: "#DC2626",
  },
  fast: {
    id: "fast",
    hp: 2,
    speed: 0.54,
    damage: 1,
    scale: 0.33,
    behavior: MONSTER_BEHAVIORS.fast,
    cssColor: "#D97706",
  },
  brute: {
    id: "brute",
    hp: 5,
    speed: 0.42,
    damage: 2,
    scale: 0.44,
    behavior: MONSTER_BEHAVIORS.fast,
    cssColor: "#F97316",
  },
  shield: {
    id: "shield",
    hp: 4,
    speed: 0.3,
    damage: 1,
    scale: 0.48,
    behavior: MONSTER_BEHAVIORS.shield,
    cssColor: "#38BDF8",
    role: {
      shield: {
        hpRatio: 0.75,
        damageReduction: 0.72,
      },
    },
  },
  charger: {
    id: "charger",
    hp: 2,
    speed: 0.42,
    damage: 1,
    scale: 0.4,
    behavior: MONSTER_BEHAVIORS.charger,
    cssColor: "#FACC15",
    role: {
      charge: {
        triggerDistance: 12,
        windupSeconds: 0.72,
        windupSpeedMultiplier: 0.12,
        chargeSpeedMultiplier: 3.4,
        chargeDamageMultiplier: 2,
      },
    },
  },
  splitter: {
    id: "splitter",
    hp: 3,
    speed: 0.28,
    damage: 1,
    scale: 0.5,
    behavior: MONSTER_BEHAVIORS.splitter,
    cssColor: "#E879F9",
    role: {
      split: {
        childCount: 2,
        lateralOffset: 0.36,
        forwardOffset: 0.9,
      },
    },
  },
  splitling: {
    id: "splitling",
    hp: 1,
    speed: 0.48,
    damage: 1,
    scale: 0.25,
    behavior: MONSTER_BEHAVIORS.basic,
    cssColor: "#C026D3",
  },
  tank: {
    id: "tank",
    hp: 34,
    speed: 0.06,
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
