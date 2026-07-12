import {
  MeshBuilder,
  Scene,
} from "@babylonjs/core"
import { cloneGltfVisual, loadGltfAsset } from "../utils/assetLoader"
import type { QualitySettings } from "./QualitySystem"
import {
  DEFENSE_BUILDING_GROUND_Y,
  DEFENSE_BUILDING_SIDE_X,
  DEFENSE_BUILDING_SPACING_Z,
  DEFENSE_BUILDING_START_Z,
  DEFENSE_BUILDING_VARIANTS,
  DEFENSE_PORTAL_Z,
  DEFENSE_ROAD_CENTER_Z,
  DEFENSE_ROAD_LENGTH,
  DEFENSE_ROAD_WIDTH,
  addGatehouse,
  createCastleMaterials,
  freezeStaticTree,
  getCastleBudget,
  hideRunwaySetpieces,
  snapRootToGround,
  type CastleBudget,
  type CastleMaterialSet,
  type DefenseCastleDebugState,
} from "./DefenseCastleEnvironmentKit"

declare global {
  interface Window {
    __squadRushDefenseCastleDebug?: DefenseCastleDebugState
  }
}

export class DefenseCastleEnvironmentSystem {
  private portalLoaded = false
  private buildingVariantCount = 0
  private buildingCount = 0
  private leftBuildingCount = 0
  private rightBuildingCount = 0

  constructor(private readonly scene: Scene, quality: QualitySettings) {
    hideRunwaySetpieces(scene)
    const materials = createCastleMaterials(scene)
    const budget = getCastleBudget(quality.maxMonsters)
    this.addCastleRoad(materials)
    this.addSideWalls(materials, budget)
    this.addBanners(materials, budget)
    this.addPortalFallback(materials)
    addGatehouse(scene, materials)
    void this.loadPortal()
    void this.loadBuildings(budget)
    this.publishDebug()
  }

  private addCastleRoad(materials: CastleMaterialSet): void {
    const road = MeshBuilder.CreateGround(
      "defense_castle_cobblestone_road",
      { width: DEFENSE_ROAD_WIDTH, height: DEFENSE_ROAD_LENGTH, subdivisions: 1 },
      this.scene,
    )
    road.material = materials.stoneRoad
    road.position.set(0, 0.055, DEFENSE_ROAD_CENTER_Z)
    freezeStaticTree(road)

    for (const z of [-30, DEFENSE_PORTAL_Z]) {
      const roundEnd = MeshBuilder.CreateCylinder(
        `defense_castle_round_road_end_${z}`,
        { diameter: DEFENSE_ROAD_WIDTH, height: 0.045, tessellation: 40 },
        this.scene,
      )
      roundEnd.material = materials.stoneRoad
      roundEnd.position.set(0, 0.072, z)
      freezeStaticTree(roundEnd)
    }

    const curbX = DEFENSE_ROAD_WIDTH * 0.5 + 0.5
    for (const x of [-curbX, curbX]) {
      const curb = MeshBuilder.CreateBox(
        `defense_castle_road_curb_${x}`,
        { width: 0.42, height: 0.22, depth: DEFENSE_ROAD_LENGTH + 7 },
        this.scene,
      )
      curb.material = materials.trim
      curb.position.set(x, 0.14, DEFENSE_ROAD_CENTER_Z)
      freezeStaticTree(curb)
    }
  }

  private addSideWalls(materials: CastleMaterialSet, budget: CastleBudget): void {
    for (let index = 0; index < budget.sideWallSegments; index += 1) {
      const z = -20 + index * 10.2
      for (const x of [-10.1, 10.1]) {
        const wall = MeshBuilder.CreateBox(
          `defense_castle_low_wall_${index}_${x}`,
          { width: 0.86, height: 1.05, depth: 8.6 },
          this.scene,
        )
        wall.material = materials.wall
        wall.position.set(x, 0.42, z)
        freezeStaticTree(wall)
      }
    }
  }

  private addBanners(materials: CastleMaterialSet, budget: CastleBudget): void {
    for (let index = 0; index < budget.bannerPairs; index += 1) {
      const z = 8 + index * 15.5
      for (const side of [-1, 1] as const) {
        const pole = MeshBuilder.CreateBox(
          `defense_castle_banner_pole_${index}_${side}`,
          { width: 0.16, height: 2.2, depth: 0.16 },
          this.scene,
        )
        pole.material = materials.wall
        pole.position.set(side * 8.45, 1.1, z)
        freezeStaticTree(pole)

        const cloth = MeshBuilder.CreateBox(
          `defense_castle_banner_cloth_${index}_${side}`,
          { width: 1.0, height: 0.72, depth: 0.05 },
          this.scene,
        )
        cloth.material = materials.banner
        cloth.position.set(side * 8.65, 1.55, z + 0.28)
        cloth.rotation.y = side * 0.18
        freezeStaticTree(cloth)
      }
    }
  }

  private addPortalFallback(materials: CastleMaterialSet): void {
    const glow = MeshBuilder.CreateTorus(
      "defense_castle_portal_glow_fallback",
      { diameter: 5.1, thickness: 0.22, tessellation: 48 },
      this.scene,
    )
    glow.material = materials.portalGlow
    glow.position.set(0, 2.2, DEFENSE_PORTAL_Z)
    glow.rotation.x = Math.PI * 0.5
    freezeStaticTree(glow)
  }

  private async loadPortal(): Promise<void> {
    const asset = await loadGltfAsset({
      scene: this.scene,
      filename: "environment/defense/portal.glb",
      templateName: "template_defense_portal",
    })
    if (!asset.isReal) {
      this.publishDebug()
      return
    }
    const portal = cloneGltfVisual(asset, "defense_castle_portal", this.scene)
    portal.position.set(0, 0, DEFENSE_PORTAL_Z)
    portal.rotation.y = Math.PI
    portal.scaling.set(16, 16, 16)
    snapRootToGround(portal, 0)
    freezeStaticTree(portal)
    this.portalLoaded = true
    this.publishDebug()
  }

  private async loadBuildings(budget: CastleBudget): Promise<void> {
    const assets = await Promise.all(
      DEFENSE_BUILDING_VARIANTS.map((variant) => loadGltfAsset({
        scene: this.scene,
        filename: variant.filename,
        templateName: variant.templateName,
      })),
    )
    const realAssets = assets.filter((asset) => asset.isReal)
    this.buildingVariantCount = realAssets.length
    if (realAssets.length === 0) {
      this.publishDebug()
      return
    }
    for (let index = 0; index < budget.buildingsPerSide; index += 1) {
      const z = DEFENSE_BUILDING_START_Z + index * DEFENSE_BUILDING_SPACING_Z
      for (const side of [-1, 1] as const) {
        const asset = realAssets[(index + (side > 0 ? 2 : 0)) % realAssets.length]
        if (asset === undefined) {
          continue
        }
        const root = cloneGltfVisual(asset, `defense_castle_side_building_${side}_${index}`, this.scene)
        root.position.set(side * DEFENSE_BUILDING_SIDE_X, 0, z + (side > 0 ? 1.3 : -0.4))
        root.rotation.y = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5
        const scale = 7.4 + Math.min(index, 8) * 0.22
        root.scaling.set(scale, scale * 1.12, scale)
        snapRootToGround(root, DEFENSE_BUILDING_GROUND_Y)
        freezeStaticTree(root)
        this.buildingCount += 1
        if (side < 0) {
          this.leftBuildingCount += 1
        } else {
          this.rightBuildingCount += 1
        }
      }
    }
    this.publishDebug()
  }

  private publishDebug(): void {
    window.__squadRushDefenseCastleDebug = {
      enabled: true,
      portalLoaded: this.portalLoaded,
      textureLoaded: true,
      buildingVariantCount: this.buildingVariantCount,
      buildingCount: this.buildingCount,
      leftBuildingCount: this.leftBuildingCount,
      rightBuildingCount: this.rightBuildingCount,
      portalZ: DEFENSE_PORTAL_Z,
      roadLength: DEFENSE_ROAD_LENGTH,
      scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  }
}
