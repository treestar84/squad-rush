import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"
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

export async function loadGameAssets(
  scene: Scene,
  onProgress: (pct: number) => void,
): Promise<AssetManifest> {
  onProgress(20)
  await Promise.resolve()
  const soldier = makeTemplate(scene, "template_soldier", new Color3(0.08, 0.47, 0.92), 1.8, 0.65)
  onProgress(45)
  const monsterBasic = makeTemplate(scene, "template_monster_basic", new Color3(0.84, 0.12, 0.16), 1.9, 0.9)
  onProgress(70)
  const monsterTank = makeTemplate(scene, "template_monster_tank", new Color3(0.42, 0.18, 0.68), 2.3, 1.2)
  onProgress(90)
  const boss = makeTemplate(scene, "template_boss", new Color3(0.48, 0.12, 0.72), 5, 3.8)
  onProgress(100)
  return { soldier, monsterBasic, monsterTank, boss }
}
