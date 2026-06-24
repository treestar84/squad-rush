import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { QualitySettings } from "./systems/QualitySystem"
import { cloneGltfVisual, type AssetManifest } from "./utils/assetLoader"

type EnvironmentDebugState = {
  readonly serviceDecks: number
  readonly gantries: number
  readonly cargoStacks: number
  readonly authoredRoadSegments: number
  readonly authoredGateFrames: number
}

type SetpieceMaterials = {
  readonly deck: StandardMaterial
  readonly support: StandardMaterial
  readonly signal: StandardMaterial
  readonly cargo: StandardMaterial
}

type SetpieceBudget = {
  readonly serviceDecks: number
  readonly cargoGroups: number
  readonly roadSegments: number
}

declare global {
  interface Window {
    __squadRushEnvironmentDebug?: EnvironmentDebugState
  }
}

export function addAuthoredEnvironmentSetpieces(scene: Scene, assets: AssetManifest | undefined, quality: QualitySettings): void {
  const materials = createSetpieceMaterials(scene)
  const budget = getSetpieceBudget(quality)
  const serviceDecks = addServiceDecks(scene, materials, budget)
  const cargoStacks = addSideCargoStacks(scene, materials, budget)
  const authoredRoadSegments = addAuthoredRoadSegments(scene, assets, budget)

  window.__squadRushEnvironmentDebug = {
    serviceDecks,
    gantries: 0,
    cargoStacks,
    authoredRoadSegments,
    authoredGateFrames: 0,
  }
}

function getSetpieceBudget(quality: QualitySettings): SetpieceBudget {
  if (quality.maxMonsters < 300) {
    return { serviceDecks: 4, cargoGroups: 3, roadSegments: 4 }
  }
  return { serviceDecks: 14, cargoGroups: 10, roadSegments: 18 }
}

function createSetpieceMaterials(scene: Scene): SetpieceMaterials {
  const deck = new StandardMaterial("serviceDeckMat", scene)
  deck.diffuseColor = new Color3(0.23, 0.28, 0.3)
  deck.emissiveColor = new Color3(0.025, 0.035, 0.04)
  deck.specularColor = new Color3(0.08, 0.1, 0.12)

  const support = new StandardMaterial("serviceSupportMat", scene)
  support.diffuseColor = new Color3(0.42, 0.45, 0.43)
  support.specularColor = new Color3(0.16, 0.18, 0.18)

  const signal = new StandardMaterial("gantrySignalMat", scene)
  signal.diffuseColor = new Color3(1, 0.62, 0.1)
  signal.emissiveColor = new Color3(0.8, 0.28, 0.02)

  const cargo = new StandardMaterial("sideCargoMat", scene)
  cargo.diffuseColor = new Color3(0.78, 0.34, 0.07)
  cargo.specularColor = new Color3(0.12, 0.07, 0.03)
  return { deck, support, signal, cargo }
}

function addServiceDecks(scene: Scene, materials: SetpieceMaterials, budget: SetpieceBudget): number {
  let count = 0
  for (let index = 0; index < budget.serviceDecks; index += 1) {
    const z = 26 + index * 36
    const side = index % 2 === 0 ? -1 : 1
    const x = side * 11.45
    const deck = MeshBuilder.CreateBox(`side_service_deck_${index}`, { width: 3.6, height: 0.22, depth: 8.4 }, scene)
    deck.material = materials.deck
    deck.position.set(x, 0.12, z)
    freezeStaticMeshTree(deck)
    count += 1

    for (const offsetZ of [-3.3, 3.3]) {
      const support = MeshBuilder.CreateBox(`service_deck_support_${index}_${offsetZ}`, { width: 0.28, height: 1.2, depth: 0.28 }, scene)
      support.material = materials.support
      support.position.set(x + side * 1.45, -0.42, z + offsetZ)
      freezeStaticMeshTree(support)

      const edgeLight = MeshBuilder.CreateBox(`service_deck_edge_light_${index}_${offsetZ}`, { width: 0.14, height: 0.08, depth: 0.86 }, scene)
      edgeLight.material = materials.signal
      edgeLight.position.set(x - side * 1.42, 0.3, z + offsetZ)
      freezeStaticMeshTree(edgeLight)
    }
  }
  return count
}

function addSideCargoStacks(scene: Scene, materials: SetpieceMaterials, budget: SetpieceBudget): number {
  let count = 0
  for (let index = 0; index < budget.cargoGroups; index += 1) {
    const side = index % 2 === 0 ? 1 : -1
    const baseZ = 44 + index * 33
    for (let stack = 0; stack < 2; stack += 1) {
      const crate = MeshBuilder.CreateBox(`authored_side_cargo_${index}_${stack}`, { width: 1.7, height: 0.75, depth: 2.2 }, scene)
      crate.material = materials.cargo
      crate.rotation.y = side * (0.08 + stack * 0.04)
      crate.position.set(side * (12.5 + stack * 0.82), 0.34 + stack * 0.34, baseZ + stack * 1.25)
      freezeStaticMeshTree(crate)
      count += 1
    }
  }
  return count
}

function addAuthoredRoadSegments(scene: Scene, assets: AssetManifest | undefined, budget: SetpieceBudget): number {
  if (assets?.roadSegmentAsset.isReal !== true) {
    return 0
  }
  for (let index = 0; index < budget.roadSegments; index += 1) {
    const z = 18 + index * 22
    const x = index % 2 === 0 ? -9.35 : 9.35
    const segment = cloneGltfVisual(assets.roadSegmentAsset, `authored_road_segment_${index}`, scene)
    segment.position.set(x, 0.16, z)
    segment.rotation.y = index % 2 === 0 ? Math.PI * 0.5 : -Math.PI * 0.5
    segment.scaling.set(1.25, 0.42, 1.25)
    freezeStaticMeshTree(segment)
  }
  return budget.roadSegments
}

function freezeStaticMeshTree(root: Mesh): void {
  root.isPickable = false
  root.freezeWorldMatrix()
  for (const child of root.getChildMeshes(false)) {
    child.isPickable = false
    child.freezeWorldMatrix()
  }
}
