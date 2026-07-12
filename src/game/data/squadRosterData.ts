export const UNIT_TYPES = {
  pangyo: "PANGYO",
  soldier: "SOLDIER",
  unemployed: "UNEMPLOYED",
  developer: "DEVELOPER",
  officer: "OFFICER",
  qa: "QA",
  gamer: "GAMER",
  entrepreneur: "ENTREPRENEUR",
  seniorDeveloper: "SENIOR_DEVELOPER",
  general: "GENERAL",
  ceo: "CEO",
  ai: "AI",
} as const

export type UnitType = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES]

export type UnitCounts = Record<UnitType, number>

export type UnitDefinition = {
  readonly type: UnitType
  readonly label: string
  readonly shortLabel: string
  readonly tier: 1 | 2 | 3
  readonly color: string
  readonly portraitSrc: string
  readonly basePower: number
}

export type UnitRequirement = {
  readonly unit: UnitType
  readonly count: number
}

export type PromotionRule = {
  readonly id: string
  readonly label: string
  readonly requirements: readonly UnitRequirement[]
  readonly result: UnitType | readonly [UnitType, ...UnitType[]]
  readonly resultCount: number
  readonly resultWeights?: readonly [number, ...number[]]
}

export const BASE_SQUAD_LIMIT = 15
export const DEFENSE_SQUAD_LIMIT = 20

export const UNIT_ORDER = [
  UNIT_TYPES.pangyo,
  UNIT_TYPES.soldier,
  UNIT_TYPES.unemployed,
  UNIT_TYPES.developer,
  UNIT_TYPES.officer,
  UNIT_TYPES.qa,
  UNIT_TYPES.gamer,
  UNIT_TYPES.entrepreneur,
  UNIT_TYPES.seniorDeveloper,
  UNIT_TYPES.general,
  UNIT_TYPES.ceo,
  UNIT_TYPES.ai,
] as const satisfies readonly UnitType[]

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  [UNIT_TYPES.pangyo]: {
    type: UNIT_TYPES.pangyo,
    label: "판교인",
    shortLabel: "판",
    tier: 3,
    color: "#38BDF8",
    portraitSrc: "/assets/ui/portraits/pangyo.png",
    basePower: 1,
  },
  [UNIT_TYPES.soldier]: {
    type: UNIT_TYPES.soldier,
    label: "병사",
    shortLabel: "병",
    tier: 2,
    color: "#22C55E",
    portraitSrc: "/assets/ui/portraits/soldier.png",
    basePower: 1.5,
  },
  [UNIT_TYPES.unemployed]: {
    type: UNIT_TYPES.unemployed,
    label: "백수",
    shortLabel: "백",
    tier: 3,
    color: "#94A3B8",
    portraitSrc: "/assets/ui/portraits/unemployed.png",
    basePower: 0.5,
  },
  [UNIT_TYPES.developer]: {
    type: UNIT_TYPES.developer,
    label: "개발자",
    shortLabel: "개",
    tier: 2,
    color: "#60A5FA",
    portraitSrc: "/assets/ui/portraits/developer.png",
    basePower: 1.6,
  },
  [UNIT_TYPES.officer]: {
    type: UNIT_TYPES.officer,
    label: "장교",
    shortLabel: "장교",
    tier: 2,
    color: "#F59E0B",
    portraitSrc: "/assets/ui/portraits/officer.png",
    basePower: 3.5,
  },
  [UNIT_TYPES.qa]: {
    type: UNIT_TYPES.qa,
    label: "QA",
    shortLabel: "QA",
    tier: 2,
    color: "#A78BFA",
    portraitSrc: "/assets/ui/portraits/qa.png",
    basePower: 4,
  },
  [UNIT_TYPES.gamer]: {
    type: UNIT_TYPES.gamer,
    label: "게이머",
    shortLabel: "겜",
    tier: 1,
    color: "#FB7185",
    portraitSrc: "/assets/ui/portraits/gamer.png",
    basePower: 8,
  },
  [UNIT_TYPES.entrepreneur]: {
    type: UNIT_TYPES.entrepreneur,
    label: "창업가",
    shortLabel: "창",
    tier: 2,
    color: "#FBBF24",
    portraitSrc: "/assets/ui/portraits/entrepreneur.png",
    basePower: 3.4,
  },
  [UNIT_TYPES.seniorDeveloper]: {
    type: UNIT_TYPES.seniorDeveloper,
    label: "시니어 개발자",
    shortLabel: "시니어",
    tier: 1,
    color: "#2DD4BF",
    portraitSrc: "/assets/ui/portraits/senior-developer.png",
    basePower: 3,
  },
  [UNIT_TYPES.general]: {
    type: UNIT_TYPES.general,
    label: "장군",
    shortLabel: "장군",
    tier: 1,
    color: "#F97316",
    portraitSrc: "/assets/ui/portraits/general.png",
    basePower: 7,
  },
  [UNIT_TYPES.ceo]: {
    type: UNIT_TYPES.ceo,
    label: "CEO",
    shortLabel: "CEO",
    tier: 1,
    color: "#FACC15",
    portraitSrc: "/assets/ui/portraits/ceo.png",
    basePower: 4.5,
  },
  [UNIT_TYPES.ai]: {
    type: UNIT_TYPES.ai,
    label: "AI",
    shortLabel: "AI",
    tier: 1,
    color: "#E879F9",
    portraitSrc: "/assets/ui/portraits/ai.png",
    basePower: 4,
  },
} as const

export const PROMOTION_RULES = [
  {
    id: "soldier_to_officer",
    label: "병사 5 -> 장교",
    requirements: [{ unit: UNIT_TYPES.soldier, count: 5 }],
    result: UNIT_TYPES.officer,
    resultCount: 1,
  },
  {
    id: "officer_to_general",
    label: "장교 5 -> 장군",
    requirements: [{ unit: UNIT_TYPES.officer, count: 5 }],
    result: UNIT_TYPES.general,
    resultCount: 1,
  },
  {
    id: "developer_to_senior",
    label: "개발자 3 -> 시니어",
    requirements: [{ unit: UNIT_TYPES.developer, count: 3 }],
    result: UNIT_TYPES.seniorDeveloper,
    resultCount: 1,
  },
  {
    id: "unemployed_to_ceo",
    label: "백수 5 -> CEO/게이머",
    requirements: [{ unit: UNIT_TYPES.unemployed, count: 5 }],
    result: [UNIT_TYPES.ceo, UNIT_TYPES.gamer],
    resultWeights: [8, 2],
    resultCount: 1,
  },
] as const satisfies readonly PromotionRule[]

export function createEmptyUnitCounts(): UnitCounts {
  return {
    [UNIT_TYPES.pangyo]: 0,
    [UNIT_TYPES.soldier]: 0,
    [UNIT_TYPES.unemployed]: 0,
    [UNIT_TYPES.developer]: 0,
    [UNIT_TYPES.officer]: 0,
    [UNIT_TYPES.qa]: 0,
    [UNIT_TYPES.gamer]: 0,
    [UNIT_TYPES.entrepreneur]: 0,
    [UNIT_TYPES.seniorDeveloper]: 0,
    [UNIT_TYPES.general]: 0,
    [UNIT_TYPES.ceo]: 0,
    [UNIT_TYPES.ai]: 0,
  }
}

export function getTotalUnitCount(counts: UnitCounts): number {
  return UNIT_ORDER.reduce((total, unit) => total + counts[unit], 0)
}

export function getUnitDefinition(type: UnitType): UnitDefinition {
  return UNIT_DEFINITIONS[type]
}
