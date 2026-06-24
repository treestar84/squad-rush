export const DIFFICULTY_IDS = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
} as const

export type DifficultyId = (typeof DIFFICULTY_IDS)[keyof typeof DIFFICULTY_IDS]

export type DifficultyProfile = {
  readonly id: DifficultyId
  readonly label: string
  readonly subtitle: string
  readonly briefing: string
  readonly spawnMultiplier: number
  readonly healthMultiplier: number
  readonly damageMultiplier: number
  readonly speedMultiplier: number
  readonly pressureMultiplier: number
}

export const DIFFICULTY_PROFILES: Record<DifficultyId, DifficultyProfile> = {
  easy: {
    id: DIFFICULTY_IDS.easy,
    label: "EASY",
    subtitle: "현재 완성 난이도",
    briefing: "기존 밸런스 그대로 시작합니다.",
    spawnMultiplier: 1,
    healthMultiplier: 1,
    damageMultiplier: 1,
    speedMultiplier: 1,
    pressureMultiplier: 1,
  },
  medium: {
    id: DIFFICULTY_IDS.medium,
    label: "NORMAL",
    subtitle: "강화된 압박",
    briefing: "더 많은 적과 빠른 충돌 압박이 들어옵니다.",
    spawnMultiplier: 1.08,
    healthMultiplier: 1.1,
    damageMultiplier: 1.1,
    speedMultiplier: 1.06,
    pressureMultiplier: 1.08,
  },
  hard: {
    id: DIFFICULTY_IDS.hard,
    label: "HARD",
    subtitle: "고위험 런",
    briefing: "적 밀도와 체력, 피해량이 크게 상승합니다.",
    spawnMultiplier: 1.16,
    healthMultiplier: 1.24,
    damageMultiplier: 1.28,
    speedMultiplier: 1.12,
    pressureMultiplier: 1.16,
  },
} as const

export const DEFAULT_DIFFICULTY = DIFFICULTY_PROFILES.easy

export function parseDifficulty(value: string | null): DifficultyProfile {
  if (value === DIFFICULTY_IDS.medium) {
    return DIFFICULTY_PROFILES.medium
  }
  if (value === DIFFICULTY_IDS.hard) {
    return DIFFICULTY_PROFILES.hard
  }
  return DEFAULT_DIFFICULTY
}
