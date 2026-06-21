import { Scene, TargetCamera, Vector3 } from "@babylonjs/core"
import { lerp } from "./utils/math"

export class CameraController {
  private readonly camera: TargetCamera
  private readonly target = new Vector3(0, 2, 10)

  constructor(scene: Scene) {
    this.camera = new TargetCamera("gameCamera", new Vector3(0, 13.5, -17), scene)
    this.camera.fov = 0.76
    scene.activeCamera = this.camera
  }

  follow(targetZ: number, squadX: number, dt: number): void {
    this.camera.position.x = lerp(this.camera.position.x, squadX * 0.22, dt * 5)
    this.camera.position.y = lerp(this.camera.position.y, 13.5, dt * 3)
    this.camera.position.z = lerp(this.camera.position.z, targetZ - 17, dt * 8)
    this.target.set(squadX * 0.16, 1.6, targetZ + 13)
    this.camera.setTarget(this.target)
  }
}
