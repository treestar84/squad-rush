import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
} from "@babylonjs/core"

export type DefenseCastleDebugState = {
  readonly enabled: boolean
  readonly portalLoaded: boolean
  readonly textureLoaded: boolean
  readonly buildingVariantCount: number
  readonly buildingCount: number
  readonly leftBuildingCount: number
  readonly rightBuildingCount: number
  readonly portalZ: number
  readonly roadLength: number
  readonly scrollOverflow: number
}

export type CastleMaterialSet = {
  readonly stoneRoad: StandardMaterial
  readonly trim: StandardMaterial
  readonly wall: StandardMaterial
  readonly banner: StandardMaterial
  readonly portalGlow: StandardMaterial
}

export type CastleBudget = {
  readonly buildingsPerSide: number
  readonly bannerPairs: number
  readonly sideWallSegments: number
}

export const DEFENSE_PORTAL_Z = 58
export const DEFENSE_ROAD_LENGTH = 158
export const DEFENSE_ROAD_WIDTH = 15.6
export const DEFENSE_ROAD_CENTER_Z = 48
export const DEFENSE_BUILDING_SIDE_X = 13.8
export const DEFENSE_BUILDING_START_Z = 18
export const DEFENSE_BUILDING_SPACING_Z = 8.6
export const DEFENSE_BUILDING_GROUND_Y = -0.235
export const DEFENSE_BUILDING_VARIANTS = [
  { filename: "environment/attack_buildings/nc.glb", templateName: "template_defense_building_nc" },
  { filename: "environment/attack_buildings/new_office.glb", templateName: "template_defense_building_new_office" },
  { filename: "environment/attack_buildings/alparium.glb", templateName: "template_defense_building_alparium" },
  { filename: "environment/attack_buildings/avenue.glb", templateName: "template_defense_building_avenue" },
] as const

export function getCastleBudget(maxMonsters: number): CastleBudget {
  if (maxMonsters < 160) {
    return { buildingsPerSide: 7, bannerPairs: 4, sideWallSegments: 8 }
  }
  if (maxMonsters < 300) {
    return { buildingsPerSide: 10, bannerPairs: 6, sideWallSegments: 12 }
  }
  return { buildingsPerSide: 15, bannerPairs: 8, sideWallSegments: 16 }
}

export function createCastleMaterials(scene: Scene): CastleMaterialSet {
  const stoneRoad = new StandardMaterial("defenseCastleStoneRoadMat", scene)
  const texture = new Texture("/assets/textures/defense_cobblestone.webp", scene)
  texture.uScale = 3.3
  texture.vScale = 18
  stoneRoad.diffuseTexture = texture
  stoneRoad.diffuseColor = new Color3(0.72, 0.72, 0.68)
  stoneRoad.specularColor = new Color3(0.05, 0.052, 0.05)

  const trim = new StandardMaterial("defenseCastleTrimMat", scene)
  trim.diffuseColor = new Color3(0.48, 0.43, 0.36)
  trim.specularColor = new Color3(0.08, 0.07, 0.06)

  const wall = new StandardMaterial("defenseCastleWallMat", scene)
  wall.diffuseColor = new Color3(0.38, 0.35, 0.31)
  wall.emissiveColor = new Color3(0.025, 0.022, 0.018)
  wall.specularColor = new Color3(0.07, 0.065, 0.06)

  const banner = new StandardMaterial("defenseCastleBannerMat", scene)
  banner.diffuseColor = new Color3(0.24, 0.36, 0.58)
  banner.emissiveColor = new Color3(0.025, 0.04, 0.08)

  const portalGlow = new StandardMaterial("defenseCastlePortalGlowMat", scene)
  portalGlow.diffuseColor = new Color3(0.34, 0.68, 1)
  portalGlow.emissiveColor = new Color3(0.1, 0.32, 0.74)
  portalGlow.alpha = 0.62
  return { stoneRoad, trim, wall, banner, portalGlow }
}

export function addGatehouse(scene: Scene, materials: CastleMaterialSet): void {
  const gateZ = DEFENSE_PORTAL_Z + 2.2
  const wall = MeshBuilder.CreateBox("defense_castle_gatehouse_wall", { width: 15.8, height: 5.6, depth: 1.4 }, scene)
  wall.material = materials.wall
  wall.position.set(0, 2.8, gateZ + 0.9)
  freezeStaticTree(wall)

  const archTop = MeshBuilder.CreateBox("defense_castle_gatehouse_arch_top", { width: 7.2, height: 1.0, depth: 1.75 }, scene)
  archTop.material = materials.trim
  archTop.position.set(0, 5.25, gateZ - 0.05)
  freezeStaticTree(archTop)

  const portalTop = MeshBuilder.CreateBox("defense_castle_portal_light_top", { width: 5.9, height: 0.22, depth: 0.32 }, scene)
  portalTop.material = materials.portalGlow
  portalTop.position.set(0, 5.15, gateZ - 1.05)
  freezeStaticTree(portalTop)

  for (const side of [-1, 1] as const) {
    const tower = MeshBuilder.CreateCylinder(`defense_castle_gatehouse_tower_${side}`, { diameter: 3.2, height: 8.2, tessellation: 18 }, scene)
    tower.material = materials.wall
    tower.position.set(side * 6.15, 4.1, gateZ)
    freezeStaticTree(tower)

    const spire = MeshBuilder.CreateCylinder(
      `defense_castle_gatehouse_spire_${side}`,
      { diameterTop: 0.25, diameterBottom: 2.9, height: 2.8, tessellation: 18 },
      scene,
    )
    spire.material = materials.trim
    spire.position.set(side * 6.15, 9.55, gateZ)
    freezeStaticTree(spire)

    const archSide = MeshBuilder.CreateBox(`defense_castle_gatehouse_arch_side_${side}`, { width: 0.8, height: 4.1, depth: 1.85 }, scene)
    archSide.material = materials.trim
    archSide.position.set(side * 3.95, 2.75, gateZ - 0.05)
    freezeStaticTree(archSide)

    const portalSide = MeshBuilder.CreateBox(`defense_castle_portal_light_side_${side}`, { width: 0.22, height: 4.2, depth: 0.32 }, scene)
    portalSide.material = materials.portalGlow
    portalSide.position.set(side * 2.95, 3.05, gateZ - 1.05)
    freezeStaticTree(portalSide)
  }
}

export function hideRunwaySetpieces(scene: Scene): void {
  const hiddenPrefixes = [
    "rail_",
    "lane_line_",
    "lane_reflector_",
    "beacon_",
    "container_",
    "side_wall_",
    "barrier_cap_",
    "warning_strip_",
    "water_plane_",
    "road_panel_seam_",
  ] as const
  for (const mesh of scene.meshes) {
    if (hiddenPrefixes.some((prefix) => mesh.name.startsWith(prefix))) {
      mesh.setEnabled(false)
    }
  }
}

export function snapRootToGround(root: Mesh, groundY: number): void {
  root.computeWorldMatrix(true)
  for (const child of root.getChildMeshes(false)) {
    child.computeWorldMatrix(true)
  }
  const bounds = root.getHierarchyBoundingVectors(true)
  root.position.y += groundY - bounds.min.y
}

export function freezeStaticTree(root: Mesh): void {
  root.isPickable = false
  root.freezeWorldMatrix()
  for (const child of root.getChildMeshes(false)) {
    child.isPickable = false
    child.freezeWorldMatrix()
  }
}
