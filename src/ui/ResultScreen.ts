import { gsap } from "gsap"
import { prefersReducedMotion } from "./motionPreference"

export type ResultStats = {
  readonly monstersKilled: number
  readonly soldiersLeft: number
}

const RESULT_SCORE_TARGET = 140

export class ResultScreen {
  private readonly el: HTMLDivElement
  private readonly inner: HTMLDivElement
  private readonly kicker: HTMLDivElement
  private readonly title: HTMLDivElement
  private readonly stats: HTMLDivElement
  private readonly rank: HTMLDivElement
  private readonly summary: HTMLDivElement
  private readonly medal: HTMLDivElement
  private readonly report: HTMLDivElement
  private readonly callout: HTMLDivElement
  private readonly meterFill: HTMLDivElement
  private readonly shareStatus: HTMLDivElement
  private readonly retry: HTMLButtonElement
  private readonly next: HTMLButtonElement
  private readonly share: HTMLButtonElement
  private shareText = ""
  onRetry?: () => void
  onNext?: () => void

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "result-screen"
    this.el.innerHTML = `
      <div class="result-inner">
        <div class="result-kicker" data-role="kicker">RUN COMPLETE</div>
        <div class="result-title" data-role="title">VICTORY</div>
        <div class="result-rank" data-role="rank">COMMANDER</div>
        <div class="result-medal" data-role="medal"></div>
        <div class="result-summary" data-role="summary"></div>
        <div class="result-stats" data-role="stats"></div>
        <div class="result-meter" aria-hidden="true"><div class="result-meter-fill" data-role="meter-fill"></div></div>
        <div class="result-report" data-role="report"></div>
        <div class="result-callout" data-role="callout"></div>
        <div class="result-actions" data-role="actions">
          <button class="result-btn retry-btn" type="button">RUN AGAIN</button>
          <button class="result-btn next-btn" type="button">NEXT RUN</button>
          <button class="result-btn share-btn" type="button">SHARE</button>
        </div>
        <div class="result-share-status" data-role="share-status" aria-live="polite"></div>
      </div>
    `
    root.appendChild(this.el)
    this.inner = this.findDivByClass("result-inner")
    this.kicker = this.findDiv("kicker")
    this.title = this.findDiv("title")
    this.rank = this.findDiv("rank")
    this.medal = this.findDiv("medal")
    this.summary = this.findDiv("summary")
    this.stats = this.findDiv("stats")
    this.report = this.findDiv("report")
    this.callout = this.findDiv("callout")
    this.meterFill = this.findDiv("meter-fill")
    this.shareStatus = this.findDiv("share-status")
    this.retry = this.findButton("retry-btn")
    this.next = this.findButton("next-btn")
    this.share = this.findButton("share-btn")
    this.retry.addEventListener("click", () => this.onRetry?.())
    this.next.addEventListener("click", () => this.onNext?.())
    this.share.addEventListener("click", () => {
      void this.shareResult()
    })
    this.hide()
  }

  show(victory: boolean, stats: ResultStats): void {
    const rank = this.getRank(victory, stats)
    const scorePct = Math.min(100, Math.round((stats.monstersKilled / RESULT_SCORE_TARGET) * 100))
    const grade = this.getGrade(victory, scorePct, stats.soldiersLeft)
    this.kicker.textContent = victory ? "RUN COMPLETE" : "RUN LOST"
    this.title.textContent = victory ? "VICTORY" : "DEFEAT"
    this.title.dataset["state"] = victory ? "victory" : "defeat"
    this.rank.textContent = rank
    this.medal.innerHTML = `<span>${grade}</span><small>COMMAND GRADE</small>`
    this.summary.textContent = victory
      ? `${stats.soldiersLeft} soldiers extracted after clearing ${stats.monstersKilled} enemies.`
      : `${stats.monstersKilled} enemies cleared before the squad was overrun.`
    this.stats.innerHTML = `
      <div class="result-stat-card"><span>Enemies cleared</span><strong>${stats.monstersKilled}</strong></div>
      <div class="result-stat-card"><span>Survivors</span><strong>${stats.soldiersLeft}</strong></div>
      <div class="result-stat-card"><span>Battle score</span><strong>${scorePct}%</strong></div>
    `
    this.report.innerHTML = `
      <div class="result-report-row"><span>Threat cleared</span><strong>${stats.monstersKilled}/${RESULT_SCORE_TARGET}</strong></div>
      <div class="result-report-row"><span>Extraction status</span><strong>${stats.soldiersLeft > 0 ? "SQUAD ONLINE" : "SQUAD LOST"}</strong></div>
      <div class="result-report-row"><span>Command rating</span><strong>${rank}</strong></div>
    `
    this.callout.textContent = this.getCallout(victory, scorePct, stats.soldiersLeft)
    this.shareText = `바로 Go 스쿼드 ${victory ? "VICTORY" : "DEFEAT"} - ${stats.monstersKilled} enemies cleared, ${stats.soldiersLeft} soldiers left, grade ${grade}.`
    this.shareStatus.textContent = "READY TO SHARE"
    this.shareStatus.dataset["state"] = "ready"
    this.meterFill.style.width = `${scorePct}%`
    this.el.style.display = "flex"
    gsap.killTweensOf([this.inner, this.title, this.rank, this.medal, this.report, this.callout, this.meterFill, this.shareStatus])
    if (prefersReducedMotion()) {
      gsap.set([this.inner, this.title, this.rank, this.medal, this.report, this.callout, this.meterFill, this.shareStatus], {
        clearProps: "transform,opacity",
      })
      this.retry.focus()
      return
    }
    gsap.fromTo(this.inner, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" })
    gsap.fromTo(this.title, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, delay: 0.08, ease: "power3.out" })
    gsap.fromTo(this.rank, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.36, delay: 0.16, ease: "power2.out" })
    gsap.fromTo(this.medal, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, delay: 0.14, ease: "back.out(1.6)" })
    gsap.fromTo([this.report, this.callout], { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.38, delay: 0.24, stagger: 0.06, ease: "power2.out" })
    gsap.fromTo(this.meterFill, { scaleX: 0 }, { scaleX: 1, duration: 0.62, delay: 0.22, ease: "power2.out", transformOrigin: "left center" })
    gsap.fromTo(this.shareStatus, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.32, ease: "power2.out" })
    this.retry.focus()
  }

  hide(): void {
    this.el.style.display = "none"
  }

  private getRank(victory: boolean, stats: ResultStats): string {
    if (!victory) {
      return "OVERRUN"
    }
    if (stats.monstersKilled >= 120 && stats.soldiersLeft >= 3) {
      return "COMMANDER"
    }
    if (stats.monstersKilled >= 80) {
      return "VANGUARD"
    }
    return "SURVIVOR"
  }

  private getGrade(victory: boolean, scorePct: number, soldiersLeft: number): string {
    if (!victory) {
      return "C"
    }
    if (scorePct >= 100 && soldiersLeft >= 8) {
      return "S"
    }
    if (scorePct >= 86 && soldiersLeft >= 3) {
      return "A"
    }
    return "B"
  }

  private getCallout(victory: boolean, scorePct: number, soldiersLeft: number): string {
    if (!victory) {
      return "Rebuild the squad and push through the next wave."
    }
    if (scorePct >= 100 && soldiersLeft >= 8) {
      return "Clean extraction. Swarm pressure contained with command advantage."
    }
    if (soldiersLeft >= 3) {
      return "Route secured. More reinforcements will raise the final grade."
    }
    return "Extraction complete, but the squad ended under heavy pressure."
  }

  private async shareResult(): Promise<void> {
    const shareData = {
      title: "바로 Go 스쿼드",
      text: this.shareText,
      url: window.location.href,
    }
    this.shareStatus.textContent = `${this.shareText} ${window.location.href}`
    this.shareStatus.dataset["state"] = "ready"
    try {
      if (navigator.share !== undefined) {
        await navigator.share(shareData)
        this.shareStatus.textContent = "SHARED"
        this.shareStatus.dataset["state"] = "shared"
        return
      }
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
      this.shareStatus.textContent = "COPIED"
      this.shareStatus.dataset["state"] = "copied"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        this.shareStatus.textContent = "SHARE READY"
        this.shareStatus.dataset["state"] = "ready"
        return
      }
      if (error instanceof Error) {
        this.shareStatus.textContent = `${shareData.text} ${shareData.url}`
        this.shareStatus.dataset["state"] = "ready"
        return
      }
      throw error
    }
  }

  private findDiv(role: string): HTMLDivElement {
    const element = this.el.querySelector(`[data-role="${role}"]`)
    if (element instanceof HTMLDivElement) {
      return element
    }
    throw new Error(`Result element missing: ${role}`)
  }

  private findDivByClass(className: string): HTMLDivElement {
    const element = this.el.querySelector(`.${className}`)
    if (element instanceof HTMLDivElement) {
      return element
    }
    throw new Error(`Result element missing: ${className}`)
  }

  private findButton(className: string): HTMLButtonElement {
    const element = this.el.querySelector(`.${className}`)
    if (element instanceof HTMLButtonElement) {
      return element
    }
    throw new Error(`Result button missing: ${className}`)
  }
}
