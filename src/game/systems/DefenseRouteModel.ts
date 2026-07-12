import { UNIT_TYPES } from "../data/squadRosterData"

export type DefenseRouteId = "military" | "developer" | "unemployed"

export type DefenseRouteOutput = {
  readonly expectedPower: number
  readonly spawnMultiplier: number
  readonly recoverySeconds: number
  readonly risk: "steady" | "slow-burn" | "volatile"
}

export type DefenseRouteRecord = {
  readonly id: DefenseRouteId
  readonly label: string
  readonly output: DefenseRouteOutput
}

export type DefenseRecoveryBeat = {
  readonly progressPct: number
  readonly reason: string
  readonly route: DefenseRouteId
}

export type DefenseRouteDebugState = {
  readonly routes: readonly DefenseRouteRecord[]
  readonly recoveryBeats: readonly DefenseRecoveryBeat[]
}

const MILITARY_BASE_POWER = 1.5
const DEVELOPER_BASE_POWER = 1.6
const UNEMPLOYED_BASE_POWER = 0.5

export function createDefenseRouteDebugState(): DefenseRouteDebugState {
  return {
    routes: [
      {
        id: "military",
        label: UNIT_TYPES.soldier,
        output: {
          expectedPower: MILITARY_BASE_POWER * 5,
          spawnMultiplier: 1.25,
          recoverySeconds: 5,
          risk: "steady",
        },
      },
      {
        id: "developer",
        label: UNIT_TYPES.developer,
        output: {
          expectedPower: DEVELOPER_BASE_POWER * 3,
          spawnMultiplier: 1,
          recoverySeconds: 8,
          risk: "slow-burn",
        },
      },
      {
        id: "unemployed",
        label: UNIT_TYPES.unemployed,
        output: {
          expectedPower: UNEMPLOYED_BASE_POWER * 5,
          spawnMultiplier: 1,
          recoverySeconds: 10,
          risk: "volatile",
        },
      },
    ],
    recoveryBeats: [
      { progressPct: 28, reason: "career-choice payoff before first boss jam", route: "military" },
      { progressPct: 44, reason: "developer slowdown buys pickup timing", route: "developer" },
      { progressPct: 62, reason: "unemployed branch needs post-jam recovery", route: "unemployed" },
    ],
  }
}
