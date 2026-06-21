import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import type { SquadSystem } from "./SquadSystem"
import type { FXSystem } from "./FXSystem"

export class BossSystem {
  private bossMesh: Mesh | null = null
  private hp = 0
  private readonly maxHp = 500
  private spawned = false
  private attackTimer = 0
  private readonly attackInterval = 3
  private readonly spawnZ = 175
  private readonly spawnPos = new Vector3(0, 2.5, this.spawnZ)
  onDeath?: () => void
  onDamageSoldiers?: (n: number) => void

  constructor(
    private readonly scene: Scene,
    private readonly squad: SquadSystem,
    private readonly fx: FXSystem,
    private readonly templateMesh: Mesh | null,
  ) {}

  update(dt: number, squadAttack: number): void {
    if (!this.spawned && this.squad.squadZ >= this.spawnZ - 60) {
      this.spawn()
    }
    if (this.bossMesh === null || this.hp <= 0) {
      return
    }

    this.attackTimer -= dt
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackInterval
      this.doAttack()
    }

    if (this.squad.squadZ >= this.spawnZ - 30) {
      const dps = squadAttack * this.squad.soldierCount * 0.5
      this.hp -= dps * dt
      this.bossMesh.rotation.y += dt
      if (this.hp <= 0) {
        this.die()
      }
    }
  }

  getHpRatio(): number {
    return this.spawned ? Math.max(0, this.hp / this.maxHp) : -1
  }

  isAlive(): boolean {
    return this.spawned && this.hp > 0
  }

  private spawn(): void {
    this.spawned = true
    this.hp = this.maxHp
    this.attackTimer = 1.4
    const mesh = this.templateMesh?.clone("boss_runtime", null) ?? this.createFallbackBoss()
    mesh.position.copyFrom(this.spawnPos)
    mesh.scaling.setAll(1)
    mesh.setEnabled(true)
    this.bossMesh = mesh
  }

  private createFallbackBoss(): Mesh {
    const mesh = MeshBuilder.CreateCylinder("boss", { height: 5, diameter: 4, tessellation: 12 }, this.scene)
    const mat = new StandardMaterial("bossMat", this.scene)
    mat.diffuseColor = new Color3(0.48, 0.12, 0.72)
    mat.emissiveColor = new Color3(0.08, 0.01, 0.13)
    mesh.material = mat
    return mesh
  }

  private doAttack(): void {
    if (this.bossMesh === null) {
      return
    }
    const removed = Math.max(1, Math.floor(this.squad.soldierCount * 0.1))
    this.squad.removeSoldiers(removed)
    this.onDamageSoldiers?.(removed)
    this.fx.playExplosion(this.bossMesh.position, 1.3)
  }

  private die(): void {
    if (this.bossMesh !== null) {
      this.fx.playExplosion(this.bossMesh.position, 3)
      this.bossMesh.setEnabled(false)
      this.bossMesh = null
    }
    this.onDeath?.()
  }
}
