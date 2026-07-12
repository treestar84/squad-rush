export const DIFFICULTY_IDS = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  infinite: "infinite",
} as const

export type DifficultyId = (typeof DIFFICULTY_IDS)[keyof typeof DIFFICULTY_IDS]

export type DifficultyProfile = {
  readonly id: DifficultyId
  readonly label: string
  readonly subtitle: string
  readonly briefing: string
  readonly gateDay: string
  readonly loreSummary: string
  readonly scenarioTitle: string
  readonly scenarioBody: string
  readonly scenarioCallout: string
  readonly scenarioImageSrc: string
  readonly scenarioImageAlt: string
  readonly spawnMultiplier: number
  readonly regularSpawnMultiplier: number
  readonly healthMultiplier: number
  readonly regularHealthMultiplier: number
  readonly midBossHealthMultiplier: number
  readonly damageMultiplier: number
  readonly speedMultiplier: number
  readonly pressureMultiplier: number
  readonly stageDurationMultiplier: number
  readonly endless: boolean
}

export const DIFFICULTY_PROFILES: Record<DifficultyId, DifficultyProfile> = {
  easy: {
    id: DIFFICULTY_IDS.easy,
    label: "EASY",
    subtitle: "게이트 오픈 1일차",
    briefing: "판교역 상공에 첫 균열. 도구리 선발대가 도로로 쏟아집니다.",
    gateDay: "D+1",
    loreSummary: "첫 균열 / 판교인 긴급 방어",
    scenarioTitle: "첫 균열, 판교가 멈췄다",
    scenarioBody: "정오 직후, 판교역 앞 하늘이 찢어졌다. 푸른 게이트가 열리자 도구리 선발대가 도로 위로 쏟아지고, 출근길 인파는 그대로 전장이 됐다.\n\n버스 정류장과 공사 펜스가 첫 바리케이드가 된다. 통신은 아직 살아 있지만, 게이트 안쪽에서는 더 큰 무리가 밀려오는 소리가 끊기지 않는다.",
    scenarioCallout: "목표: 시민 대피 시간을 벌고 첫 방어선을 유지",
    scenarioImageSrc: "/assets/ui/scenario-day-1.webp",
    scenarioImageAlt: "게이트 오픈 1일차, 판교 도심에 열린 푸른 게이트와 긴급 방어선",
    spawnMultiplier: 1.08,
    regularSpawnMultiplier: 1,
    healthMultiplier: 1.04,
    regularHealthMultiplier: 1,
    midBossHealthMultiplier: 1,
    damageMultiplier: 1,
    speedMultiplier: 1,
    pressureMultiplier: 0.92,
    stageDurationMultiplier: 1,
    endless: false,
  },
  medium: {
    id: DIFFICULTY_IDS.medium,
    label: "NORMAL",
    subtitle: "게이트 오픈 10일차",
    briefing: "게이트가 안정화되며 도구리 밀도와 돌파 속도가 올라갑니다.",
    gateDay: "D+10",
    loreSummary: "방어선 확장 / 민병대-군 합동작전",
    scenarioTitle: "열흘째, 봉쇄선이 흔들린다",
    scenarioBody: "판교 테크노밸리는 임시 작전구역으로 바뀌었다. 대피로는 보급로가 됐고, 남은 판교인들은 군 기동대 사이로 탄약과 장비를 직접 밀어 넣는다.\n\n문제는 게이트가 적응하고 있다는 것. 도구리는 밤마다 지형을 학습하고, 빌딩 유리벽에는 안쪽 세계의 푸른 빛이 더 선명하게 번진다.",
    scenarioCallout: "목표: 보급로를 지키며 합동 방어선을 재편",
    scenarioImageSrc: "/assets/ui/scenario-day-10.webp",
    scenarioImageAlt: "게이트 오픈 10일차, 봉쇄선과 보급로가 세워진 판교 도심",
    spawnMultiplier: 1.32,
    regularSpawnMultiplier: 1.6,
    healthMultiplier: 1.18,
    regularHealthMultiplier: 1.55,
    midBossHealthMultiplier: 1.45,
    damageMultiplier: 1.1,
    speedMultiplier: 1.07,
    pressureMultiplier: 1.24,
    stageDurationMultiplier: 1.5,
    endless: false,
  },
  hard: {
    id: DIFFICULTY_IDS.hard,
    label: "HARD",
    subtitle: "게이트 오픈 30일차",
    briefing: "도구리 주력이 현실 적응을 끝내고 대규모 파상공세를 시작합니다.",
    gateDay: "D+30",
    loreSummary: "장기전 돌입 / 판교 최종 차단선",
    scenarioTitle: "삼십일째, 지도 위의 판교가 붉다",
    scenarioBody: "한 달째 열린 게이트는 더 이상 사건이 아니다. 판교는 전선이 됐고, 붉게 오염된 구역은 매일 바깥으로 번지고 있다.\n\n방어군은 외곽의 마지막 차단선까지 밀렸다. 오늘 이 선이 무너지면 도구리 무리는 판교 밖으로 퍼진다. 남은 선택지는 퇴각이 아니라 역류 차단뿐이다.",
    scenarioCallout: "목표: 최종 차단선을 사수하고 게이트 역류를 막기",
    scenarioImageSrc: "/assets/ui/scenario-day-30.webp",
    scenarioImageAlt: "게이트 오픈 30일차, 붉게 오염된 한반도 작전 지도",
    spawnMultiplier: 1.65,
    regularSpawnMultiplier: 2.05,
    healthMultiplier: 1.34,
    regularHealthMultiplier: 2.24,
    midBossHealthMultiplier: 2.05,
    damageMultiplier: 1.28,
    speedMultiplier: 1.13,
    pressureMultiplier: 1.5,
    stageDurationMultiplier: 2.1,
    endless: false,
  },
  infinite: {
    id: DIFFICULTY_IDS.infinite,
    label: "INFINITE",
    subtitle: "게이트 오픈 무기한",
    briefing: "초반은 완만하게 버티지만, 도구리 체력과 밀도는 끝없이 상승합니다.",
    gateDay: "D+∞",
    loreSummary: "무한 침공 / 장기 생존 한계 시험",
    scenarioTitle: "무한 모드, 끝나지 않는 역류",
    scenarioBody: "하드 차단선을 넘긴 뒤에도 게이트는 닫히지 않았다. 이제 목표는 클리어가 아니라 얼마나 오래 전선을 유지하는지다.\n\n초반은 빌드업이 가능하도록 완만하게 시작하지만, 이후 단계마다 도구리 체력과 개체수가 계속 오른다. 최상위 1티어 스쿼드 15명을 완성해도 침공 강도는 결국 그 한계를 넘어선다.",
    scenarioCallout: "목표: 시간 제한 없이 최대 생존 기록 갱신",
    scenarioImageSrc: "/assets/ui/scenario-day-30.webp",
    scenarioImageAlt: "무한 모드, 닫히지 않는 게이트와 계속 강화되는 도구리 침공",
    spawnMultiplier: 1.1,
    regularSpawnMultiplier: 1.18,
    healthMultiplier: 1.16,
    regularHealthMultiplier: 1.34,
    midBossHealthMultiplier: 1.3,
    damageMultiplier: 1.08,
    speedMultiplier: 1.04,
    pressureMultiplier: 0.98,
    stageDurationMultiplier: 1,
    endless: true,
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
  if (value === DIFFICULTY_IDS.infinite) {
    return DIFFICULTY_PROFILES.infinite
  }
  return DEFAULT_DIFFICULTY
}

export function getDifficultyStageLength(baseLength: number, difficulty: DifficultyProfile): number {
  return baseLength * difficulty.stageDurationMultiplier
}
