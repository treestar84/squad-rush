export class Hud {
  private readonly el: HTMLDivElement
  private readonly soldierEl: HTMLElement
  private readonly stageEl: HTMLElement
  private readonly bossHpEl: HTMLElement
  private readonly bossHpBarEl: HTMLElement
  private readonly fpsEl: HTMLElement

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "hud"
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-soldiers">Squad <span data-role="soldiers">20</span></div>
        <div class="hud-stage" data-role="stage">0%</div>
        <div class="hud-fps" data-role="fps">60fps</div>
      </div>
      <div class="hud-boss-bar" data-role="boss" style="display:none">
        <div class="boss-label">TITAN BOSS</div>
        <div class="boss-hp-wrap"><div class="boss-hp-fill" data-role="boss-fill"></div></div>
      </div>
    `
    root.appendChild(this.el)
    this.soldierEl = this.mustFind("soldiers")
    this.stageEl = this.mustFind("stage")
    this.bossHpEl = this.mustFind("boss")
    this.bossHpBarEl = this.mustFind("boss-fill")
    this.fpsEl = this.mustFind("fps")
  }

  update(soldiers: number, progressPct: number, bossHpRatio: number, fps: number): void {
    this.soldierEl.textContent = String(soldiers)
    this.stageEl.textContent = `${Math.round(progressPct)}%`
    this.fpsEl.textContent = `${Math.round(fps)}fps`
    if (bossHpRatio >= 0) {
      this.bossHpEl.style.display = "block"
      this.bossHpBarEl.style.width = `${bossHpRatio * 100}%`
    } else {
      this.bossHpEl.style.display = "none"
    }
  }

  show(): void {
    this.el.style.display = "block"
  }

  hide(): void {
    this.el.style.display = "none"
  }

  private mustFind(role: string): HTMLElement {
    const element = this.el.querySelector(`[data-role="${role}"]`)
    if (element instanceof HTMLElement) {
      return element
    }
    throw new Error(`HUD element missing: ${role}`)
  }
}
