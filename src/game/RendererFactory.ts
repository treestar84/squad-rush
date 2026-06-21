import { Engine } from "@babylonjs/core"

export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  if ("gpu" in navigator) {
    console.info("[Renderer] WebGPU detected; WebGL2 selected for stable Babylon.js Engine compatibility")
  }

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    disableWebGL2Support: false,
  })
  console.info("[Renderer] WebGL2 enabled")
  return engine
}
