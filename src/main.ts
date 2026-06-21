import "./styles/global.css"
import { App } from "./app/App"
import { createEngine } from "./game/RendererFactory"
import { initScene } from "./game/SceneBootstrap"
import { setupEnvironment } from "./game/SceneEnvironment"
import { qualitySystem } from "./game/systems/QualitySystem"
import { requireElement } from "./game/utils/assert"

async function main(): Promise<void> {
  const canvas = requireElement("game-canvas", HTMLCanvasElement)
  const uiRoot = requireElement("ui-root", HTMLElement)
  const engine = await createEngine(canvas)
  const scene = initScene(engine)
  setupEnvironment(scene, qualitySystem.settings)

  const app = new App({ engine, scene, canvas, root: uiRoot, quality: qualitySystem })
  engine.runRenderLoop(() => scene.render())
  window.addEventListener("resize", () => engine.resize())
  await app.init()
  void qualitySystem.autoDetect(engine)
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message)
    return
  }
  throw error
})
