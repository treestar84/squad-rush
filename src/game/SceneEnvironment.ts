import {
  Color3,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { QualitySettings } from "./systems/QualitySystem"

let graphicsPolicyApplied = false

export function setupEnvironment(scene: Scene, quality: QualitySettings): void {
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 500, segments: 12 }, scene)
  const skyMat = new StandardMaterial("skyMat", scene)
  skyMat.emissiveColor = new Color3(0.53, 0.81, 0.98)
  skyMat.disableLighting = true
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

  for (let index = 0; index < 24; index += 1) {
    const z = index * 10
    const road = MeshBuilder.CreateBox(`road_${index}`, { width: 14, height: 0.18, depth: 10 }, scene)
    road.material = roadMat
    road.position.set(0, -0.09, z)

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
    }
  }

  applyGraphicsPolicy(scene, quality)
}

export function applyGraphicsPolicy(scene: Scene, quality: QualitySettings): void {
  if (!quality.postProcessEnabled || graphicsPolicyApplied) {
    return
  }
  graphicsPolicyApplied = true
  const pipeline = new DefaultRenderingPipeline("renderPipeline", true, scene, scene.cameras)
  pipeline.bloomEnabled = true
  pipeline.bloomWeight = 0.5
  pipeline.bloomThreshold = 0.6
  pipeline.bloomScale = 0.5
  pipeline.sharpenEnabled = true
  pipeline.sharpen.edgeAmount = 0.18
  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.toneMappingEnabled = true
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  pipeline.imageProcessing.exposure = 1.08
  pipeline.imageProcessing.contrast = 1.16
}
