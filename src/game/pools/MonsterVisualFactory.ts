import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial"
import { MONSTER_BEHAVIORS, type MonsterBehavior, type MonsterConfig } from "../data/monsterData"
import { cloneGltfVisual, type GltfAsset } from "../utils/assetLoader"

const FAST_FIN_WIDTH = 0.13
const FAST_FIN_HEIGHT = 0.54
const TANK_ARMOR_WIDTH = 0.42
const TANK_ARMOR_HEIGHT = 0.34
const DOGURI_VISUAL_SCALE = 1.9
const DOGURI_FACE_SOLDIER_ROTATION_Y = Math.PI
const DOGURI_SHADOW_Y = -0.02

export type MonsterModelAssets = {
  readonly defaultAsset: GltfAsset | null
  readonly fastAsset: GltfAsset | null
  readonly tankAsset: GltfAsset | null
}

export function createMonsterContactShadowMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial("monsterContactShadowMat", scene)
  mat.diffuseColor = new Color3(0.16, 0.035, 0.028)
  mat.emissiveColor = new Color3(0.08, 0.012, 0.01)
  mat.alpha = 0.42
  mat.specularColor = Color3.Black()
  return mat
}

export function createMonsterVisual(
  scene: Scene,
  index: number,
  behavior: MonsterBehavior,
  assets: MonsterModelAssets | null,
  contactShadowMat: StandardMaterial,
): Mesh {
  const root = new Mesh(`monster_${behavior.toLowerCase()}_${index}`, scene)
  const authoredAsset = selectAuthoredAsset(assets, behavior)
  if (authoredAsset !== null) {
    const visual = cloneGltfVisual(
      authoredAsset,
      `monster_doguri_visual_${behavior.toLowerCase()}_${index}`,
      scene,
      { cloneMaterials: behavior !== MONSTER_BEHAVIORS.tank },
    )
    visual.parent = root
    visual.position.set(0, 0, 0)
    visual.rotation.y = DOGURI_FACE_SOLDIER_ROTATION_Y
    visual.scaling.setAll(DOGURI_VISUAL_SCALE)
    applyAuthoredThreatTint(visual, behavior)
    if (behavior !== MONSTER_BEHAVIORS.tank) {
      const cueRoot = new Mesh(`monster_doguri_cue_${behavior.toLowerCase()}_${index}`, scene)
      cueRoot.parent = root
      cueRoot.scaling.setAll(DOGURI_VISUAL_SCALE)
      addAuthoredThreatBadge(scene, cueRoot, index, behavior)
      addBehaviorCue(scene, cueRoot, index, behavior)
    }
    addContactShadow(scene, root, index, contactShadowMat, DOGURI_SHADOW_Y)
    return root
  }

  createFallbackBody(scene, root, index)
  addBehaviorCue(scene, root, index, behavior)
  addContactShadow(scene, root, index, contactShadowMat)
  return root
}

function applyAuthoredThreatTint(visual: Mesh, behavior: MonsterBehavior): void {
  if (behavior === MONSTER_BEHAVIORS.tank) {
    return
  }
  const color = behavior === MONSTER_BEHAVIORS.fast
    ? new Color3(1, 0.42, 0.02)
    : new Color3(0.96, 0.02, 0.02)
  for (const child of visual.getChildMeshes(false)) {
    if (child.material instanceof StandardMaterial) {
      child.material.diffuseColor = color
      child.material.emissiveColor = color.scale(0.28)
    } else if (child.material instanceof PBRMaterial) {
      child.material.albedoColor = color
      child.material.emissiveColor = color.scale(0.18)
    }
    child.overlayColor = color
    child.overlayAlpha = behavior === MONSTER_BEHAVIORS.fast ? 0.38 : 0.5
    child.renderOverlay = true
  }
}

export function usesAuthoredMonsterVisual(assets: MonsterModelAssets | null, behavior: MonsterBehavior): boolean {
  return selectAuthoredAsset(assets, behavior) !== null
}

export function applyMonsterVisualTint(mesh: Mesh, config: MonsterConfig): void {
  const tint = Color3.FromHexString(config.cssColor)
  for (const child of mesh.getChildMeshes(false)) {
    if (!child.name.includes("monster_contact_shadow")) {
      applyMaterialTint(child.material, tint, config)
    }
  }
}

function createFallbackBody(scene: Scene, root: Mesh, index: number): void {
  const eyeMat = new StandardMaterial(`monsterEyeMat_${index}`, scene)
  eyeMat.diffuseColor = new Color3(0.12, 0.01, 0.02)
  eyeMat.emissiveColor = new Color3(0.7, 0.025, 0.018)

  const body = MeshBuilder.CreateSphere(`monster_slime_body_${index}`, { diameterX: 1.56, diameterY: 0.84, diameterZ: 1.42, segments: 8 }, scene)
  body.parent = root
  body.position.set(0, 0, 0)
  const bodyMat = new StandardMaterial(`monsterBodyMat_${index}`, scene)
  bodyMat.diffuseColor = new Color3(0.78, 0.08, 0.13)
  bodyMat.emissiveColor = new Color3(0.12, 0.012, 0.018)
  bodyMat.specularColor = new Color3(0.85, 0.34, 0.4)
  body.material = bodyMat

  const cap = MeshBuilder.CreateSphere(`monster_slime_cap_${index}`, { diameterX: 0.82, diameterY: 0.42, diameterZ: 0.72, segments: 8 }, scene)
  cap.parent = root
  cap.position.set(-0.14, 0.3, -0.08)
  cap.material = bodyMat

  const base = MeshBuilder.CreateSphere(`monster_slime_base_${index}`, { diameterX: 1.86, diameterY: 0.28, diameterZ: 1.54, segments: 8 }, scene)
  base.parent = root
  base.position.set(0, -0.34, 0)
  base.material = bodyMat

  for (const x of [-0.18, 0.18]) {
    const eye = MeshBuilder.CreateSphere(`monster_slime_eye_${index}_${x}`, { diameter: 0.13, segments: 8 }, scene)
    eye.material = eyeMat
    eye.parent = root
    eye.position.set(x, 0.12, 0.62)
  }
}

function addBehaviorCue(scene: Scene, root: Mesh, index: number, behavior: MonsterBehavior): void {
  const cueMat = new StandardMaterial(`monsterCueMat_${behavior}_${index}`, scene)
  cueMat.diffuseColor = behavior === MONSTER_BEHAVIORS.tank
    ? new Color3(0.54, 0.12, 0.78)
    : behavior === MONSTER_BEHAVIORS.fast
      ? new Color3(1, 0.55, 0.05)
      : new Color3(0.74, 0.035, 0.025)
  cueMat.emissiveColor = behavior === MONSTER_BEHAVIORS.tank
    ? new Color3(0.24, 0.03, 0.42)
    : behavior === MONSTER_BEHAVIORS.fast
      ? new Color3(0.58, 0.18, 0.01)
      : new Color3(0.42, 0.01, 0.01)

  if (behavior === MONSTER_BEHAVIORS.tank) {
    for (const x of [-0.42, 0.42]) {
      const shoulder = MeshBuilder.CreateSphere(`monster_variant_tank_${index}_${x}`, { diameterX: TANK_ARMOR_WIDTH, diameterY: TANK_ARMOR_HEIGHT, diameterZ: 0.34, segments: 10 }, scene)
      shoulder.material = cueMat
      shoulder.parent = root
      shoulder.position.set(x, 0.18, 0)
    }
    for (const z of [-0.24, 0.18]) {
      const armor = MeshBuilder.CreateSphere(`monster_variant_tank_armor_plate_${index}_${z}`, { diameterX: 0.76, diameterY: 0.16, diameterZ: 0.22, segments: 10 }, scene)
      armor.material = cueMat
      armor.parent = root
      armor.position.set(0, 0.34, z)
    }
  } else if (behavior === MONSTER_BEHAVIORS.fast) {
    for (const x of [-0.34, 0.34]) {
      const horn = MeshBuilder.CreateSphere(`monster_variant_fast_${index}_${x}`, { diameterX: 0.16, diameterY: 0.24, diameterZ: 0.18, segments: 8 }, scene)
      horn.material = cueMat
      horn.parent = root
      horn.position.set(x, 0.22, 0.22)
      const fin = MeshBuilder.CreateSphere(`monster_variant_fast_side_fin_${index}_${x}`, { diameterX: FAST_FIN_WIDTH, diameterY: FAST_FIN_HEIGHT, diameterZ: 0.16, segments: 8 }, scene)
      fin.material = cueMat
      fin.parent = root
      fin.rotation.z = x < 0 ? -0.34 : 0.34
      fin.position.set(x * 1.34, 0.08, -0.1)
    }
  }

  const spine = MeshBuilder.CreateSphere(`monster_back_spine_${behavior}_${index}`, { diameterX: 0.18, diameterY: 0.2, diameterZ: 0.5, segments: 6 }, scene)
  spine.material = cueMat
  spine.parent = root
  spine.position.set(0, 0.34, -0.22)
}

function addAuthoredThreatBadge(scene: Scene, root: Mesh, index: number, behavior: MonsterBehavior): void {
  const badgeMat = new StandardMaterial(`monsterDoguriBadgeMat_${behavior}_${index}`, scene)
  badgeMat.diffuseColor = behavior === MONSTER_BEHAVIORS.fast
    ? new Color3(1, 0.44, 0.02)
    : new Color3(0.9, 0.02, 0.02)
  badgeMat.emissiveColor = behavior === MONSTER_BEHAVIORS.fast
    ? new Color3(0.48, 0.16, 0.01)
    : new Color3(0.52, 0.01, 0.01)
  badgeMat.specularColor = Color3.Black()
  badgeMat.backFaceCulling = false

  const badge = MeshBuilder.CreateDisc(
    `monster_doguri_threat_badge_${behavior}_${index}`,
    { radius: 0.5, tessellation: 12 },
    scene,
  )
  badge.parent = root
  badge.position.set(0, 0.82, 0.08)
  badge.billboardMode = Mesh.BILLBOARDMODE_ALL
  badge.material = badgeMat
}

function selectAuthoredAsset(assets: MonsterModelAssets | null, behavior: MonsterBehavior): GltfAsset | null {
  if (assets === null) {
    return null
  }
  const asset = behavior === MONSTER_BEHAVIORS.tank
    ? assets.tankAsset
    : behavior === MONSTER_BEHAVIORS.fast
      ? assets.fastAsset ?? assets.defaultAsset
      : assets.defaultAsset
  return asset?.isReal === true ? asset : null
}

function addContactShadow(
  scene: Scene,
  root: Mesh,
  index: number,
  material: StandardMaterial,
  y = -0.48,
): void {
  const shadow = MeshBuilder.CreateDisc(
    `monster_contact_shadow_${index}`,
    { radius: 0.9, tessellation: 18 },
    scene,
  )
  shadow.parent = root
  shadow.rotation.x = Math.PI * 0.5
  shadow.position.set(0, y, -0.06)
  shadow.scaling.set(1.25, 0.7, 1)
  shadow.material = material
}

function applyMaterialTint(material: Mesh["material"], color: Color3, config: MonsterConfig): void {
  const emissive = color.scale(config.behavior === MONSTER_BEHAVIORS.fast ? 0.34 : 0.18)
  if (material instanceof StandardMaterial) {
    material.diffuseColor = color
    material.emissiveColor = emissive
  }
}
