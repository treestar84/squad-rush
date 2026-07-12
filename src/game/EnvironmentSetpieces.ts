import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
import type { QualitySettings } from "./systems/QualitySystem"
import type { AssetManifest } from "./utils/assetLoader"

type EnvironmentDebugState = {
  readonly serviceDecks: number
  readonly gantries: number
  readonly cargoStacks: number
  readonly authoredRoadSegments: number
  readonly authoredGateFrames: number
  readonly stageLength: number
  readonly serviceDeckCoverageEndZ: number
}

type SetpieceMaterials = {
  readonly deck: StandardMaterial
  readonly support: StandardMaterial
  readonly signal: StandardMaterial
}

type SetpieceBudget = {
  readonly serviceDecks: number
}

type AddEnvironmentSetpiecesParams = {
  readonly scene: Scene
  readonly assets: AssetManifest | undefined
  readonly quality: QualitySettings
  readonly enabled: boolean
  readonly stageLength: number
}

declare global {
  interface Window {
    __squadRushEnvironmentDebug?: EnvironmentDebugState
  }
}

export function addAuthoredEnvironmentSetpieces(params: AddEnvironmentSetpiecesParams): void {
  if (!params.enabled) {
    publishEnvironmentDebug({
      serviceDecks: 0,
      gantries: 0,
      cargoStacks: 0,
      authoredRoadSegments: 0,
      authoredGateFrames: 0,
      stageLength: params.stageLength,
      serviceDeckCoverageEndZ: 0,
    })
    return
  }

  const { scene, quality } = params
  const materials = createSetpieceMaterials(scene)
  const budget = getSetpieceBudget(quality, params.stageLength)
  const serviceDecks = addServiceDecks(scene, materials, budget)

  publishEnvironmentDebug({
    serviceDecks,
    gantries: 0,
    cargoStacks: 0,
    authoredRoadSegments: 0,
    authoredGateFrames: 0,
    stageLength: params.stageLength,
    serviceDeckCoverageEndZ: getServiceDeckCoverageEndZ(serviceDecks),
  })
}

function publishEnvironmentDebug(debug: EnvironmentDebugState): void {
  window.__squadRushEnvironmentDebug = debug
}

function getSetpieceBudget(quality: QualitySettings, stageLength: number): SetpieceBudget {
  const stageDecks = Math.ceil(Math.max(0, stageLength - 26) / 36) + 1
  if (quality.maxMonsters < 300) {
    return { serviceDecks: Math.max(4, stageDecks) }
  }
  return { serviceDecks: Math.max(14, stageDecks) }
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

  return { deck, support, signal }
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

function getServiceDeckCoverageEndZ(serviceDecks: number): number {
  if (serviceDecks <= 0) {
    return 0
  }
  return 26 + (serviceDecks - 1) * 36
}

function freezeStaticMeshTree(root: Mesh): void {
  root.isPickable = false
  root.freezeWorldMatrix()
  for (const child of root.getChildMeshes(false)) {
    child.isPickable = false
    child.freezeWorldMatrix()
  }
}
