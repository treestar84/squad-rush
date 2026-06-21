import { gsap } from "gsap"

export class StartScreen {
  private readonly el: HTMLDivElement
  private readonly startButton: HTMLButtonElement
  onStart?: () => void

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "start-screen"
    this.el.innerHTML = `
      <div class="start-inner">
        <div class="game-kicker">TACTICAL RUNNER</div>
        <h1 class="game-title">SQUAD RUSH</h1>
        <p class="game-subtitle">Survive the lane. Grow the squad. Break the titan.</p>
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
    this.startButton.addEventListener("click", () => this.onStart?.())
  }

  show(): void {
    this.el.style.display = "flex"
    const title = this.el.querySelector(".game-title")
    const subtitle = this.el.querySelector(".game-subtitle")
    const button = this.el.querySelector(".tap-to-start")
    gsap.fromTo(title, { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" })
    gsap.fromTo(subtitle, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.4, ease: "power2.out" })
    gsap.fromTo(button, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, delay: 0.8, ease: "back.out(1.7)" })
    this.startButton.focus()
  }

  hide(): void {
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
