import { gsap } from "gsap"
import type { CampaignProgress, CampaignRunReward } from "../game/CampaignProgress"
import type { CombatInsight } from "../game/GameDamageSystem"
import { prefersReducedMotion } from "./motionPreference"

export type ResultStats = {
  readonly monstersKilled: number
  readonly soldiersLeft: number
  readonly endlessStage?: number | undefined
  readonly infiniteUnlocked?: boolean | undefined
  readonly campaignReward: CampaignRunReward
  readonly campaignProgress: CampaignProgress
  readonly combatInsight: CombatInsight
}

const RESULT_SCORE_TARGET = 140

export class ResultScreen {
  private readonly el: HTMLDivElement
  private readonly inner: HTMLDivElement
  private readonly kicker: HTMLDivElement
  private readonly kickerKo: HTMLDivElement
  private readonly title: HTMLHeadingElement
  private readonly titleKo: HTMLDivElement
  private readonly stats: HTMLDivElement
  private readonly rewards: HTMLDivElement
  private readonly rank: HTMLDivElement
  private readonly summary: HTMLDivElement
  private readonly medal: HTMLDivElement
  private readonly report: HTMLDivElement
  private readonly threatInsight: HTMLDivElement
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
      <div class="result-inner" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <header class="result-header">
          <div class="result-heading">
            <div class="result-kicker-row">
              <div class="result-kicker-ko" data-role="kicker-ko" lang="ko">작전 완료</div>
              <div class="result-kicker" data-role="kicker" lang="en">RUN COMPLETE</div>
            </div>
            <div class="result-title-lockup">
              <div class="result-title-ko" data-role="title-ko" lang="ko">승리</div>
              <h1 class="result-title" id="result-title" data-role="title" lang="en">VICTORY</h1>
            </div>
            <div class="result-summary" data-role="summary"></div>
          </div>
          <div class="result-grade">
            <div class="result-medal" data-role="medal"></div>
            <div class="result-rank" data-role="rank">지휘관 / COMMANDER</div>
          </div>
        </header>
        <div class="result-main">
          <section class="result-column result-overview" aria-label="핵심 전투 결과 Combat summary">
            <div class="result-stats" data-role="stats"></div>
            <div class="result-meter" aria-hidden="true"><div class="result-meter-fill" data-role="meter-fill"></div></div>
            <div class="result-rewards" data-role="rewards"></div>
          </section>
          <section class="result-column result-debrief" aria-label="전투 분석 Combat debrief">
            <div class="result-report" data-role="report"></div>
            <div class="result-threat-insight" data-role="threat-insight"></div>
            <div class="result-callout" data-role="callout"></div>
          </section>
        </div>
        <footer class="result-footer">
          <div class="result-actions" data-role="actions">
            <button class="result-btn retry-btn" type="button" aria-label="다시 출전 Run again"><span lang="ko">다시 출전</span><small lang="en">RUN AGAIN</small></button>
            <button class="result-btn next-btn" type="button" aria-label="다음 작전 Next run"><span lang="ko">다음 작전</span><small lang="en">NEXT RUN</small></button>
            <button class="result-btn share-btn" type="button" aria-label="결과 공유 Share result"><span lang="ko">결과 공유</span><small lang="en">SHARE</small></button>
          </div>
          <div class="result-share-status" data-role="share-status" aria-live="polite"></div>
        </footer>
      </div>
    `
    root.appendChild(this.el)
    this.inner = this.findDivByClass("result-inner")
    this.kicker = this.findDiv("kicker")
    this.kickerKo = this.findDiv("kicker-ko")
    this.title = this.findHeading("title")
    this.titleKo = this.findDiv("title-ko")
    this.rank = this.findDiv("rank")
    this.medal = this.findDiv("medal")
    this.summary = this.findDiv("summary")
    this.stats = this.findDiv("stats")
    this.rewards = this.findDiv("rewards")
    this.report = this.findDiv("report")
    this.threatInsight = this.findDiv("threat-insight")
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
    const endless = stats.endlessStage !== undefined
    this.kicker.textContent = endless ? "ENDLESS RUN" : victory ? "RUN COMPLETE" : "RUN LOST"
    this.kickerKo.textContent = endless ? "무한 작전 종료" : victory ? "작전 완료" : "작전 실패"
    this.title.textContent = victory ? "VICTORY" : "DEFEAT"
    this.title.dataset["state"] = victory ? "victory" : "defeat"
    this.titleKo.textContent = victory ? "승리" : "패배"
    this.titleKo.dataset["state"] = victory ? "victory" : "defeat"
    this.rank.innerHTML = `<span lang="ko">${this.getRankKo(rank)}</span><strong lang="en">${rank}</strong>`
    this.medal.innerHTML = `<span>${grade}</span><small><i lang="ko">지휘 등급</i><i lang="en">COMMAND GRADE</i></small>`
    this.summary.textContent = victory
      ? `${stats.soldiersLeft}명 귀환 · ${stats.monstersKilled}기 격파 / ${stats.soldiersLeft} extracted · ${stats.monstersKilled} cleared`
      : endless
        ? `${stats.endlessStage}단계 도달 · ${stats.monstersKilled}기 격파 / STAGE ${stats.endlessStage} · ${stats.monstersKilled} cleared`
        : `${stats.monstersKilled}기 격파 · 분대 전멸 / ${stats.monstersKilled} cleared · SQUAD LOST`
    this.stats.innerHTML = `
      <div class="result-stat-card"><span>격파 / KILLS</span><strong>${stats.monstersKilled}</strong></div>
      <div class="result-stat-card"><span>생존 / ALIVE</span><strong>${stats.soldiersLeft}</strong></div>
      <div class="result-stat-card"><span>${endless ? "무한 / STAGE" : "기록 / SCORE"}</span><strong>${endless ? stats.endlessStage : `${scorePct}%`}</strong></div>
    `
    const operationLabel = stats.campaignReward.mode === "defense" ? "방어전 / WAVE DEFENCE" : "돌파전 / GATE ATTACK"
    this.rewards.innerHTML = `
      <div class="result-reward-heading">
        <span>${operationLabel}</span>
        <strong>${stats.campaignReward.primaryLabel} / SECURED</strong>
      </div>
      <div class="result-reward-currency">
        <span>작전 정보 / INTEL</span>
        <strong>+${stats.campaignReward.intel}</strong>
        <small>보유 / TOTAL ${stats.campaignProgress.resources.intel}</small>
      </div>
      <div class="result-reward-currency">
        <span>방어 합금 / ALLOY</span>
        <strong>+${stats.campaignReward.alloy}</strong>
        <small>보유 / TOTAL ${stats.campaignProgress.resources.alloy}</small>
      </div>
    `
    this.report.innerHTML = `
      <div class="result-report-row"><span>위협 제거 / THREAT</span><strong>${stats.monstersKilled}/${RESULT_SCORE_TARGET}</strong></div>
      <div class="result-report-row"><span>귀환 상태 / STATUS</span><strong>${stats.soldiersLeft > 0 ? "전력 유지 / ONLINE" : "분대 손실 / LOST"}</strong></div>
      <div class="result-report-row"><span>지휘 평가 / RATING</span><strong>${this.getRankKo(rank)} / ${rank}</strong></div>
    `
    const casualtyText = stats.combatInsight.casualties > 0
      ? `${stats.combatInsight.casualties}명 손실`
      : "손실 없음"
    this.threatInsight.dataset["cause"] = stats.combatInsight.cause?.toLowerCase() ?? "none"
    this.threatInsight.innerHTML = `
      <span>피격 분석 / THREAT REVIEW</span>
      <strong>${stats.combatInsight.label} · ${casualtyText}</strong>
      <p>${stats.combatInsight.detail}</p>
    `
    this.callout.textContent = stats.infiniteUnlocked === true
      ? "무한 모드 해금 / INFINITE MODE UNLOCKED"
      : this.getCallout(victory, scorePct, stats.soldiersLeft, stats.endlessStage)
    this.shareText = `바로 Go 스쿼드 ${victory ? "승리 / VICTORY" : "패배 / DEFEAT"} · ${stats.monstersKilled}기 격파 / cleared · ${stats.soldiersLeft}명 생존 / alive · 등급 / grade ${grade} · ${stats.combatInsight.label} · 정보 / intel +${stats.campaignReward.intel} · 합금 / alloy +${stats.campaignReward.alloy}.`
    this.shareStatus.textContent = "공유 준비 / SHARE READY"
    this.shareStatus.dataset["state"] = "ready"
    this.meterFill.style.width = `${scorePct}%`
    this.el.style.display = "flex"
    gsap.killTweensOf([this.inner, this.title, this.rank, this.medal, this.rewards, this.report, this.threatInsight, this.callout, this.meterFill, this.shareStatus])
    if (prefersReducedMotion()) {
      gsap.set([this.inner, this.title, this.rank, this.medal, this.rewards, this.report, this.threatInsight, this.callout, this.meterFill, this.shareStatus], {
        clearProps: "transform,opacity",
      })
      this.retry.focus()
      return
    }
    gsap.fromTo(this.inner, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" })
    gsap.fromTo(this.title, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, delay: 0.08, ease: "power3.out" })
    gsap.fromTo(this.rank, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.36, delay: 0.16, ease: "power2.out" })
    gsap.fromTo(this.medal, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, delay: 0.14, ease: "back.out(1.6)" })
    gsap.fromTo(this.rewards, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.34, delay: 0.2, ease: "power2.out" })
    gsap.fromTo([this.report, this.threatInsight, this.callout], { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.38, delay: 0.24, stagger: 0.06, ease: "power2.out" })
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

  private getRankKo(rank: string): string {
    if (rank === "COMMANDER") {
      return "지휘관"
    }
    if (rank === "VANGUARD") {
      return "선봉대"
    }
    if (rank === "SURVIVOR") {
      return "생존자"
    }
    return "전선 붕괴"
  }

  private getCallout(victory: boolean, scorePct: number, soldiersLeft: number, endlessStage?: number): string {
    if (endlessStage !== undefined) {
      return `무한 ${endlessStage}단계 돌파 / ENDLESS STAGE ${endlessStage}`
    }
    if (!victory) {
      return "분대를 재편하고 다시 전진 / REBUILD AND PUSH AGAIN"
    }
    if (scorePct >= 100 && soldiersLeft >= 8) {
      return "완전 귀환 · 전선 제압 / CLEAN EXTRACTION"
    }
    if (soldiersLeft >= 3) {
      return "경로 확보 · 증원 권장 / ROUTE SECURED"
    }
    return "귀환 완료 · 전력 보강 필요 / REINFORCE SQUAD"
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
        this.shareStatus.textContent = "공유 완료 / SHARED"
        this.shareStatus.dataset["state"] = "shared"
        return
      }
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
      this.shareStatus.textContent = "복사 완료 / COPIED"
      this.shareStatus.dataset["state"] = "copied"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        this.shareStatus.textContent = "공유 준비 / SHARE READY"
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

  private findHeading(role: string): HTMLHeadingElement {
    const element = this.el.querySelector(`[data-role="${role}"]`)
    if (element instanceof HTMLHeadingElement) {
      return element
    }
    throw new Error(`Result heading missing: ${role}`)
  }

  private findButton(className: string): HTMLButtonElement {
    const element = this.el.querySelector(`.${className}`)
    if (element instanceof HTMLButtonElement) {
      return element
    }
    throw new Error(`Result button missing: ${className}`)
  }
}
