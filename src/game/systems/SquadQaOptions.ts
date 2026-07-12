import { LEVEL_1 } from "../data/levelData"
import { clamp } from "../utils/math"

export type SquadQaOptions = {
  readonly speedMultiplier: number
  readonly startZ: number
  readonly startSoldiers: number
  readonly startSoldiersOverridden: boolean
  readonly startPangyo: number
  readonly startPangyoOverridden: boolean
}

const DEFAULT_SPEED_MULTIPLIER = 1
const MIN_QA_SPEED_MULTIPLIER = 0.2
const MAX_QA_SPEED_MULTIPLIER = 4
const MIN_QA_START_Z = 10
const MAX_QA_START_Z = 1400

export function readSquadQaOptions(maxSoldiers: number, defaultStartZ: number): SquadQaOptions {
  const params = new URLSearchParams(window.location.search)
  return {
    speedMultiplier: readQaSpeedMultiplier(params),
    startZ: readFloatParam(params, "qaStartZ", defaultStartZ, MIN_QA_START_Z, MAX_QA_START_Z),
    startSoldiers: readIntParam(params, "qaSoldiers", LEVEL_1.startSoldiers, LEVEL_1.startSoldiers, maxSoldiers),
    startSoldiersOverridden: params.has("qaSoldiers"),
    startPangyo: readIntParam(params, "qaPangyo", 0, 0, maxSoldiers),
    startPangyoOverridden: params.has("qaPangyo"),
  }
}

export function readQaSpeedMultiplier(params = new URLSearchParams(window.location.search)): number {
  return readFloatParam(params, "qaSpeed", DEFAULT_SPEED_MULTIPLIER, MIN_QA_SPEED_MULTIPLIER, MAX_QA_SPEED_MULTIPLIER)
}

function readFloatParam(params: URLSearchParams, name: string, fallback: number, min: number, max: number): number {
  const requested = params.get(name)
  if (requested === null) {
    return fallback
  }
  const parsed = Number.parseFloat(requested)
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
}

function readIntParam(params: URLSearchParams, name: string, fallback: number, min: number, max: number): number {
  const requested = params.get(name)
  if (requested === null) {
    return fallback
  }
  const parsed = Number.parseInt(requested, 10)
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
}
