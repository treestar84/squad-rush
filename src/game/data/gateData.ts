export const GATE_TYPES = {
  addSoldier: "ADD_SOLDIER",
  multiplySoldier: "MULTIPLY_SOLDIER",
  attackUp: "ATTACK_UP",
} as const

export type GateType = (typeof GATE_TYPES)[keyof typeof GATE_TYPES]

export type GateConfig = {
  readonly id: string
  readonly type: GateType
  readonly value: number
  readonly displayText: string
  readonly cssColor: string
}

export type GateSpawn = {
  readonly z: number
  readonly leftGateId: string
  readonly rightGateId: string
}

export type SquadBuffs = {
  attackMultiplier: number
  soldierUpgradeTier: number
}

export const MAX_SOLDIER_UPGRADE_TIER = 4
export const ROUND_1_UPGRADE_LIMIT = 2

export const GATE_CONFIGS: Record<string, GateConfig> = {
  gate_add1: {
    id: "gate_add1",
    type: GATE_TYPES.addSoldier,
    value: 1,
    displayText: "+1",
    cssColor: "#22C55E",
  },
  gate_add2: {
    id: "gate_add2",
    type: GATE_TYPES.addSoldier,
    value: 2,
    displayText: "+2",
    cssColor: "#22C55E",
  },
  gate_add3: {
    id: "gate_add3",
    type: GATE_TYPES.addSoldier,
    value: 3,
    displayText: "+3",
    cssColor: "#22C55E",
  },
  gate_add5: {
    id: "gate_add5",
    type: GATE_TYPES.addSoldier,
    value: 5,
    displayText: "+5",
    cssColor: "#22C55E",
  },
  gate_mul2: {
    id: "gate_mul2",
    type: GATE_TYPES.multiplySoldier,
    value: 2,
    displayText: "x2",
    cssColor: "#F59E0B",
  },
  gate_upgrade: {
    id: "gate_upgrade",
    type: GATE_TYPES.attackUp,
    value: 0.5,
    displayText: "UPGRADE",
    cssColor: "#38BDF8",
  },
} as const

export const UNUSED_GATE_CONFIGS: Record<string, GateConfig> = {
  gate_fire20: {
    id: "gate_fire20",
    type: GATE_TYPES.attackUp,
    value: 0.2,
    displayText: "FIRE +20%",
    cssColor: "#38BDF8",
  },
  gate_rng20: {
    id: "gate_rng20",
    type: GATE_TYPES.attackUp,
    value: 0.2,
    displayText: "RANGE +20%",
    cssColor: "#A78BFA",
  },
  gate_bullet1: {
    id: "gate_bullet1",
    type: GATE_TYPES.attackUp,
    value: 1,
    displayText: "BULLET LV +1",
    cssColor: "#FBBF24",
  },
  gate_explosion: {
    id: "gate_explosion",
    type: GATE_TYPES.attackUp,
    value: 2.35,
    displayText: "EXPLOSION",
    cssColor: "#F97316",
  },
  gate_pierce: {
    id: "gate_pierce",
    type: GATE_TYPES.attackUp,
    value: 2,
    displayText: "PIERCE",
    cssColor: "#60A5FA",
  },
} as const

export const GATE_SPAWNS: readonly GateSpawn[] = [
  { z: 38, leftGateId: "gate_add1", rightGateId: "gate_upgrade" },
  { z: 178, leftGateId: "gate_add3", rightGateId: "gate_upgrade" },
  { z: 252, leftGateId: "gate_add5", rightGateId: "gate_upgrade" },
  { z: 292, leftGateId: "gate_mul2", rightGateId: "gate_add5" },
  { z: 338, leftGateId: "gate_add5", rightGateId: "gate_mul2" },
] as const
