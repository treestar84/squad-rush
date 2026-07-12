import { Color3, Scene, StandardMaterial, Texture } from "@babylonjs/core"
import { DIFFICULTY_IDS, type DifficultyProfile } from "./data/difficultyData"
import { GAME_MODE_IDS, type GameModeProfile } from "./data/gameModeData"
import { usesDesktopAttackBuildingEnvironment } from "./utils/deviceProfile"

type EnvironmentPalette = {
  readonly roadDiffuse: Color3
  readonly roadSpecular: Color3
  readonly seamDiffuse: Color3
  readonly sideGroundDiffuse: Color3
  readonly sideGroundEmissive: Color3
  readonly sideGroundSpecular: Color3
}

type AttackGroundTextureConfig = {
  readonly url: string
  readonly roadDiffuse: Color3 | null
}

declare global {
  interface Window {
    __squadRushEnvironmentSurfaceDebug?: {
      readonly desktopAttackEnvironment: boolean
      readonly roadDiffuse: readonly [number, number, number]
      readonly sideGroundDiffuse: readonly [number, number, number]
      readonly sideObjectsHidden: boolean
    }
  }
}

const DEFAULT_ENVIRONMENT_PALETTE: EnvironmentPalette = {
  roadDiffuse: new Color3(0.23, 0.27, 0.32),
  roadSpecular: new Color3(0.05, 0.06, 0.08),
  seamDiffuse: new Color3(0.08, 0.1, 0.12),
  sideGroundDiffuse: new Color3(0.08, 0.09, 0.1),
  sideGroundEmissive: new Color3(0.012, 0.012, 0.014),
  sideGroundSpecular: new Color3(0.05, 0.05, 0.055),
}

const DESKTOP_ATTACK_ENVIRONMENT_PALETTE: EnvironmentPalette = {
  roadDiffuse: new Color3(0.47, 0.32, 0.16),
  roadSpecular: new Color3(0.12, 0.08, 0.04),
  seamDiffuse: new Color3(0.2, 0.12, 0.06),
  sideGroundDiffuse: new Color3(0.16, 0.18, 0.19),
  sideGroundEmissive: new Color3(0.018, 0.02, 0.022),
  sideGroundSpecular: new Color3(0.1, 0.11, 0.12),
}

const DESKTOP_ATTACK_HIDDEN_PREFIXES = [
  "container_",
] as const
const ATTACK_GROUND_TEXTURE_URLS = {
  default: "/assets/textures/attack_dirt_ground.webp",
  hard: "/assets/textures/attack_dirt_ground_hard.webp",
} as const
const HARD_ATTACK_ROAD_DIFFUSE = new Color3(0.78, 0.8, 0.72)
const ATTACK_ROAD_TEXTURE_SCALE = { u: 1.7, v: 1.2 } as const

export function applyEnvironmentMode(scene: Scene, mode: GameModeProfile, difficulty: DifficultyProfile): void {
  const desktopAttackEnvironment = usesDesktopAttackBuildingEnvironment(mode)
  const attackGroundTexture = getAttackGroundTextureConfig(mode, difficulty)
  const palette = desktopAttackEnvironment
    ? DESKTOP_ATTACK_ENVIRONMENT_PALETTE
    : DEFAULT_ENVIRONMENT_PALETTE
  applyMaterialPalette(scene, palette, attackGroundTexture)
  setDesktopAttackSideObjectsVisible(scene, !desktopAttackEnvironment)
  window.__squadRushEnvironmentSurfaceDebug = {
    desktopAttackEnvironment,
    roadDiffuse: colorTuple(palette.roadDiffuse),
    sideGroundDiffuse: colorTuple(palette.sideGroundDiffuse),
    sideObjectsHidden: desktopAttackEnvironment,
  }
}

function applyMaterialPalette(scene: Scene, palette: EnvironmentPalette, attackGroundTexture: AttackGroundTextureConfig | null): void {
  updateStandardMaterial(scene, "roadMat", (material) => {
    material.diffuseColor = attackGroundTexture?.roadDiffuse ?? palette.roadDiffuse
    material.specularColor = palette.roadSpecular
    material.diffuseTexture = attackGroundTexture === null
      ? null
      : createAttackGroundTexture(scene, attackGroundTexture.url, "attackRoadGroundTexture", ATTACK_ROAD_TEXTURE_SCALE)
  })
  updateStandardMaterial(scene, "roadPanelSeamMat", (material) => {
    material.diffuseColor = palette.seamDiffuse
  })
  updateStandardMaterial(scene, "waterMat", (material) => {
    material.diffuseColor = palette.sideGroundDiffuse
    material.emissiveColor = palette.sideGroundEmissive
    material.specularColor = palette.sideGroundSpecular
    material.diffuseTexture = null
  })
}

function updateStandardMaterial(scene: Scene, name: string, update: (material: StandardMaterial) => void): void {
  const material = scene.getMaterialByName(name)
  if (material instanceof StandardMaterial) {
    update(material)
  }
}

function setDesktopAttackSideObjectsVisible(scene: Scene, visible: boolean): void {
  for (const mesh of scene.meshes) {
    if (DESKTOP_ATTACK_HIDDEN_PREFIXES.some((prefix) => mesh.name.startsWith(prefix))) {
      mesh.setEnabled(visible)
    }
  }
}

function colorTuple(color: Color3): readonly [number, number, number] {
  return [color.r, color.g, color.b]
}

function getAttackGroundTextureConfig(mode: GameModeProfile, difficulty: DifficultyProfile): AttackGroundTextureConfig | null {
  if (mode.id !== GAME_MODE_IDS.run) {
    return null
  }
  if (difficulty.id === DIFFICULTY_IDS.hard) {
    return {
      url: ATTACK_GROUND_TEXTURE_URLS.hard,
      roadDiffuse: HARD_ATTACK_ROAD_DIFFUSE,
    }
  }
  return {
    url: ATTACK_GROUND_TEXTURE_URLS.default,
    roadDiffuse: null,
  }
}

function createAttackGroundTexture(
  scene: Scene,
  url: string,
  name: string,
  scale: { readonly u: number; readonly v: number },
): Texture {
  const texture = new Texture(url, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE)
  texture.name = name
  texture.wrapU = Texture.WRAP_ADDRESSMODE
  texture.wrapV = Texture.WRAP_ADDRESSMODE
  texture.uScale = scale.u
  texture.vScale = scale.v
  return texture
}
