import { Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core"
import type { AbstractMesh, Material } from "@babylonjs/core"
import { MONSTER_BEHAVIORS, type MonsterBehavior, type MonsterConfig } from "../data/monsterData"
import {
  createMonsterRoleState,
  getMonsterRoleCueIntensity,
  resetMonsterRoleState,
  type MonsterRoleState,
} from "../MonsterRoleSystem"
import { ObjectPool } from "./ObjectPool"
import {
  applyMonsterVisualTint,
  createMonsterContactShadowMaterial,
  createMonsterDeathMaterial,
  createMonsterVisual,
  resolveMonsterContactShadow,
  resolveMonsterMotionRoot,
  resolveMonsterRoleCue,
  type MonsterModelAssets,
  usesAuthoredMonsterVisual,
} from "./MonsterVisualFactory"
import { ACTOR_GROUND_Y } from "../WorldGeometry"

type MonsterPoolOptions = {
  readonly hordeContactShadows?: boolean
  readonly compactHordeVisuals?: boolean
}

type MonsterMaterialBinding = {
  readonly mesh: AbstractMesh
  readonly material: Material | null
  readonly renderOverlay: boolean
}

export type MonsterInstance = {
  readonly poolIndex: number
  readonly mesh: Mesh
  config: MonsterConfig | null
  hp: number
  maxHp: number
  alive: boolean
  velocityX: number
  velocityZ: number
  originX: number
  baseY: number
  baseRotationY: number
  spawnId: number
  variantScale: number
  hitPulse: number
  deathTimer: number
  deathDuration: number
  deathFallDirection: number
  deathStartY: number
  swayPhase: number
  swayAmplitude: number
  swaySpeed: number
  lastBounceOffsetY: number
  lastWaddleTiltRadians: number
  lastWaddleRollRadians: number
  hitRadius: number
  hitHalfDepth: number
  projectileHitRadius: number
  projectileHitHalfDepth: number
  visual: Mesh | null
  visualMotionRoot: Mesh | null
  contactShadow: Mesh | null
  visualBehavior: MonsterBehavior | null
  visualUsesAuthored: boolean
  roleState: MonsterRoleState
  roleCue: Mesh | null
  deathMaterialBindings: MonsterMaterialBinding[]
  deathMaterialApplied: boolean
  hpBarRoot: Mesh | null
  hpBarFill: Mesh | null
}

type VisualHitBounds = {
  readonly radius: number
  readonly halfDepth: number
  readonly hpBarY: number
}

const MIN_VISUAL_HIT_RADIUS = 0.24
const MIN_VISUAL_HIT_HALF_DEPTH = 0.2
const MAX_VISUAL_HIT_RADIUS = 1.45
const MAX_VISUAL_HIT_HALF_DEPTH = 1.2
const TANK_MIN_HIT_RADIUS_SCALE = 1.28
const TANK_MIN_HIT_HALF_DEPTH_SCALE = 1.04
const TANK_MAX_VISUAL_HIT_RADIUS = 2.35
const TANK_MAX_VISUAL_HIT_HALF_DEPTH = 1.9
// Covers animated body edges without turning the boss into a full-lane wall.
const TANK_PROJECTILE_HIT_RADIUS_PADDING_RATIO = 1.12
const TANK_PROJECTILE_HIT_HALF_DEPTH_RATIO = 1.55
const FALLBACK_HIT_RADIUS_SCALE = 0.78
const FALLBACK_HIT_HALF_DEPTH_SCALE = 0.64
const MID_BOSS_HP_BAR_Y = 1.56
const MID_BOSS_HP_BAR_CLEARANCE = 0.42
const MID_BOSS_HP_BAR_WIDTH = 1.84
const MID_BOSS_HP_BAR_FILL_FRONT_Z = -0.14
const MID_BOSS_HP_FILL_DIFFUSE = [0.95, 0.16, 0.2] as const
const MID_BOSS_HP_FILL_EMISSIVE = [1, 0.04, 0.08] as const

export class MonsterPool {
  private readonly pool: ObjectPool<MonsterInstance>
  private readonly contactShadowMat: StandardMaterial
  private readonly deathMat: StandardMaterial
  private spawnSerial = 0

  constructor(
    private readonly scene: Scene,
    private readonly assets: MonsterModelAssets | null,
    capacity: number,
    private readonly options: MonsterPoolOptions = {},
  ) {
    this.contactShadowMat = createMonsterContactShadowMaterial(scene)
    this.deathMat = createMonsterDeathMaterial(scene)
    this.pool = new ObjectPool<MonsterInstance>(
      (index) => this.createInstance(index),
      (monster) => {
        this.restoreDeathMaterial(monster)
        monster.mesh.setEnabled(false)
        monster.alive = false
        monster.hp = 0
        monster.hitPulse = 0
        monster.deathTimer = 0
        monster.deathDuration = 0
        monster.deathFallDirection = 1
        monster.deathStartY = 0
        monster.baseY = 0
        monster.baseRotationY = 0
        monster.lastBounceOffsetY = 0
        monster.lastWaddleTiltRadians = 0
        monster.lastWaddleRollRadians = 0
        monster.roleCue?.setEnabled(false)
        monster.mesh.rotation.x = 0
        monster.mesh.rotation.y = 0
        monster.mesh.rotation.z = 0
        this.resetVisualMotion(monster)
        monster.hitRadius = MIN_VISUAL_HIT_RADIUS
        monster.hitHalfDepth = MIN_VISUAL_HIT_HALF_DEPTH
        monster.projectileHitRadius = MIN_VISUAL_HIT_RADIUS
        monster.projectileHitHalfDepth = MIN_VISUAL_HIT_HALF_DEPTH
        monster.hpBarRoot?.setEnabled(false)
      },
      Math.min(capacity, 64),
      capacity,
    )
  }

  spawn(config: MonsterConfig, x: number, z: number): MonsterInstance | null {
    const inst = this.pool.get()
    if (inst === null) {
      return null
    }
    this.restoreDeathMaterial(inst)
    inst.config = config
    inst.hp = config.hp
    inst.maxHp = config.hp
    inst.alive = true
    resetMonsterRoleState(inst.roleState, config)
    this.spawnSerial += 1
    inst.spawnId = this.spawnSerial
    const seed = this.variantSeed(x, z, config.id.length)
    inst.originX = x
    inst.baseY = 0
    inst.baseRotationY = (seed - 0.5) * 0.38
    inst.velocityX = 0
    inst.velocityZ = -config.speed
    inst.variantScale = config.scale * this.getScaleVariant(config, seed)
    inst.hitPulse = 0
    inst.deathTimer = 0
    inst.deathDuration = 0
    inst.deathFallDirection = 1
    inst.deathStartY = 0
    inst.swayPhase = seed * Math.PI * 2
    inst.swayAmplitude = this.getSwayAmplitude(config, seed)
    inst.swaySpeed = 0.62 + seed * 0.44
    inst.lastBounceOffsetY = 0
    inst.lastWaddleTiltRadians = 0
    inst.lastWaddleRollRadians = 0
    const usesAuthoredVisual = this.shouldUseAuthoredVisual(config.behavior)
    this.ensureVisual(inst, config.behavior, usesAuthoredVisual)
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      this.ensureHpBar(inst)
    }
    this.resetVisualMotion(inst)
    inst.mesh.scaling.setAll(inst.variantScale)
    inst.mesh.rotation.x = 0
    inst.mesh.rotation.y = inst.baseRotationY
    inst.mesh.rotation.z = 0
    const rootY = usesAuthoredVisual ? ACTOR_GROUND_Y : inst.variantScale * 0.5
    inst.baseY = rootY
    inst.mesh.position.set(x, rootY, z)
    if (
      (!usesAuthoredVisual || config.behavior !== MONSTER_BEHAVIORS.tank)
      && (
        this.options.compactHordeVisuals !== true
        || config.behavior === MONSTER_BEHAVIORS.fast
        || config.behavior === MONSTER_BEHAVIORS.shield
        || config.behavior === MONSTER_BEHAVIORS.charger
        || config.behavior === MONSTER_BEHAVIORS.splitter
      )
    ) {
      applyMonsterVisualTint(inst.mesh, config)
    }
    inst.mesh.setEnabled(true)
    const hitBounds = this.options.compactHordeVisuals === true && config.behavior !== MONSTER_BEHAVIORS.tank
      ? this.getFallbackHitBounds(inst)
      : this.calculateVisualHitBounds(inst)
    inst.hitRadius = hitBounds.radius
    inst.hitHalfDepth = hitBounds.halfDepth
    inst.projectileHitRadius = this.getProjectileHitRadius(inst, hitBounds.radius)
    inst.projectileHitHalfDepth = this.getProjectileHitHalfDepth(inst, hitBounds.halfDepth)
    if (inst.hpBarRoot !== null) {
      inst.hpBarRoot.position.y = hitBounds.hpBarY
    }
    this.updateHpBar(inst)
    this.updateRoleCue(inst)
    return inst
  }

  updateRoleCue(inst: MonsterInstance): void {
    const cue = inst.roleCue
    const config = inst.config
    if (cue === null || config === null || !inst.alive) {
      cue?.setEnabled(false)
      return
    }
    if (config.behavior === MONSTER_BEHAVIORS.shield) {
      const ratio = inst.roleState.shieldMaxHp <= 0
        ? 0
        : Math.max(0, Math.min(1, inst.roleState.shieldHp / inst.roleState.shieldMaxHp))
      cue.setEnabled(ratio > 0)
      cue.scaling.set(0.88 + ratio * 0.12, 0.82 + ratio * 0.18, 1)
      return
    }
    if (config.behavior === MONSTER_BEHAVIORS.charger) {
      const intensity = getMonsterRoleCueIntensity(inst.roleState, config)
      cue.setEnabled(intensity > 0)
      const pulse = 1 + Math.sin(inst.roleState.cuePhase * 24) * 0.12 * intensity
      cue.scaling.set(pulse, 0.82 + intensity * 0.28, pulse)
      return
    }
    if (config.behavior === MONSTER_BEHAVIORS.splitter) {
      cue.setEnabled(true)
      const pulse = 1 + Math.sin(inst.roleState.cuePhase * 8) * 0.05
      cue.scaling.set(pulse, 1 + (pulse - 1) * 0.6, pulse)
      return
    }
    cue.setEnabled(false)
  }

  updateHpBar(inst: MonsterInstance): void {
    const isMidBoss = inst.config?.behavior === MONSTER_BEHAVIORS.tank && inst.alive && inst.hp > 0
    if (!isMidBoss) {
      inst.hpBarRoot?.setEnabled(false)
      return
    }
    this.ensureHpBar(inst)
    const root = inst.hpBarRoot
    const fill = inst.hpBarFill
    if (root === null || fill === null) {
      return
    }
    root.setEnabled(true)
    this.restoreHpBarFillMaterial(fill)
    const hpRatio = inst.maxHp <= 0 ? 0 : Math.max(0, Math.min(1, inst.hp / inst.maxHp))
    fill.scaling.x = Math.max(0.001, hpRatio)
    fill.position.x = -(1 - hpRatio) * MID_BOSS_HP_BAR_WIDTH * 0.5
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
    mesh.setEnabled(false)
    return {
      poolIndex: index,
      mesh,
      config: null,
      hp: 0,
      maxHp: 0,
      alive: false,
      velocityX: 0,
      velocityZ: 0,
      originX: 0,
      baseY: 0,
      baseRotationY: 0,
      spawnId: 0,
      variantScale: 1,
      hitPulse: 0,
      deathTimer: 0,
      deathDuration: 0,
      deathFallDirection: 1,
      deathStartY: 0,
      swayPhase: 0,
      swayAmplitude: 0,
      swaySpeed: 0,
      lastBounceOffsetY: 0,
      lastWaddleTiltRadians: 0,
      lastWaddleRollRadians: 0,
      hitRadius: MIN_VISUAL_HIT_RADIUS,
      hitHalfDepth: MIN_VISUAL_HIT_HALF_DEPTH,
      projectileHitRadius: MIN_VISUAL_HIT_RADIUS,
      projectileHitHalfDepth: MIN_VISUAL_HIT_HALF_DEPTH,
      visual: null,
      visualMotionRoot: null,
      contactShadow: null,
      visualBehavior: null,
      visualUsesAuthored: false,
      roleState: createMonsterRoleState(),
      roleCue: null,
      deathMaterialBindings: [],
      deathMaterialApplied: false,
      hpBarRoot: null,
      hpBarFill: null,
    }
  }

  private ensureHpBar(inst: MonsterInstance): void {
    if (inst.hpBarRoot !== null && inst.hpBarFill !== null) {
      return
    }
    const hpBar = this.createHpBar(inst.poolIndex)
    hpBar.root.parent = inst.mesh
    hpBar.root.position.set(0, MID_BOSS_HP_BAR_Y, 0)
    hpBar.root.setEnabled(false)
    inst.hpBarRoot = hpBar.root
    inst.hpBarFill = hpBar.fill
  }

  applyDeathMaterial(inst: MonsterInstance): void {
    if (inst.deathMaterialApplied || inst.deathMaterialBindings.length === 0) {
      return
    }
    for (const binding of inst.deathMaterialBindings) {
      binding.mesh.material = this.deathMat
      binding.mesh.renderOverlay = false
    }
    inst.deathMaterialApplied = true
  }

  private createHpBar(index: number): { readonly root: Mesh; readonly fill: Mesh } {
    const root = new Mesh(`monster_mid_boss_hp_${index}`, this.scene)
    root.billboardMode = Mesh.BILLBOARDMODE_ALL

    const backMat = new StandardMaterial(`monsterMidBossHpBackMat_${index}`, this.scene)
    backMat.diffuseColor.set(0.025, 0.025, 0.03)
    backMat.emissiveColor.set(0.035, 0.035, 0.04)
    backMat.specularColor.set(0, 0, 0)
    backMat.disableLighting = true

    const fillMat = new StandardMaterial(`monsterMidBossHpFillMat_${index}`, this.scene)
    fillMat.diffuseColor.set(...MID_BOSS_HP_FILL_DIFFUSE)
    fillMat.emissiveColor.set(...MID_BOSS_HP_FILL_EMISSIVE)
    fillMat.specularColor.set(0, 0, 0)
    fillMat.disableLighting = true
    fillMat.backFaceCulling = false
    fillMat.needDepthPrePass = false

    const back = MeshBuilder.CreateBox(`monster_mid_boss_hp_back_${index}`, { width: MID_BOSS_HP_BAR_WIDTH, height: 0.16, depth: 0.05 }, this.scene)
    back.parent = root
    back.material = backMat
    back.renderingGroupId = 1

    const fill = MeshBuilder.CreateBox(`monster_mid_boss_hp_fill_${index}`, { width: MID_BOSS_HP_BAR_WIDTH, height: 0.11, depth: 0.06 }, this.scene)
    fill.parent = root
    fill.material = fillMat
    fill.position.z = MID_BOSS_HP_BAR_FILL_FRONT_Z
    fill.renderingGroupId = 2
    fill.alwaysSelectAsActiveMesh = true

    return { root, fill }
  }

  private restoreHpBarFillMaterial(fill: Mesh): void {
    if (!(fill.material instanceof StandardMaterial)) {
      return
    }
    fill.material.diffuseColor.set(...MID_BOSS_HP_FILL_DIFFUSE)
    fill.material.emissiveColor.set(...MID_BOSS_HP_FILL_EMISSIVE)
    fill.material.specularColor.set(0, 0, 0)
    fill.material.disableLighting = true
    fill.material.backFaceCulling = false
    fill.renderOverlay = false
  }

  private ensureVisual(inst: MonsterInstance, behavior: MonsterBehavior, useAuthoredVisual: boolean): void {
    if (inst.visualBehavior === behavior && inst.visualUsesAuthored === useAuthoredVisual && inst.visual !== null) {
      return
    }
    this.restoreDeathMaterial(inst)
    inst.visual?.dispose(false, false)
    const visual = createMonsterVisual(
      this.scene,
      this.visualIndex(inst),
      behavior,
      this.assets,
      this.contactShadowMat,
      useAuthoredVisual,
      this.shouldUseContactShadow(behavior),
      this.options.compactHordeVisuals === true,
    )
    visual.parent = inst.mesh
    visual.position.set(0, 0, 0)
    visual.scaling.setAll(1)
    if (this.options.compactHordeVisuals === true) {
      for (const child of visual.getChildMeshes(false)) {
        child.material?.freeze()
      }
    }
    inst.visual = visual
    inst.visualMotionRoot = resolveMonsterMotionRoot(visual)
    inst.contactShadow = resolveMonsterContactShadow(visual)
    inst.roleCue = resolveMonsterRoleCue(visual)
    inst.visualBehavior = behavior
    inst.visualUsesAuthored = useAuthoredVisual
    inst.deathMaterialBindings = this.captureDeathMaterialBindings(visual)
  }

  private captureDeathMaterialBindings(visual: Mesh): MonsterMaterialBinding[] {
    const bindings: MonsterMaterialBinding[] = []
    for (const child of visual.getChildMeshes(false)) {
      if (!this.isDeathMaterialMesh(child) || child.material === null) {
        continue
      }
      bindings.push({
        mesh: child,
        material: child.material,
        renderOverlay: child.renderOverlay,
      })
    }
    return bindings
  }

  private restoreDeathMaterial(inst: MonsterInstance): void {
    if (!inst.deathMaterialApplied) {
      return
    }
    for (const binding of inst.deathMaterialBindings) {
      binding.mesh.material = binding.material
      binding.mesh.renderOverlay = binding.renderOverlay
    }
    inst.deathMaterialApplied = false
  }

  private isDeathMaterialMesh(mesh: AbstractMesh): boolean {
    return !mesh.name.includes("monster_contact_shadow")
      && !mesh.name.includes("monster_mid_boss_hp")
  }

  private shouldUseAuthoredVisual(behavior: MonsterBehavior): boolean {
    return usesAuthoredMonsterVisual(this.assets, behavior)
  }

  private shouldUseContactShadow(behavior: MonsterBehavior): boolean {
    return this.options.hordeContactShadows !== false || behavior === MONSTER_BEHAVIORS.tank
  }

  private resetVisualMotion(inst: MonsterInstance): void {
    if (inst.visual === null) {
      return
    }
    inst.visual.position.set(0, 0, 0)
    inst.visual.rotation.set(0, 0, 0)
    inst.visual.scaling.setAll(1)
    if (inst.contactShadow !== null) {
      inst.contactShadow.position.x = 0
      inst.contactShadow.position.z = -0.06
      inst.contactShadow.scaling.set(1.25, 0.7, 1)
    }
    if (inst.visualMotionRoot === null) {
      return
    }
    inst.visualMotionRoot.position.set(0, 0, 0)
    inst.visualMotionRoot.rotation.set(0, 0, 0)
    inst.visualMotionRoot.scaling.setAll(1)
    if (inst.roleCue !== null) {
      inst.roleCue.scaling.setAll(1)
      inst.roleCue.setEnabled(false)
    }
  }

  private visualIndex(inst: MonsterInstance): number {
    return inst.poolIndex
  }

  private getScaleVariant(config: MonsterConfig, seed: number): number {
    if (config.behavior === MONSTER_BEHAVIORS.tank) {
      return 0.94 + seed * 0.24
    }
    if (config.behavior === MONSTER_BEHAVIORS.fast) {
      return 0.86 + seed * 0.18
    }
    if (config.behavior === MONSTER_BEHAVIORS.shield) {
      return 0.96 + seed * 0.12
    }
    if (config.behavior === MONSTER_BEHAVIORS.charger) {
      return 0.9 + seed * 0.14
    }
    if (config.behavior === MONSTER_BEHAVIORS.splitter) {
      return 0.94 + seed * 0.12
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
    let maxY = Number.NEGATIVE_INFINITY
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
        maxY = Math.max(maxY, point.y)
        minZ = Math.min(minZ, point.z)
        maxZ = Math.max(maxZ, point.z)
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      return fallback
    }

    const isTank = inst.config?.behavior === MONSTER_BEHAVIORS.tank
    const minRadius = isTank ? inst.variantScale * TANK_MIN_HIT_RADIUS_SCALE : MIN_VISUAL_HIT_RADIUS
    const minHalfDepth = isTank ? inst.variantScale * TANK_MIN_HIT_HALF_DEPTH_SCALE : MIN_VISUAL_HIT_HALF_DEPTH
    const maxRadius = isTank ? TANK_MAX_VISUAL_HIT_RADIUS : MAX_VISUAL_HIT_RADIUS
    const maxHalfDepth = isTank ? TANK_MAX_VISUAL_HIT_HALF_DEPTH : MAX_VISUAL_HIT_HALF_DEPTH
    return {
      radius: this.clampHitSize((maxX - minX) * 0.5, minRadius, maxRadius),
      halfDepth: this.clampHitSize((maxZ - minZ) * 0.5, minHalfDepth, maxHalfDepth),
      hpBarY: this.getHpBarY(inst, maxY),
    }
  }

  private getFallbackHitBounds(inst: MonsterInstance): VisualHitBounds {
    const isTank = inst.config?.behavior === MONSTER_BEHAVIORS.tank
    const minRadius = isTank ? inst.variantScale * TANK_MIN_HIT_RADIUS_SCALE : MIN_VISUAL_HIT_RADIUS
    const minHalfDepth = isTank ? inst.variantScale * TANK_MIN_HIT_HALF_DEPTH_SCALE : MIN_VISUAL_HIT_HALF_DEPTH
    const maxRadius = isTank ? TANK_MAX_VISUAL_HIT_RADIUS : MAX_VISUAL_HIT_RADIUS
    const maxHalfDepth = isTank ? TANK_MAX_VISUAL_HIT_HALF_DEPTH : MAX_VISUAL_HIT_HALF_DEPTH
    return {
      radius: this.clampHitSize(inst.variantScale * FALLBACK_HIT_RADIUS_SCALE, minRadius, maxRadius),
      halfDepth: this.clampHitSize(inst.variantScale * FALLBACK_HIT_HALF_DEPTH_SCALE, minHalfDepth, maxHalfDepth),
      hpBarY: MID_BOSS_HP_BAR_Y,
    }
  }

  private getProjectileHitRadius(inst: MonsterInstance, radius: number): number {
    if (inst.config?.behavior !== MONSTER_BEHAVIORS.tank) {
      return radius
    }
    return this.clampHitSize(radius * TANK_PROJECTILE_HIT_RADIUS_PADDING_RATIO, radius, TANK_MAX_VISUAL_HIT_RADIUS * TANK_PROJECTILE_HIT_RADIUS_PADDING_RATIO)
  }

  private getProjectileHitHalfDepth(inst: MonsterInstance, halfDepth: number): number {
    if (inst.config?.behavior !== MONSTER_BEHAVIORS.tank) {
      return halfDepth
    }
    return this.clampHitSize(halfDepth * TANK_PROJECTILE_HIT_HALF_DEPTH_RATIO, halfDepth, TANK_MAX_VISUAL_HIT_HALF_DEPTH * TANK_PROJECTILE_HIT_HALF_DEPTH_RATIO)
  }

  private getHpBarY(inst: MonsterInstance, maxWorldY: number): number {
    if (!Number.isFinite(maxWorldY) || inst.variantScale <= 0) {
      return MID_BOSS_HP_BAR_Y
    }
    const localTopY = (maxWorldY - inst.mesh.position.y) / inst.variantScale
    return Math.max(MID_BOSS_HP_BAR_Y, localTopY + MID_BOSS_HP_BAR_CLEARANCE)
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
