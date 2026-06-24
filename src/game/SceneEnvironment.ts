import {
  Color3,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import { LEVEL_1 } from "./data/levelData"
import type { QualitySettings } from "./systems/QualitySystem"
import { ROAD_FORWARD_VIEW_BUFFER, ROAD_SEGMENT_DEPTH } from "./WorldGeometry"

let graphicsPolicyApplied = false

const HIGH_QUALITY_BLOOM_WEIGHT = 0.76
const HIGH_QUALITY_BLOOM_THRESHOLD = 0.42
const HIGH_QUALITY_BLOOM_SCALE = 0.56
const HIGH_QUALITY_SHARPEN_EDGE_AMOUNT = 0.16
const HIGH_QUALITY_EXPOSURE = 1.13
const HIGH_QUALITY_CONTRAST = 1.21

declare global {
  interface Window {
    __squadRushGraphicsDebug?: {
      readonly bloomEnabled: boolean
      readonly bloomWeight: number
      readonly bloomThreshold: number
      readonly bloomScale: number
      readonly exposure: number
      readonly contrast: number
    }
  }
}

export function setupEnvironment(scene: Scene, quality: QualitySettings): void {
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 500, segments: 12 }, scene)
  sky.infiniteDistance = true
  sky.isPickable = false
  const skyMat = new StandardMaterial("skyMat", scene)
  skyMat.emissiveColor = new Color3(0.53, 0.81, 0.98)
  skyMat.disableLighting = true
  skyMat.disableDepthWrite = true
  skyMat.backFaceCulling = false
  sky.material = skyMat

  const roadMat = new StandardMaterial("roadMat", scene)
  roadMat.diffuseColor = new Color3(0.23, 0.27, 0.32)
  roadMat.specularColor = new Color3(0.05, 0.06, 0.08)

  const railMat = new StandardMaterial("railMat", scene)
  railMat.diffuseColor = new Color3(0.85, 0.72, 0.42)
  railMat.emissiveColor = new Color3(0.18, 0.12, 0.02)

  const lineMat = new StandardMaterial("laneLineMat", scene)
  lineMat.diffuseColor = new Color3(0.92, 0.96, 1)
  lineMat.emissiveColor = new Color3(0.12, 0.2, 0.28)

  const beaconMat = new StandardMaterial("beaconMat", scene)
  beaconMat.diffuseColor = new Color3(1, 0.66, 0.12)
  beaconMat.emissiveColor = new Color3(0.9, 0.32, 0.04)

  const waterMat = new StandardMaterial("waterMat", scene)
  waterMat.diffuseColor = new Color3(0.02, 0.37, 0.48)
  waterMat.emissiveColor = new Color3(0.01, 0.08, 0.1)
  waterMat.specularColor = new Color3(0.16, 0.58, 0.72)

  const sideWallMat = new StandardMaterial("sideWallMat", scene)
  sideWallMat.diffuseColor = new Color3(0.54, 0.58, 0.6)
  sideWallMat.specularColor = new Color3(0.22, 0.24, 0.26)

  const warningMat = new StandardMaterial("warningStripMat", scene)
  warningMat.diffuseColor = new Color3(1, 0.68, 0.12)
  warningMat.emissiveColor = new Color3(0.42, 0.18, 0.02)

  const containerMat = new StandardMaterial("containerMat", scene)
  containerMat.diffuseColor = new Color3(0.78, 0.39, 0.08)
  containerMat.specularColor = new Color3(0.12, 0.08, 0.04)

  const seamMat = new StandardMaterial("roadPanelSeamMat", scene)
  seamMat.diffuseColor = new Color3(0.08, 0.1, 0.12)
  seamMat.specularColor = new Color3(0.01, 0.01, 0.01)

  const wearMat = new StandardMaterial("roadWearMat", scene)
  wearMat.diffuseColor = new Color3(0.14, 0.16, 0.18)
  wearMat.specularColor = new Color3(0.02, 0.02, 0.02)

  const capMat = new StandardMaterial("barrierCapMat", scene)
  capMat.diffuseColor = new Color3(0.72, 0.74, 0.73)
  capMat.specularColor = new Color3(0.2, 0.22, 0.24)

  const environmentDepth = LEVEL_1.totalLength + ROAD_FORWARD_VIEW_BUFFER
  const roadSegmentCount = Math.ceil(environmentDepth / ROAD_SEGMENT_DEPTH)
  for (let index = 0; index <= roadSegmentCount; index += 1) {
    const z = index * ROAD_SEGMENT_DEPTH
    const road = MeshBuilder.CreateBox(`road_${index}`, { width: 14, height: 0.18, depth: ROAD_SEGMENT_DEPTH }, scene)
    road.material = roadMat
    road.position.set(0, -0.09, z)

    const roadPanelSeam = MeshBuilder.CreateBox(`road_panel_seam_${index}`, { width: 13.6, height: 0.035, depth: 0.08 }, scene)
    roadPanelSeam.material = seamMat
    roadPanelSeam.position.set(0, 0.035, z + 4.92)

    const roadWearPatch = MeshBuilder.CreateBox(`road_wear_patch_${index}`, { width: 2.1, height: 0.032, depth: 2.9 }, scene)
    roadWearPatch.material = wearMat
    roadWearPatch.rotation.y = index % 2 === 0 ? 0.04 : -0.05
    roadWearPatch.position.set(index % 2 === 0 ? -2.6 : 2.7, 0.038, z - 0.7)

    const leftRail = MeshBuilder.CreateBox(`rail_l_${index}`, { width: 0.22, height: 0.28, depth: 9 }, scene)
    leftRail.material = railMat
    leftRail.position.set(-7.2, 0.12, z)

    const rightRail = MeshBuilder.CreateBox(`rail_r_${index}`, { width: 0.22, height: 0.28, depth: 9 }, scene)
    rightRail.material = railMat
    rightRail.position.set(7.2, 0.12, z)

    const laneLine = MeshBuilder.CreateBox(`lane_line_${index}`, { width: 0.14, height: 0.03, depth: 3.2 }, scene)
    laneLine.material = lineMat
    laneLine.position.set(0, 0.03, z - 1.8)

    for (const x of [-6.7, 6.7]) {
      const beacon = MeshBuilder.CreateBox(`beacon_${index}_${x}`, { width: 0.28, height: 0.18, depth: 0.72 }, scene)
      beacon.material = beaconMat
      beacon.position.set(x, 0.34, z + 3.2)

      const laneReflector = MeshBuilder.CreateBox(`lane_reflector_${index}_${x}`, { width: 0.18, height: 0.06, depth: 0.42 }, scene)
      laneReflector.material = beaconMat
      laneReflector.position.set(x * 0.9, 0.075, z - 3.2)
    }

    for (const x of [-8.2, 8.2]) {
      const sideWall = MeshBuilder.CreateBox(`side_wall_${index}_${x}`, { width: 0.72, height: 0.7, depth: 9.6 }, scene)
      sideWall.material = sideWallMat
      sideWall.position.set(x, 0.26, z)

      const barrierCap = MeshBuilder.CreateBox(`barrier_cap_${index}_${x}`, { width: 0.9, height: 0.16, depth: 9.8 }, scene)
      barrierCap.material = capMat
      barrierCap.position.set(x, 0.69, z)

      const warningStrip = MeshBuilder.CreateBox(`warning_strip_${index}_${x}`, { width: 0.12, height: 0.04, depth: 2.4 }, scene)
      warningStrip.material = warningMat
      warningStrip.position.set(x * 0.86, 0.11, z + 1.2)
    }

    if (index % 5 === 2) {
      const containerX = index % 10 === 2 ? -10.2 : 10.2
      const container = MeshBuilder.CreateBox(`container_${index}`, { width: 2.6, height: 1.55, depth: 4.8 }, scene)
      container.material = containerMat
      container.rotation.y = containerX < 0 ? 0.1 : -0.1
      container.position.set(containerX, 0.58, z + 0.4)
    }
  }

  for (const x of [-18, 18]) {
    const water = MeshBuilder.CreateBox(`water_plane_${x}`, { width: 18, height: 0.05, depth: environmentDepth + 80 }, scene)
    water.material = waterMat
    water.position.set(x, -0.26, environmentDepth * 0.5 - 20)
  }

  freezeEnvironmentMeshes(scene)
  applyGraphicsPolicy(scene, quality)
}

function freezeEnvironmentMeshes(scene: Scene): void {
  const staticPrefixes = [
    "road_",
    "road_panel_seam_",
    "road_wear_patch_",
    "rail_",
    "lane_line_",
    "lane_reflector_",
    "beacon_",
    "side_wall_",
    "barrier_cap_",
    "warning_strip_",
    "container_",
    "water_plane_",
  ]

  for (const mesh of scene.meshes) {
    if (staticPrefixes.some((prefix) => mesh.name.startsWith(prefix))) {
      mesh.isPickable = false
      mesh.freezeWorldMatrix()
    }
  }
}

export function applyGraphicsPolicy(scene: Scene, quality: QualitySettings): void {
  if (!quality.postProcessEnabled || graphicsPolicyApplied) {
    return
  }
  graphicsPolicyApplied = true
  const pipeline = new DefaultRenderingPipeline("renderPipeline", true, scene, scene.cameras)
  pipeline.bloomEnabled = true
  pipeline.bloomWeight = HIGH_QUALITY_BLOOM_WEIGHT
  pipeline.bloomThreshold = HIGH_QUALITY_BLOOM_THRESHOLD
  pipeline.bloomScale = HIGH_QUALITY_BLOOM_SCALE
  pipeline.sharpenEnabled = true
  pipeline.sharpen.edgeAmount = HIGH_QUALITY_SHARPEN_EDGE_AMOUNT
  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.toneMappingEnabled = true
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  pipeline.imageProcessing.exposure = HIGH_QUALITY_EXPOSURE
  pipeline.imageProcessing.contrast = HIGH_QUALITY_CONTRAST
  window.__squadRushGraphicsDebug = {
    bloomEnabled: pipeline.bloomEnabled,
    bloomWeight: pipeline.bloomWeight,
    bloomThreshold: pipeline.bloomThreshold,
    bloomScale: pipeline.bloomScale,
    exposure: pipeline.imageProcessing.exposure,
    contrast: pipeline.imageProcessing.contrast,
  }
}
