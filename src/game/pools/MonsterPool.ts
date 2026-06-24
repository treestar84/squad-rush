import { Mesh, Scene, StandardMaterial } from "@babylonjs/core"
import type { AbstractMesh } from "@babylonjs/core"
import { MONSTER_BEHAVIORS, type MonsterBehavior, type MonsterConfig } from "../data/monsterData"
import { ObjectPool } from "./ObjectPool"
import {
  applyMonsterVisualTint,
  createMonsterContactShadowMaterial,
  createMonsterVisual,
  type MonsterModelAssets,
  usesAuthoredMonsterVisual,
} from "./MonsterVisualFactory"
import { ACTOR_GROUND_Y } from "../WorldGeometry"

export type MonsterInstance = {
  readonly mesh: Mesh
  config: MonsterConfig | null
  hp: number
  maxHp: number
  alive: boolean
  velocityX: number
  velocityZ: number
  originX: number
  spawnId: number
  variantScale: number
  hitPulse: number
  swayPhase: number
  swayAmplitude: number
  swaySpeed: number
  hitRadius: number
  hitHalfDepth: number
  visual: Mesh | null
  visualBehavior: MonsterBehavior | null
}

type VisualHitBounds = {
  readonly radius: number
  readonly halfDepth: number
}

const MIN_VISUAL_HIT_RADIUS = 0.24
const MIN_VISUAL_HIT_HALF_DEPTH = 0.2
const MAX_VISUAL_HIT_RADIUS = 1.45
const MAX_VISUAL_HIT_HALF_DEPTH = 1.2
const FALLBACK_HIT_RADIUS_SCALE = 0.78
const FALLBACK_HIT_HALF_DEPTH_SCALE = 0.64

export class MonsterPool {
  private readonly pool: ObjectPool<MonsterInstance>
  private readonly contactShadowMat: StandardMaterial
  private spawnSerial = 0

  constructor(
    private readonly scene: Scene,
    private readonly assets: MonsterModelAssets | null,
    capacity: number,
  ) {
    this.contactShadowMat = createMonsterContactShadowMaterial(scene)
    this.pool = new ObjectPool<MonsterInstance>(
      (index) => this.createInstance(index),
      (monster) => {
        monster.mesh.setEnabled(false)
        monster.alive = false
        monster.hp = 0
        monster.hitPulse = 0
        monster.hitRadius = MIN_VISUAL_HIT_RADIUS
        monster.hitHalfDepth = MIN_VISUAL_HIT_HALF_DEPTH
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
    this.spawnSerial += 1
    inst.spawnId = this.spawnSerial
    const seed = this.variantSeed(x, z, config.id.length)
    inst.originX = x
    inst.velocityX = 0
    inst.velocityZ = -config.speed
    inst.variantScale = config.scale * this.getScaleVariant(config, seed)
    inst.hitPulse = 0
    inst.swayPhase = seed * Math.PI * 2
    inst.swayAmplitude = this.getSwayAmplitude(config, seed)
    inst.swaySpeed = 0.62 + seed * 0.44
    this.ensureVisual(inst, config.behavior)
    inst.mesh.scaling.setAll(inst.variantScale)
    inst.mesh.rotation.y = (seed - 0.5) * 0.38
    const usesAuthoredVisual = usesAuthoredMonsterVisual(this.assets, config.behavior)
    const rootY = usesAuthoredVisual ? ACTOR_GROUND_Y : inst.variantScale * 0.5
    inst.mesh.position.set(x, rootY, z)
    if (!usesAuthoredVisual) {
      applyMonsterVisualTint(inst.mesh, config)
    }
    inst.mesh.setEnabled(true)
    const hitBounds = this.calculateVisualHitBounds(inst)
    inst.hitRadius = hitBounds.radius
    inst.hitHalfDepth = hitBounds.halfDepth
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
    const mesh = new Mesh(`monster_${index}`, this.scene)
    const visual = createMonsterVisual(this.scene, index, MONSTER_BEHAVIORS.basic, this.assets, this.contactShadowMat)
    visual.parent = mesh
    visual.position.set(0, 0, 0)
    mesh.setEnabled(false)
    return {
      mesh,
      config: null,
      hp: 0,
      maxHp: 0,
      alive: false,
      velocityX: 0,
      velocityZ: 0,
      originX: 0,
      spawnId: 0,
      variantScale: 1,
      hitPulse: 0,
      swayPhase: 0,
      swayAmplitude: 0,
      swaySpeed: 0,
      hitRadius: MIN_VISUAL_HIT_RADIUS,
      hitHalfDepth: MIN_VISUAL_HIT_HALF_DEPTH,
      visual,
      visualBehavior: MONSTER_BEHAVIORS.basic,
    }
  }

  private ensureVisual(inst: MonsterInstance, behavior: MonsterBehavior): void {
    if (inst.visualBehavior === behavior && inst.visual !== null) {
      return
    }
    inst.visual?.dispose(false, false)
    const visual = createMonsterVisual(this.scene, this.visualIndex(inst), behavior, this.assets, this.contactShadowMat)
    visual.parent = inst.mesh
    visual.position.set(0, 0, 0)
    visual.scaling.setAll(1)
    inst.visual = visual
    inst.visualBehavior = behavior
  }

  private visualIndex(inst: MonsterInstance): number {
    return this.pool.getActive().indexOf(inst)
  }

  private getScaleVariant(config: MonsterConfig, seed: number): number {
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      return 0.94 + seed * 0.24
    }
    if (config.behavior === MONSTER_BEHAVIORS.fast) {
      return 0.86 + seed * 0.18
    }
    return 0.98 + seed * 0.2
  }

  private getSwayAmplitude(config: MonsterConfig, seed: number): number {
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      return 0.02 + seed * 0.04
    }
    return 0.045 + seed * 0.1
  }

  private calculateVisualHitBounds(inst: MonsterInstance): VisualHitBounds {
    const fallback = this.getFallbackHitBounds(inst)
    const visual = inst.visual
    if (visual === null) {
      return fallback
    }

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY
    inst.mesh.computeWorldMatrix(true)
    visual.computeWorldMatrix(true)
    for (const child of visual.getChildMeshes(false)) {
      if (!this.isHitVolumeMesh(child)) {
        continue
      }
      child.computeWorldMatrix(true)
      for (const point of child.getBoundingInfo().boundingBox.vectorsWorld) {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minZ = Math.min(minZ, point.z)
        maxZ = Math.max(maxZ, point.z)
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      return fallback
    }

    return {
      radius: this.clampHitSize((maxX - minX) * 0.5, MIN_VISUAL_HIT_RADIUS, MAX_VISUAL_HIT_RADIUS),
      halfDepth: this.clampHitSize((maxZ - minZ) * 0.5, MIN_VISUAL_HIT_HALF_DEPTH, MAX_VISUAL_HIT_HALF_DEPTH),
    }
  }

  private getFallbackHitBounds(inst: MonsterInstance): VisualHitBounds {
    return {
      radius: this.clampHitSize(inst.variantScale * FALLBACK_HIT_RADIUS_SCALE, MIN_VISUAL_HIT_RADIUS, MAX_VISUAL_HIT_RADIUS),
      halfDepth: this.clampHitSize(inst.variantScale * FALLBACK_HIT_HALF_DEPTH_SCALE, MIN_VISUAL_HIT_HALF_DEPTH, MAX_VISUAL_HIT_HALF_DEPTH),
    }
  }

  private clampHitSize(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min
    }
    return Math.min(max, Math.max(min, value))
  }

  private isHitVolumeMesh(mesh: AbstractMesh): boolean {
    const name = mesh.name.toLowerCase()
    return !name.includes("contact_shadow")
      && !name.includes("threat_badge")
      && !name.includes("_cue_")
      && !name.includes("back_spine")
      && !name.includes("variant_")
  }

  private variantSeed(x: number, z: number, salt: number): number {
    return Math.abs(Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453) % 1
  }
}
