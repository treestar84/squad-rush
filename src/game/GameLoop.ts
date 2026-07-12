import type { Observer, Scene } from "@babylonjs/core"

export type UpdateFn = (dt: number, totalTime: number) => void

// Keep real-time progression down to 4 FPS, but discard longer stalls instead of
// running multiple expensive simulation passes in one render frame. Catch-up
// loops turn a single GC/layout pause into a sustained spiral of slow frames.
const MAX_FRAME_DELTA_SECONDS = 0.25

export class GameLoop {
  private readonly updateFns: UpdateFn[] = []
  private totalTime = 0
  private readonly observer: Observer<Scene>
  private lastFrameTime = performance.now()

  constructor(private readonly scene: Scene) {
    this.observer = scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const dt = Math.min((now - this.lastFrameTime) / 1000, MAX_FRAME_DELTA_SECONDS)
      this.lastFrameTime = now
      if (dt <= 0) {
        return
      }
      this.totalTime += dt
      for (const fn of this.updateFns) {
        fn(dt, this.totalTime)
      }
    })
  }

  add(fn: UpdateFn): void {
    this.updateFns.push(fn)
  }

  dispose(): void {
    this.scene.onBeforeRenderObservable.remove(this.observer)
    this.updateFns.length = 0
  }
}
