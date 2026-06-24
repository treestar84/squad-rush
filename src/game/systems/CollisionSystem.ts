import { distance2d } from "../utils/math"
import type { MonsterInstance } from "../pools/MonsterPool"
import type { MonsterWaveSystem } from "./MonsterWaveSystem"
import type { SquadSystem } from "./SquadSystem"

const SOLDIER_CONTACT_RADIUS = 0.48
const MONSTER_CONTACT_SCALE_RADIUS = 0.32
const MONSTER_CONTACT_FRONT_BUFFER = 0.04

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
    const soldierPositions = this.squad.getAlivePositions()
    for (const monster of this.waves.getAlive()) {
      const radius = SOLDIER_CONTACT_RADIUS + (monster.config?.scale ?? 1) * MONSTER_CONTACT_SCALE_RADIUS
      const contactRadius = radius + MONSTER_CONTACT_FRONT_BUFFER
      if (soldierPositions.some((soldier) => distance2d(
        monster.mesh.position.x,
        monster.mesh.position.z,
        soldier.x,
        soldier.z,
      ) < contactRadius)) {
        hits.push(monster)
      }
    }
    return hits
  }
}
