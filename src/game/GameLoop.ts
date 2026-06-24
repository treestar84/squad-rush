import type { Observer, Scene } from "@babylonjs/core"

export type UpdateFn = (dt: number, totalTime: number) => void

const MAX_FRAME_DELTA_SECONDS = 0.2
const MAX_FRAME_CATCHUP_SECONDS = 0.5
const MIN_FRAME_STEP_SECONDS = 0.001

export class GameLoop {
  private readonly updateFns: UpdateFn[] = []
  private totalTime = 0
  private readonly observer: Observer<Scene>
  private lastFrameTime = performance.now()

  constructor(private readonly scene: Scene) {
    this.observer = scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      let remainingTime = Math.min((now - this.lastFrameTime) / 1000, MAX_FRAME_CATCHUP_SECONDS)
      this.lastFrameTime = now
      while (remainingTime > MIN_FRAME_STEP_SECONDS) {
        const dt = Math.min(remainingTime, MAX_FRAME_DELTA_SECONDS)
        remainingTime -= dt
        this.totalTime += dt
        for (const fn of this.updateFns) {
          fn(dt, this.totalTime)
        }
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
