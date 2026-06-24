import { gsap } from "gsap"

export class PauseControl {
  private readonly el: HTMLDivElement
  private readonly button: HTMLButtonElement
  private readonly panel: HTMLElement
  onToggle?: () => void

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "pause-control"
    this.el.innerHTML = `
      <button class="pause-button" data-role="pause" type="button" aria-pressed="false">PAUSE</button>
      <div class="pause-panel" data-role="pause-panel" hidden>
        <span>PAUSED</span>
        <strong>RUN ON HOLD</strong>
        <button class="pause-resume-button" type="button">RESUME</button>
      </div>
    `
    root.appendChild(this.el)
    this.button = this.mustFindButton("[data-role='pause']")
    this.panel = this.mustFindPanel()
    this.hide()
    this.button.addEventListener("click", () => this.onToggle?.())
    this.mustFindButton(".pause-resume-button").addEventListener("click", () => this.onToggle?.())
  }

  setPaused(paused: boolean): void {
    this.button.textContent = paused ? "RESUME" : "PAUSE"
    this.button.setAttribute("aria-pressed", String(paused))
    this.el.classList.toggle("pause-control--paused", paused)
    this.panel.toggleAttribute("hidden", !paused)
    gsap.killTweensOf(this.panel)
    if (paused) {
      gsap.fromTo(this.panel, { opacity: 0, y: 10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.18, ease: "power2.out" })
    }
  }

  hide(): void {
    this.el.style.display = "none"
  }

  show(): void {
    this.el.style.display = "block"
  }

  private mustFindButton(selector: string): HTMLButtonElement {
    const button = this.el.querySelector(selector)
    if (button instanceof HTMLButtonElement) {
      return button
    }
    throw new Error(`Pause button missing: ${selector}`)
  }

  private mustFindPanel(): HTMLElement {
    const panel = this.el.querySelector("[data-role='pause-panel']")
    if (panel instanceof HTMLElement) {
      return panel
    }
    throw new Error("Pause panel missing")
  }
}
