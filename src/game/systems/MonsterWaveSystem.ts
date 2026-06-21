import type { Mesh, Scene } from "@babylonjs/core"
import type { MonsterConfig, SpawnPattern } from "../data/monsterData"
import { MONSTER_CONFIGS, WAVE_CONFIGS } from "../data/monsterData"
import { MonsterPool, type MonsterInstance } from "../pools/MonsterPool"
import type { QualitySettings } from "./QualitySystem"

export class MonsterWaveSystem {
  private readonly pool: MonsterPool
  private readonly spawnedWaves = new Set<string>()

  constructor(scene: Scene, templateMesh: Mesh | null, private readonly quality: QualitySettings) {
    this.pool = new MonsterPool(scene, templateMesh, quality.maxMonsters)
  }

  update(squadZ: number, dt: number): void {
    for (const wave of Object.values(WAVE_CONFIGS)) {
      if (!this.spawnedWaves.has(wave.id) && squadZ >= wave.startZ - 50) {
        this.spawnedWaves.add(wave.id)
        let spawned = 0
        for (const group of wave.monsters) {
          const config = MONSTER_CONFIGS[group.configId]
          if (config === undefined) {
            continue
          }
          const count = Math.min(group.count, this.quality.maxMonsters - spawned)
          this.spawnGroup(config, count, wave.startZ, group.spawnPattern)
          spawned += count
          if (spawned >= this.quality.maxMonsters) {
            break
          }
        }
      }
    }

    for (const monster of this.pool.getActive()) {
      monster.mesh.position.x += monster.velocityX * dt
      monster.mesh.position.z += monster.velocityZ * dt
      monster.mesh.rotation.y += dt * 1.4
      if (monster.mesh.position.z < squadZ - 30) {
        this.kill(monster)
      }
    }
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

  private spawnGroup(config: MonsterConfig, count: number, baseZ: number, pattern: SpawnPattern): void {
    for (let index = 0; index < count; index += 1) {
      const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
      let x = 0
      let z = baseZ
      switch (pattern) {
        case "LINE":
          x = (index - (count - 1) / 2) * 1.45
          break
        case "BLOCK":
          x = ((index % cols) - (cols - 1) / 2) * 1.65
          z = baseZ + Math.floor(index / cols) * 1.85
          break
        case "V_SHAPE":
          x = (index - (count - 1) / 2) * 1.35
          z = baseZ + Math.abs(index - (count - 1) / 2) * 1.35
          break
      }
      this.pool.spawn(config, x, z)
    }
  }
}
