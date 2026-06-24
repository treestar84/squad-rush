import {
  AnimationGroup,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { GltfAsset } from "../utils/assetLoader"
import { cloneGltfInstance } from "../utils/assetLoader"
import { attachSoldierRoleKit } from "./SoldierVisualKit"

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
const PICKUP_FALLBACK_SOLDIER_Y = -0.38

export function createPickupSoldierVisual(scene: Scene, asset: GltfAsset | null, name: string): Mesh {
  if (asset?.isReal === true) {
    const instance = cloneGltfInstance(asset, name, scene)
    const mesh = instance.root
    mesh.scaling.setAll(PICKUP_SOLDIER_MODEL_SCALE)
    mesh.position.y = PICKUP_SOLDIER_MODEL_Y
    hideUnusedSoldierParts(mesh)
    attachSoldierRoleKit(mesh, PICKUP_SOLDIER_ROLE_INDEX, scene)
    getIdleAnimation(instance.animationGroups)?.start(true, 1)
    return mesh
  }

  const fallback = MeshBuilder.CreateCylinder(name, { height: 1.8, diameter: 0.65, tessellation: 8 }, scene)
  const mat = new StandardMaterial(`${name}_mat`, scene)
  mat.diffuseColor = new Color3(0.08, 0.47, 0.92)
  mat.emissiveColor = new Color3(0.01, 0.05, 0.1)
  fallback.material = mat
  fallback.position.y = PICKUP_FALLBACK_SOLDIER_Y
  attachSoldierRoleKit(fallback, PICKUP_SOLDIER_ROLE_INDEX, scene)
  return fallback
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
