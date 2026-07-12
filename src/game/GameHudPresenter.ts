import { LEVEL_1 } from "./data/levelData"
import type { DifficultyProfile } from "./data/difficultyData"
import { getDifficultyStageLength } from "./data/difficultyData"
import { GAME_MODE_IDS } from "./data/gameModeData"
import type { GameModeProfile } from "./data/gameModeData"
import { publishAdvancedGateDebug } from "./GameDebug"
import type { Hud } from "../ui/Hud"
import type { AudioSystem } from "./systems/AudioSystem"
import type { GateSystem } from "./systems/GateSystem"
import type { MonsterWaveSystem } from "./systems/MonsterWaveSystem"
import type { ObstacleSystem } from "./systems/ObstacleSystem"
import type { DefenseProgressionState, SquadSystem } from "./systems/SquadSystem"
import { createDefenseRouteDebugState, type DefenseRouteDebugState } from "./systems/DefenseRouteModel"

const HUD_REFRESH_INTERVAL_SECONDS = 1 / 12

type GameModeDebugState = {
  readonly mode: string
  readonly squadX: number
  readonly squadZ: number
  readonly progressZ: number
  readonly squadForwardMultiplier: number
  readonly contentScrollSpeed: number
  readonly promotionTreeEnabled: boolean
  readonly formation: {
    readonly count: number
    readonly columns: number
    readonly rows: number
    readonly frontRowCount: number
    readonly spacing: number
    readonly rowDepth: number
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
    readonly width: number
    readonly depth: number
  }
  readonly combat: {
    readonly projectileCount: number
    readonly effectiveAttackPower: number
    readonly attackMultiplier: number
  }
  readonly defenseProgression: DefenseProgressionState
  readonly roster: readonly { readonly label: string; readonly count: number }[]
}

type GameHudPresenterDeps = {
  readonly audio: AudioSystem
  readonly gates: GateSystem
  readonly hud: Hud
  readonly difficulty: DifficultyProfile
  readonly mode: GameModeProfile
  readonly obstacles: ObstacleSystem
  readonly squad: SquadSystem
  readonly waves: MonsterWaveSystem
}

declare global {
  interface Window {
    __squadRushGameModeDebug?: GameModeDebugState
    __squadRushDefenseRouteDebug?: DefenseRouteDebugState
  }
}

export class GameHudPresenter {
  private fpsAccum = 0
  private fpsFrames = 0
  private displayedFps = 60
  private hudRefreshCooldown = 0

  constructor(private readonly deps: GameHudPresenterDeps) {}

  update(dt: number, progressZ: number, monstersKilled: number): void {
    this.fpsAccum += 1 / dt
    this.fpsFrames += 1
    if (this.fpsFrames >= 20) {
      this.displayedFps = this.fpsAccum / this.fpsFrames
      this.fpsAccum = 0
      this.fpsFrames = 0
    }
    this.flushEvents()
    this.hudRefreshCooldown -= dt
    if (this.hudRefreshCooldown > 0) {
      return
    }
    this.hudRefreshCooldown = HUD_REFRESH_INTERVAL_SECONDS
    const progress = this.getDisplayProgress(progressZ)
    const stats = this.deps.gates.getStats()
    this.deps.audio.updateRunAmbience(this.deps.squad.soldierCount, progress.percent, -1)
    publishAdvancedGateDebug(window.location.search.includes("qa=advanced"), {
      squadZ: this.deps.squad.squadZ,
      gates: this.deps.gates.getDebugState(),
      stats,
    })
    this.publishGameModeDebug(progressZ)
    this.publishDefenseRouteDebug()
    this.deps.hud.update({
      soldiers: this.deps.squad.soldierCount,
      maxSoldiers: this.deps.squad.squadCapacity,
      soldierMaxed: this.deps.squad.isAtMaxSoldiers,
      progressPct: progress.percent,
      progressLabel: progress.label,
      fps: this.displayedFps,
      kills: monstersKilled,
      attackMultiplier: stats.attackMultiplier,
      shield: stats.shield,
      roster: this.deps.squad.getRosterEntries(),
      effectSummaries: this.deps.squad.getEffectSummaries(),
      timedSkills: this.deps.squad.getTimedSkillStates(),
      laneX: this.deps.squad.squadX,
      obstacles: this.deps.obstacles.activeCount,
      monsters: this.deps.waves.aliveCount(),
      defenseProgression: this.deps.squad.getDefenseProgressionState(),
      careerChoice: this.deps.squad.getCareerChoiceState(),
    })
  }

  private flushEvents(): void {
    for (const event of this.deps.squad.consumePromotionEvents()) {
      this.deps.hud.showPromotionEvent(event)
      this.deps.audio.playUiReveal()
    }
    for (const event of this.deps.squad.consumeTimedSkillEvents()) {
      this.deps.hud.showTimedSkillEvent(event)
      this.deps.audio.playWeaponSpin()
    }
  }

  private publishGameModeDebug(progressZ: number): void {
    const search = window.location.search
    if (!search.includes("qa=defense") && !search.includes("qa=monsters")) {
      return
    }
    const combat = this.deps.squad.getCombatStats()
    window.__squadRushGameModeDebug = {
      mode: this.deps.mode.id,
      squadX: this.deps.squad.squadX,
      squadZ: this.deps.squad.squadZ,
      progressZ,
      squadForwardMultiplier: this.deps.mode.squadForwardMultiplier,
      contentScrollSpeed: this.deps.mode.contentScrollSpeed,
      promotionTreeEnabled: this.deps.squad.isPromotionTreeEnabled,
      formation: this.deps.squad.getFormationDebugState(),
      combat: {
        projectileCount: combat.projectileCount,
        effectiveAttackPower: combat.effectiveAttackPower,
        attackMultiplier: combat.attackMultiplier,
      },
      defenseProgression: this.deps.squad.getDefenseProgressionState(),
      roster: this.deps.squad.getRosterEntries().map((entry) => ({
        label: entry.label,
        count: entry.count,
      })),
    }
  }

  private getDisplayProgress(progressZ: number): { readonly percent: number; readonly label?: string } {
    const stageLength = getDifficultyStageLength(LEVEL_1.totalLength, this.deps.difficulty)
    if (!this.deps.difficulty.endless) {
      return { percent: Math.min(100, (progressZ / stageLength) * 100) }
    }
    const stageIndex = Math.floor(progressZ / stageLength) + 1
    const stageProgressZ = progressZ % stageLength
    const percent = Math.min(100, (stageProgressZ / stageLength) * 100)
    return {
      percent,
      label: `INF ${stageIndex}-${Math.round(percent)}%`,
    }
  }

  private publishDefenseRouteDebug(): void {
    if (this.deps.mode.id !== GAME_MODE_IDS.defense || !window.location.search.includes("qa=defense-routes")) {
      return
    }
    window.__squadRushDefenseRouteDebug = createDefenseRouteDebugState()
  }
}
