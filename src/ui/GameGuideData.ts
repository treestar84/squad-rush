import {
  PROMOTION_RULES,
  UNIT_DEFINITIONS,
  UNIT_TYPES,
  type PromotionRule,
  type UnitRequirement,
  type UnitType,
} from "../game/data/squadRosterData"

export type GuideUnit = {
  readonly type: UnitType
  readonly detail: string
  readonly effect: string
}

export type GuideLane = {
  readonly title: string
  readonly summary: string
  readonly tone: "start" | "military" | "developer" | "unemployed"
  readonly units: readonly GuideUnit[]
}

export type GuideTier = 1 | 2 | 3 | 4

export const GUIDE_UNIT_TIERS: Record<UnitType, GuideTier> = {
  [UNIT_TYPES.general]: 1,
  [UNIT_TYPES.ceo]: 1,
  [UNIT_TYPES.gamer]: 1,
  [UNIT_TYPES.seniorDeveloper]: 1,
  [UNIT_TYPES.officer]: 2,
  [UNIT_TYPES.soldier]: 3,
  [UNIT_TYPES.developer]: 3,
  [UNIT_TYPES.pangyo]: 4,
  [UNIT_TYPES.unemployed]: 4,
  [UNIT_TYPES.qa]: 3,
  [UNIT_TYPES.entrepreneur]: 3,
  [UNIT_TYPES.ai]: 1,
}

export const ACTIVE_GUIDE_UNITS = [
  UNIT_TYPES.pangyo,
  UNIT_TYPES.unemployed,
  UNIT_TYPES.soldier,
  UNIT_TYPES.developer,
  UNIT_TYPES.officer,
  UNIT_TYPES.general,
  UNIT_TYPES.seniorDeveloper,
  UNIT_TYPES.ceo,
  UNIT_TYPES.gamer,
] as const satisfies readonly UnitType[]

export const GUIDE_PORTRAIT_SOURCES: Partial<Record<UnitType, string>> = {
  [UNIT_TYPES.pangyo]: "/assets/ui/portraits/tactical/pangyo.webp",
  [UNIT_TYPES.unemployed]: "/assets/ui/portraits/tactical/unemployed.webp",
  [UNIT_TYPES.soldier]: "/assets/ui/portraits/tactical/soldier.webp",
  [UNIT_TYPES.developer]: "/assets/ui/portraits/tactical/developer.webp",
  [UNIT_TYPES.officer]: "/assets/ui/portraits/tactical/officer.webp",
  [UNIT_TYPES.general]: "/assets/ui/portraits/tactical/general.webp",
  [UNIT_TYPES.seniorDeveloper]: "/assets/ui/portraits/tactical/senior-developer.webp",
  [UNIT_TYPES.ceo]: "/assets/ui/portraits/tactical/ceo.webp",
  [UNIT_TYPES.gamer]: "/assets/ui/portraits/tactical/gamer.webp",
}

export const GUIDE_LANES: readonly GuideLane[] = [
  {
    title: "시작과 진로 결정",
    summary: "판교인 3명이 모이면 J/K/L로 병사, 개발자, 백수 중 하나를 선택합니다.",
    tone: "start",
    units: [
      { type: UNIT_TYPES.pangyo, detail: "기본 인력. 3명은 진로 결정 재화로 사용됩니다.", effect: "3명을 소모해 J 군입대(병사), K 야근(개발자), L 해고(백수) 중 하나를 선택합니다." },
    ],
  },
  {
    title: "군 라인",
    summary: "병사는 장교, 장교는 장군으로 자동 승급합니다.",
    tone: "military",
    units: [
      { type: UNIT_TYPES.soldier, detail: "5명 자동 승급 -> 장교 1명.", effect: "기본 전투 유닛입니다. 5명이 모이면 자동으로 장교 1명으로 승급합니다." },
      { type: UNIT_TYPES.officer, detail: "25초마다 병사 생성. 장교 수가 늘면 20/15/10/5초까지 가속됩니다.", effect: "병사를 자동 생산하고, 5명이 모이면 장군 1명으로 자동 승급합니다." },
      { type: UNIT_TYPES.general, detail: "장교 5명 자동 승급. 병사와 장교 수에 비례해 추가 화력을 얻습니다.", effect: "최상위 군 라인입니다. 기본 화력 7에 병사/장교 보정 화력을 더합니다." },
    ],
  },
  {
    title: "개발 라인",
    summary: "개발자는 게임 진행속도를 조절하고, 전체 화력 및 게이머를 더 강력하게 만듭니다.",
    tone: "developer",
    units: [
      { type: UNIT_TYPES.developer, detail: "3명 자동 승급 -> 시니어 개발자 1명. 1명당 전진 속도 20% 감소.", effect: "스쿼드가 커질수록 빨라지는 전진 속도를 늦춰 선택 시간을 벌어줍니다." },
      { type: UNIT_TYPES.seniorDeveloper, detail: "승급 필요 인원 -1, 전체 화력 +20%. 게이머 화력도 증폭합니다.", effect: "최상위 개발 라인입니다. 승급 요구 수를 줄이고 전체 화력 +20%, 게이머 화력 2배를 제공합니다." },
    ],
  },
  {
    title: "백수 분기",
    summary: "백수 5명은 CEO 또는 게이머 중 하나로 랜덤 승급합니다.",
    tone: "unemployed",
    units: [
      { type: UNIT_TYPES.unemployed, detail: "2명 이상부터 10초마다 병사 또는 판교인을 백수로 만들 수 있습니다. 50%는 변화 없음입니다.", effect: "5명이 모이면 CEO 80%, 게이머 20% 비율로 랜덤 자동 승급합니다." },
      { type: UNIT_TYPES.ceo, detail: "승급 발생 시 캐릭터 추가 등장 확률을 제공합니다. CEO가 늘수록 확률이 증가합니다.", effect: "최상위 엔진형 분기입니다. 승급 때 30% 확률로 추가 캐릭터가 등장하고 CEO가 늘수록 확률이 증가합니다." },
      { type: UNIT_TYPES.gamer, detail: "강력한 순수 화력 분기. 기본 화력 8로 고급 전투 압축 역할입니다.", effect: "최상위 공격형 분기입니다. 등장 확률은 20%로 낮지만, 시니어 개발자가 있으면 화력이 2배가 됩니다." },
    ],
  },
]

export const GUIDE_RULES = [
  "스쿼드 제한은 15명입니다.",
  "공격 모드에서 인원이 늘수록 전진 속도가 1명당 15% 증가합니다.",
  "게이트는 항상 2개만 등장합니다. 낮은 효과는 왼쪽, 좋은 효과는 오른쪽입니다.",
  "오른쪽 좋은 효과는 장벽을 부숴야만 적용됩니다. 못 부수면 보상도 패널티도 없습니다.",
] as const

export function getGuideUnits(): readonly GuideUnit[] {
  return GUIDE_LANES.flatMap((lane) => lane.units)
}

export function getGuidePortraitSource(unit: UnitType): string {
  return GUIDE_PORTRAIT_SOURCES[unit] ?? UNIT_DEFINITIONS[unit].portraitSrc
}

export function formatGuideRequirements(requirements: readonly UnitRequirement[]): string {
  return requirements
    .map((requirement) => `${getGuideUnitLabel(requirement.unit)} ${requirement.count}명`)
    .join(" + ")
}

export function formatGuideRuleResult(rule: PromotionRule): string {
  const requirements = formatGuideRequirements(rule.requirements)
  if (typeof rule.result === "string") {
    return `${requirements} -> ${UNIT_DEFINITIONS[rule.result].label}`
  }
  const totalWeight = rule.resultWeights?.reduce((total, weight) => total + Math.max(0, weight), 0) ?? 0
  const labels = rule.result.map((type, index) => {
    const weight = rule.resultWeights?.[index]
    const percent = weight === undefined || totalWeight <= 0 ? null : Math.round((weight / totalWeight) * 100)
    const suffix = percent === null ? "" : ` ${percent}%`
    return `${UNIT_DEFINITIONS[type].label}${suffix}`
  })
  return `${requirements} -> ${labels.join(" / ")}`
}

export function findGuideUnit(type: UnitType): GuideUnit | null {
  for (const lane of GUIDE_LANES) {
    const unit = lane.units.find((candidate) => candidate.type === type)
    if (unit !== undefined) {
      return unit
    }
  }
  return null
}

export function findRuleForResult(type: UnitType): PromotionRule | null {
  return ACTIVE_PROMOTION_RULES.find((rule) => {
    if (typeof rule.result === "string") {
      return rule.result === type
    }
    return rule.result.some((result) => result === type)
  }) ?? null
}

function getGuideUnitLabel(unit: UnitType): string {
  switch (unit) {
    case UNIT_TYPES.pangyo:
      return "판교인"
    case UNIT_TYPES.soldier:
      return "병사"
    case UNIT_TYPES.unemployed:
      return "백수"
    case UNIT_TYPES.developer:
      return "개발자"
    case UNIT_TYPES.officer:
      return "장교"
    case UNIT_TYPES.gamer:
      return "게이머"
    case UNIT_TYPES.seniorDeveloper:
      return "시니어 개발자"
    case UNIT_TYPES.general:
      return "장군"
    case UNIT_TYPES.ceo:
      return "CEO"
    case UNIT_TYPES.qa:
      return "QA"
    case UNIT_TYPES.entrepreneur:
      return "창업가"
    case UNIT_TYPES.ai:
      return "AI"
  }
}

export const ACTIVE_PROMOTION_RULES = PROMOTION_RULES.filter((rule) => {
  if (!rule.requirements.every((requirement) => isActiveGuideUnit(requirement.unit))) {
    return false
  }
  if (typeof rule.result === "string") {
    return isActiveGuideUnit(rule.result)
  }
  return rule.result.every((result) => isActiveGuideUnit(result))
})

export function isActiveGuideUnit(unit: UnitType): boolean {
  return ACTIVE_GUIDE_UNITS.some((activeUnit) => activeUnit === unit)
}
