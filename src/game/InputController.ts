export class InputController {
  private deltaX = 0
  private lastPointerX = 0
  private isDown = false
  private readonly keysHeld = new Set<string>()
  private readonly sensitivity = 0.06

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", this.onDown)
    canvas.addEventListener("pointermove", this.onMove)
    canvas.addEventListener("pointerup", this.onUp)
    canvas.addEventListener("pointercancel", this.onUp)
    window.addEventListener("keydown", this.onKey)
    window.addEventListener("keyup", this.onKeyUp)
  }

  private readonly onDown = (event: PointerEvent): void => {
    this.isDown = true
    this.lastPointerX = event.clientX
    this.canvas.setPointerCapture(event.pointerId)
  }

  private readonly onMove = (event: PointerEvent): void => {
    if (!this.isDown) {
      return
    }
    this.deltaX = (event.clientX - this.lastPointerX) * this.sensitivity
    this.lastPointerX = event.clientX
  }

  private readonly onUp = (): void => {
    this.isDown = false
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    this.keysHeld.add(event.key)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keysHeld.delete(event.key)
  }

  getDeltaX(): number {
    let movement = this.deltaX
    if (this.keysHeld.has("ArrowLeft") || this.keysHeld.has("a")) {
      movement -= 0.15
    }
    if (this.keysHeld.has("ArrowRight") || this.keysHeld.has("d")) {
      movement += 0.15
    }
    this.deltaX *= 0.7
    return movement
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onDown)
    this.canvas.removeEventListener("pointermove", this.onMove)
    this.canvas.removeEventListener("pointerup", this.onUp)
    this.canvas.removeEventListener("pointercancel", this.onUp)
    window.removeEventListener("keydown", this.onKey)
    window.removeEventListener("keyup", this.onKeyUp)
  }
}
