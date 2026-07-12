import {
  AnimationGroup,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import { UNIT_TYPES, type UnitType } from "../data/squadRosterData"
import type { GltfAsset } from "../utils/assetLoader"
import { cloneGltfInstance } from "../utils/assetLoader"
import { attachSoldierHeadMarkers, attachSoldierRoleKit } from "./SoldierVisualKit"
import { applySoldierUnitVisual } from "./SoldierUpgradeVisual"

const PICKUP_SOLDIER_HIDDEN_PART_NAMES = [
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
const PICKUP_SOLDIER_ROLE_INDEX = 0
const PICKUP_SOLDIER_MODEL_SCALE = 0.62
const PICKUP_SOLDIER_MODEL_Y = -1.18
const PANGYO_PICKUP_MODEL_SCALE = 2.08
const PANGYO_PICKUP_MODEL_Y = -1.36
const PANGYO_PICKUP_MODEL_ROTATION_Y = Math.PI
const PICKUP_FALLBACK_SOLDIER_Y = -0.38

export type PickupUnitVisualOptions = {
  readonly scene: Scene
  readonly asset: GltfAsset | null
  readonly pangyoAsset: GltfAsset | null
  readonly name: string
  readonly unit: UnitType
  readonly cssColor: string
}

export function createPickupUnitVisual(options: PickupUnitVisualOptions): Mesh {
  if (isAuthoredPangyoPickupUnit(options.unit) && options.pangyoAsset?.isReal === true) {
    const instance = cloneGltfInstance(options.pangyoAsset, options.name, options.scene)
    const mesh = instance.root
    mesh.scaling.setAll(PANGYO_PICKUP_MODEL_SCALE)
    mesh.position.y = PANGYO_PICKUP_MODEL_Y
    mesh.rotation.y = PANGYO_PICKUP_MODEL_ROTATION_Y
    attachSoldierHeadMarkers(mesh, 0, options.scene)
    attachPangyoBadge(mesh, options.scene, options.cssColor)
    applySoldierUnitVisual(mesh, options.unit, options.cssColor)
    const authoredMarker = new Mesh(`pickup_authored_pangyo_marker_${options.name}`, options.scene)
    authoredMarker.parent = mesh
    authoredMarker.isVisible = false
    authoredMarker.isPickable = false
    return mesh
  }

  if (options.asset?.isReal === true) {
    const instance = cloneGltfInstance(options.asset, options.name, options.scene)
    const mesh = instance.root
    mesh.scaling.setAll(PICKUP_SOLDIER_MODEL_SCALE)
    mesh.position.y = PICKUP_SOLDIER_MODEL_Y
    hideUnusedSoldierParts(mesh)
    attachSoldierHeadMarkers(mesh, PICKUP_SOLDIER_ROLE_INDEX, options.scene)
    if (isMilitaryUnit(options.unit)) {
      attachSoldierRoleKit(mesh, PICKUP_SOLDIER_ROLE_INDEX, options.scene)
    } else {
      attachPangyoBadge(mesh, options.scene, options.cssColor)
    }
    applySoldierUnitVisual(mesh, options.unit, options.cssColor)
    getIdleAnimation(instance.animationGroups)?.start(true, 1)
    return mesh
  }

  const fallback = MeshBuilder.CreateCylinder(options.name, { height: 1.8, diameter: 0.65, tessellation: 8 }, options.scene)
  const mat = new StandardMaterial(`${options.name}_mat`, options.scene)
  const color = Color3.FromHexString(options.cssColor)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(0.28)
  fallback.material = mat
  fallback.position.y = PICKUP_FALLBACK_SOLDIER_Y
  attachSoldierHeadMarkers(fallback, PICKUP_SOLDIER_ROLE_INDEX, options.scene)
  if (isMilitaryUnit(options.unit)) {
    attachSoldierRoleKit(fallback, PICKUP_SOLDIER_ROLE_INDEX, options.scene)
  } else {
    attachPangyoBadge(fallback, options.scene, options.cssColor)
  }
  applySoldierUnitVisual(fallback, options.unit, options.cssColor)
  return fallback
}

function isAuthoredPangyoPickupUnit(unit: UnitType): boolean {
  switch (unit) {
    case UNIT_TYPES.developer:
    case UNIT_TYPES.seniorDeveloper:
    case UNIT_TYPES.unemployed:
    case UNIT_TYPES.ceo:
    case UNIT_TYPES.gamer:
      return true
    case UNIT_TYPES.pangyo:
    case UNIT_TYPES.soldier:
    case UNIT_TYPES.officer:
    case UNIT_TYPES.general:
    case UNIT_TYPES.qa:
    case UNIT_TYPES.entrepreneur:
    case UNIT_TYPES.ai:
      return false
  }
}

function isMilitaryUnit(unit: UnitType): boolean {
  switch (unit) {
    case UNIT_TYPES.soldier:
    case UNIT_TYPES.officer:
    case UNIT_TYPES.general:
      return true
    case UNIT_TYPES.pangyo:
    case UNIT_TYPES.developer:
    case UNIT_TYPES.seniorDeveloper:
    case UNIT_TYPES.unemployed:
    case UNIT_TYPES.ceo:
    case UNIT_TYPES.gamer:
    case UNIT_TYPES.qa:
    case UNIT_TYPES.entrepreneur:
    case UNIT_TYPES.ai:
      return false
  }
}

function hideUnusedSoldierParts(mesh: Mesh): void {
  for (const child of mesh.getChildMeshes(false)) {
    if (PICKUP_SOLDIER_HIDDEN_PART_NAMES.some((partName) => child.name.includes(partName))) {
      child.setEnabled(false)
    }
  }
}

function getIdleAnimation(groups: readonly AnimationGroup[]): AnimationGroup | undefined {
  return groups.find((group) => group.name === "Idle")
    ?? groups.find((group) => group.name.includes("Idle"))
}

function attachPangyoBadge(mesh: Mesh, scene: Scene, cssColor: string): void {
  const color = Color3.FromHexString(cssColor)
  const mat = new StandardMaterial(`${mesh.name}_pangyo_badge_mat`, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(0.52)
  const badge = MeshBuilder.CreateBox(`pickup_pangyo_badge_${mesh.name}`, { width: 0.42, height: 0.26, depth: 0.08 }, scene)
  badge.material = mat
  badge.parent = mesh
  badge.position.set(0, 0.42, 0.3)
}
