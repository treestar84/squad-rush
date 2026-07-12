import { Engine, WebGPUEngine, type AbstractEngine } from "@babylonjs/core"

export type RendererMode = "webgl2" | "webgpu"

function readRendererMode(): RendererMode {
  const params = new URLSearchParams(window.location.search)
  return params.get("renderer") === "webgpu" ? "webgpu" : "webgl2"
}

function createWebGL2Engine(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    disableWebGL2Support: false,
  })
}

async function createWebGPUEngine(canvas: HTMLCanvasElement): Promise<WebGPUEngine | null> {
  if (!("gpu" in navigator)) {
    return null
  }
  try {
    const engine = await WebGPUEngine.CreateAsync(canvas, {
      adaptToDeviceRatio: true,
      antialias: true,
      stencil: false,
      powerPreference: "high-performance",
    })
    return engine
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.warn(`[Renderer] WebGPU initialization failed; falling back to WebGL2: ${error.message}`)
      return null
    }
    throw error
  }
}

export async function createEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
  if (readRendererMode() === "webgpu") {
    const webgpuEngine = await createWebGPUEngine(canvas)
    if (webgpuEngine !== null) {
      return webgpuEngine
    }
  }

  const engine = createWebGL2Engine(canvas)
  return engine
}
