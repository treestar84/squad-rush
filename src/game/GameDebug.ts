import type { SquadBuffs } from "./data/gateData"
import type { GateDebugState, GateSystem } from "./systems/GateSystem"

type AdvancedGateDebugState = {
  readonly squadZ: number
  readonly gates: readonly GateDebugState[]
  readonly stats: ReturnType<GateSystem["getStats"]>
}

declare global {
  interface Window {
    __squadRushDebug?: AdvancedGateDebugState
  }
}

type AdvancedGateDebugSnapshot = {
  readonly squadZ: number
  readonly gates: readonly GateDebugState[]
  readonly stats: SquadBuffs
}

export function publishAdvancedGateDebug(enabled: boolean, snapshot: AdvancedGateDebugSnapshot): void {
  if (!enabled) {
    return
  }
  window.__squadRushDebug = snapshot
}
