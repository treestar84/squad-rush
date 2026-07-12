import type { AbstractEngine, Scene } from "@babylonjs/core"
import { getCampaignBonuses, readCampaignProgress } from "../game/CampaignProgress"
import { Game } from "../game/Game"
import { StartHeroPreview } from "../game/StartHeroPreview"
import { DEFAULT_DIFFICULTY, parseDifficulty, type DifficultyProfile } from "../game/data/difficultyData"
import { DEFAULT_GAME_MODE, parseGameMode, type GameModeProfile } from "../game/data/gameModeData"
import type { QualitySystem } from "../game/systems/QualitySystem"
import { loadGameAssets, type AssetManifest } from "../game/utils/assetLoader"
import { LoadingScreen } from "../ui/LoadingScreen"
import { PreGameCountdown } from "../ui/PreGameCountdown"
import { StartScreen } from "../ui/StartScreen"

export type AppState = "loading" | "start" | "countdown" | "playing" | "result"

export type AppDeps = {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly canvas: HTMLCanvasElement
  readonly root: HTMLElement
  readonly quality: QualitySystem
}

declare global {
  interface Window {
    __squadRushQaStart?: () => void
    __squadRushQaStarted?: boolean
  }
}

export class App {
  private state: AppState = "loading"
  private readonly loadingScreen: LoadingScreen
  private readonly countdown: PreGameCountdown
  private readonly startScreen: StartScreen
  private game: Game | null = null
  private startHero: StartHeroPreview | null = null
  private selectedDifficulty: DifficultyProfile = DEFAULT_DIFFICULTY
  private selectedGameMode: GameModeProfile = DEFAULT_GAME_MODE
  private gameStarted = false
  private countdownRunning = false
  assets?: AssetManifest

  constructor(private readonly deps: AppDeps) {
    this.loadingScreen = new LoadingScreen(deps.root)
    this.countdown = new PreGameCountdown(deps.root)
    this.startScreen = new StartScreen(deps.root)
    this.startScreen.hide({ immediate: true })
    const query = new URLSearchParams(window.location.search)
    const difficultyQuery = query.get("difficulty")
    const modeQuery = query.get("mode")
    this.selectedDifficulty = parseDifficulty(difficultyQuery)
    this.selectedGameMode = parseGameMode(modeQuery)
    this.startScreen.setDifficulty(this.selectedDifficulty, { revealScenario: difficultyQuery !== null })
    this.startScreen.setGameMode(this.selectedGameMode, { revealDifficulty: modeQuery !== null })
    this.startScreen.onDifficultyChange = (difficulty) => {
      this.selectedDifficulty = difficulty
    }
    this.startScreen.onGameModeChange = (mode) => {
      this.selectedGameMode = mode
    }
    this.startScreen.onStart = (options) => {
      void this.beginCountdown(options.difficulty, options.mode)
    }
  }

  async init(): Promise<void> {
    if (new URLSearchParams(window.location.search).get("qa") === "loading") {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 900))
    }
    this.assets = await loadGameAssets(this.deps.scene, (pct) => this.loadingScreen.setProgress(pct))
    this.startHero = new StartHeroPreview(this.deps.scene, this.assets.soldierAsset)
    this.transitionTo("start")
  }

  transitionTo(next: AppState): void {
    this.state = next
    if (next === "loading") {
      this.loadingScreen.show()
      this.countdown.hide()
      this.startScreen.hide()
      this.startHero?.hide()
      return
    }
    if (next === "start") {
      this.loadingScreen.hide()
      this.countdown.hide()
      this.startHero?.show()
      this.startScreen.show()
      window.__squadRushQaStarted = false
      window.__squadRushQaStart = () => {
        void this.beginCountdown(this.selectedDifficulty, this.selectedGameMode)
      }
      return
    }
    if (next === "playing") {
      this.loadingScreen.hide()
      this.countdown.hide()
      this.startHero?.hide()
      this.startScreen.hide()
      window.__squadRushQaStarted = true
      delete window.__squadRushQaStart
      this.startGame()
      return
    }
  }

  getState(): AppState {
    return this.state
  }

  private async beginCountdown(difficulty: DifficultyProfile, mode: GameModeProfile): Promise<void> {
    if (this.countdownRunning || this.gameStarted) {
      return
    }
    this.selectedDifficulty = difficulty
    this.selectedGameMode = mode
    this.prepareGame()
    this.countdownRunning = true
    this.state = "countdown"
    this.loadingScreen.hide()
    this.startHero?.hide()
    this.startScreen.hide({ immediate: true })
    this.game?.primeAudio()
    this.game?.playStartJingle()
    await this.countdown.run(() => {
      this.prepareGame()
    }, (value) => {
      this.game?.playCountdown(value)
    })
    this.countdownRunning = false
    this.transitionTo("playing")
  }

  private prepareGame(): Game {
    if (this.game !== null) {
      return this.game
    }
    this.game = new Game({
      scene: this.deps.scene,
      canvas: this.deps.canvas,
      uiRoot: this.deps.root,
      assets: this.assets,
      quality: this.deps.quality,
      difficulty: this.selectedDifficulty,
      mode: this.selectedGameMode,
      campaignBonuses: getCampaignBonuses(readCampaignProgress()),
    })
    this.game.onGameOver = () => {
      this.state = "result"
    }
    return this.game
  }

  private startGame(): void {
    if (this.gameStarted) {
      return
    }
    this.gameStarted = true
    this.prepareGame().start()
  }
}
