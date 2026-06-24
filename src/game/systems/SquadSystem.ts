import {
  AnimationGroup,
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
import type { GltfAsset } from "../utils/assetLoader"
import { cloneGltfInstance } from "../utils/assetLoader"
import { clamp } from "../utils/math"
import { ACTOR_GROUND_Y, FALLBACK_SOLDIER_ROOT_Y } from "../WorldGeometry"
import { readSquadQaOptions } from "./SquadQaOptions"
import { attachSoldierRoleKit } from "./SoldierVisualKit"
import { applySoldierUpgradeVisual } from "./SoldierUpgradeVisual"

type Soldier = {
  readonly mesh: Mesh
  readonly runAnimation: AnimationGroup | null
  offsetX: number
  offsetZ: number
  hp: number
  alive: boolean
  runPhase: number
}

const SOLDIER_HIDDEN_PART_NAMES = [
  "GrenadeLauncher",
  "Knife_1",
  "Knife_2",
  "Pistol",
  "Revolver",
  "Revolver_Small",
  "RocketLauncher",
  "ShortCannon",
  "Shotgun",
  "Shovel",
  "SMG",
  "Sniper",
  "Sniper_2",
] as const
const SOLDIER_MUZZLE_OFFSET = new Vector3(0.34, 0.58, 0.78)
const SOLDIER_VISUAL_SCALE = 0.468
const SOLDIER_FORMATION_SPACING = 0.78
const SOLDIER_FORMATION_ROW_DEPTH_RATIO = 0.62
export const MAX_SQUAD_SOLDIERS = 30

export class SquadSystem {
  squadX = 0
  squadZ = 10
  private readonly soldiers: Soldier[] = []
  private readonly pool: ObjectPool<Soldier>
  private readonly alivePositions: Vector3[] = []
  private readonly muzzlePositions: Vector3[] = []
  private readonly trackHalf = LEVEL_1.trackWidth / 2
  private readonly helmetMat: StandardMaterial
  private readonly visorMat: StandardMaterial
  private readonly rifleMat: StandardMaterial
  private readonly muzzleMat: StandardMaterial
  private readonly speedMultiplier: number
  private readonly rootY = this.asset?.isReal === true ? ACTOR_GROUND_Y : FALLBACK_SOLDIER_ROOT_Y
  private readonly maxSoldiers: number
  private upgradeTier = 0

  constructor(
    private readonly scene: Scene,
    private readonly asset: GltfAsset | null,
    maxCount: number,
  ) {
    this.maxSoldiers = Math.min(maxCount, MAX_SQUAD_SOLDIERS)
    const qaOptions = readSquadQaOptions(this.maxSoldiers, this.squadZ)
    this.squadZ = qaOptions.startZ
    this.speedMultiplier = qaOptions.speedMultiplier
    this.helmetMat = new StandardMaterial("squadHelmetMat", scene)
    this.helmetMat.diffuseColor = new Color3(0.05, 0.09, 0.12)
    this.helmetMat.specularColor = new Color3(0.55, 0.62, 0.68)
    this.visorMat = new StandardMaterial("squadVisorMat", scene)
    this.visorMat.diffuseColor = new Color3(0.12, 0.7, 1)
    this.visorMat.emissiveColor = new Color3(0.02, 0.18, 0.35)
    this.rifleMat = new StandardMaterial("squadRifleMat", scene)
    this.rifleMat.diffuseColor = new Color3(0.08, 0.08, 0.07)
    this.muzzleMat = new StandardMaterial("squadMuzzleMat", scene)
    this.muzzleMat.diffuseColor = new Color3(1, 0.72, 0.16)
    this.muzzleMat.emissiveColor = new Color3(0.8, 0.32, 0.02)
    this.pool = new ObjectPool<Soldier>(
      (index) => this.createSoldier(index),
      (soldier) => {
        soldier.mesh.setEnabled(false)
        soldier.runAnimation?.pause()
        soldier.alive = false
      },
      this.maxSoldiers,
    )
    for (let index = 0; index < this.maxSoldiers; index += 1) {
      this.alivePositions.push(new Vector3(0, 0, 0))
      this.muzzlePositions.push(new Vector3(0, 0, 0))
    }
    this.addSoldiers(qaOptions.startSoldiers)
  }

  private createSoldier(index: number): Soldier {
    const visual = this.createSoldierVisual(index)
    visual.mesh.setEnabled(false)
    return {
      mesh: visual.mesh,
      runAnimation: visual.runAnimation,
      offsetX: 0,
      offsetZ: 0,
      hp: SOLDIER_BASE.hp,
      alive: false,
      runPhase: index * 0.73,
    }
  }

  private createSoldierVisual(index: number): { readonly mesh: Mesh; readonly runAnimation: AnimationGroup | null } {
    if (this.asset?.isReal === true) {
      const instance = cloneGltfInstance(this.asset, `soldier_${index}`, this.scene)
      const mesh = instance.root
      mesh.scaling.setAll(SOLDIER_VISUAL_SCALE)
      this.hideUnusedSoldierParts(mesh)
      attachSoldierRoleKit(mesh, index, this.scene)
      const runAnimation = this.getRunAnimation(instance.animationGroups)
      runAnimation?.start(true, 1.18)
      return { mesh, runAnimation }
    }

    const mesh = this.createFallbackSoldier(index)
    this.decorateSoldier(mesh, index)
    attachSoldierRoleKit(mesh, index, this.scene)
    return { mesh, runAnimation: null }
  }

  private decorateSoldier(mesh: Mesh, index: number): void {
    const helmet = MeshBuilder.CreateSphere(`soldier_helmet_${index}`, { diameter: 0.48, segments: 12 }, this.scene)
    helmet.material = this.helmetMat
    helmet.parent = mesh
    helmet.position.set(0, 1.04, 0.02)

    const visor = MeshBuilder.CreateBox(`soldier_visor_${index}`, { width: 0.34, height: 0.1, depth: 0.05 }, this.scene)
    visor.material = this.visorMat
    visor.parent = mesh
    visor.position.set(0, 1.06, 0.25)

    const rifle = MeshBuilder.CreateBox(`soldier_rifle_${index}`, { width: 0.1, height: 0.12, depth: 0.78 }, this.scene)
    rifle.material = this.rifleMat
    rifle.parent = mesh
    rifle.position.set(0.34, 0.58, 0.34)

    const muzzle = MeshBuilder.CreateSphere(`soldier_muzzle_${index}`, { diameter: 0.12, segments: 8 }, this.scene)
    muzzle.material = this.muzzleMat
    muzzle.parent = mesh
    muzzle.position.set(0.34, 0.58, 0.78)
  }

  private createFallbackSoldier(index: number): Mesh {
    const mesh = MeshBuilder.CreateCylinder(`soldier_${index}`, { height: 1.8, diameter: 0.65, tessellation: 8 }, this.scene)
    const mat = new StandardMaterial(`soldierMat_${index}`, this.scene)
    mat.diffuseColor = new Color3(0.08, 0.47, 0.92)
    mat.emissiveColor = new Color3(0.01, 0.05, 0.1)
    mesh.material = mat
    return mesh
  }

  private hideUnusedSoldierParts(mesh: Mesh): void {
    for (const child of mesh.getChildMeshes(false)) {
      if (SOLDIER_HIDDEN_PART_NAMES.some((partName) => child.name.includes(partName))) {
        child.setEnabled(false)
      }
    }
  }

  addSoldiers(count: number): void {
    const firstAddedIndex = this.soldiers.length
    const addableCount = Math.min(Math.max(0, count), this.maxSoldiers - this.soldiers.length)
    for (let index = 0; index < addableCount; index += 1) {
      const soldier = this.pool.get()
      if (soldier === null) {
        break
      }
      soldier.alive = true
      soldier.hp = SOLDIER_BASE.hp
      soldier.runAnimation?.play(true)
      soldier.mesh.setEnabled(true)
      applySoldierUpgradeVisual(soldier.mesh, this.upgradeTier)
      this.soldiers.push(soldier)
    }
    this.recalcFormation()
    for (let index = firstAddedIndex; index < this.soldiers.length; index += 1) {
      const soldier = this.soldiers[index]
      if (soldier !== undefined) {
        soldier.mesh.position.set(this.squadX + soldier.offsetX, this.rootY, this.squadZ + soldier.offsetZ)
      }
    }
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

  get soldierCapacity(): number {
    return this.maxSoldiers
  }

  get isAtMaxSoldiers(): boolean {
    return this.soldiers.length >= this.maxSoldiers
  }

  setUpgradeTier(tier: number): void {
    this.upgradeTier = tier
    for (const soldier of this.soldiers) {
      applySoldierUpgradeVisual(soldier.mesh, tier)
    }
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

  getMuzzlePositions(): readonly Vector3[] {
    for (let index = 0; index < this.soldiers.length; index += 1) {
      const soldier = this.soldiers[index]
      const position = this.muzzlePositions[index]
      if (soldier !== undefined && position !== undefined) {
        Vector3.TransformCoordinatesToRef(SOLDIER_MUZZLE_OFFSET, soldier.mesh.getWorldMatrix(), position)
      }
    }
    return this.muzzlePositions.slice(0, this.soldiers.length)
  }

  update(deltaX: number, dt: number): void {
    this.squadX = clamp(this.squadX + deltaX, -this.trackHalf, this.trackHalf)
    this.squadZ += LEVEL_1.forwardSpeed * this.speedMultiplier * dt

    for (const soldier of this.soldiers) {
      const targetX = this.squadX + soldier.offsetX
      const targetZ = this.squadZ + soldier.offsetZ
      const follow = Math.min(dt * 12, 1)
      soldier.runPhase += dt * 11.5
      soldier.mesh.position.x += (targetX - soldier.mesh.position.x) * follow
      soldier.mesh.position.z += (targetZ - soldier.mesh.position.z) * follow
      soldier.mesh.position.y = this.rootY + Math.abs(Math.sin(soldier.runPhase)) * 0.035
      soldier.mesh.rotation.x = Math.sin(soldier.runPhase) * 0.035
      soldier.mesh.rotation.z = Math.cos(soldier.runPhase * 0.5) * 0.025
      soldier.mesh.rotation.y = Math.sin(this.squadZ * 0.8 + soldier.offsetX) * 0.08
    }
  }

  private getRunAnimation(groups: readonly AnimationGroup[]): AnimationGroup | null {
    return groups.find((group) => group.name.includes("Run_Gun"))
      ?? groups.find((group) => group.name.includes("Run"))
      ?? null
  }

  private recalcFormation(): void {
    const count = this.soldiers.length
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.45)))
    for (let index = 0; index < count; index += 1) {
      const soldier = this.soldiers[index]
      if (soldier === undefined) {
        continue
      }
      const col = index % cols
      const row = Math.floor(index / cols)
      const rowShift = row % 2 === 0 ? -SOLDIER_FORMATION_SPACING * 0.18 : SOLDIER_FORMATION_SPACING * 0.18
      soldier.offsetX = (col - (cols - 1) / 2) * SOLDIER_FORMATION_SPACING + rowShift
      soldier.offsetZ = -row * SOLDIER_FORMATION_SPACING * SOLDIER_FORMATION_ROW_DEPTH_RATIO
    }
  }
}
