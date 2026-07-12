export class InputController {
  private deltaX = 0
  private lastPointerX = 0
  private isDown = false
  private readonly keysHeld = new Set<string>()
  private pendingCareerChoice: "military" | "overtime" | "fired" | null = null
  private readonly sensitivity = 0.035

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", this.onDown, { passive: false })
    canvas.addEventListener("pointermove", this.onMove, { passive: false })
    canvas.addEventListener("pointerup", this.onUp, { passive: false })
    canvas.addEventListener("pointercancel", this.onUp, { passive: false })
    canvas.addEventListener("wheel", this.onWheel, { passive: false })
    window.addEventListener("keydown", this.onKey)
    window.addEventListener("keyup", this.onKeyUp)
  }

  private readonly onDown = (event: PointerEvent): void => {
    event.preventDefault()
    this.isDown = true
    this.lastPointerX = event.clientX
    this.canvas.setPointerCapture(event.pointerId)
  }

  private readonly onMove = (event: PointerEvent): void => {
    if (!this.isDown) {
      return
    }
    event.preventDefault()
    this.deltaX = (event.clientX - this.lastPointerX) * this.sensitivity
    this.lastPointerX = event.clientX
  }

  private readonly onUp = (event: PointerEvent): void => {
    event.preventDefault()
    this.isDown = false
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    const careerChoice = this.normalizeCareerChoice(event)
    if (careerChoice !== null) {
      event.preventDefault()
      if (!event.repeat) {
        this.pendingCareerChoice = careerChoice
      }
      return
    }

    const key = this.normalizeKey(event)
    if (key === null) {
      return
    }
    event.preventDefault()
    this.keysHeld.add(key)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.normalizeCareerChoice(event) !== null) {
      event.preventDefault()
      return
    }

    const key = this.normalizeKey(event)
    if (key !== null) {
      event.preventDefault()
      this.keysHeld.delete(key)
    }
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
  }

  getDeltaX(): number {
    let movement = this.deltaX
    if (this.keysHeld.has("left")) {
      movement -= 0.12
    }
    if (this.keysHeld.has("right")) {
      movement += 0.12
    }
    this.deltaX *= 0.7
    return movement
  }

  consumeCareerChoice(): "military" | "overtime" | "fired" | null {
    const choice = this.pendingCareerChoice
    this.pendingCareerChoice = null
    return choice
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onDown)
    this.canvas.removeEventListener("pointermove", this.onMove)
    this.canvas.removeEventListener("pointerup", this.onUp)
    this.canvas.removeEventListener("pointercancel", this.onUp)
    this.canvas.removeEventListener("wheel", this.onWheel)
    window.removeEventListener("keydown", this.onKey)
    window.removeEventListener("keyup", this.onKeyUp)
  }

  private normalizeKey(event: KeyboardEvent): "left" | "right" | null {
    if (event.key === "ArrowLeft" || event.code === "KeyA") {
      return "left"
    }
    if (event.key === "ArrowRight" || event.code === "KeyD") {
      return "right"
    }
    return null
  }

  private normalizeCareerChoice(event: KeyboardEvent): "military" | "overtime" | "fired" | null {
    if (event.code === "KeyJ") {
      return "military"
    }
    if (event.code === "KeyK") {
      return "overtime"
    }
    if (event.code === "KeyL") {
      return "fired"
    }
    return null
  }
}
