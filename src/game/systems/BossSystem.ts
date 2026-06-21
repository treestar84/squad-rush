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
    this.decorateBoss(mesh)
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

  private decorateBoss(mesh: Mesh): void {
    const armorMat = new StandardMaterial("bossArmorMat", this.scene)
    armorMat.diffuseColor = new Color3(0.12, 0.04, 0.2)
    armorMat.emissiveColor = new Color3(0.08, 0.01, 0.14)
    const coreMat = new StandardMaterial("bossCoreMat", this.scene)
    coreMat.diffuseColor = new Color3(1, 0.16, 0.38)
    coreMat.emissiveColor = new Color3(0.85, 0.02, 0.16)

    const crown = MeshBuilder.CreateCylinder("boss_crown", { height: 0.6, diameterTop: 1.2, diameterBottom: 2.4, tessellation: 6 }, this.scene)
    crown.material = armorMat
    crown.parent = mesh
    crown.position.set(0, 3, 0)

    const core = MeshBuilder.CreateSphere("boss_core", { diameter: 0.82, segments: 16 }, this.scene)
    core.material = coreMat
    core.parent = mesh
    core.position.set(0, 1.45, 1.95)

    for (const x of [-1.65, 1.65]) {
      const shoulder = MeshBuilder.CreateBox(`boss_shoulder_${x}`, { width: 0.72, height: 0.72, depth: 0.72 }, this.scene)
      shoulder.material = armorMat
      shoulder.parent = mesh
      shoulder.position.set(x, 2.25, 0)
    }
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
