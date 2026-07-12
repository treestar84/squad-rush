export class LoadingScreen {
  private readonly el: HTMLDivElement
  private readonly bar: HTMLDivElement
  private readonly text: HTMLDivElement
  private readonly stage: HTMLDivElement

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "loading-screen"
    this.el.setAttribute("aria-live", "polite")
    this.el.innerHTML = `
      <div class="loading-inner">
        <img class="loading-logo" src="/assets/ui/start-title-logo.png" alt="바로 Go 스쿼드" width="1600" height="597" decoding="async" fetchpriority="high" />
        <p class="loading-message">판교에 포탈이 열리고 몬스터가 쏟아졌다. 국가비상사태가 선포되자 병력과 판교 직장인들이 첫 방어선을 세운다.</p>
        <div class="loading-stage" data-role="loading-stage">Preparing runway</div>
        <div class="loading-bar-wrap" role="progressbar" aria-label="Loading game assets" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="loading-bar"></div>
        </div>
        <div class="loading-metrics" aria-hidden="true">
          <span>GLTF</span>
          <span>WEBGL2</span>
          <span>AUDIO</span>
        </div>
        <div class="loading-text">Loading 0%</div>
      </div>
    `
    root.appendChild(this.el)
    const bar = this.el.querySelector(".loading-bar")
    const text = this.el.querySelector(".loading-text")
    const stage = this.el.querySelector("[data-role='loading-stage']")
    if (!(bar instanceof HTMLDivElement) || !(text instanceof HTMLDivElement) || !(stage instanceof HTMLDivElement)) {
      throw new Error("Loading screen markup failed")
    }
    this.bar = bar
    this.text = text
    this.stage = stage
  }

  setProgress(pct: number): void {
    this.bar.style.width = `${pct}%`
    this.text.textContent = `Loading ${pct}%`
    this.stage.textContent = this.stageForProgress(pct)
    const progressbar = this.el.querySelector("[role='progressbar']")
    if (progressbar instanceof HTMLElement) {
      progressbar.setAttribute("aria-valuenow", String(pct))
    }
  }

  show(): void {
    this.el.style.display = "flex"
  }

  hide(): void {
    this.el.style.display = "none"
  }

  private stageForProgress(pct: number): string {
    if (pct >= 96) {
      return "Opening start lane"
    }
    if (pct >= 82) {
      return "Mixing heavy waves"
    }
    if (pct >= 58) {
      return "Spawning enemy horde"
    }
    if (pct >= 35) {
      return "Loading squad rigs"
    }
    return "Preparing runway"
  }
}
