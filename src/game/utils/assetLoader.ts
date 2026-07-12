import {
  AnimationGroup,
  AssetContainer,
  Mesh,
  Scene,
  TransformNode,
} from "@babylonjs/core"
import { LoadAssetContainerAsync, type LoadAssetContainerOptions } from "@babylonjs/core/Loading/sceneLoader"
import "@babylonjs/loaders/glTF"

export type GltfAsset = {
  readonly root: Mesh
  readonly animGroups: readonly AnimationGroup[]
  readonly isReal: boolean
  readonly container?: AssetContainer
}

export type AssetManifest = {
  readonly soldierAsset: GltfAsset
  readonly pangyoRunnerAsset: GltfAsset
  readonly pangyoPickupAsset: GltfAsset
  readonly ghostAsset: GltfAsset
  readonly monsterDoguriAsset: GltfAsset
  readonly monsterFastAsset: GltfAsset
  readonly monsterTankAsset: GltfAsset
  readonly yetiAsset: GltfAsset
  readonly roadSegmentAsset: GltfAsset
  readonly gateFrameAsset: GltfAsset
}

export type GltfInstance = {
  readonly root: Mesh
  readonly animationGroups: readonly AnimationGroup[]
}

export type GltfCloneOptions = {
  readonly cloneMaterials?: boolean
}

type GltfLoadConfig = {
  readonly scene: Scene
  readonly filename: string
  readonly templateName: string
  readonly skipMaterials?: boolean
}

function loaderOptions(config: GltfLoadConfig): LoadAssetContainerOptions | undefined {
  if (config.skipMaterials !== true) {
    return undefined
  }
  return { pluginOptions: { gltf: { skipMaterials: true } } }
}

export async function loadGltfAsset(config: GltfLoadConfig): Promise<GltfAsset> {
  try {
    const container = await LoadAssetContainerAsync(`/assets/models/${config.filename}`, config.scene, loaderOptions(config))
    container.addAllToScene()
    const root = new Mesh(config.templateName, config.scene)

    for (const node of container.transformNodes) {
      if (node.name !== "__root__" && node.parent === null) {
        node.parent = root
      }
    }
    for (const abstractMesh of container.meshes) {
      if (abstractMesh.name !== "__root__" && abstractMesh.parent === null && abstractMesh instanceof Mesh) {
        abstractMesh.parent = root
      }
    }

    root.setEnabled(false)
    for (const child of root.getChildMeshes(false)) {
      child.setEnabled(false)
    }
    const animGroups = container.animationGroups
    for (const ag of animGroups) {
      ag.stop()
    }
    return { root, animGroups, isReal: true, container }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    console.warn(`Asset ${config.filename} unavailable, using procedural fallback: ${error.message}`)
    const emptyRoot = new Mesh(config.templateName, config.scene)
    emptyRoot.setEnabled(false)
    return { root: emptyRoot, animGroups: [], isReal: false }
  }
}

export function cloneGltfInstance(asset: GltfAsset, name: string, scene: Scene, options: GltfCloneOptions = {}): GltfInstance {
  if (asset.container !== undefined) {
    const clonedRoot = new Mesh(name, scene)
    const entries = asset.container.instantiateModelsToScene(
      (sourceName) => `${name}_${sourceName}`,
      options.cloneMaterials === true,
    )
    for (const node of entries.rootNodes) {
      if (node instanceof Mesh || node instanceof TransformNode) {
        node.parent = clonedRoot
      }
    }
    for (const child of clonedRoot.getChildMeshes(false)) {
      child.isPickable = false
      child.setEnabled(true)
    }
    return { root: clonedRoot, animationGroups: entries.animationGroups }
  }

  const clonedRoot = asset.root.clone(name, null, false)
  if (clonedRoot !== null) {
    clonedRoot.name = name
    clonedRoot.isPickable = false
    clonedRoot.setEnabled(true)
    for (const child of clonedRoot.getChildMeshes(false)) {
      child.isPickable = false
      child.setEnabled(true)
    }
    return { root: clonedRoot, animationGroups: [] }
  }

  return { root: new Mesh(name, scene), animationGroups: [] }
}

export function cloneGltfVisual(asset: GltfAsset, name: string, scene: Scene, options: GltfCloneOptions = {}): Mesh {
  return cloneGltfInstance(asset, name, scene, options).root
}

export function getAnimGroup(groups: AnimationGroup[], name: string): AnimationGroup | undefined {
  return groups.find((ag) => ag.name.startsWith(name))
}

export async function loadGameAssets(
  scene: Scene,
  onProgress: (pct: number) => void,
): Promise<AssetManifest> {
  const soldierAsset = loadGltfAsset({ scene, filename: "soldier.gltf", templateName: "template_soldier" })
    .then((asset) => {
      onProgress(35)
      return asset
    })
  const pangyoRunnerAsset = loadGltfAsset({ scene, filename: "squad/pangyo_runner.glb", templateName: "template_pangyo_runner" })
    .then((asset) => {
      onProgress(42)
      return asset
    })
  const pangyoPickupAsset = loadGltfAsset({ scene, filename: "pickups/pangyo_man.glb", templateName: "template_pangyo_pickup" })
    .then((asset) => {
      onProgress(48)
      return asset
    })
  const ghostAsset = loadGltfAsset({ scene, filename: "ghost.gltf", templateName: "template_ghost" })
    .then((asset) => {
      onProgress(58)
      return asset
    })
  const monsterFastAsset = loadGltfAsset({ scene, filename: "monster_basic.glb", templateName: "template_monster_fast" })
    .then((asset) => {
      onProgress(68)
      return asset
    })
  const monsterDoguriAsset = loadGltfAsset({ scene, filename: "monster_doguri.glb", templateName: "template_monster_doguri" })
    .then((asset) => {
      onProgress(72)
      return asset
    })
  const monsterTankAsset = loadGltfAsset({ scene, filename: "monster_tank.glb", templateName: "template_monster_tank" })
    .then((asset) => {
      onProgress(76)
      return asset
    })
  const yetiAsset = loadGltfAsset({ scene, filename: "yeti.gltf", templateName: "template_yeti" })
    .then((asset) => {
      onProgress(82)
      return asset
    })
  const roadSegmentAsset = loadGltfAsset({
    scene,
    filename: "environment/road_segment.glb",
    templateName: "template_road_segment",
    skipMaterials: true,
  }).then((asset) => {
    onProgress(90)
    return asset
  })
  const gateFrameAsset = loadGltfAsset({
    scene,
    filename: "environment/gate_frame.glb",
    templateName: "template_gate_frame",
    skipMaterials: true,
  }).then((asset) => {
    onProgress(96)
    return asset
  })
  const [
    loadedSoldierAsset,
    loadedPangyoRunnerAsset,
    loadedPangyoPickupAsset,
    loadedGhostAsset,
    loadedMonsterDoguriAsset,
    loadedMonsterFastAsset,
    loadedMonsterTankAsset,
    loadedYetiAsset,
    loadedRoadSegmentAsset,
    loadedGateFrameAsset,
  ] = await Promise.all([
    soldierAsset,
    pangyoRunnerAsset,
    pangyoPickupAsset,
    ghostAsset,
    monsterDoguriAsset,
    monsterFastAsset,
    monsterTankAsset,
    yetiAsset,
    roadSegmentAsset,
    gateFrameAsset,
  ])
  onProgress(100)
  return {
    soldierAsset: loadedSoldierAsset,
    pangyoRunnerAsset: loadedPangyoRunnerAsset,
    pangyoPickupAsset: loadedPangyoPickupAsset,
    ghostAsset: loadedGhostAsset,
    monsterDoguriAsset: loadedMonsterDoguriAsset,
    monsterFastAsset: loadedMonsterFastAsset,
    monsterTankAsset: loadedMonsterTankAsset,
    yetiAsset: loadedYetiAsset,
    roadSegmentAsset: loadedRoadSegmentAsset,
    gateFrameAsset: loadedGateFrameAsset,
  }
}
