import type { Engine, Scene } from "@babylonjs/core"
import { Game } from "../game/Game"
import type { QualitySystem } from "../game/systems/QualitySystem"
import { loadGameAssets, type AssetManifest } from "../game/utils/assetLoader"
import { LoadingScreen } from "../ui/LoadingScreen"
import { StartScreen } from "../ui/StartScreen"

export type AppState = "loading" | "start" | "playing" | "result"

export type AppDeps = {
  readonly engine: Engine
  readonly scene: Scene
  readonly canvas: HTMLCanvasElement
  readonly root: HTMLElement
  readonly quality: QualitySystem
}

export class App {
  private state: AppState = "loading"
  private readonly loadingScreen: LoadingScreen
  private readonly startScreen: StartScreen
  private game: Game | null = null
  assets?: AssetManifest

  constructor(private readonly deps: AppDeps) {
    this.loadingScreen = new LoadingScreen(deps.root)
    this.startScreen = new StartScreen(deps.root)
    this.startScreen.hide()
    this.startScreen.onStart = () => this.transitionTo("playing")
  }

  async init(): Promise<void> {
    this.assets = await loadGameAssets(this.deps.scene, (pct) => this.loadingScreen.setProgress(pct))
    this.transitionTo("start")
  }

  transitionTo(next: AppState): void {
    this.state = next
    if (next === "loading") {
      this.loadingScreen.show()
      this.startScreen.hide()
      return
    }
    if (next === "start") {
      this.loadingScreen.hide()
      this.startScreen.show()
      return
    }
    if (next === "playing") {
      this.loadingScreen.hide()
      this.startScreen.hide()
      this.startGame()
      return
    }
  }

  getState(): AppState {
    return this.state
  }

  private startGame(): void {
    if (this.game !== null) {
      return
    }
    this.game = new Game({
      scene: this.deps.scene,
      engine: this.deps.engine,
      canvas: this.deps.canvas,
      uiRoot: this.deps.root,
      assets: this.assets,
      quality: this.deps.quality,
    })
    this.game.onGameOver = () => {
      this.state = "result"
    }
    this.game.start()
  }
}
