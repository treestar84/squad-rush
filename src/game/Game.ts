import type { Engine, Scene } from "@babylonjs/core"
import { LEVEL_1 } from "./data/levelData"
import { CameraController } from "./CameraController"
import { GameLoop } from "./GameLoop"
import { InputController } from "./InputController"
import { BossSystem } from "./systems/BossSystem"
import { CollisionSystem } from "./systems/CollisionSystem"
import { FXSystem } from "./systems/FXSystem"
import { GateSystem } from "./systems/GateSystem"
import { MonsterWaveSystem } from "./systems/MonsterWaveSystem"
import { ProjectileSystem } from "./systems/ProjectileSystem"
import type { QualitySystem } from "./systems/QualitySystem"
import { ShootingSystem } from "./systems/ShootingSystem"
import { SquadSystem } from "./systems/SquadSystem"
import type { AssetManifest } from "./utils/assetLoader"
import { Hud } from "../ui/Hud"
import { ResultScreen } from "../ui/ResultScreen"

export type GameDeps = {
  readonly scene: Scene
  readonly engine: Engine
  readonly canvas: HTMLCanvasElement
  readonly uiRoot: HTMLElement
  readonly assets: AssetManifest | undefined
  readonly quality: QualitySystem
}

export class Game {
  private readonly loop: GameLoop
  private readonly input: InputController
  private readonly camera: CameraController
  private readonly squad: SquadSystem
  private readonly gates: GateSystem
  private readonly waves: MonsterWaveSystem
  private readonly collision: CollisionSystem
  private readonly shooting: ShootingSystem
  private readonly projectiles: ProjectileSystem
  private readonly boss: BossSystem
  private readonly fx: FXSystem
  private readonly hud: Hud
  private readonly result: ResultScreen
  private monstersKilled = 0
  private gameOver = false
  private fpsAccum = 0
  private fpsFrames = 0
  onGameOver?: (victory: boolean) => void

  constructor(deps: GameDeps) {
    this.fx = new FXSystem(deps.scene, Math.round(112 * deps.quality.settings.particleMultiplier) + 24)
    this.loop = new GameLoop(deps.scene)
    this.input = new InputController(deps.canvas)
    this.camera = new CameraController(deps.scene)
    this.squad = new SquadSystem(deps.scene, deps.assets?.soldier ?? null, deps.quality.settings.maxSoldiers)
    this.gates = new GateSystem(deps.scene, this.squad)
    this.waves = new MonsterWaveSystem(deps.scene, deps.assets?.monsterBasic ?? null, deps.quality.settings)
    this.collision = new CollisionSystem(this.squad, this.waves)
    this.projectiles = new ProjectileSystem(deps.scene, deps.quality.settings.maxSoldiers * 2)
    this.shooting = new ShootingSystem(
      this.squad,
      this.waves,
      this.collision,
      this.gates,
      this.projectiles,
      deps.quality.settings.maxSoldiers,
    )
    this.boss = new BossSystem(deps.scene, this.squad, this.fx, deps.assets?.boss ?? null)
    this.hud = new Hud(deps.uiRoot)
    this.result = new ResultScreen(deps.uiRoot)

    this.gates.onPass((cfg, position) => {
      this.fx.playGateEffect(position)
      this.hud.showPopup(cfg.displayText, cfg.cssColor)
    })
    this.shooting.onMonsterKilled = (monster) => {
      this.monstersKilled += 1
      this.fx.playExplosion(monster.mesh.position, 0.65)
    }
    this.boss.onDeath = () => this.endGame(true)
    this.result.onRetry = () => window.location.reload()
    this.hud.show()
  }

  start(): void {
    this.loop.add((dt) => this.update(dt))
  }

  private update(dt: number): void {
    if (this.gameOver) {
      return
    }
    this.squad.update(this.input.getDeltaX(), dt)
    this.gates.update(dt)
    this.waves.update(this.squad.squadZ, dt)
    this.shooting.update(dt)
    this.projectiles.update(dt)
    this.fx.update(dt)
    this.boss.update(dt, 10 * this.gates.getStats().attackMultiplier)
    this.camera.follow(this.squad.squadZ, this.squad.squadX, dt)
    this.resolveMonsterHits()
    this.updateHud(dt)

    if (this.squad.soldierCount <= 0) {
      this.endGame(false)
    }
  }

  private resolveMonsterHits(): void {
    for (const monster of this.collision.checkMonsterSquadCollision()) {
      this.squad.removeSoldiers(monster.config?.damage ?? 1)
      this.waves.kill(monster)
      this.fx.playHitSpark(monster.mesh.position)
    }
  }

  private updateHud(dt: number): void {
    this.fpsAccum += 1 / dt
    this.fpsFrames += 1
    if (this.fpsFrames < 20) {
      return
    }
    const fps = this.fpsAccum / this.fpsFrames
    const progress = Math.min(100, (this.squad.squadZ / LEVEL_1.totalLength) * 100)
    this.hud.update(this.squad.soldierCount, progress, this.boss.getHpRatio(), fps)
    this.fpsAccum = 0
    this.fpsFrames = 0
  }

  private endGame(victory: boolean): void {
    if (this.gameOver) {
      return
    }
    this.gameOver = true
    this.input.dispose()
    this.hud.hide()
    this.result.show(victory, {
      monstersKilled: this.monstersKilled,
      soldiersLeft: this.squad.soldierCount,
    })
    this.onGameOver?.(victory)
  }
}
