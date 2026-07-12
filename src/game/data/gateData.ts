import { UNIT_TYPES, type UnitType } from "./squadRosterData"

export const GATE_TYPES = {
  numberIncrease: "NUMBER_INCREASE",
  enlist: "ENLIST",
  removeMostCommon: "REMOVE_MOST_COMMON",
  unitRecruit: "UNIT_RECRUIT",
  permanentAttackUp: "PERMANENT_ATTACK_UP",
  unitDamageMultiplier: "UNIT_DAMAGE_MULTIPLIER",
} as const

export type GateType = (typeof GATE_TYPES)[keyof typeof GATE_TYPES]

export type NumberIncreaseMode = "ADD" | "MULTIPLY"

export type GateConfig =
  | {
    readonly id: string
    readonly type: typeof GATE_TYPES.numberIncrease
    readonly mode: NumberIncreaseMode
    readonly value: number
    readonly displayText: string
    readonly cssColor: string
    readonly effectScore: number
  }
  | {
    readonly id: string
    readonly type: typeof GATE_TYPES.enlist
    readonly displayText: string
    readonly cssColor: string
    readonly effectScore: number
  }
  | {
    readonly id: string
    readonly type: typeof GATE_TYPES.removeMostCommon
    readonly value: number
    readonly displayText: string
    readonly cssColor: string
    readonly effectScore: number
  }
  | {
    readonly id: string
    readonly type: typeof GATE_TYPES.unitRecruit
    readonly unit: UnitType
    readonly count: number
    readonly displayText: string
    readonly cssColor: string
    readonly effectScore: number
  }
  | {
    readonly id: string
    readonly type: typeof GATE_TYPES.permanentAttackUp
    readonly multiplier: number
    readonly displayText: string
    readonly cssColor: string
    readonly effectScore: number
  }
  | {
    readonly id: string
    readonly type: typeof GATE_TYPES.unitDamageMultiplier
    readonly unit: UnitType
    readonly multiplier: number
    readonly displayText: string
    readonly cssColor: string
    readonly effectScore: number
  }

export type FixedGateSpawn = {
  readonly z: number
  readonly kind?: "fixed"
  readonly gateIds: readonly [string, string]
  readonly rightBarrier?: boolean
  readonly hidden?: boolean
}

export type RewardPoolGateSpawn = {
  readonly z: number
  readonly kind: "rewardPool"
  readonly rightBarrier?: boolean
}

export type GateSpawn = FixedGateSpawn | RewardPoolGateSpawn

export type WeightedGateReward = {
  readonly gateId: string
  readonly weight: number
  readonly minZ?: number
}

export type SquadBuffs = {
  readonly attackMultiplier: number
  readonly projectileCount: number
  readonly effectiveAttackPower: number
  readonly monsterSpawnMultiplier: number
  readonly shield: number
  readonly squadLimit: number
}

export const GATE_CONFIGS: Record<string, GateConfig> = {
  gate_add1: {
    id: "gate_add1",
    type: GATE_TYPES.numberIncrease,
    mode: "ADD",
    value: 1,
    displayText: "+1 최다",
    cssColor: "#22C55E",
    effectScore: 1,
  },
  gate_add2: {
    id: "gate_add2",
    type: GATE_TYPES.numberIncrease,
    mode: "ADD",
    value: 2,
    displayText: "+2 최다",
    cssColor: "#22C55E",
    effectScore: 2,
  },
  gate_add3: {
    id: "gate_add3",
    type: GATE_TYPES.numberIncrease,
    mode: "ADD",
    value: 3,
    displayText: "+3 최다",
    cssColor: "#38BDF8",
    effectScore: 3,
  },
  gate_mul2: {
    id: "gate_mul2",
    type: GATE_TYPES.numberIncrease,
    mode: "MULTIPLY",
    value: 2,
    displayText: "x2 최다",
    cssColor: "#F59E0B",
    effectScore: 4,
  },
  gate_sub1: {
    id: "gate_sub1",
    type: GATE_TYPES.removeMostCommon,
    value: 1,
    displayText: "-1 최다",
    cssColor: "#EF4444",
    effectScore: -1,
  },
  gate_enlist: {
    id: "gate_enlist",
    type: GATE_TYPES.enlist,
    displayText: "군입대",
    cssColor: "#EF4444",
    effectScore: 1.5,
  },
  gate_soldier_add1: {
    id: "gate_soldier_add1",
    type: GATE_TYPES.unitRecruit,
    unit: UNIT_TYPES.soldier,
    count: 1,
    displayText: "병사 +1",
    cssColor: "#22C55E",
    effectScore: 1,
  },
  gate_pangyo_add2: {
    id: "gate_pangyo_add2",
    type: GATE_TYPES.unitRecruit,
    unit: UNIT_TYPES.pangyo,
    count: 2,
    displayText: "판교인 +2",
    cssColor: "#38BDF8",
    effectScore: 1,
  },
  gate_developer_add1: {
    id: "gate_developer_add1",
    type: GATE_TYPES.unitRecruit,
    unit: UNIT_TYPES.developer,
    count: 1,
    displayText: "개발자 +1",
    cssColor: "#60A5FA",
    effectScore: 2.6,
  },
  gate_unemployed_add1: {
    id: "gate_unemployed_add1",
    type: GATE_TYPES.unitRecruit,
    unit: UNIT_TYPES.unemployed,
    count: 1,
    displayText: "백수 +1",
    cssColor: "#94A3B8",
    effectScore: 1.6,
  },
  gate_officer_add1: {
    id: "gate_officer_add1",
    type: GATE_TYPES.unitRecruit,
    unit: UNIT_TYPES.officer,
    count: 1,
    displayText: "장교 +1",
    cssColor: "#F59E0B",
    effectScore: 5,
  },
  gate_attack_amp20: {
    id: "gate_attack_amp20",
    type: GATE_TYPES.permanentAttackUp,
    multiplier: 1.2,
    displayText: "전체 공격 +20%",
    cssColor: "#A78BFA",
    effectScore: 5.5,
  },
  gate_pangyo_damage2x: {
    id: "gate_pangyo_damage2x",
    type: GATE_TYPES.unitDamageMultiplier,
    unit: UNIT_TYPES.pangyo,
    multiplier: 2,
    displayText: "판교인 2배",
    cssColor: "#38BDF8",
    effectScore: 4.5,
  },
} as const

export const LEFT_GATE_REWARD_POOL: readonly WeightedGateReward[] = [
  { gateId: "gate_add1", weight: 35 },
  { gateId: "gate_add2", weight: 35 },
  { gateId: "gate_add3", weight: 20 },
  { gateId: "gate_mul2", weight: 10 },
] as const

export const RIGHT_GATE_REWARD_POOL: readonly WeightedGateReward[] = [
  { gateId: "gate_sub1", weight: 6 },
  { gateId: "gate_add1", weight: 8 },
  { gateId: "gate_add2", weight: 15 },
  { gateId: "gate_add3", weight: 21 },
  { gateId: "gate_mul2", weight: 13 },
  { gateId: "gate_soldier_add1", weight: 14 },
  { gateId: "gate_developer_add1", weight: 10 },
  { gateId: "gate_unemployed_add1", weight: 8 },
  { gateId: "gate_officer_add1", weight: 1.5, minZ: 150 },
  { gateId: "gate_attack_amp20", weight: 1.5, minZ: 170 },
  { gateId: "gate_pangyo_damage2x", weight: 2, minZ: 150 },
] as const

export const GATE_SPAWNS: readonly GateSpawn[] = [
  { z: 24, gateIds: ["gate_soldier_add1", "gate_pangyo_add2"], rightBarrier: false },
  { z: 76, kind: "rewardPool" },
  { z: 118, kind: "rewardPool" },
  { z: 162, kind: "rewardPool" },
  { z: 206, kind: "rewardPool" },
  { z: 250, kind: "rewardPool" },
  { z: 294, kind: "rewardPool" },
  { z: 338, kind: "rewardPool" },
] as const
