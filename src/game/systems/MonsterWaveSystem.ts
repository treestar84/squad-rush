import type { Scene } from "@babylonjs/core"
import type { DifficultyProfile } from "../data/difficultyData"
import type { MonsterConfig, SpawnPattern } from "../data/monsterData"
import { CONTINUOUS_SPAWN, MONSTER_CONFIGS } from "../data/monsterData"
import { MonsterPool, type MonsterInstance } from "../pools/MonsterPool"
import type { MonsterModelAssets } from "../pools/MonsterVisualFactory"
import type { QualitySettings } from "./QualitySystem"

type SpawnBatch = {
  readonly config: MonsterConfig
  readonly count: number
  readonly pattern: SpawnPattern
}

type MonsterDebugState = { readonly active: number; readonly averageAbsX: number; readonly maxAbsX: number; readonly nearestDistance: number }

declare global {
  interface Window {
    __squadRushMonsterDebug?: MonsterDebugState
  }
}

const LANE_X = [-5.1, -3.4, -1.7, 0, 1.7, 3.4, 5.1] as const
const SIDE_LANE_X = [-5.4, -4.05, -2.7, 2.7, 4.05, 5.4] as const
const HORDE_OFFSET_X = [-4.8, -4, -3.2, -2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4, 3.2, 4, 4.8] as const
const SWARM_OFFSET_X = [-5.6, -4.9, -4.2, -3.5, -2.8, -2.1, -1.4, -0.7, 0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6] as const
const HORDE_ROW_DEPTH = 0.31
const HORDE_STAGGER_DEPTH = 0.06
const BATCH_LAYER_DEPTH = 0.18
const MEDIUM_LOD_DISTANCE = 24
const FAR_LOD_DISTANCE = 42
const FAR_LOD_EXTRA_SKIP = 3
const MEDIUM_LOD_EXTRA_SKIP = 1
const FRAME_ORDINAL_WRAP = 6000
const HIT_PULSE_DURATION = 0.12
const HIT_PULSE_WIDE_SCALE = 0.14
const HIT_PULSE_FLAT_SCALE = 0.1
const MID_BOSS_SPAWN_Z = [104, 154, 204, 258, 318] as const
const MAX_ACTIVE_PRESSURE_MONSTERS = 150
const CENTER_CONVERGE_DISTANCE = 70
const CENTER_CONVERGE_MIN_RETAIN = 0.24

export class MonsterWaveSystem {
  private readonly pool: MonsterPool
  private nextSpawnZ = CONTINUOUS_SPAWN.startZ
  private spawnOrdinal = 0
  private frameOrdinal = 0

  constructor(
    scene: Scene,
    monsterAssets: MonsterModelAssets | null,
    private readonly quality: QualitySettings,
    private readonly difficulty: DifficultyProfile,
  ) {
    this.pool = new MonsterPool(scene, monsterAssets, quality.maxMonsters)
  }

  update(squadZ: number, dt: number): void {
    this.frameOrdinal = (this.frameOrdinal + 1) % FRAME_ORDINAL_WRAP
    while (this.canSpawnAhead(squadZ)) {
      this.spawnContinuousGroup(this.nextSpawnZ, this.spawnOrdinal)
      this.nextSpawnZ += CONTINUOUS_SPAWN.spacing
      this.spawnOrdinal += 1
    }

    for (const monster of this.pool.getActive()) {
      const distanceAhead = monster.mesh.position.z - squadZ
      this.updateHitPulse(monster, dt)
      if (this.shouldAnimateMonster(monster, distanceAhead)) {
        monster.swayPhase += monster.swaySpeed * dt
        const centerPull = Math.max(CENTER_CONVERGE_MIN_RETAIN, Math.min(1, distanceAhead / CENTER_CONVERGE_DISTANCE))
        monster.mesh.position.x = monster.originX * centerPull + Math.sin(monster.swayPhase) * monster.swayAmplitude
        monster.mesh.rotation.y += Math.sin(monster.swayPhase) * dt * 0.42
      }
      monster.mesh.position.z += monster.velocityZ * dt
      if (monster.mesh.position.z < squadZ - 30) {
        this.kill(monster)
      }
    }
    this.updateDebugState(squadZ)
  }

  markHit(monster: MonsterInstance): void {
    if (!monster.alive) {
      return
    }
    monster.hitPulse = HIT_PULSE_DURATION
  }

  kill(monster: MonsterInstance): void {
    if (!monster.alive) {
      return
    }
    monster.alive = false
    this.pool.release(monster)
  }

  getAlive(): readonly MonsterInstance[] {
    return this.pool.getActive()
  }

  aliveCount(): number {
    return this.pool.activeCount()
  }

  private canSpawnAhead(squadZ: number): boolean {
    return this.nextSpawnZ <= CONTINUOUS_SPAWN.endZ
      && squadZ + CONTINUOUS_SPAWN.lookAhead >= this.nextSpawnZ
      && this.pool.activeCount() < this.maxActivePressure
  }

  private get maxActivePressure(): number {
    return Math.min(this.quality.maxMonsters, Math.round(MAX_ACTIVE_PRESSURE_MONSTERS * this.difficulty.pressureMultiplier))
  }

  private shouldAnimateMonster(monster: MonsterInstance, distanceAhead: number): boolean {
    const skipRate = this.getLodSkipRate(monster, distanceAhead)
    return skipRate === 0 || this.frameOrdinal % (skipRate + 1) === 0
  }

  private getLodSkipRate(monster: MonsterInstance, distanceAhead: number): number {
    const config = monster.config
    if (config?.behavior === MONSTER_CONFIGS.tank.behavior || distanceAhead < MEDIUM_LOD_DISTANCE) {
      return 0
    }

    const distanceSkip = distanceAhead > FAR_LOD_DISTANCE ? FAR_LOD_EXTRA_SKIP : MEDIUM_LOD_EXTRA_SKIP
    return this.quality.animationSkipRate + distanceSkip
  }

  private updateHitPulse(monster: MonsterInstance, dt: number): void {
    if (monster.hitPulse <= 0) {
      if (
        monster.mesh.scaling.x !== monster.variantScale
        || monster.mesh.scaling.y !== monster.variantScale
        || monster.mesh.scaling.z !== monster.variantScale
      ) {
        monster.mesh.scaling.setAll(monster.variantScale)
      }
      return
    }

    monster.hitPulse = Math.max(0, monster.hitPulse - dt)
    const pulse = monster.hitPulse / HIT_PULSE_DURATION
    monster.mesh.scaling.set(
      monster.variantScale * (1 + pulse * HIT_PULSE_WIDE_SCALE),
      monster.variantScale * (1 - pulse * HIT_PULSE_FLAT_SCALE),
      monster.variantScale * (1 + pulse * HIT_PULSE_WIDE_SCALE * 0.65),
    )
  }

  private updateDebugState(squadZ: number): void {
    if (!window.location.search.includes("qa=monsters")) {
      return
    }
    let totalAbsX = 0
    let maxAbsX = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    const active = this.pool.getActive()
    for (const monster of active) {
      const absX = Math.abs(monster.mesh.position.x)
      totalAbsX += absX
      maxAbsX = Math.max(maxAbsX, absX)
      nearestDistance = Math.min(nearestDistance, Math.abs(monster.mesh.position.z - squadZ))
    }
    window.__squadRushMonsterDebug = {
      active: active.length,
      averageAbsX: active.length === 0 ? 0 : totalAbsX / active.length,
      maxAbsX,
      nearestDistance,
    }
  }

  private spawnContinuousGroup(baseZ: number, ordinal: number): void {
    const remainingCapacity = this.maxActivePressure - this.pool.activeCount()
    if (remainingCapacity <= 0) {
      return
    }
    let spawned = 0
    let batchIndex = 0
    for (const batch of this.getSpawnBatches(baseZ, ordinal)) {
      const count = Math.min(Math.ceil(batch.count * this.difficulty.spawnMultiplier), remainingCapacity - spawned)
      if (count <= 0) {
        return
      }
      this.spawnGroup(this.scaleConfig(batch.config), count, baseZ + batchIndex * BATCH_LAYER_DEPTH, batch.pattern)
      spawned += count
      batchIndex += 1
    }
  }

  private getSpawnBatches(baseZ: number, ordinal: number): readonly SpawnBatch[] {
    if (baseZ < 132) {
      return [
        { config: MONSTER_CONFIGS.basic, count: 2 + (ordinal % 2), pattern: "BLOCK" },
        { config: MONSTER_CONFIGS.fast, count: ordinal % 5 === 0 ? 1 : 0, pattern: "LINE" },
        { config: MONSTER_CONFIGS.tank, count: this.isMidBossSpawn(baseZ) ? 1 : 0, pattern: "LINE" },
      ]
    }
    if (baseZ < 190) {
      return [
        { config: MONSTER_CONFIGS.basic, count: 5 + (ordinal % 3), pattern: "BLOCK" },
        { config: MONSTER_CONFIGS.fast, count: ordinal % 3 === 0 ? 2 : 1, pattern: "LINE" },
        { config: MONSTER_CONFIGS.tank, count: this.isMidBossSpawn(baseZ) ? 1 : 0, pattern: "LINE" },
      ]
    }
    if (baseZ < 250) {
      return [
        { config: MONSTER_CONFIGS.basic, count: 42 + (ordinal % 8), pattern: "BLOCK" },
        { config: MONSTER_CONFIGS.fast, count: ordinal % 2 === 0 ? 12 : 9, pattern: "V_SHAPE" },
        { config: MONSTER_CONFIGS.tank, count: this.isMidBossSpawn(baseZ) ? 1 : 0, pattern: "LINE" },
      ]
    }
    return [
      { config: MONSTER_CONFIGS.basic, count: 48 + (ordinal % 10), pattern: "BLOCK" },
      { config: MONSTER_CONFIGS.fast, count: ordinal % 2 === 0 ? 14 : 10, pattern: "V_SHAPE" },
      { config: MONSTER_CONFIGS.tank, count: this.isMidBossSpawn(baseZ) ? 1 : 0, pattern: "LINE" },
    ]
  }

  private isMidBossSpawn(baseZ: number): boolean {
    return MID_BOSS_SPAWN_Z.some((spawnZ) => Math.abs(baseZ - spawnZ) <= CONTINUOUS_SPAWN.spacing * 0.5)
  }

  private scaleConfig(config: MonsterConfig): MonsterConfig {
    if (this.difficulty.id === "easy") {
      return config
    }
    return {
      ...config,
      hp: Math.ceil(config.hp * this.difficulty.healthMultiplier),
      speed: config.speed * this.difficulty.speedMultiplier,
      damage: Math.ceil(config.damage * this.difficulty.damageMultiplier),
    }
  }

  private spawnGroup(config: MonsterConfig, count: number, baseZ: number, pattern: SpawnPattern): void {
    for (let index = 0; index < count; index += 1) {
      let x = 0
      let z = baseZ
      switch (pattern) {
        case "LINE":
          x = this.getLaneX(index + Math.floor(baseZ)) + this.getScatter(index, baseZ, 0.16)
          break
        case "BLOCK":
          x = this.getHordeX(index + Math.floor(baseZ)) + this.getScatter(index, baseZ, 0.24)
          z = baseZ + Math.floor(index / SWARM_OFFSET_X.length) * HORDE_ROW_DEPTH + (index % 2) * HORDE_STAGGER_DEPTH
            + this.getScatter(index + 11, baseZ, 0.12)
          break
        case "V_SHAPE":
          x = this.getSideLaneX(index + Math.floor(baseZ)) + this.getScatter(index, baseZ, 0.2)
          z = baseZ + Math.abs(index - (count - 1) / 2) * 0.72 + this.getScatter(index + 7, baseZ, 0.14)
          break
      }
      this.pool.spawn(config, x, z)
    }
  }

  private getLaneX(index: number): number {
    return LANE_X[index % LANE_X.length] ?? 0
  }

  private getSideLaneX(index: number): number {
    return SIDE_LANE_X[index % SIDE_LANE_X.length] ?? 0
  }

  private getHordeX(index: number): number {
    return SWARM_OFFSET_X[index % SWARM_OFFSET_X.length]
      ?? HORDE_OFFSET_X[index % HORDE_OFFSET_X.length]
      ?? 0
  }

  private getScatter(index: number, baseZ: number, amount: number): number {
    return Math.sin(index * 2.31 + baseZ * 0.37) * amount
  }
}
