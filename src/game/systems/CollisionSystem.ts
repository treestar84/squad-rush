import type { MonsterInstance } from "../pools/MonsterPool"
import type { MonsterWaveSystem } from "./MonsterWaveSystem"
import type { SquadSystem } from "./SquadSystem"

const SOLDIER_CONTACT_RADIUS = 0.48
const MONSTER_CONTACT_SCALE_RADIUS = 0.32
const MONSTER_CONTACT_FRONT_BUFFER = 0.04

export class CollisionSystem {
  private readonly squadCollisionHits: MonsterInstance[] = []

  constructor(
    private readonly squad: SquadSystem,
    private readonly waves: MonsterWaveSystem,
  ) {}

  getAliveMonsters(): readonly MonsterInstance[] {
    return this.waves.getAlive()
  }

  getBulletsInRange(originX: number, originZ: number, range: number): readonly MonsterInstance[] {
    const result: MonsterInstance[] = []
    for (const monster of this.waves.getAlive()) {
      if (!monster.alive) {
        continue
      }
      const targetReach = range + monster.projectileHitRadius
      const dx = monster.mesh.position.x - originX
      const dz = monster.mesh.position.z - originZ
      if (dx * dx + dz * dz <= targetReach * targetReach) {
        result.push(monster)
      }
    }
    return result
  }

  checkMonsterSquadCollision(): readonly MonsterInstance[] {
    const hits = this.squadCollisionHits
    hits.length = 0
    const soldierPositions = this.squad.getAlivePositions()
    if (soldierPositions.length === 0) {
      return hits
    }
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY
    for (const soldier of soldierPositions) {
      minX = Math.min(minX, soldier.x)
      maxX = Math.max(maxX, soldier.x)
      minZ = Math.min(minZ, soldier.z)
      maxZ = Math.max(maxZ, soldier.z)
    }
    for (const monster of this.waves.getAlive()) {
      if (!monster.alive) {
        continue
      }
      const radius = SOLDIER_CONTACT_RADIUS + (monster.config?.scale ?? 1) * MONSTER_CONTACT_SCALE_RADIUS
      const contactRadius = radius + MONSTER_CONTACT_FRONT_BUFFER
      const nearestX = Math.max(minX, Math.min(maxX, monster.mesh.position.x))
      const nearestZ = Math.max(minZ, Math.min(maxZ, monster.mesh.position.z))
      const dx = monster.mesh.position.x - nearestX
      const dz = monster.mesh.position.z - nearestZ
      if (dx * dx + dz * dz < contactRadius * contactRadius) {
        hits.push(monster)
      }
    }
    return hits
  }
}
