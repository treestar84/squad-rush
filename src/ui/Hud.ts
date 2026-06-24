import { gsap } from "gsap"

export type HudStats = {
  readonly soldiers: number
  readonly maxSoldiers: number
  readonly soldierMaxed: boolean
  readonly progressPct: number
  readonly fps: number
  readonly kills: number
  readonly attackMultiplier: number
  readonly soldierUpgradeTier: number
  readonly laneX: number
  readonly obstacles: number
  readonly monsters: number
}

export class Hud {
  private readonly el: HTMLDivElement
  private readonly soldierWrapEl: HTMLElement
  private readonly soldierEl: HTMLElement
  private readonly soldierCapEl: HTMLElement
  private readonly stageEl: HTMLElement
  private readonly stageFillEl: HTMLElement
  private readonly killsEl: HTMLElement
  private readonly attackEl: HTMLElement
  private readonly upgradeEl: HTMLElement
  private readonly laneXEl: HTMLElement
  private readonly obstaclesEl: HTMLElement
  private readonly monstersEl: HTMLElement
  private readonly fpsEl: HTMLElement
  private readonly comboEl: HTMLElement
  private previousSoldiers: number | null = null

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "hud"
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-soldiers"><span>Squad</span><strong data-role="soldiers">1</strong><em data-role="soldier-cap">/30</em></div>
        <div class="hud-stage">
          <span data-role="stage">0%</span>
          <div class="hud-stage-track"><div class="hud-stage-fill" data-role="stage-fill"></div></div>
        </div>
        <div class="hud-fps" data-role="fps">60fps</div>
      </div>
      <div class="hud-command-strip">
        <div class="hud-command-cell hud-command-cell--kills"><span>Kills</span><strong data-role="kills">0</strong></div>
        <div class="hud-command-cell"><span>ATK</span><strong data-role="attack">1.0x</strong></div>
        <div class="hud-command-cell"><span>UPG</span><strong data-role="upgrade">0/2</strong></div>
      </div>
      <div class="hud-telemetry" aria-hidden="true">
        <span data-role="lane-x">0.00</span>
        <span data-role="obstacles">0</span>
        <span data-role="monsters">0</span>
      </div>
      <div class="hud-combo" data-role="combo" style="display:none">KILL CHAIN <span data-role="combo-count">0</span></div>
    `
    root.appendChild(this.el)
    this.soldierEl = this.mustFind("soldiers")
    this.soldierCapEl = this.mustFind("soldier-cap")
    this.soldierWrapEl = this.mustFindClosest(this.soldierEl, "hud-soldiers")
    this.stageEl = this.mustFind("stage")
    this.stageFillEl = this.mustFind("stage-fill")
    this.killsEl = this.mustFind("kills")
    this.attackEl = this.mustFind("attack")
    this.upgradeEl = this.mustFind("upgrade")
    this.laneXEl = this.mustFind("lane-x")
    this.obstaclesEl = this.mustFind("obstacles")
    this.monstersEl = this.mustFind("monsters")
    this.fpsEl = this.mustFind("fps")
    this.comboEl = this.mustFind("combo")
  }

  update(stats: HudStats): void {
    const previousSoldiers = this.previousSoldiers
    this.soldierEl.textContent = String(stats.soldiers)
    this.soldierCapEl.textContent = stats.soldierMaxed ? "MAX" : `/${stats.maxSoldiers}`
    this.soldierWrapEl.classList.toggle("hud-soldiers--max", stats.soldierMaxed)
    this.soldierWrapEl.setAttribute(
      "aria-label",
      stats.soldierMaxed ? `Squad maximum ${stats.maxSoldiers}` : `Squad ${stats.soldiers} of ${stats.maxSoldiers}`,
    )
    if (previousSoldiers !== null && stats.soldiers !== previousSoldiers) {
      this.punchSoldierCount(stats.soldiers > previousSoldiers)
    }
    this.previousSoldiers = stats.soldiers
    this.stageEl.textContent = `${Math.round(stats.progressPct)}%`
    this.stageFillEl.style.width = `${Math.min(100, Math.max(0, stats.progressPct))}%`
    this.killsEl.textContent = String(stats.kills)
    this.attackEl.textContent = `${stats.attackMultiplier.toFixed(1)}x`
    this.upgradeEl.textContent = `${stats.soldierUpgradeTier}/2`
    this.laneXEl.textContent = stats.laneX.toFixed(2)
    this.obstaclesEl.textContent = String(stats.obstacles)
    this.monstersEl.textContent = String(stats.monsters)
    this.fpsEl.textContent = `${Math.round(stats.fps)}fps`
  }

  private punchSoldierCount(isGain: boolean): void {
    const stateClass = isGain ? "hud-soldiers--gain" : "hud-soldiers--loss"
    this.soldierWrapEl.classList.remove("hud-soldiers--gain", "hud-soldiers--loss")
    this.soldierWrapEl.classList.add(stateClass)
    gsap.killTweensOf([this.soldierWrapEl, this.soldierEl])
    gsap
      .timeline({
        onComplete: () => {
          this.soldierWrapEl.classList.remove(stateClass)
        },
      })
      .fromTo(
        this.soldierWrapEl,
        { scale: 1, filter: "brightness(1)" },
        { scale: isGain ? 1.2 : 1.12, filter: "brightness(1.6)", duration: 0.12, ease: "power2.out" },
      )
      .to(this.soldierWrapEl, { scale: 1, filter: "brightness(1)", duration: 0.34, ease: "back.out(2.8)" })
      .fromTo(this.soldierEl, { y: isGain ? -2 : 2 }, { y: 0, duration: 0.32, ease: "power2.out" }, 0.08)
  }

  show(): void {
    this.el.style.display = "block"
  }

  hide(): void {
    this.el.style.display = "none"
  }

  showPopup(text: string, color = "var(--accent-primary)"): void {
    const popup = document.createElement("div")
    popup.className = "hud-popup"
    popup.textContent = text
    popup.style.color = color
    this.el.appendChild(popup)
    gsap
      .timeline({ onComplete: () => popup.remove() })
      .fromTo(popup, { y: 10, opacity: 0, scale: 0.82 }, { y: 0, opacity: 1, scale: 1, duration: 0.16, ease: "power1.out" })
      .to(popup, { y: -64, opacity: 0, scale: 1.18, duration: 1.04, ease: "power3.out" })
  }

  showDamage(amount: number, laneX: number): void {
    const popup = document.createElement("div")
    const clampedLane = Math.max(-5, Math.min(5, laneX))
    popup.className = "hud-damage"
    popup.textContent = `-${Math.round(amount)}`
    popup.style.left = `calc(50% + ${clampedLane * 34}px)`
    this.el.appendChild(popup)
    gsap
      .timeline({ onComplete: () => popup.remove() })
      .fromTo(popup, { y: 12, opacity: 0, scale: 0.78 }, { y: 0, opacity: 1, scale: 1, duration: 0.14, ease: "power1.out" })
      .to(popup, { y: -46, opacity: 0, scale: 1.14, duration: 0.62, delay: 0.2, ease: "power2.out" })
  }

  showCombo(kills: number): void {
    const counter = this.mustFind("combo-count")
    counter.textContent = String(kills)
    this.comboEl.style.display = "block"
    gsap.killTweensOf(this.comboEl)
    gsap
      .timeline()
      .fromTo(this.comboEl, { y: -8, opacity: 0, scale: 0.86 }, { y: 0, opacity: 1, scale: 1, duration: 0.14, ease: "power1.out" })
      .to(this.comboEl, { opacity: 0, scale: 1.08, duration: 0.52, delay: 0.42, ease: "power2.out", onComplete: () => {
        this.comboEl.style.display = "none"
      } })
  }

  private mustFind(role: string): HTMLElement {
    const element = this.el.querySelector(`[data-role="${role}"]`)
    if (element instanceof HTMLElement) {
      return element
    }
    throw new Error(`HUD element missing: ${role}`)
  }

  private mustFindClosest(element: HTMLElement, className: string): HTMLElement {
    const closest = element.closest(`.${className}`)
    if (closest instanceof HTMLElement) {
      return closest
    }
    throw new Error(`HUD parent missing: ${className}`)
  }
}
