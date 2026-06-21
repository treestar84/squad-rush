export const GATE_TYPES = {
  addSoldier: "ADD_SOLDIER",
  multiplySoldier: "MULTIPLY_SOLDIER",
  attackUp: "ATTACK_UP",
  fireRateUp: "FIRE_RATE_UP",
  rangeUp: "RANGE_UP",
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
  fireRateMultiplier: number
  rangeMultiplier: number
}

export const GATE_CONFIGS: Record<string, GateConfig> = {
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
  gate_atk20: {
    id: "gate_atk20",
    type: GATE_TYPES.attackUp,
    value: 0.2,
    displayText: "ATK +20%",
    cssColor: "#F43F5E",
  },
  gate_fire20: {
    id: "gate_fire20",
    type: GATE_TYPES.fireRateUp,
    value: 0.2,
    displayText: "FIRE +20%",
    cssColor: "#38BDF8",
  },
  gate_rng20: {
    id: "gate_rng20",
    type: GATE_TYPES.rangeUp,
    value: 0.2,
    displayText: "RANGE +20%",
    cssColor: "#A78BFA",
  },
} as const

export const GATE_SPAWNS: readonly GateSpawn[] = [
  { z: 25, leftGateId: "gate_add5", rightGateId: "gate_atk20" },
  { z: 95, leftGateId: "gate_mul2", rightGateId: "gate_fire20" },
] as const
