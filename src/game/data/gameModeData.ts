import { LEVEL_1 } from "./levelData"

const ATTACK_FORWARD_MULTIPLIER = 0.68
const ATTACK_PROGRESS_SPEED_MULTIPLIER = 1.2
const DEFENSE_CONTENT_SCROLL_SPEED = 1.6

export const GAME_MODE_IDS = {
  run: "run",
  defense: "defense",
} as const

export type GameModeId = (typeof GAME_MODE_IDS)[keyof typeof GAME_MODE_IDS]

export type GameModeProfile = {
  readonly id: GameModeId
  readonly label: string
  readonly subtitle: string
  readonly briefing: string
  readonly squadForwardMultiplier: number
  readonly contentScrollSpeed: number
  readonly monsterHealthMultiplier: number
  readonly monsterSpawnMultiplier: number
  readonly monsterPressureMultiplier: number
  readonly monsterCenterConvergeMultiplier: number
}

export const GAME_MODE_PROFILES: Record<GameModeId, GameModeProfile> = {
  run: {
    id: GAME_MODE_IDS.run,
    label: "Gate Attack",
    subtitle: "Gate Attack",
    briefing: "기존처럼 앞으로 달리며 게이트와 웨이브를 돌파합니다.",
    squadForwardMultiplier: ATTACK_FORWARD_MULTIPLIER * ATTACK_PROGRESS_SPEED_MULTIPLIER,
    contentScrollSpeed: LEVEL_1.forwardSpeed * (1 - ATTACK_FORWARD_MULTIPLIER) * ATTACK_PROGRESS_SPEED_MULTIPLIER,
    monsterHealthMultiplier: 1,
    monsterSpawnMultiplier: 1,
    monsterPressureMultiplier: 1,
    monsterCenterConvergeMultiplier: 2,
  },
  defense: {
    id: GAME_MODE_IDS.defense,
    label: "Wave Defence",
    subtitle: "Wave Defence",
    briefing: "위치를 지키며 도로 전폭의 적 카펫을 막고, 좌우 +1 게이트로 스쿼드를 직접 늘립니다. 자동 조합 승급은 발동하지 않습니다.",
    squadForwardMultiplier: 0,
    contentScrollSpeed: DEFENSE_CONTENT_SCROLL_SPEED,
    monsterHealthMultiplier: 2,
    monsterSpawnMultiplier: 1.75,
    monsterPressureMultiplier: 1.55,
    monsterCenterConvergeMultiplier: 0.6,
  },
} as const

export const DEFAULT_GAME_MODE = GAME_MODE_PROFILES.run

export function parseGameMode(value: string | null): GameModeProfile {
  if (value === GAME_MODE_IDS.defense) {
    return GAME_MODE_PROFILES.defense
  }
  return DEFAULT_GAME_MODE
}
