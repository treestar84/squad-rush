import type { Observer, Scene } from "@babylonjs/core"

export type UpdateFn = (dt: number, totalTime: number) => void

export class GameLoop {
  private readonly updateFns: UpdateFn[] = []
  private totalTime = 0
  private readonly observer: Observer<Scene>

  constructor(private readonly scene: Scene) {
    this.observer = scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
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
