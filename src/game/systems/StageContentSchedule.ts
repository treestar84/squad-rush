import { getDifficultyStageLength, type DifficultyProfile } from "../data/difficultyData"
import { GAME_MODE_IDS, type GameModeProfile } from "../data/gameModeData"
import { LEVEL_1 } from "../data/levelData"

const DEFENSE_HARD_OPENING_CONTENT_BASE_Z = 124
const DEFENSE_HARD_OPENING_CONTENT_MULTIPLIER = 0.9

export function getStageContentLength(difficulty: DifficultyProfile): number {
  return getDifficultyStageLength(LEVEL_1.totalLength, difficulty)
}

export function projectBaseStageZ(
  baseZ: number,
  stageLength: number,
  mode?: GameModeProfile,
  difficulty?: DifficultyProfile,
): number {
  if (mode?.id === GAME_MODE_IDS.defense && difficulty?.id === "hard") {
    return projectDefenseHardStageZ(baseZ, stageLength)
  }
  return baseZ * stageLength / LEVEL_1.totalLength
}

function projectDefenseHardStageZ(baseZ: number, stageLength: number): number {
  const openingEndZ = DEFENSE_HARD_OPENING_CONTENT_BASE_Z * DEFENSE_HARD_OPENING_CONTENT_MULTIPLIER
  if (baseZ <= DEFENSE_HARD_OPENING_CONTENT_BASE_Z) {
    return baseZ * DEFENSE_HARD_OPENING_CONTENT_MULTIPLIER
  }
  const remainingBase = LEVEL_1.totalLength - DEFENSE_HARD_OPENING_CONTENT_BASE_Z
  const remainingStage = stageLength - openingEndZ
  const remainingRatio = (baseZ - DEFENSE_HARD_OPENING_CONTENT_BASE_Z) / remainingBase
  return openingEndZ + remainingStage * remainingRatio
}
