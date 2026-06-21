export type ResultStats = {
  readonly monstersKilled: number
  readonly soldiersLeft: number
}

export class ResultScreen {
  private readonly el: HTMLDivElement
  private readonly title: HTMLDivElement
  private readonly stats: HTMLDivElement
  private readonly retry: HTMLButtonElement
  onRetry?: () => void

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "result-screen"
    this.el.innerHTML = `
      <div class="result-inner">
        <div class="result-title" data-role="title">VICTORY</div>
        <div class="result-stats" data-role="stats"></div>
        <button class="retry-btn" type="button">RETRY</button>
      </div>
    `
    root.appendChild(this.el)
    this.title = this.findDiv("title")
    this.stats = this.findDiv("stats")
    const retry = this.el.querySelector(".retry-btn")
    if (!(retry instanceof HTMLButtonElement)) {
      throw new Error("Retry button missing")
    }
    this.retry = retry
    this.retry.addEventListener("click", () => this.onRetry?.())
    this.hide()
  }

  show(victory: boolean, stats: ResultStats): void {
    this.title.textContent = victory ? "VICTORY" : "DEFEAT"
    this.title.dataset["state"] = victory ? "victory" : "defeat"
    this.stats.innerHTML = `
      <div><span>Monsters</span><strong>${stats.monstersKilled}</strong></div>
      <div><span>Survivors</span><strong>${stats.soldiersLeft}</strong></div>
    `
    this.el.style.display = "flex"
    this.retry.focus()
  }

  hide(): void {
    this.el.style.display = "none"
  }

  private findDiv(role: string): HTMLDivElement {
    const element = this.el.querySelector(`[data-role="${role}"]`)
    if (element instanceof HTMLDivElement) {
      return element
    }
    throw new Error(`Result element missing: ${role}`)
  }
}
