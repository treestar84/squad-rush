import type { GameModeProfile } from "../data/gameModeData"
import { GAME_MODE_IDS } from "../data/gameModeData"
import { LEVEL_1 } from "../data/levelData"
import { getDifficultyStageLength, type DifficultyProfile } from "../data/difficultyData"
import {
  getDefenseInfluxCountPerSecond,
  getDefensePressureStateForRatio,
  getDefenseVisibleTargetBand,
} from "../data/defenseBalanceCurve"

export type DefensePressureState = "onboarding_crowd" | "contested_pickup" | "boss_jam" | "recovery_burst" | "final_squeeze"

const DEFENSE_STANDING_TIME_SECONDS = 30

export type DefenseWaveMultipliers = {
  readonly pressure: number
  readonly spawnDensity: number
  readonly health: number
  readonly state: DefensePressureState
  readonly visibleTargetMin: number
  readonly visibleTargetMax: number
}

export function getDefenseWaveMultipliers(mode: GameModeProfile, difficulty: DifficultyProfile, progressZ: number): DefenseWaveMultipliers {
  if (mode.id !== GAME_MODE_IDS.defense) {
    return {
      pressure: 1,
      spawnDensity: 1,
      health: mode.monsterHealthMultiplier,
      state: "onboarding_crowd",
      visibleTargetMin: 15,
      visibleTargetMax: 25,
    }
  }
  const progressRatio = clamp01(progressZ / getDifficultyStageLength(LEVEL_1.totalLength, difficulty))
  const state = getDefensePressureStateForRatio(progressRatio)
  const band = getDefenseVisibleTargetBand(progressRatio, difficulty.id)
  const standingPopulation = getDefenseInfluxCountPerSecond(progressRatio, difficulty.id) * DEFENSE_STANDING_TIME_SECONDS
  return {
    pressure: standingPopulation,
    spawnDensity: 1,
    health: 1,
    state,
    visibleTargetMin: band.min,
    visibleTargetMax: band.max,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
