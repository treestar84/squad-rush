import { UNIT_ORDER, UNIT_DEFINITIONS } from "./data/squadRosterData"
import type { HudStats } from "../ui/Hud"

export const INITIAL_HUD_STATS: HudStats = {
  soldiers: 4,
  maxSoldiers: 15,
  soldierMaxed: false,
  progressPct: 0,
  fps: 60,
  kills: 0,
  attackMultiplier: 1,
  shield: 0,
  roster: UNIT_ORDER.map((unit) => ({
    type: unit,
    label: UNIT_DEFINITIONS[unit].label,
    shortLabel: UNIT_DEFINITIONS[unit].shortLabel,
    count: unit === "PANGYO" ? 3 : unit === "SOLDIER" ? 1 : 0,
    color: UNIT_DEFINITIONS[unit].color,
    portraitSrc: UNIT_DEFINITIONS[unit].portraitSrc,
    tier: UNIT_DEFINITIONS[unit].tier,
  })),
  effectSummaries: [],
  timedSkills: [],
  laneX: 0,
  obstacles: 0,
  monsters: 0,
  defenseProgression: {
    enabled: false,
    maxed: false,
    reserveUnemployed: 0,
    promotionCost: 10,
    promotionCount: 0,
    nextUnitLabel: "판교인",
    nextUnitColor: UNIT_DEFINITIONS.PANGYO.color,
  },
  careerChoice: {
    active: true,
    pangyoCount: 3,
    requiredPangyo: 3,
  },
} as const
