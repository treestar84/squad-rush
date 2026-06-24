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
export const GATE_LEFT_X = -4.2
export const GATE_RIGHT_X = 4.2
export const GATE_ARROW_BASE_Y = 0.22 * GATE_VISUAL_SCALE

export type GateVisual = {
  readonly allMeshes: readonly Mesh[]
  readonly animatedMeshes: readonly Mesh[]
}

export type GateVisualPlacement = {
  readonly x: number
  readonly z: number
}

export function createGateVisual(scene: Scene, config: GateConfig, placement: GateVisualPlacement): GateVisual {
  const { x, z } = placement
  const color = Color3.FromHexString(config.cssColor)
  const mat = new StandardMaterial(`gateMat_${config.id}_${x}`, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(0.46)
  mat.alpha = 0.42

  const frameMat = new StandardMaterial(`gateFrameMat_${config.id}_${x}`, scene)
  frameMat.diffuseColor = new Color3(0.02, 0.03, 0.04)
  frameMat.emissiveColor = color.scale(0.12)

  const glowMat = new StandardMaterial(`gateGlowMat_${config.id}_${x}`, scene)
  glowMat.diffuseColor = color
  glowMat.emissiveColor = color.scale(0.82)
  glowMat.alpha = 0.68

  const floorMat = new StandardMaterial(`gateFloorMat_${config.id}_${x}`, scene)
  floorMat.diffuseColor = color.scale(0.45)
  floorMat.emissiveColor = color.scale(0.22)
  floorMat.alpha = 0.62

  const baseMat = new StandardMaterial(`gateBaseMat_${config.id}_${x}`, scene)
  baseMat.diffuseColor = new Color3(0.1, 0.12, 0.14)
  baseMat.emissiveColor = color.scale(0.08)

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

  const threshold = MeshBuilder.CreateBox(`gate_threshold_${config.id}_${x}`, { width: 4.35 * scale, height: 0.32 * scale, depth: 0.34 * scale }, scene)
  threshold.material = baseMat
  threshold.position.set(x, 0.27 * scale, z + 0.78 * scale)

  const overheadBeam = MeshBuilder.CreateBox(`gate_overhead_beam_${config.id}_${x}`, { width: 4.85 * scale, height: 0.34 * scale, depth: 0.84 * scale }, scene)
  overheadBeam.material = baseMat
  overheadBeam.position.set(x, 5.12 * scale, z - 0.18 * scale)

  const backPlate = MeshBuilder.CreateBox(`gate_depth_plate_${config.id}_${x}`, { width: 4.25 * scale, height: 4.55 * scale, depth: 0.16 * scale }, scene)
  backPlate.material = frameMat
  backPlate.position.set(x, 2.35 * scale, z + 0.1 * scale)

  const leftFrame = MeshBuilder.CreateBox(`gate_frame_l_${config.id}_${x}`, { width: 0.28 * scale, height: 4.9 * scale, depth: 0.56 * scale }, scene)
  leftFrame.material = frameMat
  leftFrame.position.set(x - 1.9 * scale, 2.4 * scale, z - 0.22 * scale)

  const rightFrame = MeshBuilder.CreateBox(`gate_frame_r_${config.id}_${x}`, { width: 0.28 * scale, height: 4.9 * scale, depth: 0.56 * scale }, scene)
  rightFrame.material = frameMat
  rightFrame.position.set(x + 1.9 * scale, 2.4 * scale, z - 0.22 * scale)

  const topFrame = MeshBuilder.CreateBox(`gate_frame_t_${config.id}_${x}`, { width: 4.25 * scale, height: 0.3 * scale, depth: 0.56 * scale }, scene)
  topFrame.material = frameMat
  topFrame.position.set(x, 4.78 * scale, z - 0.22 * scale)

  const leftAnchor = MeshBuilder.CreateBox(`gate_anchor_pylon_l_${config.id}_${x}`, { width: 0.5 * scale, height: 1.05 * scale, depth: 0.82 * scale }, scene)
  leftAnchor.material = baseMat
  leftAnchor.position.set(x - 2.07 * scale, 0.58 * scale, z - 0.05 * scale)

  const rightAnchor = MeshBuilder.CreateBox(`gate_anchor_pylon_r_${config.id}_${x}`, { width: 0.5 * scale, height: 1.05 * scale, depth: 0.82 * scale }, scene)
  rightAnchor.material = baseMat
  rightAnchor.position.set(x + 2.07 * scale, 0.58 * scale, z - 0.05 * scale)

  const leftGlow = MeshBuilder.CreateBox(`gate_side_glow_l_${config.id}_${x}`, { width: 0.08 * scale, height: 4.3 * scale, depth: 0.08 * scale }, scene)
  leftGlow.material = glowMat
  leftGlow.position.set(x - 1.62 * scale, 2.36 * scale, z - 0.58 * scale)

  const rightGlow = MeshBuilder.CreateBox(`gate_side_glow_r_${config.id}_${x}`, { width: 0.08 * scale, height: 4.3 * scale, depth: 0.08 * scale }, scene)
  rightGlow.material = glowMat
  rightGlow.position.set(x + 1.62 * scale, 2.36 * scale, z - 0.58 * scale)

  const ring = MeshBuilder.CreateTorus(`gate_energy_ring_${config.id}_${x}`, { diameter: 4.2 * scale, thickness: 0.07 * scale, tessellation: 36 }, scene)
  ring.material = glowMat
  ring.position.set(x, 2.45 * scale, z - 0.46 * scale)

  const arrowLeft = MeshBuilder.CreateBox(`gate_choice_arrow_l_${config.id}_${x}`, { width: 0.18 * scale, height: 0.08 * scale, depth: 1.15 * scale }, scene)
  arrowLeft.material = glowMat
  arrowLeft.position.set(x - 0.36 * scale, GATE_ARROW_BASE_Y, z - 2.05 * scale)
  arrowLeft.rotation.y = -0.62

  const arrowRight = MeshBuilder.CreateBox(`gate_choice_arrow_r_${config.id}_${x}`, { width: 0.18 * scale, height: 0.08 * scale, depth: 1.15 * scale }, scene)
  arrowRight.material = glowMat
  arrowRight.position.set(x + 0.36 * scale, GATE_ARROW_BASE_Y, z - 2.05 * scale)
  arrowRight.rotation.y = 0.62

  const labelBackplate = MeshBuilder.CreatePlane(`gate_label_backplate_${config.id}_${x}`, { width: 3.62 * scale, height: 1.06 * scale }, scene)
  labelBackplate.material = labelBackMat
  labelBackplate.position.set(x, 3.16 * scale, z - 0.315 * scale)
  labelBackplate.billboardMode = Mesh.BILLBOARDMODE_ALL

  const tex = new DynamicTexture(`gateLabel_${config.id}_${x}`, { width: 512, height: 256 }, scene)
  const ctx = tex.getContext()
  ctx.clearRect(0, 0, 512, 256)
  const fontSize = config.displayText.length > 4 ? 58 : 76
  tex.drawText(config.displayText, null, 148, `900 ${fontSize}px Arial`, "#FFFFFF", "transparent", true, true)
  tex.update()

  const label = MeshBuilder.CreatePlane(`gate_label_${config.id}_${x}`, { width: 3.3 * scale, height: 0.98 * scale }, scene)
  const labelMat = new StandardMaterial(`gateLabelMat_${config.id}_${x}`, scene)
  labelMat.diffuseTexture = tex
  labelMat.emissiveTexture = tex
  labelMat.useAlphaFromDiffuseTexture = true
  labelMat.backFaceCulling = false
  label.material = labelMat
  label.position.set(x, 3.16 * scale, z - 0.3 * scale)
  label.billboardMode = Mesh.BILLBOARDMODE_ALL

  return {
    allMeshes: [
      floorPad,
      choicePad,
      threshold,
      overheadBeam,
      backPlate,
      panel,
      leftFrame,
      rightFrame,
      topFrame,
      leftAnchor,
      rightAnchor,
      leftGlow,
      rightGlow,
      ring,
      arrowLeft,
      arrowRight,
      labelBackplate,
      label,
    ],
    animatedMeshes: [choicePad, leftGlow, rightGlow, ring, arrowLeft, arrowRight],
  }
}
