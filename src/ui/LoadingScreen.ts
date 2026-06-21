export class LoadingScreen {
  private readonly el: HTMLDivElement
  private readonly bar: HTMLDivElement
  private readonly text: HTMLDivElement

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "loading-screen"
    this.el.innerHTML = `
      <div class="loading-inner">
        <div class="loading-logo">SQUAD RUSH</div>
        <div class="loading-bar-wrap"><div class="loading-bar"></div></div>
        <div class="loading-text">Loading 0%</div>
      </div>
    `
    root.appendChild(this.el)
    const bar = this.el.querySelector(".loading-bar")
    const text = this.el.querySelector(".loading-text")
    if (!(bar instanceof HTMLDivElement) || !(text instanceof HTMLDivElement)) {
      throw new Error("Loading screen markup failed")
    }
    this.bar = bar
    this.text = text
  }

  setProgress(pct: number): void {
    this.bar.style.width = `${pct}%`
    this.text.textContent = `Loading ${pct}%`
  }

  show(): void {
    this.el.style.display = "flex"
  }

  hide(): void {
    this.el.style.display = "none"
  }
}
