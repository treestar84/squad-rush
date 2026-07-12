import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"

const PROJECTILE_STREAK_WIDTH = 0.032
const PROJECTILE_WAKE_NEAR_DIAMETER = 0.13
const PROJECTILE_WAKE_FAR_DIAMETER = 0.1
const PROJECTILE_SLUG_DIAMETER = 0.093
const PROJECTILE_SLUG_LENGTH = 0.45
export const PROJECTILE_CORE_DIAMETER = 0.13
const PROJECTILE_TIP_DIAMETER = 0.093
const PROJECTILE_FLASH_DIAMETER = 0.24

export type Trail = {
  readonly root: Mesh
  readonly streak: Mesh
  readonly wakeNear: Mesh
  readonly wakeFar: Mesh
  readonly slug: Mesh
  readonly core: Mesh
  readonly tip: Mesh
  readonly flash: Mesh
  life: number
  travelDistance: number
  impactDistance: number
  tailClearDistance: number
  traveled: number
  originZ: number
  velocityX: number
  velocityY: number
  velocityZ: number
  impactX: number
  impactY: number
  impactZ: number
  impactTriggered: boolean
  stopAtImpact: boolean
  onImpact: (() => void) | null
}

export type MuzzleFlash = {
  readonly mesh: Mesh
  baseScale: number
  life: number
  duration: number
}

export type ImpactFlash = {
  readonly core: Mesh
  readonly ring: Mesh
  life: number
  duration: number
  baseScale: number
}

export function createTrail(scene: Scene, index: number): Trail {
  const root = new Mesh(`bullet_fx_${index}`, scene)
  const streak = MeshBuilder.CreateBox(
    `bullet_streak_${index}`,
    { width: PROJECTILE_STREAK_WIDTH, height: PROJECTILE_STREAK_WIDTH, depth: 1 },
    scene,
  )
  const wakeNear = MeshBuilder.CreateSphere(
    `bullet_wake_near_${index}`,
    { diameter: PROJECTILE_WAKE_NEAR_DIAMETER, segments: 8 },
    scene,
  )
  const wakeFar = MeshBuilder.CreateSphere(
    `bullet_wake_far_${index}`,
    { diameter: PROJECTILE_WAKE_FAR_DIAMETER, segments: 8 },
    scene,
  )
  const slug = MeshBuilder.CreateBox(
    `bullet_slug_${index}`,
    { width: PROJECTILE_SLUG_DIAMETER, height: PROJECTILE_SLUG_DIAMETER * 0.72, depth: PROJECTILE_SLUG_LENGTH },
    scene,
  )
  const core = slug
  const tip = MeshBuilder.CreateSphere(`bullet_tip_${index}`, { diameter: PROJECTILE_TIP_DIAMETER, segments: 10 }, scene)
  const flash = MeshBuilder.CreateSphere(`bullet_flash_${index}`, { diameter: PROJECTILE_FLASH_DIAMETER, segments: 10 }, scene)

  streak.parent = root
  wakeNear.parent = root
  wakeFar.parent = root
  slug.parent = root
  core.parent = root
  tip.parent = root
  flash.parent = root
  streak.isPickable = false
  wakeNear.isPickable = false
  wakeFar.isPickable = false
  slug.isPickable = false
  core.isPickable = false
  tip.isPickable = false
  flash.isPickable = false

  const streakMat = new StandardMaterial(`bulletStreakMat_${index}`, scene)
  streakMat.emissiveColor = new Color3(1, 0.64, 0.12)
  streakMat.diffuseColor = new Color3(1, 0.74, 0.24)
  streakMat.alpha = 0.16
  streak.material = streakMat

  const wakeMat = new StandardMaterial(`bulletWakeMat_${index}`, scene)
  wakeMat.emissiveColor = new Color3(1, 0.58, 0.08)
  wakeMat.diffuseColor = new Color3(1, 0.7, 0.18)
  wakeMat.alpha = 0.08
  wakeNear.material = wakeMat
  wakeFar.material = wakeMat

  const slugMat = new StandardMaterial(`bulletSlugMat_${index}`, scene)
  slugMat.emissiveColor = new Color3(1, 0.9, 0.24)
  slugMat.diffuseColor = new Color3(1, 0.82, 0.18)
  slug.material = slugMat

  const tipMat = new StandardMaterial(`bulletTipMat_${index}`, scene)
  tipMat.emissiveColor = new Color3(1, 0.95, 0.52)
  tipMat.diffuseColor = new Color3(1, 0.92, 0.42)
  tip.material = tipMat

  const flashMat = new StandardMaterial(`bulletFlashMat_${index}`, scene)
  flashMat.emissiveColor = new Color3(1, 0.56, 0.08)
  flashMat.diffuseColor = new Color3(1, 0.78, 0.22)
  flashMat.alpha = 0.46
  flash.material = flashMat

  root.setEnabled(false)
  return {
    root,
    streak,
    wakeNear,
    wakeFar,
    slug,
    core,
    tip,
    flash,
    life: 0,
    travelDistance: 0,
    impactDistance: 0,
    tailClearDistance: 0,
    traveled: 0,
    originZ: 0,
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    impactX: 0,
    impactY: 0,
    impactZ: 0,
    impactTriggered: false,
    stopAtImpact: false,
    onImpact: null,
  }
}

export function createMuzzleFlash(scene: Scene, index: number): MuzzleFlash {
  const mesh = MeshBuilder.CreateSphere(`muzzle_flash_${index}`, { diameter: 0.34, segments: 10 }, scene)
  const mat = new StandardMaterial(`muzzleFlashMat_${index}`, scene)
  mat.emissiveColor = new Color3(1, 0.58, 0.08)
  mat.diffuseColor = new Color3(1, 0.78, 0.2)
  mat.alpha = 0
  mesh.material = mat
  mesh.isPickable = false
  mesh.setEnabled(false)
  return { mesh, baseScale: 1, life: 0, duration: 0 }
}

export function createImpactFlash(scene: Scene, index: number): ImpactFlash {
  const core = MeshBuilder.CreateSphere(`bullet_impact_core_${index}`, { diameter: 1, segments: 12 }, scene)
  const ring = MeshBuilder.CreateTorus(`bullet_impact_ring_${index}`, {
    diameter: 1,
    thickness: 0.08,
    tessellation: 24,
  }, scene)

  const coreMat = new StandardMaterial(`bulletImpactCoreMat_${index}`, scene)
  coreMat.emissiveColor = new Color3(1, 0.72, 0.1)
  coreMat.diffuseColor = new Color3(1, 0.86, 0.32)
  coreMat.alpha = 0
  core.material = coreMat

  const ringMat = new StandardMaterial(`bulletImpactRingMat_${index}`, scene)
  ringMat.emissiveColor = new Color3(1, 0.58, 0.08)
  ringMat.diffuseColor = new Color3(1, 0.72, 0.18)
  ringMat.alpha = 0
  ring.material = ringMat

  core.isPickable = false
  ring.isPickable = false
  core.setEnabled(false)
  ring.setEnabled(false)
  return { core, ring, life: 0, duration: 0, baseScale: 1 }
}

export function setMeshAlpha(mesh: Mesh, alpha: number): void {
  if (mesh.material instanceof StandardMaterial) {
    mesh.material.alpha = alpha
  }
}

export function getMeshAlpha(mesh: Mesh): number {
  if (mesh.material instanceof StandardMaterial) {
    return mesh.material.alpha
  }
  return 1
}

export function colorizeMesh(mesh: Mesh, color: Color3): void {
  if (mesh.material instanceof StandardMaterial) {
    mesh.material.diffuseColor = color
    mesh.material.emissiveColor = color.scale(0.82)
  }
}
