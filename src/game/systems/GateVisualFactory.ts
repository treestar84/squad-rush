import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { GateConfig } from "../data/gateData"

export const GATE_VISUAL_SCALE = 0.7
export const GATE_LEFT_X = -4.6
export const GATE_RIGHT_X = 4.6
export const GATE_ARROW_BASE_Y = 0.22 * GATE_VISUAL_SCALE

export type GateVisual = {
  readonly allMeshes: readonly Mesh[]
  readonly animatedMeshes: readonly Mesh[]
  readonly setDisplayText: (text: string) => void
}

export type GateVisualPlacement = {
  readonly x: number
  readonly z: number
  readonly hiddenLabel?: boolean
}

export type GateBarrierVisual = {
  readonly allMeshes: readonly Mesh[]
  readonly breakMeshes: readonly Mesh[]
  readonly wall: Mesh
  readonly hpFill: Mesh
}

function drawGateLabel(texture: DynamicTexture, text: string): void {
  const ctx = texture.getContext()
  ctx.clearRect(0, 0, 512, 256)
  const fontSize = text.length > 9 ? 58 : text.length > 6 ? 68 : text.length > 3 ? 82 : 104
  texture.drawText(text, null, 148, `900 ${fontSize}px Arial`, "#FFFFFF", "transparent", true, true)
  texture.update()
}

export function createGateVisual(scene: Scene, config: GateConfig, placement: GateVisualPlacement): GateVisual {
  const { hiddenLabel = false, x, z } = placement
  const color = Color3.FromHexString(config.cssColor)
  const mat = new StandardMaterial(`gateMat_${config.id}_${x}`, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(0.46)
  mat.alpha = 0.42

  const glowMat = new StandardMaterial(`gateGlowMat_${config.id}_${x}`, scene)
  glowMat.diffuseColor = color
  glowMat.emissiveColor = color.scale(0.82)
  glowMat.alpha = 0.68

  const floorMat = new StandardMaterial(`gateFloorMat_${config.id}_${x}`, scene)
  floorMat.diffuseColor = color.scale(0.45)
  floorMat.emissiveColor = color.scale(0.22)
  floorMat.alpha = 0.62

  const labelBackMat = new StandardMaterial(`gateLabelBackMat_${config.id}_${x}`, scene)
  labelBackMat.diffuseColor = new Color3(0.02, 0.025, 0.032)
  labelBackMat.emissiveColor = color.scale(0.16)
  labelBackMat.alpha = 0.78

  const scale = GATE_VISUAL_SCALE
  const panel = MeshBuilder.CreatePlane(`gate_panel_${config.id}_${x}`, { width: 3.6 * scale, height: 4.4 * scale }, scene)
  panel.material = mat
  panel.position.set(x, 2.25 * scale, z - 0.18 * scale)

  const floorPad = MeshBuilder.CreateBox(`gate_floor_pad_${config.id}_${x}`, { width: 4.25 * scale, height: 0.08 * scale, depth: 3.45 * scale }, scene)
  floorPad.material = floorMat
  floorPad.position.set(x, 0.13 * scale, z - 0.95 * scale)

  const choicePad = MeshBuilder.CreateBox(`gate_choice_pad_${config.id}_${x}`, { width: 4.55 * scale, height: 0.045 * scale, depth: 4.3 * scale }, scene)
  choicePad.material = floorMat
  choicePad.position.set(x, 0.105 * scale, z - 1.7 * scale)

  const leftGlow = MeshBuilder.CreateBox(`gate_side_glow_l_${config.id}_${x}`, { width: 0.08 * scale, height: 4.3 * scale, depth: 0.08 * scale }, scene)
  leftGlow.material = glowMat
  leftGlow.position.set(x - 1.62 * scale, 2.36 * scale, z - 0.58 * scale)

  const rightGlow = MeshBuilder.CreateBox(`gate_side_glow_r_${config.id}_${x}`, { width: 0.08 * scale, height: 4.3 * scale, depth: 0.08 * scale }, scene)
  rightGlow.material = glowMat
  rightGlow.position.set(x + 1.62 * scale, 2.36 * scale, z - 0.58 * scale)

  const arrowLeft = MeshBuilder.CreateBox(`gate_choice_arrow_l_${config.id}_${x}`, { width: 0.18 * scale, height: 0.08 * scale, depth: 1.15 * scale }, scene)
  arrowLeft.material = glowMat
  arrowLeft.position.set(x - 0.36 * scale, GATE_ARROW_BASE_Y, z - 2.05 * scale)
  arrowLeft.rotation.y = -0.62

  const arrowRight = MeshBuilder.CreateBox(`gate_choice_arrow_r_${config.id}_${x}`, { width: 0.18 * scale, height: 0.08 * scale, depth: 1.15 * scale }, scene)
  arrowRight.material = glowMat
  arrowRight.position.set(x + 0.36 * scale, GATE_ARROW_BASE_Y, z - 2.05 * scale)
  arrowRight.rotation.y = 0.62

  const tex = new DynamicTexture(`gateLabel_${config.id}_${x}`, { width: 512, height: 256 }, scene)
  drawGateLabel(tex, hiddenLabel ? "?" : config.displayText)

  const labelBackplate = MeshBuilder.CreatePlane(`gate_label_backplate_${config.id}_${x}`, { width: 3.62 * scale, height: 1.06 * scale }, scene)
  labelBackplate.material = labelBackMat
  labelBackplate.position.set(x, 3.16 * scale, z - 0.315 * scale)
  labelBackplate.billboardMode = Mesh.BILLBOARDMODE_ALL
  labelBackplate.renderingGroupId = 1

  const label = MeshBuilder.CreatePlane(`gate_label_${config.id}_${x}`, { width: 3.3 * scale, height: 0.98 * scale }, scene)
  const labelMat = new StandardMaterial(`gateLabelMat_${config.id}_${x}`, scene)
  labelMat.diffuseTexture = tex
  labelMat.emissiveTexture = tex
  labelMat.useAlphaFromDiffuseTexture = true
  labelMat.backFaceCulling = false
  labelMat.disableDepthWrite = true
  label.material = labelMat
  label.position.set(x, 3.16 * scale, z - 0.3 * scale)
  label.billboardMode = Mesh.BILLBOARDMODE_ALL
  label.renderingGroupId = 1

  return {
    allMeshes: [
      floorPad,
      choicePad,
      panel,
      leftGlow,
      rightGlow,
      arrowLeft,
      arrowRight,
      labelBackplate,
      label,
    ],
    animatedMeshes: [choicePad, leftGlow, rightGlow, arrowLeft, arrowRight],
    setDisplayText: (text) => drawGateLabel(tex, text),
  }
}

export function createGateBarrierVisual(scene: Scene, placement: GateVisualPlacement): GateBarrierVisual {
  const { x, z } = placement
  const wallMat = new StandardMaterial(`gate_barrier_wall_mat_${x}_${z}`, scene)
  wallMat.diffuseColor = new Color3(0.22, 0.08, 0.08)
  wallMat.emissiveColor = new Color3(0.12, 0.02, 0.02)
  wallMat.specularColor = new Color3(0.48, 0.18, 0.12)

  const braceMat = new StandardMaterial(`gate_barrier_brace_mat_${x}_${z}`, scene)
  braceMat.diffuseColor = new Color3(0.04, 0.045, 0.055)
  braceMat.emissiveColor = new Color3(0.02, 0.018, 0.014)

  const hpBackMat = new StandardMaterial(`gate_barrier_hp_back_mat_${x}_${z}`, scene)
  hpBackMat.diffuseColor = new Color3(0.04, 0.025, 0.025)
  hpBackMat.emissiveColor = new Color3(0.04, 0.01, 0.01)

  const hpFillMat = new StandardMaterial(`gate_barrier_hp_fill_mat_${x}_${z}`, scene)
  hpFillMat.diffuseColor = new Color3(0.95, 0.18, 0.16)
  hpFillMat.emissiveColor = new Color3(0.62, 0.06, 0.04)

  const wall = MeshBuilder.CreateBox(`gate_barrier_wall_${x}_${z}`, { width: 3.45, height: 2.1, depth: 0.42 }, scene)
  wall.material = wallMat
  wall.position.set(x, 1.12, z - 3.1)

  const leftBrace = MeshBuilder.CreateBox(`gate_barrier_brace_l_${x}_${z}`, { width: 0.24, height: 2.55, depth: 0.62 }, scene)
  leftBrace.material = braceMat
  leftBrace.position.set(x - 1.86, 1.22, z - 3.08)

  const rightBrace = MeshBuilder.CreateBox(`gate_barrier_brace_r_${x}_${z}`, { width: 0.24, height: 2.55, depth: 0.62 }, scene)
  rightBrace.material = braceMat
  rightBrace.position.set(x + 1.86, 1.22, z - 3.08)

  const hpBack = MeshBuilder.CreateBox(`gate_barrier_hp_back_${x}_${z}`, { width: 3.25, height: 0.18, depth: 0.08 }, scene)
  hpBack.material = hpBackMat
  hpBack.position.set(x, 2.48, z - 3.38)

  const hpFill = MeshBuilder.CreateBox(`gate_barrier_hp_fill_${x}_${z}`, { width: 3.16, height: 0.12, depth: 0.1 }, scene)
  hpFill.material = hpFillMat
  hpFill.position.set(x, 2.48, z - 3.43)

  return {
    allMeshes: [wall, leftBrace, rightBrace, hpBack, hpFill],
    breakMeshes: [wall, leftBrace, rightBrace],
    wall,
    hpFill,
  }
}
