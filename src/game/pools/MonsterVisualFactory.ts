import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { AbstractMesh } from "@babylonjs/core"
import { MONSTER_BEHAVIORS, type MonsterBehavior, type MonsterConfig } from "../data/monsterData"
import { cloneGltfVisual, type GltfAsset } from "../utils/assetLoader"

const FAST_FIN_WIDTH = 0.13
const FAST_FIN_HEIGHT = 0.54
const TANK_ARMOR_WIDTH = 0.42
const TANK_ARMOR_HEIGHT = 0.34
const DOGURI_VISUAL_SCALE = 1.9
const DOGURI_FACE_SOLDIER_ROTATION_Y = Math.PI
const DOGURI_SHADOW_Y = -0.02
const BASIC_OVERLAY_ALPHA = 0.5
const FAST_OVERLAY_ALPHA = 0.38
const DEATH_GREY = new Color3(0.42, 0.42, 0.4)
const MONSTER_MOTION_ROOT_PREFIX = "monster_motion_root_"
const MONSTER_CONTACT_SHADOW_PREFIX = "monster_contact_shadow_"
const MONSTER_ROLE_CUE_PREFIX = "monster_role_cue_root_"

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

export function createMonsterDeathMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial("monsterDeathGreySharedMat", scene)
  mat.diffuseColor = DEATH_GREY
  mat.emissiveColor = DEATH_GREY.scale(0.055)
  mat.specularColor = Color3.Black()
  mat.freeze()
  return mat
}

export function createMonsterVisual(
  scene: Scene,
  index: number,
  behavior: MonsterBehavior,
  assets: MonsterModelAssets | null,
  contactShadowMat: StandardMaterial,
  useAuthoredVisual = true,
  useContactShadow = true,
  compactHordeVisuals = false,
): Mesh {
  const root = new Mesh(`monster_${behavior.toLowerCase()}_${index}`, scene)
  const motionRoot = new Mesh(`${MONSTER_MOTION_ROOT_PREFIX}${behavior.toLowerCase()}_${index}`, scene)
  motionRoot.parent = root
  const authoredAsset = useAuthoredVisual ? selectAuthoredAsset(assets, behavior) : null
  if (authoredAsset !== null) {
    const visual = cloneGltfVisual(
      authoredAsset,
      `monster_doguri_visual_${behavior.toLowerCase()}_${index}`,
      scene,
      { cloneMaterials: false },
    )
    visual.parent = motionRoot
    visual.position.set(0, 0, 0)
    visual.rotation.y = DOGURI_FACE_SOLDIER_ROTATION_Y
    visual.scaling.setAll(DOGURI_VISUAL_SCALE)
    if (!compactHordeVisuals || behavior === MONSTER_BEHAVIORS.fast || isCombatRoleBehavior(behavior)) {
      applyAuthoredThreatTint(visual, behavior)
    }
    if ((!compactHordeVisuals && behavior !== MONSTER_BEHAVIORS.tank) || isCombatRoleBehavior(behavior)) {
      const cueRoot = new Mesh(`monster_doguri_cue_${behavior.toLowerCase()}_${index}`, scene)
      cueRoot.parent = motionRoot
      cueRoot.scaling.setAll(DOGURI_VISUAL_SCALE)
      addAuthoredThreatBadge(scene, cueRoot, index, behavior)
      addBehaviorCue(scene, cueRoot, index, behavior)
    }
    if (useContactShadow) {
      addContactShadow(scene, root, index, contactShadowMat, DOGURI_SHADOW_Y)
    }
    return root
  }

  createFallbackBody(scene, motionRoot, index)
  if (!compactHordeVisuals || behavior === MONSTER_BEHAVIORS.tank || isCombatRoleBehavior(behavior)) {
    addBehaviorCue(scene, motionRoot, index, behavior)
  }
  if (useContactShadow) {
    addContactShadow(scene, root, index, contactShadowMat)
  }
  return root
}

export function resolveMonsterMotionRoot(root: Mesh): Mesh {
  const motionRoot = root.getChildMeshes(false).find((child) => child.name.startsWith(MONSTER_MOTION_ROOT_PREFIX))
  return motionRoot instanceof Mesh ? motionRoot : root
}

export function resolveMonsterContactShadow(root: Mesh): Mesh | null {
  const shadow = root.getChildMeshes(false).find((child) => child.name.startsWith(MONSTER_CONTACT_SHADOW_PREFIX))
  return shadow instanceof Mesh ? shadow : null
}

export function resolveMonsterRoleCue(root: Mesh): Mesh | null {
  const cue = root.getChildMeshes(false).find((child) => child.name.startsWith(MONSTER_ROLE_CUE_PREFIX))
  return cue instanceof Mesh ? cue : null
}

function applyAuthoredThreatTint(visual: Mesh, behavior: MonsterBehavior): void {
  if (behavior === MONSTER_BEHAVIORS.tank) {
    return
  }
  const color = getBehaviorColor(behavior)
  for (const child of visual.getChildMeshes(false)) {
    child.overlayColor = color
    child.overlayAlpha = behavior === MONSTER_BEHAVIORS.fast || behavior === MONSTER_BEHAVIORS.charger
      ? 0.38
      : 0.5
    child.renderOverlay = true
  }
}

export function usesAuthoredMonsterVisual(assets: MonsterModelAssets | null, behavior: MonsterBehavior): boolean {
  return selectAuthoredAsset(assets, behavior) !== null
}

export function applyMonsterVisualTint(mesh: Mesh, config: MonsterConfig): void {
  const tint = Color3.FromHexString(config.cssColor)
  for (const child of mesh.getChildMeshes(false)) {
    if (isTintableMonsterMesh(child)) {
      child.overlayColor = tint
      child.overlayAlpha = config.behavior === MONSTER_BEHAVIORS.fast || config.behavior === MONSTER_BEHAVIORS.charger
        ? FAST_OVERLAY_ALPHA
        : BASIC_OVERLAY_ALPHA
      child.renderOverlay = true
    }
  }
}

function isTintableMonsterMesh(mesh: AbstractMesh): boolean {
  return !mesh.name.includes("monster_contact_shadow")
    && !mesh.name.includes("monster_mid_boss_hp")
    && !mesh.name.includes("monster_role_cue_")
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
  cueMat.diffuseColor = getBehaviorColor(behavior)
  cueMat.emissiveColor = getBehaviorEmissiveColor(behavior)
  cueMat.specularColor = Color3.Black()

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
  } else if (behavior === MONSTER_BEHAVIORS.fast || behavior === MONSTER_BEHAVIORS.charger) {
    for (const x of [-0.34, 0.34]) {
      const horn = MeshBuilder.CreateSphere(`monster_variant_${behavior.toLowerCase()}_${index}_${x}`, {
        diameterX: behavior === MONSTER_BEHAVIORS.charger ? 0.18 : 0.16,
        diameterY: behavior === MONSTER_BEHAVIORS.charger ? 0.42 : 0.24,
        diameterZ: 0.18,
        segments: 8,
      }, scene)
      horn.material = cueMat
      horn.parent = root
      horn.rotation.x = behavior === MONSTER_BEHAVIORS.charger ? -0.48 : 0
      horn.position.set(x, behavior === MONSTER_BEHAVIORS.charger ? 0.3 : 0.22, behavior === MONSTER_BEHAVIORS.charger ? -0.3 : 0.22)
      if (behavior === MONSTER_BEHAVIORS.fast) {
        const fin = MeshBuilder.CreateSphere(`monster_variant_fast_side_fin_${index}_${x}`, { diameterX: FAST_FIN_WIDTH, diameterY: FAST_FIN_HEIGHT, diameterZ: 0.16, segments: 8 }, scene)
        fin.material = cueMat
        fin.parent = root
        fin.rotation.z = x < 0 ? -0.34 : 0.34
        fin.position.set(x * 1.34, 0.08, -0.1)
      }
    }
  } else if (behavior === MONSTER_BEHAVIORS.shield) {
    addShieldRoleCue(scene, root, index, cueMat)
  } else if (behavior === MONSTER_BEHAVIORS.splitter) {
    addSplitterRoleCue(scene, root, index, cueMat)
  }

  if (behavior === MONSTER_BEHAVIORS.charger) {
    addChargeRoleCue(scene, root, index, cueMat)
  }

  const spine = MeshBuilder.CreateSphere(`monster_back_spine_${behavior}_${index}`, { diameterX: 0.18, diameterY: 0.2, diameterZ: 0.5, segments: 6 }, scene)
  spine.material = cueMat
  spine.parent = root
  spine.position.set(0, 0.34, -0.22)
}

function addAuthoredThreatBadge(scene: Scene, root: Mesh, index: number, behavior: MonsterBehavior): void {
  const badgeMat = new StandardMaterial(`monsterDoguriBadgeMat_${behavior}_${index}`, scene)
  badgeMat.diffuseColor = getBehaviorColor(behavior)
  badgeMat.emissiveColor = getBehaviorEmissiveColor(behavior)
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
    : behavior === MONSTER_BEHAVIORS.fast || behavior === MONSTER_BEHAVIORS.charger
      ? assets.fastAsset ?? assets.defaultAsset
      : assets.defaultAsset
  return asset?.isReal === true ? asset : null
}

function addShieldRoleCue(scene: Scene, root: Mesh, index: number, material: StandardMaterial): void {
  const cueRoot = new Mesh(`${MONSTER_ROLE_CUE_PREFIX}shield_${index}`, scene)
  cueRoot.parent = root
  const plate = MeshBuilder.CreateBox(
    `monster_role_cue_shield_plate_${index}`,
    { width: 1.2, height: 0.64, depth: 0.1 },
    scene,
  )
  plate.parent = cueRoot
  plate.position.set(0, 0.02, -0.62)
  plate.material = material
  const brace = MeshBuilder.CreateBox(
    `monster_role_cue_shield_brace_${index}`,
    { width: 0.18, height: 0.78, depth: 0.13 },
    scene,
  )
  brace.parent = cueRoot
  brace.position.set(0, 0.02, -0.68)
  brace.material = material
}

function addChargeRoleCue(scene: Scene, root: Mesh, index: number, material: StandardMaterial): void {
  const cueRoot = new Mesh(`${MONSTER_ROLE_CUE_PREFIX}charger_${index}`, scene)
  cueRoot.parent = root
  const lane = MeshBuilder.CreateBox(
    `monster_role_cue_charge_lane_${index}`,
    { width: 0.26, height: 0.035, depth: 2.4 },
    scene,
  )
  lane.parent = cueRoot
  lane.position.set(0, -0.4, -1.45)
  lane.material = material
  const warning = MeshBuilder.CreateCylinder(
    `monster_role_cue_charge_warning_${index}`,
    { diameter: 0.5, height: 0.08, tessellation: 3 },
    scene,
  )
  warning.parent = cueRoot
  warning.position.set(0, 0.72, -0.24)
  warning.rotation.x = Math.PI * 0.5
  warning.material = material
  cueRoot.setEnabled(false)
}

function addSplitterRoleCue(scene: Scene, root: Mesh, index: number, material: StandardMaterial): void {
  const cueRoot = new Mesh(`${MONSTER_ROLE_CUE_PREFIX}splitter_${index}`, scene)
  cueRoot.parent = root
  const band = MeshBuilder.CreateBox(
    `monster_role_cue_splitter_band_${index}`,
    { width: 1.02, height: 0.14, depth: 0.12 },
    scene,
  )
  band.parent = cueRoot
  band.position.set(0, 0.06, -0.54)
  band.material = material
  for (const x of [-0.3, 0.3]) {
    const core = MeshBuilder.CreateSphere(
      `monster_role_cue_splitter_core_${index}_${x}`,
      { diameter: 0.28, segments: 6 },
      scene,
    )
    core.parent = cueRoot
    core.position.set(x, 0.2, -0.5)
    core.material = material
  }
}

function isCombatRoleBehavior(behavior: MonsterBehavior): boolean {
  return behavior === MONSTER_BEHAVIORS.shield
    || behavior === MONSTER_BEHAVIORS.charger
    || behavior === MONSTER_BEHAVIORS.splitter
}

function getBehaviorColor(behavior: MonsterBehavior): Color3 {
  if (behavior === MONSTER_BEHAVIORS.tank) return new Color3(0.54, 0.12, 0.78)
  if (behavior === MONSTER_BEHAVIORS.fast) return new Color3(1, 0.55, 0.05)
  if (behavior === MONSTER_BEHAVIORS.shield) return new Color3(0.08, 0.66, 0.92)
  if (behavior === MONSTER_BEHAVIORS.charger) return new Color3(0.98, 0.72, 0.04)
  if (behavior === MONSTER_BEHAVIORS.splitter) return new Color3(0.91, 0.32, 0.95)
  return new Color3(0.74, 0.035, 0.025)
}

function getBehaviorEmissiveColor(behavior: MonsterBehavior): Color3 {
  if (behavior === MONSTER_BEHAVIORS.tank) return new Color3(0.24, 0.03, 0.42)
  if (behavior === MONSTER_BEHAVIORS.fast) return new Color3(0.58, 0.18, 0.01)
  if (behavior === MONSTER_BEHAVIORS.shield) return new Color3(0.01, 0.28, 0.48)
  if (behavior === MONSTER_BEHAVIORS.charger) return new Color3(0.6, 0.28, 0.01)
  if (behavior === MONSTER_BEHAVIORS.splitter) return new Color3(0.42, 0.03, 0.5)
  return new Color3(0.42, 0.01, 0.01)
}

function addContactShadow(
  scene: Scene,
  root: Mesh,
  index: number,
  material: StandardMaterial,
  y = -0.48,
): void {
  const shadow = MeshBuilder.CreateDisc(
    `${MONSTER_CONTACT_SHADOW_PREFIX}${index}`,
    { radius: 0.9, tessellation: 18 },
    scene,
  )
  shadow.parent = root
  shadow.rotation.x = Math.PI * 0.5
  shadow.position.set(0, y, -0.06)
  shadow.scaling.set(1.25, 0.7, 1)
  shadow.material = material
}
