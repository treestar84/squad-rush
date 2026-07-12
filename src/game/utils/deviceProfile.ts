import { GAME_MODE_IDS, type GameModeProfile } from "../data/gameModeData"

const MIN_DESKTOP_ATTACK_BUILDING_WIDTH = 768

export function isDesktopAttackBuildingViewport(): boolean {
  if (window.innerWidth < MIN_DESKTOP_ATTACK_BUILDING_WIDTH) {
    return false
  }
  return !window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches
}

export function usesDesktopAttackBuildingEnvironment(mode: GameModeProfile): boolean {
  return mode.id === GAME_MODE_IDS.run && isDesktopAttackBuildingViewport()
}
