import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import { LEVEL_1 } from "../data/levelData"
import { SOLDIER_BASE } from "../data/soldierData"
import { ObjectPool } from "../pools/ObjectPool"
import { clamp } from "../utils/math"

type Soldier = {
  readonly mesh: Mesh
  offsetX: number
  offsetZ: number
  hp: number
  alive: boolean
}

export class SquadSystem {
  squadX = 0
  squadZ = 10
  private readonly soldiers: Soldier[] = []
  private readonly pool: ObjectPool<Soldier>
  private readonly alivePositions: Vector3[] = []
  private readonly trackHalf = LEVEL_1.trackWidth / 2

  constructor(
    private readonly scene: Scene,
    private readonly templateMesh: Mesh | null,
    maxCount: number,
  ) {
    this.pool = new ObjectPool<Soldier>(
      (index) => this.createSoldier(index),
      (soldier) => {
        soldier.mesh.setEnabled(false)
        soldier.alive = false
      },
      maxCount,
    )
    for (let index = 0; index < maxCount; index += 1) {
      this.alivePositions.push(new Vector3(0, 0, 0))
    }
    this.addSoldiers(LEVEL_1.startSoldiers)
  }

  private createSoldier(index: number): Soldier {
    const mesh = this.templateMesh?.clone(`soldier_${index}`, null) ?? this.createFallbackSoldier(index)
    mesh.setEnabled(false)
    return { mesh, offsetX: 0, offsetZ: 0, hp: SOLDIER_BASE.hp, alive: false }
  }

  private createFallbackSoldier(index: number): Mesh {
    const mesh = MeshBuilder.CreateCylinder(`soldier_${index}`, { height: 1.8, diameter: 0.65, tessellation: 8 }, this.scene)
    const mat = new StandardMaterial(`soldierMat_${index}`, this.scene)
    mat.diffuseColor = new Color3(0.08, 0.47, 0.92)
    mat.emissiveColor = new Color3(0.01, 0.05, 0.1)
    mesh.material = mat
    return mesh
  }

  addSoldiers(count: number): void {
    for (let index = 0; index < count; index += 1) {
      const soldier = this.pool.get()
      if (soldier === null) {
        break
      }
      soldier.alive = true
      soldier.hp = SOLDIER_BASE.hp
      soldier.mesh.setEnabled(true)
      this.soldiers.push(soldier)
    }
    this.recalcFormation()
  }

  removeSoldiers(count: number): void {
    for (let removed = 0; removed < count && this.soldiers.length > 0; removed += 1) {
      const soldier = this.soldiers.pop()
      if (soldier !== undefined) {
        this.pool.release(soldier)
      }
    }
    this.recalcFormation()
  }

  get soldierCount(): number {
    return this.soldiers.length
  }

  getAlivePositions(): readonly Vector3[] {
    for (let index = 0; index < this.soldiers.length; index += 1) {
      const soldier = this.soldiers[index]
      const position = this.alivePositions[index]
      if (soldier !== undefined && position !== undefined) {
        position.copyFrom(soldier.mesh.position)
      }
    }
    return this.alivePositions.slice(0, this.soldiers.length)
  }

  update(deltaX: number, dt: number): void {
    this.squadX = clamp(this.squadX + deltaX, -this.trackHalf, this.trackHalf)
    this.squadZ += LEVEL_1.forwardSpeed * dt

    for (const soldier of this.soldiers) {
      const targetX = this.squadX + soldier.offsetX
      const targetZ = this.squadZ + soldier.offsetZ
      const follow = Math.min(dt * 12, 1)
      soldier.mesh.position.x += (targetX - soldier.mesh.position.x) * follow
      soldier.mesh.position.z += (targetZ - soldier.mesh.position.z) * follow
      soldier.mesh.position.y = 0.9
      soldier.mesh.rotation.y = Math.sin(this.squadZ * 0.8 + soldier.offsetX) * 0.08
    }
  }

  private recalcFormation(): void {
    const count = this.soldiers.length
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.45)))
    const spacing = 1.35
    for (let index = 0; index < count; index += 1) {
      const soldier = this.soldiers[index]
      if (soldier === undefined) {
        continue
      }
      const col = index % cols
      const row = Math.floor(index / cols)
      soldier.offsetX = (col - (cols - 1) / 2) * spacing
      soldier.offsetZ = -row * spacing * 0.82
    }
  }
}
