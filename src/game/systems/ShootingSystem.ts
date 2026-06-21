import { Vector3 } from "@babylonjs/core"
import { SOLDIER_BASE } from "../data/soldierData"
import type { MonsterInstance } from "../pools/MonsterPool"
import type { CollisionSystem } from "./CollisionSystem"
import type { GateSystem } from "./GateSystem"
import type { MonsterWaveSystem } from "./MonsterWaveSystem"
import type { ProjectileSystem } from "./ProjectileSystem"
import type { SquadSystem } from "./SquadSystem"

export class ShootingSystem {
  private readonly timers: number[] = []
  private readonly shotFrom = new Vector3(0, 0, 0)
  private readonly shotTo = new Vector3(0, 0, 0)
  onMonsterKilled?: (monster: MonsterInstance) => void

  constructor(
    private readonly squad: SquadSystem,
    private readonly waves: MonsterWaveSystem,
    private readonly collision: CollisionSystem,
    private readonly gates: GateSystem,
    private readonly projectiles: ProjectileSystem,
    maxSoldiers: number,
  ) {
    for (let index = 0; index < maxSoldiers; index += 1) {
      this.timers.push(0)
    }
  }

  update(dt: number): void {
    const monsters = this.waves.getAlive()
    if (monsters.length === 0) {
      return
    }
    const stats = this.gates.getStats()
    const cooldown = 1 / (SOLDIER_BASE.fireRate * stats.fireRateMultiplier)
    const damage = SOLDIER_BASE.attackDamage * stats.attackMultiplier
    const range = SOLDIER_BASE.attackRange * stats.rangeMultiplier
    const soldierPositions = this.squad.getAlivePositions()

    for (let index = 0; index < soldierPositions.length; index += 1) {
      this.timers[index] = (this.timers[index] ?? 0) - dt
      if ((this.timers[index] ?? 0) > 0) {
        continue
      }
      const position = soldierPositions[index]
      if (position === undefined) {
        continue
      }
      const target = this.findNearest(position.x, position.z, range)
      if (target === null) {
        continue
      }
      this.timers[index] = cooldown
      this.shotFrom.set(position.x, 1.35, position.z)
      this.shotTo.set(target.mesh.position.x, 1.2, target.mesh.position.z)
      this.projectiles.addTrail(this.shotFrom, this.shotTo)
      target.hp -= damage
      if (target.hp <= 0) {
        this.waves.kill(target)
        this.onMonsterKilled?.(target)
      }
    }
  }

  private findNearest(x: number, z: number, range: number): MonsterInstance | null {
    const candidates = this.collision.getBulletsInRange(x, z, range)
    let nearest: MonsterInstance | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const monster of candidates) {
      const dx = monster.mesh.position.x - x
      const dz = monster.mesh.position.z - z
      const distance = dx * dx + dz * dz
      if (distance < nearestDistance) {
        nearest = monster
        nearestDistance = distance
      }
    }
    return nearest
  }
}
