import { Scene, TargetCamera, Vector3 } from "@babylonjs/core"
import { lerp } from "./utils/math"

const CAMERA_HEIGHT = 10.8
const CAMERA_BACK_OFFSET = 13.2
const CAMERA_LOOKAHEAD = 11.4
const CAMERA_TARGET_HEIGHT = 1.2
const CAMERA_FOV = 0.68
const PORTRAIT_ASPECT_THRESHOLD = 0.7
const PORTRAIT_HEIGHT_BONUS = 0.9
const PORTRAIT_BACK_BONUS = 1.25
const PORTRAIT_LOOKAHEAD_BONUS = 0.6
const PORTRAIT_FOV_BONUS = 0.02
const GATE_FOCUS_HEIGHT_DROP = 0.46
const GATE_FOCUS_BACK_PULL = 1.08
const GATE_FOCUS_LOOKAHEAD = 1.5
const GATE_FOCUS_FOV_REDUCTION = 0.045
const COMBAT_FOCUS_LOOKAHEAD = 0.86
const COMBAT_FOCUS_BACK_PULL = 0.38

export type CameraFollowTarget = {
  readonly z: number
  readonly x: number
  readonly gateFocus: number
  readonly combatFocus: number
  readonly bossFocus: number
}

export class CameraController {
  private readonly camera: TargetCamera
  private readonly target = new Vector3(0, 2, 10)
  private impulse = 0
  private impulseTime = 0

  constructor(private readonly scene: Scene) {
    this.camera = new TargetCamera("gameCamera", new Vector3(0, CAMERA_HEIGHT, -CAMERA_BACK_OFFSET), scene)
    this.camera.fov = CAMERA_FOV
    scene.activeCamera = this.camera
  }

  addImpulse(strength: number): void {
    this.impulse = Math.max(this.impulse, strength)
    this.impulseTime = 0.14
  }

  follow(focus: CameraFollowTarget, dt: number): void {
    this.impulseTime = Math.max(0, this.impulseTime - dt)
    const impulseRatio = this.impulseTime > 0 ? this.impulseTime / 0.14 : 0
    const shake = Math.sin(this.impulseTime * 95) * this.impulse * impulseRatio
    if (this.impulseTime <= 0) {
      this.impulse = 0
    }

    const aspect = this.scene.getEngine().getRenderWidth() / this.scene.getEngine().getRenderHeight()
    const portraitBlend = aspect < PORTRAIT_ASPECT_THRESHOLD ? 1 : 0
    const gateFocus = Math.max(0, Math.min(1, focus.gateFocus))
    const combatFocus = Math.max(0, Math.min(1, focus.combatFocus))
    const height = CAMERA_HEIGHT + portraitBlend * PORTRAIT_HEIGHT_BONUS - gateFocus * GATE_FOCUS_HEIGHT_DROP
    const backOffset = CAMERA_BACK_OFFSET + portraitBlend * PORTRAIT_BACK_BONUS - gateFocus * GATE_FOCUS_BACK_PULL - combatFocus * COMBAT_FOCUS_BACK_PULL
    const lookahead = CAMERA_LOOKAHEAD + portraitBlend * PORTRAIT_LOOKAHEAD_BONUS + gateFocus * GATE_FOCUS_LOOKAHEAD + combatFocus * COMBAT_FOCUS_LOOKAHEAD
    const targetFov = CAMERA_FOV + portraitBlend * PORTRAIT_FOV_BONUS - gateFocus * GATE_FOCUS_FOV_REDUCTION
    const targetHeight = CAMERA_TARGET_HEIGHT
    this.camera.fov = lerp(this.camera.fov, targetFov, dt * 4)
    this.camera.position.x = lerp(this.camera.position.x, focus.x * 0.22 + shake * 0.16, dt * 5)
    this.camera.position.y = lerp(this.camera.position.y, height + shake * 0.34, dt * 3)
    this.camera.position.z = lerp(this.camera.position.z, focus.z - backOffset - this.impulse * impulseRatio, dt * 8)
    this.target.set(focus.x * 0.16, targetHeight, focus.z + lookahead)
    this.camera.setTarget(this.target)
  }
}
