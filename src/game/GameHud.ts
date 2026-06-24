import type { HudStats } from "../ui/Hud"

export const INITIAL_HUD_STATS: HudStats = {
  soldiers: 1,
  maxSoldiers: 30,
  soldierMaxed: false,
  progressPct: 0,
  fps: 60,
  kills: 0,
  attackMultiplier: 1,
  soldierUpgradeTier: 0,
  laneX: 0,
  obstacles: 0,
  monsters: 0,
} as const
