import { UNIT_TYPES, type UnitType } from "../data/squadRosterData"

export const DEFENSE_RESERVE_PROMOTION_COST = 10
export const DEFENSE_TIER_PROMOTION_THRESHOLD = 3

export type DefenseSpecialistBranchId = "command" | "technology"

export type DefenseSpecialistBranch = {
  readonly id: DefenseSpecialistBranchId
  readonly label: string
  readonly baseUnit: UnitType
  readonly units: readonly [UnitType, UnitType, UnitType]
}

export const DEFENSE_SPECIALIST_BRANCHES = [
  {
    id: "command",
    label: "지휘 계열",
    baseUnit: UNIT_TYPES.pangyo,
    units: [UNIT_TYPES.pangyo, UNIT_TYPES.officer, UNIT_TYPES.general],
  },
  {
    id: "technology",
    label: "기술 계열",
    baseUnit: UNIT_TYPES.developer,
    units: [UNIT_TYPES.developer, UNIT_TYPES.seniorDeveloper, UNIT_TYPES.ai],
  },
] as const satisfies readonly DefenseSpecialistBranch[]

export const DEFENSE_TIER_PROMOTION_RULES = [
  {
    source: UNIT_TYPES.pangyo,
    result: UNIT_TYPES.officer,
    label: "판교인 3명 보유 → 1명 장교 전직",
  },
  {
    source: UNIT_TYPES.officer,
    result: UNIT_TYPES.general,
    label: "장교 3명 보유 → 1명 장군 전직",
  },
  {
    source: UNIT_TYPES.developer,
    result: UNIT_TYPES.seniorDeveloper,
    label: "개발자 3명 보유 → 1명 시니어 전직",
  },
  {
    source: UNIT_TYPES.seniorDeveloper,
    result: UNIT_TYPES.ai,
    label: "시니어 3명 보유 → 1명 AI 전직",
  },
] as const satisfies readonly {
  readonly source: UnitType
  readonly result: UnitType
  readonly label: string
}[]

// Defense progression is strictly monotonic: replacing a soldier or promoting
// a specialist must never lower the unit's immediate contribution.
export const DEFENSE_UNIT_POWER_OVERRIDES = {
  [UNIT_TYPES.soldier]: 1.5,
  [UNIT_TYPES.pangyo]: 2,
  [UNIT_TYPES.developer]: 2,
  [UNIT_TYPES.officer]: 4,
  [UNIT_TYPES.seniorDeveloper]: 4,
  [UNIT_TYPES.general]: 8,
  [UNIT_TYPES.ai]: 8,
} as const satisfies Partial<Record<UnitType, number>>

export const DEFENSE_DISPLACEMENT_ORDER = [
  UNIT_TYPES.soldier,
  UNIT_TYPES.pangyo,
  UNIT_TYPES.developer,
  UNIT_TYPES.officer,
  UNIT_TYPES.seniorDeveloper,
  UNIT_TYPES.general,
  UNIT_TYPES.ai,
  UNIT_TYPES.unemployed,
  UNIT_TYPES.entrepreneur,
  UNIT_TYPES.qa,
  UNIT_TYPES.ceo,
  UNIT_TYPES.gamer,
] as const satisfies readonly UnitType[]
