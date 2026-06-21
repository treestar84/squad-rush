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
  private readonly eyeMat: StandardMaterial
  private readonly spikeMat: StandardMaterial

  constructor(
    private readonly scene: Scene,
    private readonly templateMesh: Mesh | null,
    capacity: number,
  ) {
    this.eyeMat = new StandardMaterial("monsterEyeMat", scene)
    this.eyeMat.diffuseColor = new Color3(1, 0.08, 0.04)
    this.eyeMat.emissiveColor = new Color3(0.85, 0.02, 0.01)
    this.spikeMat = new StandardMaterial("monsterSpikeMat", scene)
    this.spikeMat.diffuseColor = new Color3(0.04, 0.02, 0.02)
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
    this.applyColor(inst.mesh, Color3.FromHexString(config.cssColor))
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
    const mesh = this.createMonsterVisual(index)
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

  private createMonsterVisual(index: number): Mesh {
    const root = new Mesh(`monster_${index}`, this.scene)
    const imported = this.templateMesh?.clone(`monster_glb_${index}`, null)
    if (imported !== undefined && imported !== null) {
      imported.parent = root
      imported.scaling.setAll(0.72)
      imported.position.set(0, -0.22, 0)
    }
    const body = MeshBuilder.CreateSphere(`monster_body_${index}`, { diameterX: 1.25, diameterY: 1.05, diameterZ: 1.35, segments: 16 }, this.scene)
    body.parent = root
    body.position.set(0, 0.62, 0)
    body.material = this.createFallbackMaterial(index)
    const jaw = MeshBuilder.CreateBox(`monster_jaw_${index}`, { width: 0.72, height: 0.28, depth: 0.32 }, this.scene)
    jaw.parent = root
    jaw.position.set(0, 0.42, 0.62)
    jaw.material = this.spikeMat
    this.decorateMonster(root, index)
    return root
  }

  private decorateMonster(mesh: Mesh, index: number): void {
    for (const x of [-0.18, 0.18]) {
      const eye = MeshBuilder.CreateSphere(`monster_eye_${index}_${x}`, { diameter: 0.18, segments: 8 }, this.scene)
      eye.material = this.eyeMat
      eye.parent = mesh
      eye.position.set(x, 0.82, 0.62)
    }
    const spike = MeshBuilder.CreateCylinder(`monster_spike_${index}`, { height: 0.46, diameterTop: 0, diameterBottom: 0.28, tessellation: 8 }, this.scene)
    spike.material = this.spikeMat
    spike.parent = mesh
    spike.position.set(0, 1.18, -0.08)
  }

  private createFallbackMaterial(index: number): StandardMaterial {
    const mat = new StandardMaterial(`monsterBodyMat_${index}`, this.scene)
    mat.diffuseColor = new Color3(0.82, 0.12, 0.16)
    mat.emissiveColor = new Color3(0.12, 0.01, 0.01)
    mat.specularColor = new Color3(0.55, 0.18, 0.12)
    return mat
  }

  private applyColor(mesh: Mesh, color: Color3): void {
    const meshes = [mesh, ...mesh.getChildMeshes(false)]
    for (const child of meshes) {
      const material = child.material
      if (material instanceof StandardMaterial && material !== this.eyeMat && material !== this.spikeMat) {
        material.diffuseColor = color
        material.emissiveColor = color.scale(0.12)
      }
    }
  }
}
