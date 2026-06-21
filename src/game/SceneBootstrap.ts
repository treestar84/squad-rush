import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  Vector3,
} from "@babylonjs/core"

export function initScene(engine: Engine): Scene {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.53, 0.81, 0.98, 1)
  scene.fogMode = Scene.FOGMODE_LINEAR
  scene.fogStart = 85
  scene.fogEnd = 170
  scene.fogColor = new Color3(0.53, 0.81, 0.98)

  const camera = new ArcRotateCamera("bootCamera", -Math.PI / 2, Math.PI / 3.5, 30, new Vector3(0, 0, 10), scene)
  camera.attachControl(false)

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.72
  hemi.diffuse = new Color3(0.9, 0.95, 1)

  const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene)
  sun.intensity = 1.15
  sun.diffuse = new Color3(1, 0.95, 0.78)

  return scene
}
