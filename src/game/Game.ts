import type { Scene } from "@babylonjs/core"
import { grantCampaignRunReward, type CampaignBonuses } from "./CampaignProgress"
import { LEVEL_1 } from "./data/levelData"
import type { DifficultyProfile } from "./data/difficultyData"
import { DIFFICULTY_IDS, getDifficultyStageLength } from "./data/difficultyData"
import { GAME_MODE_IDS } from "./data/gameModeData"
import type { GameModeProfile } from "./data/gameModeData"
import { MONSTER_BEHAVIORS, MONSTER_TACTICAL_GUIDANCE } from "./data/monsterData"
import { CameraController } from "./CameraController"
import { addAuthoredEnvironmentSetpieces } from "./EnvironmentSetpieces"
import { GameDamageSystem } from "./GameDamageSystem"
import { INITIAL_HUD_STATS } from "./GameHud"
import { GameHudPresenter } from "./GameHudPresenter"
import { GameLoop } from "./GameLoop"
import { GamePause } from "./GamePause"
import { InputController } from "./InputController"
import { applyEnvironmentMode } from "./EnvironmentMode"
import { AudioSystem } from "./systems/AudioSystem"
import { AttackBuildingSystem } from "./systems/AttackBuildingSystem"
import { BonusPickupSystem } from "./systems/BonusPickupSystem"
import { CollisionSystem } from "./systems/CollisionSystem"
import { DefenseCastleEnvironmentSystem } from "./systems/DefenseCastleEnvironmentSystem"
import { FXSystem } from "./systems/FXSystem"
import { GateSystem } from "./systems/GateSystem"
import { MonsterWaveSystem } from "./systems/MonsterWaveSystem"
import { ObstacleSystem } from "./systems/ObstacleSystem"
import { ProjectileSystem } from "./systems/ProjectileSystem"
import type { QualitySystem } from "./systems/QualitySystem"
import { ShootingSystem } from "./systems/ShootingSystem"
import { DEFENSE_SQUAD_LIMIT, UNIT_DEFINITIONS, UNIT_TYPES } from "./data/squadRosterData"
import type { MonsterInstance } from "./pools/MonsterPool"
import { SquadSystem } from "./systems/SquadSystem"
import type { CareerChoiceKey } from "./systems/SquadSystem"
import { readQaSpeedMultiplier } from "./systems/SquadQaOptions"
import type { AssetManifest } from "./utils/assetLoader"
import { usesDesktopAttackBuildingEnvironment } from "./utils/deviceProfile"
import { recordHardClear } from "./ModeProgress"
import { Hud } from "../ui/Hud"
import type { CareerChoiceFeedback } from "../ui/Hud"
import { ResultScreen } from "../ui/ResultScreen"

declare global {
  interface Window {
    __squadRushBreachQa?: {
      applyBreaches: (monsterCount: number) => void
      snapshot: () => {
        readonly gameOver: boolean
        readonly soldiers: number
        readonly roster: readonly { readonly label: string; readonly count: number }[]
      }
    }
    __squadRushMonsterQa?: {
      killMidBoss: () => boolean
      killBasic: () => boolean
      killFast: () => boolean
    }
  }
}

const MID_BOSS_DEATH_BURST_DELAY_MS = 180
const MID_BOSS_DEATH_BURST_SCALE = 1.85
const MID_BOSS_DEATH_CAMERA_IMPULSE = 0.14
const DEFENSE_PROJECTILE_CAPACITY = 64
const DEFENSE_REGULAR_DEATH_FX_STRIDE = 3

export type GameDeps = {
  readonly scene: Scene
  readonly canvas: HTMLCanvasElement
  readonly uiRoot: HTMLElement
  readonly assets: AssetManifest | undefined
  readonly quality: QualitySystem
  readonly difficulty: DifficultyProfile
  readonly mode: GameModeProfile
  readonly campaignBonuses: CampaignBonuses
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
  private readonly attackBuildings: AttackBuildingSystem
  private readonly fx: FXSystem
  private readonly hud: Hud
  private readonly hudPresenter: GameHudPresenter
  private readonly damage: GameDamageSystem
  private readonly pause: GamePause
  private readonly result: ResultScreen
  private readonly audio: AudioSystem
  private readonly mode: GameModeProfile
  private readonly difficulty: DifficultyProfile
  private contentScrollOffsetZ = 0
  private readonly cameraFocus = {
    z: 0,
    x: 0,
    gateFocus: 0,
    combatFocus: 0,
    bossFocus: 0,
  }
  private readonly waveUpdate = {
    squadZ: 0,
    dt: 0,
    spawnProgressZ: 0,
    incomingScrollSpeed: 0,
    squadPowerSpawnMultiplier: 1,
  }
  private readonly qaSpeedMultiplier = readQaSpeedMultiplier()
  private monstersKilled = 0
  private gameOver = false
  onGameOver?: (victory: boolean) => void

  constructor(deps: GameDeps) {
    this.mode = deps.mode
    this.difficulty = deps.difficulty
    const useDesktopAttackBuildings = usesDesktopAttackBuildingEnvironment(deps.mode)
    const useDefenseCastle = deps.mode.id === GAME_MODE_IDS.defense
    applyEnvironmentMode(deps.scene, deps.mode, deps.difficulty)
    addAuthoredEnvironmentSetpieces({
      scene: deps.scene,
      assets: deps.assets,
      quality: deps.quality.settings,
      enabled: !useDesktopAttackBuildings && !useDefenseCastle,
      stageLength: this.getStageLength(),
    })
    this.attackBuildings = new AttackBuildingSystem(deps.scene, deps.mode)
    if (useDefenseCastle) {
      new DefenseCastleEnvironmentSystem(deps.scene, deps.quality.settings)
    }
    this.fx = new FXSystem(deps.scene, Math.round(160 * deps.quality.settings.particleMultiplier) + 48)
    this.audio = new AudioSystem()
    this.loop = new GameLoop(deps.scene)
    this.input = new InputController(deps.canvas)
    this.camera = new CameraController(deps.scene)
    this.squad = new SquadSystem(
      deps.scene,
      deps.assets?.soldierAsset ?? null,
      deps.assets?.pangyoRunnerAsset ?? null,
      useDefenseCastle
        ? getDefenseSquadVisualCapacity(deps.quality.settings.maxMonsters)
        : deps.quality.settings.maxSoldiers,
      useDefenseCastle
        ? {
          squadLimit: DEFENSE_SQUAD_LIMIT,
          promotionTreeEnabled: false,
          defenseProgressionEnabled: true,
          startingUnit: UNIT_TYPES.soldier,
          formationMaxColumns: 3,
          formationSpacing: 0.42,
          formationRowDepth: 0.21,
          formationRowStagger: 0,
          maxFireEmitters: 8,
          maxAnimatedSoldiers: 6,
          maxLateralX: 4.5,
        }
        : {},
    )
    this.squad.addUnits(
      useDefenseCastle ? UNIT_TYPES.soldier : UNIT_TYPES.pangyo,
      deps.campaignBonuses.bonusStartingUnits,
    )
    this.squad.multiplyPermanentAttack(deps.campaignBonuses.attackMultiplier)
    this.squad.grantShield(deps.campaignBonuses.startingShield)
    this.gates = new GateSystem(deps.scene, this.squad, this.fx, deps.difficulty, deps.mode)
    this.pickups = new BonusPickupSystem(
      deps.scene,
      this.squad,
      this.fx,
      deps.assets?.soldierAsset ?? null,
      deps.assets?.pangyoPickupAsset ?? null,
      deps.difficulty,
      deps.mode,
    )
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
    }, deps.quality.settings, deps.difficulty, deps.mode)
    this.collision = new CollisionSystem(this.squad, this.waves)
    this.obstacles = new ObstacleSystem(deps.scene, this.squad, this.fx)
    this.projectiles = useDefenseCastle
      ? new ProjectileSystem(deps.scene, DEFENSE_PROJECTILE_CAPACITY, {
        compactVisuals: true,
        effectStride: 2,
        prewarmCapacity: 24,
      })
      : new ProjectileSystem(deps.scene, this.squad.soldierCapacity * 16)
    this.shooting = new ShootingSystem(
      this.squad,
      this.waves,
      this.collision,
      this.gates,
      this.projectiles,
      this.squad.soldierCapacity,
      deps.mode,
    )
    this.hud = new Hud(deps.uiRoot)
    this.hudPresenter = new GameHudPresenter({
      audio: this.audio,
      difficulty: deps.difficulty,
      gates: this.gates,
      hud: this.hud,
      mode: deps.mode,
      obstacles: this.obstacles,
      squad: this.squad,
      waves: this.waves,
    })
    this.damage = new GameDamageSystem({
      audio: this.audio,
      collision: this.collision,
      fx: this.fx,
      hud: this.hud,
      shooting: this.shooting,
      squad: this.squad,
      waves: this.waves,
    })
    this.waves.onRoleWarning = (behavior) => {
      const color = behavior === MONSTER_BEHAVIORS.shield
        ? "#38BDF8"
        : behavior === MONSTER_BEHAVIORS.splitter
          ? "#E879F9"
          : "#FACC15"
      this.hud.showHeadline(MONSTER_TACTICAL_GUIDANCE[behavior].warning, color, "elite")
    }
    this.installBreachQaHooks()
    this.installMonsterQaHooks()
    this.pause = new GamePause(deps.uiRoot, this.audio)
    this.result = new ResultScreen(deps.uiRoot)

    this.gates.onPass((cfg, position, result) => {
      this.fx.playGateEffect(position)
      this.fx.playReinforcementBurst(this.squad.getAlivePositions())
      this.hud.showPopup(cfg.displayText, cfg.cssColor)
      for (const addedUnit of result.addedUnits) {
        const definition = UNIT_DEFINITIONS[addedUnit.unit]
        this.hud.showUnitRewardFlight({
          label: definition.label,
          color: definition.color,
          portraitSrc: definition.portraitSrc,
          count: addedUnit.count,
        })
      }
      this.camera.addImpulse(0.22)
      this.audio.playGate()
      this.audio.playSquadAdd(this.squad.soldierCount)
    })
    this.pickups.onCollect = (result) => {
      this.hud.showPopup(result.label, result.color)
      if (!result.compact) {
        this.fx.playReinforcementBurst(this.squad.getAlivePositions())
        this.hud.showUnitRewardFlight({
          label: UNIT_DEFINITIONS[result.unit].label,
          color: result.color,
          portraitSrc: result.portraitSrc,
          count: result.count,
        })
        this.camera.addImpulse(0.12)
      } else {
        this.camera.addImpulse(0.035)
      }
      this.audio.playPickup()
      this.audio.playSquadAdd(this.squad.soldierCount)
    }
    this.shooting.onDamage = (damage, monster) => this.damage.queueShotDamage(damage, monster.mesh.position.x)
    this.shooting.onShot = (power) => this.audio.playShot(power)
    this.shooting.onMonsterKilled = (monster) => this.handleMonsterKilled(monster)
    this.result.onRetry = () => window.location.reload()
    this.result.onNext = () => window.location.reload()
    this.hud.update(INITIAL_HUD_STATS)
  }

  primeAudio(): void { this.audio.unlock() }

  playStartJingle(): void { this.audio.playStartJingle() }

  playCountdown(value: number): void { this.audio.playCountdown(value) }

  isWorldAdvancing(): boolean {
    return !this.gameOver && !this.pause.paused
  }

  start(): void {
    this.audio.unlock()
    this.audio.startRunAmbience()
    this.hud.show()
    this.pause.show()
    this.loop.add((dt) => this.update(dt))
  }

  private update(dt: number): void {
    if (!this.isWorldAdvancing()) {
      return
    }
    this.applyCareerChoice()
    this.squad.update(this.input.getDeltaX(), dt, this.mode.squadForwardMultiplier)
    const combatStats = this.squad.getCombatStats()
    this.updateContentProgress(dt)
    this.gates.update(dt, this.getStageProgressZ(), this.mode.contentScrollSpeed)
    this.pickups.update(dt, this.getStageProgressZ(), this.mode.contentScrollSpeed)
    this.waveUpdate.squadZ = this.squad.squadZ
    this.waveUpdate.dt = dt
    this.waveUpdate.spawnProgressZ = this.getStageProgressZ()
    this.waveUpdate.incomingScrollSpeed = this.getMonsterIncomingScrollSpeed()
    this.waveUpdate.squadPowerSpawnMultiplier = combatStats.monsterSpawnMultiplier
    this.waves.update(this.waveUpdate)
    this.obstacles.update(dt)
    this.attackBuildings.update(this.squad.squadZ)
    this.shooting.update(dt, combatStats)
    this.projectiles.update(dt)
    this.fx.update(dt)
    this.cameraFocus.z = this.squad.squadZ
    this.cameraFocus.x = this.squad.squadX
    this.cameraFocus.gateFocus = this.gates.getApproachFocus(this.squad.squadZ)
    this.cameraFocus.combatFocus = Math.min(1, this.waves.aliveCount() / 220)
    this.camera.follow(this.cameraFocus, dt)
    if (this.camera.isDebugEnabled) {
      this.camera.publishDebug(this.cameraFocus, this.squad.getAlivePositions())
    }
    this.damage.update(dt)
    this.hudPresenter.update(dt, this.getStageProgressZ(), this.monstersKilled)

    if (this.squad.soldierCount <= 0) {
      this.endGame(false)
      return
    }
    if (!this.difficulty.endless && this.getStageProgressZ() >= this.getStageLength()) {
      this.endGame(true)
    }
  }

  private updateContentProgress(dt: number): void {
    this.contentScrollOffsetZ += this.mode.contentScrollSpeed * this.qaSpeedMultiplier * dt
  }

  private applyCareerChoice(): void {
    const choice = this.input.consumeCareerChoice()
    if (choice === null) {
      return
    }
    const feedback = this.getCareerChoiceFeedback(choice)
    if (!this.squad.chooseCareer(choice)) {
      return
    }
    this.fx.playReinforcementBurst(this.squad.getAlivePositions())
    this.hud.showCareerChoiceResult(feedback)
    this.camera.addImpulse(0.12)
    this.audio.playWeaponSpin()
    this.audio.playSquadAdd(this.squad.soldierCount)
  }

  private installBreachQaHooks(): void {
    if (!window.location.search.includes("qa=breach")) {
      return
    }
    window.__squadRushBreachQa = {
      applyBreaches: (monsterCount) => {
        this.damage.applyMonsterBreaches(monsterCount, 0)
      },
      snapshot: () => ({
        gameOver: this.gameOver,
        soldiers: this.squad.soldierCount,
        roster: this.squad.getRosterEntries().map((entry) => ({
          label: entry.label,
          count: entry.count,
        })),
      }),
    }
  }

  private installMonsterQaHooks(): void {
    if (!window.location.search.includes("qa=monsters")) {
      return
    }
    window.__squadRushMonsterQa = {
      killMidBoss: () => {
        const midBoss = this.waves.getAlive().find((monster) => monster.config?.behavior === MONSTER_BEHAVIORS.tank)
        if (midBoss === undefined) {
          return false
        }
        this.waves.kill(midBoss)
        this.handleMonsterKilled(midBoss)
        return true
      },
      killBasic: () => {
        const basic = this.waves.getAlive().find((monster) => monster.config?.behavior === MONSTER_BEHAVIORS.basic)
        if (basic === undefined) {
          return false
        }
        this.waves.kill(basic)
        this.handleMonsterKilled(basic)
        return true
      },
      killFast: () => {
        const fast = this.waves.getAlive().find((monster) => monster.config?.behavior === MONSTER_BEHAVIORS.fast)
        if (fast === undefined) {
          return false
        }
        this.waves.kill(fast)
        this.handleMonsterKilled(fast)
        return true
      },
    }
  }

  private getCareerChoiceFeedback(choice: CareerChoiceKey): CareerChoiceFeedback {
    switch (choice) {
      case "military": {
        const unit = UNIT_DEFINITIONS[UNIT_TYPES.soldier]
        return {
          label: unit.label,
          color: unit.color,
          portraitSrc: unit.portraitSrc,
          message: "군입대 선택: 병사 합류",
        }
      }
      case "overtime": {
        const unit = UNIT_DEFINITIONS[UNIT_TYPES.developer]
        return {
          label: unit.label,
          color: unit.color,
          portraitSrc: unit.portraitSrc,
          message: "야근 선택: 개발자 합류",
        }
      }
      case "fired": {
        const unit = UNIT_DEFINITIONS[UNIT_TYPES.unemployed]
        return {
          label: unit.label,
          color: unit.color,
          portraitSrc: unit.portraitSrc,
          message: "해고 선택: 백수 합류",
        }
      }
    }
  }

  private handleMonsterKilled(monster: MonsterInstance): void {
    this.monstersKilled += 1
    this.playMonsterDeathFeedback(monster)
    if (this.monstersKilled % 12 === 0) {
      this.audio.playEnemyFlurry(this.monstersKilled)
    }
    if (this.monstersKilled % 5 === 0) {
      this.fx.playChainPop(monster.mesh.position)
      this.audio.playChainKill()
    }
    if (this.monstersKilled % 10 === 0) {
      this.hud.showCombo(this.monstersKilled)
      this.camera.addImpulse(0.08)
      this.audio.playFinalPop()
    }
  }

  private playMonsterDeathFeedback(monster: MonsterInstance): void {
    if (monster.config?.behavior !== MONSTER_BEHAVIORS.tank) {
      if (
        this.mode.id === GAME_MODE_IDS.defense
        && this.monstersKilled % DEFENSE_REGULAR_DEATH_FX_STRIDE !== 0
      ) {
        return
      }
      this.fx.playDeathBurst(monster.mesh.position, 0.65)
      return
    }
    const burstPosition = monster.mesh.position.clone()
    window.setTimeout(() => {
      this.fx.playMidBossDeathBurst(burstPosition, MID_BOSS_DEATH_BURST_SCALE)
      this.camera.addImpulse(MID_BOSS_DEATH_CAMERA_IMPULSE)
    }, MID_BOSS_DEATH_BURST_DELAY_MS)
  }

  private getStageProgressZ(): number {
    return this.squad.squadZ + this.contentScrollOffsetZ
  }

  private getStageLength(): number {
    return getDifficultyStageLength(LEVEL_1.totalLength, this.difficulty)
  }

  private getMonsterIncomingScrollSpeed(): number {
    if (this.mode.squadForwardMultiplier > 0) {
      return 0
    }
    return this.mode.contentScrollSpeed
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
    const infiniteUnlocked = victory && this.difficulty.id === DIFFICULTY_IDS.hard
      ? recordHardClear(this.mode.id)
      : false
    const campaignGrant = grantCampaignRunReward({
      mode: this.mode.id,
      difficulty: this.difficulty.id,
      victory,
      monstersKilled: this.monstersKilled,
      progressRatio: this.getStageProgressZ() / this.getStageLength(),
    })
    this.result.show(victory, {
      monstersKilled: this.monstersKilled,
      soldiersLeft: this.squad.soldierCount,
      endlessStage: this.difficulty.endless ? this.getEndlessStage() : undefined,
      infiniteUnlocked,
      campaignReward: campaignGrant.reward,
      campaignProgress: campaignGrant.progress,
      combatInsight: this.damage.getCombatInsight(),
    })
    this.onGameOver?.(victory)
  }

  private getEndlessStage(): number {
    return Math.max(1, Math.floor(this.getStageProgressZ() / this.getStageLength()) + 1)
  }
}

function getDefenseSquadVisualCapacity(baseMonsterCapacity: number): number {
  if (baseMonsterCapacity >= 320) return 24
  if (baseMonsterCapacity >= 210) return 22
  if (baseMonsterCapacity >= 170) return 20
  if (baseMonsterCapacity >= 140) return 18
  return 16
}
