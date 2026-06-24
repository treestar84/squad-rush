import {
  AnimationGroup,
  Mesh,
  Scene,
  Vector3,
} from "@babylonjs/core"
import { attachSoldierRoleKit, getSoldierRoleName, type SoldierRoleName } from "./systems/SoldierVisualKit"
import type { GltfAsset } from "./utils/assetLoader"
import { cloneGltfInstance } from "./utils/assetLoader"

type StartHeroDebugState = {
  readonly visible: boolean
  readonly role: SoldierRoleName
  readonly runAnimation: boolean
  readonly kitMeshes: number
  readonly screenZone: "hero-lane" | "offscreen"
}

const START_HERO_HIDDEN_PART_NAMES = [
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

const HERO_POSITION = new Vector3(0, 0.78, 1.6)
const HERO_ROLE_INDEX = 1

declare global {
  interface Window {
    __squadRushStartHeroDebug?: StartHeroDebugState
  }
}

export class StartHeroPreview {
  private readonly mesh: Mesh
  private readonly runAnimation: AnimationGroup | null
  private readonly role = getSoldierRoleName(HERO_ROLE_INDEX)

  constructor(scene: Scene, asset: GltfAsset) {
    const instance = cloneGltfInstance(asset, "start_hero_soldier", scene)
    this.mesh = instance.root
    this.mesh.position.copyFrom(HERO_POSITION)
    this.mesh.scaling.setAll(1.08)
    this.mesh.rotation.y = 0
    this.hideUnusedParts()
    attachSoldierRoleKit(this.mesh, HERO_ROLE_INDEX, scene)
    this.runAnimation = this.getRunAnimation(instance.animationGroups)
    this.runAnimation?.start(true, 1.12)
    this.mesh.setEnabled(false)
    this.publishDebug(false)
  }

  show(): void {
    this.mesh.setEnabled(true)
    this.runAnimation?.play(true)
    this.publishDebug(true)
  }

  hide(): void {
    this.mesh.setEnabled(false)
    this.runAnimation?.pause()
    this.publishDebug(false)
  }

  private hideUnusedParts(): void {
    for (const child of this.mesh.getChildMeshes(false)) {
      if (START_HERO_HIDDEN_PART_NAMES.some((partName) => child.name.includes(partName))) {
        child.setEnabled(false)
      }
    }
  }

  private getRunAnimation(groups: readonly AnimationGroup[]): AnimationGroup | null {
    return groups.find((group) => group.name.includes("Run_Gun"))
      ?? groups.find((group) => group.name.includes("Run"))
      ?? null
  }

  private publishDebug(visible: boolean): void {
    const kitMeshes = this.mesh.getChildMeshes(false).filter((child) => child.name.includes("soldier_role_")).length
    window.__squadRushStartHeroDebug = {
      visible,
      role: this.role,
      runAnimation: this.runAnimation !== null,
      kitMeshes,
      screenZone: visible ? "hero-lane" : "offscreen",
    }
  }
}
