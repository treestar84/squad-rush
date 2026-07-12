import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { GameModeProfile } from "../data/gameModeData"
import { cloneGltfVisual, loadGltfAsset, type GltfAsset } from "../utils/assetLoader"
import { isDesktopAttackBuildingViewport } from "../utils/deviceProfile"

type AttackBuildingDebugState = {
  readonly mode: string
  readonly assetLoaded: boolean
  readonly mobileDisabled: boolean
  readonly variantCount: number
  readonly totalCount: number
  readonly leftCount: number
  readonly rightCount: number
  readonly sampleAverageZ: number
  readonly anchorZ: number
  readonly groundY: number
  readonly maxGroundContactError: number
  readonly scrollOverflow: number
}

type BuildingSlot = {
  readonly root: Mesh
  readonly side: -1 | 1
  readonly baseZ: number
}

type BuildingRootOptions = {
  readonly asset: GltfAsset | null
  readonly fallbackMaterial: StandardMaterial
  readonly index: number
  readonly side: -1 | 1
}

declare global {
  interface Window {
    __squadRushAttackBuildingDebug?: AttackBuildingDebugState
  }
}

const ATTACK_MODE_ID = "run"
const BUILDING_COUNT = 24
const BUILDING_START_Z = 18
const BUILDING_SPACING_Z = 14
const BUILDING_RECYCLE_Z = -20
const BUILDING_SIDE_X = 12.7
const BUILDING_FAR_Z = BUILDING_START_Z + BUILDING_SPACING_Z * BUILDING_COUNT
const BUILDING_GROUND_Y = -0.235
const ATTACK_BUILDING_VARIANTS = [
  { filename: "environment/attack_buildings/nc.glb", templateName: "template_attack_building_nc" },
  { filename: "environment/attack_buildings/new_office.glb", templateName: "template_attack_building_new_office" },
  { filename: "environment/attack_buildings/alparium.glb", templateName: "template_attack_building_alparium" },
  { filename: "environment/attack_buildings/avenue.glb", templateName: "template_attack_building_avenue" },
] as const

export class AttackBuildingSystem {
  private readonly enabled: boolean
  private readonly mobileDisabled: boolean
  private buildings: readonly BuildingSlot[] = []
  private variantCount = 0
  private assetLoaded = false
  private anchorZ = 0

  constructor(
    private readonly scene: Scene,
    private readonly mode: GameModeProfile,
  ) {
    this.mobileDisabled = !isDesktopAttackBuildingViewport()
    this.enabled = mode.id === ATTACK_MODE_ID && !this.mobileDisabled
    if (this.enabled) {
      void this.loadBuildings()
    }
    this.publishDebug()
  }

  update(anchorZ: number): void {
    if (!this.enabled) {
      return
    }
    this.anchorZ = anchorZ
    for (const slot of this.buildings) {
      const z = this.wrapZ(slot.baseZ, anchorZ)
      slot.root.position.z = z
    }
    this.publishDebug()
  }

  private async loadBuildings(): Promise<void> {
    const assets = await Promise.all(
      ATTACK_BUILDING_VARIANTS.map((variant) => loadGltfAsset({
        scene: this.scene,
        filename: variant.filename,
        templateName: variant.templateName,
      })),
    )
    this.assetLoaded = assets.some((asset) => asset.isReal)
    this.variantCount = assets.filter((asset) => asset.isReal).length
    this.buildings = this.createBuildings(assets)
    this.publishDebug()
  }

  private createBuildings(assets: readonly GltfAsset[]): readonly BuildingSlot[] {
    const fallbackMaterial = createFallbackBuildingMaterial(this.scene)
    const slots: BuildingSlot[] = []
    for (let index = 0; index < BUILDING_COUNT; index += 1) {
      const side: -1 | 1 = index % 2 === 0 ? -1 : 1
      const root = this.createBuildingRoot({ asset: selectVariantAsset(assets, index), fallbackMaterial, index, side })
      const baseZ = BUILDING_START_Z + index * BUILDING_SPACING_Z
      root.position.set(side * BUILDING_SIDE_X, 0, baseZ)
      root.rotation.y = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5
      snapRootToGround(root)
      slots.push({ root, side, baseZ })
    }
    return slots
  }

  private createBuildingRoot(options: BuildingRootOptions): Mesh {
    const { asset, fallbackMaterial, index, side } = options
    if (asset?.isReal === true) {
      const root = cloneGltfVisual(asset, `attack_side_building_${index}`, this.scene)
      root.scaling.set(8.6, 9.8, 8.6)
      prepareStaticTree(root)
      return root
    }

    const root = new Mesh(`attack_side_building_fallback_${index}`, this.scene)
    const tower = MeshBuilder.CreateBox(`attack_side_building_tower_${index}`, { width: 2.2, height: 5.4, depth: 2.6 }, this.scene)
    tower.parent = root
    tower.material = fallbackMaterial
    tower.position.set(side * 0.2, 2.7, 0)
    const cap = MeshBuilder.CreateBox(`attack_side_building_cap_${index}`, { width: 2.8, height: 0.42, depth: 3.2 }, this.scene)
    cap.parent = root
    cap.material = fallbackMaterial
    cap.position.set(side * 0.2, 5.62, 0)
    prepareStaticTree(root)
    return root
  }

  private wrapZ(baseZ: number, anchorZ: number): number {
    const relativeZ = baseZ - anchorZ
    if (relativeZ >= BUILDING_RECYCLE_Z) {
      return baseZ
    }
    const cycleDepth = BUILDING_FAR_Z - BUILDING_RECYCLE_Z
    return baseZ + Math.ceil((BUILDING_RECYCLE_Z - relativeZ) / cycleDepth) * cycleDepth
  }

  private publishDebug(): void {
    if (!window.location.search.includes("qa=attack-buildings")) {
      return
    }
    const totalZ = this.buildings.reduce((sum, slot) => sum + slot.root.position.z - this.anchorZ, 0)
    const maxGroundContactError = this.getMaxGroundContactError()
    window.__squadRushAttackBuildingDebug = {
      mode: this.mode.id,
      assetLoaded: this.assetLoaded,
      mobileDisabled: this.mobileDisabled,
      variantCount: this.variantCount,
      totalCount: this.buildings.length,
      leftCount: this.buildings.filter((slot) => slot.side < 0).length,
      rightCount: this.buildings.filter((slot) => slot.side > 0).length,
      sampleAverageZ: this.buildings.length === 0 ? 0 : totalZ / this.buildings.length,
      anchorZ: this.anchorZ,
      groundY: BUILDING_GROUND_Y,
      maxGroundContactError,
      scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  }

  private getMaxGroundContactError(): number {
    let maxError = 0
    for (const slot of this.buildings) {
      slot.root.computeWorldMatrix(true)
      for (const child of slot.root.getChildMeshes(false)) {
        child.computeWorldMatrix(true)
      }
      const bounds = slot.root.getHierarchyBoundingVectors(true)
      maxError = Math.max(maxError, Math.abs(bounds.min.y - BUILDING_GROUND_Y))
    }
    return maxError
  }
}

function snapRootToGround(root: Mesh): void {
  root.computeWorldMatrix(true)
  for (const child of root.getChildMeshes(false)) {
    child.computeWorldMatrix(true)
  }
  const bounds = root.getHierarchyBoundingVectors(true)
  root.position.y += BUILDING_GROUND_Y - bounds.min.y
}

function selectVariantAsset(assets: readonly GltfAsset[], index: number): GltfAsset | null {
  if (assets.length === 0) {
    return null
  }
  return assets[index % assets.length] ?? null
}

function createFallbackBuildingMaterial(scene: Scene): StandardMaterial {
  const material = new StandardMaterial("attackFallbackBuildingMat", scene)
  material.diffuseColor = new Color3(0.24, 0.29, 0.34)
  material.emissiveColor = new Color3(0.025, 0.035, 0.045)
  material.specularColor = new Color3(0.08, 0.1, 0.12)
  return material
}

function prepareStaticTree(root: Mesh): void {
  root.isPickable = false
  for (const child of root.getChildMeshes(false)) {
    child.isPickable = false
  }
}
