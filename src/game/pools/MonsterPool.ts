import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { MonsterConfig } from "../data/monsterData"
import { ObjectPool } from "./ObjectPool"

export type MonsterInstance = {
  readonly mesh: Mesh
  config: MonsterConfig | null
  hp: number
  maxHp: number
  alive: boolean
  velocityX: number
  velocityZ: number
}

export class MonsterPool {
  private readonly pool: ObjectPool<MonsterInstance>

  constructor(
    private readonly scene: Scene,
    private readonly templateMesh: Mesh | null,
    capacity: number,
  ) {
    this.pool = new ObjectPool<MonsterInstance>(
      (index) => this.createInstance(index),
      (monster) => {
        monster.mesh.setEnabled(false)
        monster.alive = false
        monster.hp = 0
      },
      capacity,
    )
  }

  spawn(config: MonsterConfig, x: number, z: number): MonsterInstance | null {
    const inst = this.pool.get()
    if (inst === null) {
      return null
    }
    inst.config = config
    inst.hp = config.hp
    inst.maxHp = config.hp
    inst.alive = true
    inst.velocityX = 0
    inst.velocityZ = -config.speed
    inst.mesh.scaling.setAll(config.scale)
    inst.mesh.position.set(x, config.scale, z)
    inst.mesh.setEnabled(true)
    const material = inst.mesh.material
    if (material instanceof StandardMaterial) {
      material.diffuseColor = Color3.FromHexString(config.cssColor)
    }
    return inst
  }

  release(inst: MonsterInstance): void {
    this.pool.release(inst)
  }

  getActive(): readonly MonsterInstance[] {
    return this.pool.getActive()
  }

  activeCount(): number {
    return this.pool.activeCount()
  }

  private createInstance(index: number): MonsterInstance {
    const mesh = this.templateMesh?.clone(`monster_${index}`, null) ?? this.createFallback(index)
    mesh.setEnabled(false)
    return {
      mesh,
      config: null,
      hp: 0,
      maxHp: 0,
      alive: false,
      velocityX: 0,
      velocityZ: 0,
    }
  }

  private createFallback(index: number): Mesh {
    const mesh = MeshBuilder.CreateCylinder(`monster_${index}`, { height: 2, diameter: 1, tessellation: 8 }, this.scene)
    const mat = new StandardMaterial(`monsterMat_${index}`, this.scene)
    mat.diffuseColor = new Color3(0.82, 0.12, 0.16)
    mat.emissiveColor = new Color3(0.08, 0.01, 0.01)
    mesh.material = mat
    return mesh
  }
}
