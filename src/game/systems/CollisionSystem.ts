import { distance2d } from "../utils/math"
import type { MonsterInstance } from "../pools/MonsterPool"
import type { MonsterWaveSystem } from "./MonsterWaveSystem"
import type { SquadSystem } from "./SquadSystem"

export class CollisionSystem {
  constructor(
    private readonly squad: SquadSystem,
    private readonly waves: MonsterWaveSystem,
  ) {}

  getBulletsInRange(originX: number, originZ: number, range: number): readonly MonsterInstance[] {
    const result: MonsterInstance[] = []
    for (const monster of this.waves.getAlive()) {
      if (distance2d(monster.mesh.position.x, monster.mesh.position.z, originX, originZ) <= range) {
        result.push(monster)
      }
    }
    return result
  }

  checkMonsterSquadCollision(): readonly MonsterInstance[] {
    const hits: MonsterInstance[] = []
    for (const monster of this.waves.getAlive()) {
      const radius = 1.2 + (monster.config?.scale ?? 1)
      if (distance2d(monster.mesh.position.x, monster.mesh.position.z, this.squad.squadX, this.squad.squadZ) < radius) {
        hits.push(monster)
      }
    }
    return hits
  }
}
