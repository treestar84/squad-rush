import { gsap } from "gsap"

const MAX_VISIBLE_PROMOTION_EVENTS = 3

export type HudRosterEntry = {
  readonly type: string
  readonly label: string
  readonly shortLabel: string
  readonly count: number
  readonly color: string
  readonly portraitSrc: string
  readonly tier: 1 | 2 | 3
}

export type CareerChoiceFeedback = {
  readonly label: string
  readonly color: string
  readonly portraitSrc: string
  readonly message: string
}

export type HudPromotionUnit = {
  readonly label: string
  readonly count: number
  readonly color: string
  readonly portraitSrc: string
}

export type HudPromotionEvent = {
  readonly label: string
  readonly requirements: readonly HudPromotionUnit[]
  readonly result: HudPromotionUnit
}

export type HudTimedSkillState = {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly remainingSeconds: number
  readonly intervalSeconds: number
  readonly progress: number
  readonly source: HudPromotionUnit
  readonly result: HudPromotionUnit
}

export type HudTimedSkillEvent = {
  readonly label: string
  readonly message: string
  readonly result: HudPromotionUnit
}

export type HudUnitRewardFlight = Pick<HudPromotionUnit, "label" | "color" | "portraitSrc"> & {
  readonly count: number
}

export type HudCasualtyUnit = HudUnitRewardFlight

export type HudDefenseProgressionState = {
  readonly enabled: boolean
  readonly maxed: boolean
  readonly reserveUnemployed: number
  readonly promotionCost: number
  readonly promotionCount: number
  readonly nextUnitLabel: string
  readonly nextUnitColor: string
}

export type HudStats = {
  readonly soldiers: number
  readonly maxSoldiers: number
  readonly soldierMaxed: boolean
  readonly progressPct: number
  readonly progressLabel?: string | undefined
  readonly fps: number
  readonly kills: number
  readonly attackMultiplier: number
  readonly shield: number
  readonly roster: readonly HudRosterEntry[]
  readonly effectSummaries: readonly string[]
  readonly timedSkills: readonly HudTimedSkillState[]
  readonly laneX: number
  readonly obstacles: number
  readonly monsters: number
  readonly defenseProgression: HudDefenseProgressionState
  readonly careerChoice: {
    readonly active: boolean
    readonly pangyoCount: number
    readonly requiredPangyo: number
  }
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
  private readonly shieldEl: HTMLElement
  private readonly rosterEl: HTMLElement
  private readonly defenseReserveEl: HTMLElement
  private readonly defenseReserveCountEl: HTMLElement
  private readonly defenseReserveNextEl: HTMLElement
  private readonly defenseReserveFillEl: HTMLElement
  private readonly promotionFeedEl: HTMLElement
  private readonly timedSkillsEl: HTMLElement
  private readonly effectSummaryEl: HTMLElement
  private readonly laneXEl: HTMLElement
  private readonly obstaclesEl: HTMLElement
  private readonly monstersEl: HTMLElement
  private readonly careerChoiceEl: HTMLElement
  private readonly careerProgressEl: HTMLElement
  private readonly fpsEl: HTMLElement
  private readonly comboEl: HTMLElement
  private previousSoldiers: number | null = null
  private previousRosterCounts: Map<string, number> | null = null
  private rosterSignature = ""
  private timedSkillsSignature = ""
  private effectSummarySignature = ""

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
        <div class="hud-command-cell"><span>SHD</span><strong data-role="shield">0</strong></div>
      </div>
      <div class="hud-defense-reserve" data-role="defense-reserve" aria-hidden="true">
        <img src="/assets/ui/portraits/unemployed.png" alt="" width="38" height="38">
        <div class="hud-defense-reserve-copy">
          <span>백수 예비 인력</span>
          <strong data-role="defense-reserve-count">0/10</strong>
          <small data-role="defense-reserve-next">다음 자동승급: 판교인</small>
        </div>
        <div class="hud-defense-reserve-track"><div data-role="defense-reserve-fill"></div></div>
      </div>
      <div class="hud-roster" data-role="roster" aria-label="Squad roster"></div>
      <div class="hud-promotion-feed" data-role="promotion-feed" aria-live="polite"></div>
      <div class="career-choice-panel" data-role="career-choice" aria-hidden="true">
        <div class="career-choice-title">진로 결정 <strong data-role="career-progress">0/3</strong></div>
        <div class="career-choice-options">
          <span><kbd>J</kbd><img src="/assets/ui/portraits/soldier.png" alt="" width="40" height="40">군입대</span>
          <span><kbd>K</kbd><img src="/assets/ui/portraits/developer.png" alt="" width="40" height="40">야근</span>
          <span><kbd>L</kbd><img src="/assets/ui/portraits/unemployed.png" alt="" width="40" height="40">해고</span>
        </div>
      </div>
      <div class="hud-timed-skills" data-role="timed-skills" aria-label="Timed squad skills"></div>
      <div class="hud-effect-summary" data-role="effect-summary" aria-label="Active squad effects"></div>
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
    this.shieldEl = this.mustFind("shield")
    this.defenseReserveEl = this.mustFind("defense-reserve")
    this.defenseReserveCountEl = this.mustFind("defense-reserve-count")
    this.defenseReserveNextEl = this.mustFind("defense-reserve-next")
    this.defenseReserveFillEl = this.mustFind("defense-reserve-fill")
    this.rosterEl = this.mustFind("roster")
    this.promotionFeedEl = this.mustFind("promotion-feed")
    this.timedSkillsEl = this.mustFind("timed-skills")
    this.effectSummaryEl = this.mustFind("effect-summary")
    this.laneXEl = this.mustFind("lane-x")
    this.obstaclesEl = this.mustFind("obstacles")
    this.monstersEl = this.mustFind("monsters")
    this.careerChoiceEl = this.mustFind("career-choice")
    this.careerProgressEl = this.mustFind("career-progress")
    this.fpsEl = this.mustFind("fps")
    this.comboEl = this.mustFind("combo")
  }

  update(stats: HudStats): void {
    const previousSoldiers = this.previousSoldiers
    this.setText(this.soldierEl, String(stats.soldiers))
    this.setText(this.soldierCapEl, stats.soldierMaxed ? "MAX" : `/${stats.maxSoldiers}`)
    this.soldierWrapEl.classList.toggle("hud-soldiers--max", stats.soldierMaxed)
    this.setAttribute(
      this.soldierWrapEl,
      "aria-label",
      stats.soldierMaxed ? `Squad maximum ${stats.maxSoldiers}` : `Squad ${stats.soldiers} of ${stats.maxSoldiers}`,
    )
    if (previousSoldiers !== null && stats.soldiers !== previousSoldiers) {
      this.punchSoldierCount(stats.soldiers > previousSoldiers)
    }
    this.previousSoldiers = stats.soldiers
    this.setText(this.stageEl, stats.progressLabel ?? `${Math.round(stats.progressPct)}%`)
    const stageWidth = `${Math.min(100, Math.max(0, stats.progressPct))}%`
    if (this.stageFillEl.style.width !== stageWidth) {
      this.stageFillEl.style.width = stageWidth
    }
    this.setText(this.killsEl, String(stats.kills))
    this.setText(this.attackEl, `${stats.attackMultiplier.toFixed(1)}x`)
    this.setText(this.shieldEl, String(stats.shield))
    this.updateDefenseProgression(stats.defenseProgression)
    this.updateRoster(stats.roster)
    this.updateTimedSkills(stats.timedSkills)
    this.updateEffectSummary(stats.effectSummaries)
    this.setText(this.laneXEl, stats.laneX.toFixed(2))
    this.setText(this.obstaclesEl, String(stats.obstacles))
    this.setText(this.monstersEl, String(stats.monsters))
    this.careerChoiceEl.classList.toggle("career-choice-panel--active", stats.careerChoice.active)
    this.setAttribute(this.careerChoiceEl, "aria-hidden", stats.careerChoice.active ? "false" : "true")
    this.setText(this.careerProgressEl, `${stats.careerChoice.pangyoCount}/${stats.careerChoice.requiredPangyo}`)
    this.setText(this.fpsEl, `${Math.round(stats.fps)}fps`)
  }

  private updateDefenseProgression(state: HudDefenseProgressionState): void {
    this.el.classList.toggle("hud--defense-progression", state.enabled)
    this.defenseReserveEl.classList.toggle("hud-defense-reserve--active", state.enabled)
    this.defenseReserveEl.classList.toggle("hud-defense-reserve--maxed", state.maxed)
    this.setAttribute(this.defenseReserveEl, "aria-hidden", state.enabled ? "false" : "true")
    if (!state.enabled) {
      return
    }
    this.setText(
      this.defenseReserveCountEl,
      state.maxed ? `예비 ${state.reserveUnemployed}` : `${state.reserveUnemployed}/${state.promotionCost}`,
    )
    this.setText(
      this.defenseReserveNextEl,
      state.maxed ? state.nextUnitLabel : `다음 자동승급: ${state.nextUnitLabel}`,
    )
    this.defenseReserveEl.style.setProperty("--next-unit-color", state.nextUnitColor)
    const progress = state.maxed ? 1 : state.promotionCost <= 0 ? 0 : state.reserveUnemployed / state.promotionCost
    const width = `${Math.min(100, Math.max(0, progress * 100))}%`
    if (this.defenseReserveFillEl.style.width !== width) {
      this.defenseReserveFillEl.style.width = width
    }
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

  private updateRoster(roster: readonly HudRosterEntry[]): void {
    this.announceTierOneGains(roster)
    const ownedRoster = roster.filter((entry) => entry.count > 0)
    this.rosterEl.classList.toggle("hud-roster--empty", ownedRoster.length === 0)
    const signature = ownedRoster.map((entry) => `${entry.type}:${entry.count}:${entry.tier}`).join("|")
    if (signature === this.rosterSignature) {
      return
    }
    this.rosterSignature = signature
    this.rosterEl.replaceChildren(...ownedRoster.map((entry) => {
      const item = document.createElement("div")
      item.className = `hud-roster-item hud-roster-item--tier-${entry.tier}`
      item.style.setProperty("--unit-color", entry.color)
      item.setAttribute("title", entry.label)
      item.setAttribute("aria-label", `${entry.label} ${entry.count}`)

      const portrait = document.createElement("img")
      portrait.className = "hud-roster-portrait"
      portrait.src = entry.portraitSrc
      portrait.alt = ""
      portrait.width = 32
      portrait.height = 32
      portrait.loading = "eager"
      portrait.decoding = "async"
      const label = document.createElement("span")
      label.textContent = this.getRosterDisplayName(entry)
      const count = document.createElement("strong")
      count.textContent = String(entry.count)
      item.append(portrait, label, count)
      return item
    }))
  }

  showCareerChoiceResult(feedback: CareerChoiceFeedback): void {
    this.showHeadline(feedback.message, feedback.color)
    this.showPortraitFlight({
      label: feedback.label,
      color: feedback.color,
      portraitSrc: feedback.portraitSrc,
    })
  }

  showPromotionEvent(event: HudPromotionEvent): void {
    while (this.promotionFeedEl.childElementCount >= MAX_VISIBLE_PROMOTION_EVENTS) {
      const staleEvent = this.promotionFeedEl.lastElementChild
      if (staleEvent instanceof HTMLElement) {
        gsap.killTweensOf(staleEvent)
        staleEvent.remove()
      }
    }
    const item = document.createElement("div")
    item.className = "hud-promotion-event"
    item.style.setProperty("--unit-color", event.result.color)
    item.setAttribute("aria-label", event.label)

    const title = document.createElement("span")
    title.className = "hud-promotion-label"
    title.textContent = event.label

    const input = document.createElement("div")
    input.className = "hud-promotion-units"
    for (const requirement of event.requirements) {
      for (let index = 0; index < requirement.count; index += 1) {
        input.append(this.createUnitIcon(requirement, 22))
      }
    }

    const arrow = document.createElement("span")
    arrow.className = "hud-promotion-arrow"
    arrow.textContent = "->"

    const output = document.createElement("div")
    output.className = "hud-promotion-result"
    output.append(this.createUnitIcon(event.result, 28))
    const label = document.createElement("strong")
    label.textContent = `${this.getDisplayUnitName(event.result.label)} 승급`
    output.append(label)

    item.append(title, input, arrow, output)
    this.promotionFeedEl.prepend(item)
    gsap
      .timeline({ onComplete: () => item.remove() })
      .fromTo(item, { y: -8, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" })
      .to(item, { opacity: 0, scale: 0.98, duration: 0.32, delay: 4.2, ease: "power2.out" })
  }

  showTimedSkillEvent(event: HudTimedSkillEvent): void {
    this.showHeadline(event.message, event.result.color)
    this.showPortraitFlight(event.result)
  }

  showUnitRewardFlight(unit: HudUnitRewardFlight): void {
    if (unit.count <= 0) {
      return
    }
    this.showPortraitFlight(unit, unit.count)
  }

  showCasualties(units: readonly HudCasualtyUnit[]): void {
    const shownUnits = units.filter((unit) => unit.count > 0)
    if (shownUnits.length <= 0) {
      return
    }
    const rosterRect = this.rosterEl.getBoundingClientRect()
    const baseLeft = Math.max(8, rosterRect.left - 76)
    const baseTop = rosterRect.top + Math.min(10, rosterRect.height * 0.16)
    shownUnits.forEach((unit, index) => {
      this.showCasualtyBadge(unit, baseLeft, baseTop + index * 54)
    })
  }

  private showPortraitFlight(unit: Pick<HudPromotionUnit, "label" | "color" | "portraitSrc">, count = 1): void {
    const flightCount = Math.max(1, Math.floor(count))
    const rosterRect = this.rosterEl.getBoundingClientRect()
    const targetX = rosterRect.left + Math.min(56, rosterRect.width * 0.5)
    const targetY = rosterRect.top + Math.min(42, rosterRect.height * 0.5)
    const startCenterX = window.innerWidth * 0.5 - 56
    const startCenterY = window.innerHeight * 0.5 - 86
    const popCenterY = window.innerHeight * 0.5 - 136
    for (let index = 0; index < flightCount; index += 1) {
      this.createPortraitFlight(unit, {
        index,
        count: flightCount,
        startCenterX,
        startCenterY,
        popCenterY,
        targetX,
        targetY,
      })
    }
  }

  private createPortraitFlight(
    unit: Pick<HudPromotionUnit, "label" | "color" | "portraitSrc">,
    placement: {
      readonly index: number
      readonly count: number
      readonly startCenterX: number
      readonly startCenterY: number
      readonly popCenterY: number
      readonly targetX: number
      readonly targetY: number
    },
  ): void {
    const portrait = document.createElement("img")
    portrait.className = "career-choice-flight"
    portrait.src = unit.portraitSrc
    portrait.alt = unit.label
    portrait.width = 112
    portrait.height = 112
    portrait.style.setProperty("--unit-color", unit.color)
    this.el.appendChild(portrait)

    const centeredIndex = placement.index - (placement.count - 1) * 0.5
    const rowOffset = placement.index % 2 === 0 ? -1 : 1
    const spreadX = Math.max(-84, Math.min(84, centeredIndex * 30))
    const spreadY = rowOffset * Math.min(22, Math.max(0, placement.count - 1) * 4)
    const startX = placement.startCenterX + spreadX
    const startY = placement.startCenterY + spreadY
    const popY = placement.popCenterY + spreadY * 0.35
    const targetX = placement.targetX + centeredIndex * 5
    const targetY = placement.targetY + rowOffset * 3
    const rotate = centeredIndex * 3

    gsap
      .timeline({ onComplete: () => portrait.remove() })
      .fromTo(
        portrait,
        {
          x: startX,
          y: startY,
          scale: 0.72,
          opacity: 0,
          rotate: -4 + rotate,
        },
        {
          y: popY,
          scale: 1.28,
          opacity: 1,
          rotate,
          duration: 0.22,
          ease: "back.out(2.6)",
        },
      )
      .to(portrait, {
        x: targetX - 18,
        y: targetY - 18,
        scale: 0.22,
        opacity: 0.82,
        rotate: 8 + rotate,
        duration: 0.58,
        ease: "power3.in",
      })
      .to(portrait, { opacity: 0, scale: 0.08, duration: 0.12, ease: "power2.out" })
  }

  private showCasualtyBadge(unit: HudCasualtyUnit, left: number, top: number): void {
    const badge = document.createElement("div")
    badge.className = "hud-casualty-badge"
    badge.style.left = `${left}px`
    badge.style.top = `${top}px`
    badge.style.setProperty("--unit-color", unit.color)
    badge.setAttribute("aria-label", `${unit.label} ${unit.count} lost`)

    const portrait = document.createElement("img")
    portrait.src = unit.portraitSrc
    portrait.alt = unit.label
    portrait.width = 52
    portrait.height = 52
    const xMark = document.createElement("span")
    xMark.className = "hud-casualty-x"
    xMark.textContent = "X"
    badge.append(portrait, xMark)
    if (unit.count > 1) {
      const count = document.createElement("strong")
      count.textContent = `${unit.count}x`
      badge.append(count)
    }
    this.el.appendChild(badge)
    gsap
      .timeline({ onComplete: () => badge.remove() })
      .fromTo(
        badge,
        { x: -12, y: 0, opacity: 0, scale: 0.72, filter: "brightness(0.9) saturate(1.1)" },
        { x: 0, opacity: 1, scale: 1, filter: "brightness(0.95) saturate(1.5)", duration: 0.16, ease: "back.out(2.4)" },
      )
      .to(badge, { x: -10, opacity: 0, scale: 0.82, duration: 0.34, delay: 0.74, ease: "power2.in" })
  }

  private updateTimedSkills(skills: readonly HudTimedSkillState[]): void {
    this.timedSkillsEl.classList.toggle("hud-timed-skills--empty", skills.length === 0)
    const signature = skills.map((skill) => (
      `${skill.id}:${Math.ceil(skill.remainingSeconds)}:${Math.round(skill.progress * 100)}`
    )).join("|")
    if (signature === this.timedSkillsSignature) {
      return
    }
    this.timedSkillsSignature = signature
    this.timedSkillsEl.replaceChildren(...skills.map((skill) => {
      const item = document.createElement("div")
      item.className = "hud-timed-skill"
      item.style.setProperty("--unit-color", skill.result.color)
      item.setAttribute("aria-label", `${skill.label} ${Math.ceil(skill.remainingSeconds)} seconds remaining`)

      const icon = this.createUnitIcon(skill.source, 30)
      const copy = document.createElement("div")
      const title = document.createElement("strong")
      title.textContent = skill.label
      const detail = document.createElement("span")
      detail.textContent = `${skill.detail} ${Math.ceil(skill.remainingSeconds)}초`
      copy.append(title, detail)

      const result = this.createUnitIcon(skill.result, 26)
      const track = document.createElement("div")
      track.className = "hud-timed-skill-track"
      const fill = document.createElement("div")
      fill.style.width = `${Math.round(skill.progress * 100)}%`
      track.append(fill)
      item.append(icon, copy, result, track)
      return item
    }))
  }

  private updateEffectSummary(summaries: readonly string[]): void {
    this.effectSummaryEl.classList.toggle("hud-effect-summary--empty", summaries.length === 0)
    const signature = summaries.slice(0, 5).join("|")
    if (signature === this.effectSummarySignature) {
      return
    }
    this.effectSummarySignature = signature
    const title = document.createElement("strong")
    title.textContent = "누적 효과"
    const list = document.createElement("ul")
    for (const summary of summaries.slice(0, 5)) {
      const item = document.createElement("li")
      item.textContent = summary
      list.append(item)
    }
    this.effectSummaryEl.replaceChildren(title, list)
  }

  private setText(element: HTMLElement, value: string): void {
    if (element.textContent !== value) {
      element.textContent = value
    }
  }

  private setAttribute(element: HTMLElement, name: string, value: string): void {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value)
    }
  }

  private createUnitIcon(unit: HudPromotionUnit, size: number): HTMLImageElement {
    const icon = document.createElement("img")
    icon.className = "hud-unit-icon"
    icon.src = unit.portraitSrc
    icon.alt = this.getDisplayUnitName(unit.label)
    icon.width = size
    icon.height = size
    icon.style.setProperty("--unit-color", unit.color)
    return icon
  }

  private announceTierOneGains(roster: readonly HudRosterEntry[]): void {
    const previous = this.previousRosterCounts
    const nextCounts = new Map(roster.map((entry) => [entry.type, entry.count]))
    this.previousRosterCounts = nextCounts
    if (previous === null) {
      return
    }
    for (const entry of roster) {
      const previousCount = previous.get(entry.type) ?? 0
      if (entry.tier === 1 && entry.count > previousCount) {
        this.showHeadline(`1티어 ${this.getDisplayUnitName(entry.label)}!`, entry.color, "elite")
      }
    }
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

  showHeadline(text: string, color = "var(--accent-primary)", tone: "normal" | "elite" = "normal"): void {
    const headline = document.createElement("div")
    headline.className = "hud-headline"
    if (tone === "elite") {
      headline.classList.add("hud-headline--elite")
    }
    headline.textContent = text
    headline.style.color = color
    this.el.appendChild(headline)
    gsap
      .timeline({ onComplete: () => headline.remove() })
      .fromTo(headline, { y: -8, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.16, ease: "power1.out" })
      .to(headline, { y: -18, opacity: 0, scale: 1.03, duration: 1.1, delay: 0.72, ease: "power2.out" })
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

  private getRosterDisplayName(entry: HudRosterEntry): string {
    return this.getDisplayUnitName(entry.label)
  }

  private getDisplayUnitName(label: string): string {
    if (label === "시니어 개발자") {
      return "시니어"
    }
    if (label === "CEO") {
      return "대표"
    }
    if (label === "AI") {
      return "인공지능"
    }
    if (label === "QA") {
      return "품질담당"
    }
    return label
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
