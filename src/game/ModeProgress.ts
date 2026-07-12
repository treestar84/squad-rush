import { DIFFICULTY_IDS } from "./data/difficultyData"
import { GAME_MODE_IDS, type GameModeId } from "./data/gameModeData"

const STORAGE_KEY = "squad-rush-mode-progress-v1"

type ModeProgress = {
  readonly hardCleared: Partial<Record<GameModeId, boolean>>
}

const EMPTY_PROGRESS: ModeProgress = {
  hardCleared: {},
}

export function isInfiniteModeUnlocked(modeId: GameModeId): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get("difficulty") === DIFFICULTY_IDS.infinite) {
    return true
  }
  return readModeProgress().hardCleared[modeId] === true
}

export function recordHardClear(modeId: GameModeId): boolean {
  const progress = readModeProgress()
  if (progress.hardCleared[modeId] === true) {
    return false
  }
  writeModeProgress({
    hardCleared: {
      ...progress.hardCleared,
      [modeId]: true,
    },
  })
  return true
}

function readModeProgress(): ModeProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return EMPTY_PROGRESS
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isModeProgress(parsed)) {
      return EMPTY_PROGRESS
    }
    return parsed
  } catch (error) {
    if (error instanceof DOMException || error instanceof SyntaxError) {
      return EMPTY_PROGRESS
    }
    throw error
  }
}

function writeModeProgress(progress: ModeProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch (error) {
    if (error instanceof DOMException) {
      return
    }
    throw error
  }
}

function isModeProgress(value: unknown): value is ModeProgress {
  if (!isPlainRecord(value) || !("hardCleared" in value)) {
    return false
  }
  const hardCleared = value["hardCleared"]
  if (!isPlainRecord(hardCleared)) {
    return false
  }
  return getProgressFlag(hardCleared, GAME_MODE_IDS.run) !== null
    && getProgressFlag(hardCleared, GAME_MODE_IDS.defense) !== null
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null
}

function getProgressFlag(value: Readonly<Record<string, unknown>>, modeId: GameModeId): boolean | null {
  if (!(modeId in value)) {
    return true
  }
  return typeof value[modeId] === "boolean" ? true : null
}
