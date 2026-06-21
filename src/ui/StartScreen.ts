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
    this.startButton.focus()
  }

  hide(): void {
    this.el.style.display = "none"
  }
}
