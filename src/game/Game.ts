import type { Scene } from "@babylonjs/core"
import { LEVEL_1 } from "./data/levelData"
import { CameraController } from "./CameraController"
import { addAuthoredEnvironmentSetpieces } from "./EnvironmentSetpieces"
import { publishAdvancedGateDebug } from "./GameDebug"
import { INITIAL_HUD_STATS } from "./GameHud"
import { GameLoop } from "./GameLoop"
import { GamePause } from "./GamePause"
import { InputController } from "./InputController"
import { AudioSystem } from "./systems/AudioSystem"
import { BonusPickupSystem } from "./systems/BonusPickupSystem"
import { CollisionSystem } from "./systems/CollisionSystem"
import { FXSystem } from "./systems/FXSystem"
import { GateSystem } from "./systems/GateSystem"
import { MonsterWaveSystem } from "./systems/MonsterWaveSystem"
import { ObstacleSystem } from "./systems/ObstacleSystem"
import { ProjectileSystem } from "./systems/ProjectileSystem"
import type { QualitySystem } from "./systems/QualitySystem"
import { ShootingSystem } from "./systems/ShootingSystem"
import { SquadSystem } from "./systems/SquadSystem"
import type { AssetManifest } from "./utils/assetLoader"
import { Hud } from "../ui/Hud"
import { ResultScreen } from "../ui/ResultScreen"

const SQUAD_HIT_RECOVERY_SECONDS = 1.25

export type GameDeps = {
  readonly scene: Scene
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
  private readonly pickups: BonusPickupSystem
  private readonly waves: MonsterWaveSystem
  private readonly collision: CollisionSystem
  private readonly shooting: ShootingSystem
  private readonly projectiles: ProjectileSystem
  private readonly obstacles: ObstacleSystem
  private readonly fx: FXSystem
  private readonly hud: Hud
  private readonly pause: GamePause
  private readonly result: ResultScreen
  private readonly audio: AudioSystem
  private monstersKilled = 0
  private gameOver = false
  private fpsAccum = 0
  private fpsFrames = 0
  private damageAmount = 0
  private damageLaneX = 0
  private damageTimer = 0
  private displayedFps = 60
  private squadHitRecovery = 0
  onGameOver?: (victory: boolean) => void

  constructor(deps: GameDeps) {
    addAuthoredEnvironmentSetpieces(deps.scene, deps.assets, deps.quality.settings)
    this.fx = new FXSystem(deps.scene, Math.round(112 * deps.quality.settings.particleMultiplier) + 24)
    this.audio = new AudioSystem()
    this.loop = new GameLoop(deps.scene)
    this.input = new InputController(deps.canvas)
    this.camera = new CameraController(deps.scene)
    this.squad = new SquadSystem(deps.scene, deps.assets?.soldierAsset ?? null, deps.quality.settings.maxSoldiers)
    this.gates = new GateSystem(deps.scene, this.squad)
    this.pickups = new BonusPickupSystem(deps.scene, this.squad, this.gates, this.fx, deps.assets?.soldierAsset ?? null)
    const monsterDefaultAsset = deps.assets?.monsterDoguriAsset.isReal === true
      ? deps.assets.monsterDoguriAsset
      : deps.assets?.ghostAsset
    const monsterFastAsset = deps.assets?.monsterDoguriAsset.isReal === true
      ? deps.assets.monsterDoguriAsset
      : deps.assets?.monsterFastAsset
    const monsterTankAsset = deps.assets?.monsterDoguriAsset.isReal === true
      ? deps.assets.monsterDoguriAsset
      : deps.assets?.yetiAsset
    this.waves = new MonsterWaveSystem(deps.scene, deps.assets === undefined ? null : {
      defaultAsset: monsterDefaultAsset ?? null,
      fastAsset: monsterFastAsset ?? null,
      tankAsset: monsterTankAsset ?? null,
    }, deps.quality.settings)
    this.collision = new CollisionSystem(this.squad, this.waves)
    this.obstacles = new ObstacleSystem(deps.scene, this.squad, this.fx)
    this.projectiles = new ProjectileSystem(deps.scene, this.squad.soldierCapacity * 16)
    this.shooting = new ShootingSystem(
      this.squad,
      this.waves,
      this.collision,
      this.gates,
      this.projectiles,
      this.squad.soldierCapacity,
    )
    this.hud = new Hud(deps.uiRoot)
    this.pause = new GamePause(deps.uiRoot, this.audio)
    this.result = new ResultScreen(deps.uiRoot)

    this.gates.onPass((cfg, position) => {
      this.fx.playGateEffect(position)
      this.fx.playReinforcementBurst(this.squad.getAlivePositions())
      this.hud.showPopup(cfg.displayText, cfg.cssColor)
      this.camera.addImpulse(0.22)
      this.audio.playGate()
      this.audio.playSquadAdd(this.squad.soldierCount)
    })
    this.pickups.onCollect = (cfg) => {
      this.fx.playReinforcementBurst(this.squad.getAlivePositions())
      this.hud.showPopup(cfg.displayText, cfg.cssColor)
      this.camera.addImpulse(0.12)
      this.audio.playPickup()
      this.audio.playSquadAdd(this.squad.soldierCount)
    }
    this.shooting.onDamage = (damage, monster) => this.queueDamagePopup(damage, monster.mesh.position.x)
    this.shooting.onShot = (power) => this.audio.playShot(power)
    this.shooting.onMonsterKilled = (monster) => {
      this.monstersKilled += 1
      this.fx.playDeathBurst(monster.mesh.position, 0.65)
      this.audio.playHit()
      if (this.monstersKilled % 5 === 0) {
        this.fx.playChainPop(monster.mesh.position)
        this.audio.playChainKill()
      }
      if (this.monstersKilled % 10 === 0) {
        this.hud.showCombo(this.monstersKilled)
        this.camera.addImpulse(0.08)
      }
    }
    this.result.onRetry = () => window.location.reload()
    this.result.onNext = () => window.location.reload()
    this.hud.update(INITIAL_HUD_STATS)
  }

  primeAudio(): void { this.audio.unlock() }

  playStartJingle(): void { this.audio.playStartJingle() }

  playCountdown(value: number): void { this.audio.playCountdown(value) }

  start(): void {
    this.audio.unlock()
    this.audio.startRunAmbience()
    this.hud.show()
    this.pause.show()
    this.loop.add((dt) => this.update(dt))
  }

  private update(dt: number): void {
    if (this.gameOver || this.pause.paused) {
      return
    }
    this.squad.update(this.input.getDeltaX(), dt)
    this.gates.update(dt)
    this.pickups.update(dt)
    this.waves.update(this.squad.squadZ, dt)
    this.obstacles.update(dt)
    this.shooting.update(dt)
    this.projectiles.update(dt)
    this.fx.update(dt)
    this.squadHitRecovery = Math.max(0, this.squadHitRecovery - dt)
    this.camera.follow({
      z: this.squad.squadZ,
      x: this.squad.squadX,
      gateFocus: this.gates.getApproachFocus(this.squad.squadZ),
      combatFocus: Math.min(1, this.waves.aliveCount() / 220),
      bossFocus: 0,
    }, dt)
    this.resolveMonsterHits()
    this.flushDamagePopup(dt)
    this.updateHud(dt)

    if (this.squad.soldierCount <= 0) {
      this.endGame(false)
      return
    }
    if (this.squad.squadZ >= LEVEL_1.totalLength) {
      this.endGame(true)
    }
  }

  private resolveMonsterHits(): void {
    let canDamageSquad = this.squadHitRecovery <= 0
    for (const monster of this.collision.checkMonsterSquadCollision()) {
      if (this.shooting.willReservedImpactKill(monster)) {
        continue
      }
      if (canDamageSquad) {
        this.squad.removeSoldiers(monster.config?.damage ?? 1)
        this.squadHitRecovery = SQUAD_HIT_RECOVERY_SECONDS
        canDamageSquad = false
      }
      this.waves.kill(monster)
      this.fx.playHitSpark(monster.mesh.position)
      this.audio.playHit()
    }
  }

  private queueDamagePopup(damage: number, laneX: number): void {
    this.damageAmount += damage
    this.damageLaneX = this.damageAmount > damage ? (this.damageLaneX + laneX) * 0.5 : laneX
    this.damageTimer = Math.max(this.damageTimer, 0.25)
  }

  private flushDamagePopup(dt: number): void {
    if (this.damageAmount <= 0) {
      return
    }
    this.damageTimer -= dt
    if (this.damageTimer > 0) {
      return
    }
    this.hud.showDamage(this.damageAmount, this.damageLaneX)
    this.damageAmount = 0
    this.damageLaneX = 0
  }

  private updateHud(dt: number): void {
    this.fpsAccum += 1 / dt
    this.fpsFrames += 1
    if (this.fpsFrames >= 20) {
      this.displayedFps = this.fpsAccum / this.fpsFrames
      this.fpsAccum = 0
      this.fpsFrames = 0
    }
    const progress = Math.min(100, (this.squad.squadZ / LEVEL_1.totalLength) * 100)
    const stats = this.gates.getStats()
    this.audio.updateRunAmbience(this.squad.soldierCount, progress, -1)
    publishAdvancedGateDebug(window.location.search.includes("qa=advanced"), {
      squadZ: this.squad.squadZ,
      gates: this.gates.getDebugState(),
      stats,
    })
    this.hud.update({
      soldiers: this.squad.soldierCount,
      maxSoldiers: this.squad.soldierCapacity,
      soldierMaxed: this.squad.isAtMaxSoldiers,
      progressPct: progress,
      fps: this.displayedFps,
      kills: this.monstersKilled,
      attackMultiplier: stats.attackMultiplier,
      soldierUpgradeTier: stats.soldierUpgradeTier,
      laneX: this.squad.squadX,
      obstacles: this.obstacles.activeCount,
      monsters: this.waves.aliveCount(),
    })
  }

  private endGame(victory: boolean): void {
    if (this.gameOver) {
      return
    }
    this.gameOver = true
    this.audio.stopRunAmbience()
    this.audio.playResult(victory)
    this.input.dispose()
    this.pause.hide()
    this.hud.hide()
    this.result.show(victory, {
      monstersKilled: this.monstersKilled,
      soldiersLeft: this.squad.soldierCount,
    })
    this.onGameOver?.(victory)
  }
}
