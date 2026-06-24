import { gsap } from "gsap"
import { prefersReducedMotion } from "./motionPreference"

export class StartScreen {
  private readonly el: HTMLDivElement
  private readonly startButton: HTMLButtonElement
  private pointerDownX = 0
  private pointerDownY = 0
  private pointerDragged = false
  private pointerTracking = false
  private startPressArmed = false
  private startTriggered = false
  private readonly handleStartPointerMove = (event: PointerEvent): void => {
    if (!this.pointerTracking) {
      return
    }
    const dx = event.clientX - this.pointerDownX
    const dy = event.clientY - this.pointerDownY
    this.pointerDragged = this.pointerDragged || Math.hypot(dx, dy) > 10
  }
  private readonly handleStartPointerUp = (): void => {
    this.pointerTracking = false
  }
  private readonly handleStartMouseMove = (event: MouseEvent): void => {
    if (!this.pointerTracking) {
      return
    }
    const dx = event.clientX - this.pointerDownX
    const dy = event.clientY - this.pointerDownY
    this.pointerDragged = this.pointerDragged || Math.hypot(dx, dy) > 10
  }
  onStart?: () => void

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "start-screen"
    this.el.innerHTML = `
      <div class="start-inner">
        <div class="game-kicker">TACTICAL RUNNER</div>
        <h1 class="game-title">바로 Go 스쿼드</h1>
        <p class="game-subtitle">Survive the lane. Grow the squad. Break the titan.</p>
        <div class="mission-strip" aria-label="Run briefing">
          <div><span>START</span><strong>1</strong><small>SOLDIER</small></div>
          <div><span>RUN</span><strong>54s</strong><small>SLICE</small></div>
          <div><span>THREAT</span><strong>460+</strong><small>HOSTILES</small></div>
        </div>
        <button class="tap-to-start" type="button">TAP TO START</button>
        <div class="controls-hint">
          <span>Mouse drag</span>
          <span>Touch drag</span>
          <span>A/D keys</span>
        </div>
      </div>
    `
    root.appendChild(this.el)
    const button = this.el.querySelector(".tap-to-start")
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Start screen button missing")
    }
    this.startButton = button
    this.startButton.addEventListener("pointerdown", (event) => {
      this.pointerDownX = event.clientX
      this.pointerDownY = event.clientY
      this.pointerDragged = false
      this.pointerTracking = true
      this.startPressArmed = true
    })
    this.startButton.addEventListener("pointerup", (event) => {
      this.pointerTracking = false
      if (!this.startPressArmed) {
        return
      }
      event.preventDefault()
      this.startPressArmed = false
      if (this.pointerDragged) {
        this.pointerDragged = false
        return
      }
      this.triggerStart()
    })
    this.startButton.addEventListener("mousedown", (event) => {
      this.pointerDownX = event.clientX
      this.pointerDownY = event.clientY
      this.pointerDragged = false
      this.pointerTracking = true
      this.startPressArmed = true
    })
    window.addEventListener("pointermove", this.handleStartPointerMove, { passive: true })
    window.addEventListener("pointerup", this.handleStartPointerUp, { passive: true })
    window.addEventListener("mousemove", this.handleStartMouseMove, { passive: true })
    window.addEventListener("mouseup", this.handleStartPointerUp, { passive: true })
    this.startButton.addEventListener("click", (event) => {
      if (this.startTriggered) {
        event.preventDefault()
        return
      }
      if (this.startPressArmed && this.pointerDragged) {
        event.preventDefault()
        this.pointerDragged = false
        this.startPressArmed = false
        return
      }
      this.startPressArmed = false
      this.triggerStart()
    })
  }

  private triggerStart(): void {
    if (this.startTriggered) {
      return
    }
    this.startTriggered = true
    this.onStart?.()
  }

  show(): void {
    this.el.style.display = "flex"
    this.el.style.opacity = "1"
    const title = this.el.querySelector(".game-title")
    const subtitle = this.el.querySelector(".game-subtitle")
    const missionStrip = this.el.querySelector(".mission-strip")
    const button = this.el.querySelector(".tap-to-start")
    const animatedElements = [title, subtitle, missionStrip, button]
    gsap.killTweensOf([this.el, ...animatedElements])
    if (prefersReducedMotion()) {
      gsap.set(animatedElements, { clearProps: "transform,opacity" })
      this.startButton.focus()
      return
    }
    gsap.fromTo(title, { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" })
    gsap.fromTo(subtitle, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.4, ease: "power2.out" })
    gsap.fromTo(missionStrip, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.58, ease: "power2.out" })
    gsap.fromTo(button, { scale: 0.9, opacity: 1 }, { scale: 1, opacity: 1, duration: 0.38, delay: 0.18, ease: "back.out(1.7)" })
    this.startButton.focus()
  }

  hide(options: { readonly immediate?: boolean } = {}): void {
    gsap.killTweensOf(this.el)
    if (options.immediate === true || prefersReducedMotion()) {
      this.el.style.display = "none"
      this.el.style.opacity = "1"
      return
    }

    gsap.to(this.el, {
      opacity: 0,
      duration: 0.24,
      ease: "power1.out",
      onComplete: () => {
        this.el.style.display = "none"
        this.el.style.opacity = "1"
      },
    })
  }
}
