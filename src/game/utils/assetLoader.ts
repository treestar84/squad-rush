import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core"
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader"
import "@babylonjs/loaders/glTF"

export type AssetManifest = {
  readonly soldier: Mesh
  readonly monsterBasic: Mesh
  readonly monsterTank: Mesh
  readonly boss: Mesh
}

function makeTemplate(scene: Scene, name: string, color: Color3, height: number, diameter: number): Mesh {
  const mesh = MeshBuilder.CreateCylinder(name, { height, diameter, tessellation: 8 }, scene)
  const mat = new StandardMaterial(`${name}Mat`, scene)
  mat.diffuseColor = color
  mat.specularColor = new Color3(0.12, 0.14, 0.16)
  mesh.material = mat
  mesh.setEnabled(false)
  return mesh
}

async function loadTemplate(
  scene: Scene,
  filename: string,
  templateName: string,
  fallback: () => Mesh,
): Promise<Mesh> {
  try {
    const container = await LoadAssetContainerAsync(`/assets/models/${filename}`, scene)
    container.addAllToScene()
    const root = new Mesh(templateName, scene)
    const importedMeshes = container.meshes.filter((mesh) => mesh instanceof Mesh)
    for (const mesh of importedMeshes) {
      if (mesh.name !== "__root__") {
        mesh.parent = root
      }
    }
    for (const transform of container.transformNodes) {
      if (transform instanceof TransformNode && transform.name !== "__root__") {
        transform.parent = root
      }
    }
    root.setEnabled(false)
    return root
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`Asset ${filename} unavailable, using procedural fallback: ${error.message}`)
    }
    return fallback()
  }
}

export async function loadGameAssets(
  scene: Scene,
  onProgress: (pct: number) => void,
): Promise<AssetManifest> {
  const soldier = await loadTemplate(scene, "soldier.glb", "template_soldier", () =>
    makeTemplate(scene, "template_soldier", new Color3(0.08, 0.47, 0.92), 1.8, 0.65),
  )
  onProgress(35)
  const monsterBasic = await loadTemplate(scene, "monster_basic.glb", "template_monster_basic", () =>
    makeTemplate(scene, "template_monster_basic", new Color3(0.84, 0.12, 0.16), 1.9, 0.9),
  )
  onProgress(60)
  const monsterTank = await loadTemplate(scene, "monster_tank.glb", "template_monster_tank", () =>
    makeTemplate(scene, "template_monster_tank", new Color3(0.42, 0.18, 0.68), 2.3, 1.2),
  )
  onProgress(82)
  const boss = await loadTemplate(scene, "boss.glb", "template_boss", () =>
    makeTemplate(scene, "template_boss", new Color3(0.48, 0.12, 0.72), 5, 3.8),
  )
  onProgress(100)
  return { soldier, monsterBasic, monsterTank, boss }
}
