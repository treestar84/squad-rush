import {
  CAMPAIGN_FACILITY_ORDER,
  CAMPAIGN_MAX_FACILITY_LEVEL,
  getCampaignBonuses,
  getCampaignFacilityEffectSummary,
  getCampaignFacilityState,
  purchaseCampaignFacility,
  readCampaignProgress,
  type CampaignFacilityId,
} from "../game/CampaignProgress"

export class CommandCenter {
  readonly trigger: HTMLButtonElement
  private readonly modal: HTMLDivElement
  private readonly panel: HTMLDivElement
  private readonly closeButton: HTMLButtonElement
  private readonly intelBalance: HTMLElement
  private readonly alloyBalance: HTMLElement
  private readonly facilityGrid: HTMLDivElement
  private readonly bonusSummary: HTMLDivElement
  private readonly growthValue: HTMLElement
  private readonly growthTrack: HTMLDivElement
  private readonly growthBar: HTMLSpanElement
  private readonly feedback: HTMLDivElement
  private previouslyFocused: HTMLElement | null = null

  constructor(root: HTMLElement, triggerHost: HTMLElement) {
    this.trigger = document.createElement("button")
    this.trigger.className = "command-center-trigger"
    this.trigger.type = "button"
    this.trigger.setAttribute("aria-haspopup", "dialog")
    this.trigger.setAttribute("aria-expanded", "false")
    this.trigger.innerHTML = `
      <strong>COMMAND CENTER</strong>
      <span data-role="command-center-trigger-balance"></span>
    `
    triggerHost.appendChild(this.trigger)

    this.modal = document.createElement("div")
    this.modal.className = "command-center-modal"
    this.modal.hidden = true
    this.modal.setAttribute("role", "dialog")
    this.modal.setAttribute("aria-modal", "true")
    this.modal.setAttribute("aria-labelledby", "command-center-title")
    this.modal.setAttribute("aria-describedby", "command-center-description")
    this.modal.innerHTML = `
      <div class="command-center-panel">
        <header class="command-center-header">
          <div>
            <span class="command-center-kicker">PANGYO FORWARD BASE</span>
            <h2 id="command-center-title">COMMAND CENTER</h2>
            <p id="command-center-description">작전 자원으로 세 시설을 단계적으로 강화합니다.</p>
          </div>
          <button class="command-center-close" type="button" aria-label="Command Center 닫기">CLOSE</button>
        </header>
        <div class="command-center-overview">
          <div class="command-center-balances" aria-label="보유 작전 자원">
            <div><span>작전 정보</span><strong data-role="campaign-intel">0</strong></div>
            <div><span>방어 합금</span><strong data-role="campaign-alloy">0</strong></div>
          </div>
          <div class="command-center-growth">
            <div class="command-center-growth-heading">
              <span>기지 성장</span>
              <strong data-role="campaign-growth-value">0 / 30</strong>
            </div>
            <div
              class="command-center-growth-track"
              data-role="campaign-growth-track"
              role="progressbar"
              aria-label="커맨드 센터 전체 성장"
              aria-valuemin="0"
              aria-valuemax="30"
              aria-valuenow="0"
            ><span data-role="campaign-growth-bar"></span></div>
          </div>
          <div class="command-center-bonus-summary" data-role="campaign-bonus-summary"></div>
        </div>
        <div class="command-center-facilities" data-role="campaign-facilities"></div>
        <div class="command-center-feedback" data-role="campaign-feedback" aria-live="polite"></div>
      </div>
    `
    root.appendChild(this.modal)
    const panel = this.modal.querySelector(".command-center-panel")
    const close = this.modal.querySelector(".command-center-close")
    const intel = this.modal.querySelector("[data-role='campaign-intel']")
    const alloy = this.modal.querySelector("[data-role='campaign-alloy']")
    const facilityGrid = this.modal.querySelector("[data-role='campaign-facilities']")
    const bonusSummary = this.modal.querySelector("[data-role='campaign-bonus-summary']")
    const growthValue = this.modal.querySelector("[data-role='campaign-growth-value']")
    const growthTrack = this.modal.querySelector("[data-role='campaign-growth-track']")
    const growthBar = this.modal.querySelector("[data-role='campaign-growth-bar']")
    const feedback = this.modal.querySelector("[data-role='campaign-feedback']")
    if (
      !(panel instanceof HTMLDivElement)
      || !(close instanceof HTMLButtonElement)
      || !(intel instanceof HTMLElement)
      || !(alloy instanceof HTMLElement)
      || !(facilityGrid instanceof HTMLDivElement)
      || !(bonusSummary instanceof HTMLDivElement)
      || !(growthValue instanceof HTMLElement)
      || !(growthTrack instanceof HTMLDivElement)
      || !(growthBar instanceof HTMLSpanElement)
      || !(feedback instanceof HTMLDivElement)
    ) {
      throw new Error("Command Center controls missing")
    }
    this.panel = panel
    this.closeButton = close
    this.intelBalance = intel
    this.alloyBalance = alloy
    this.facilityGrid = facilityGrid
    this.bonusSummary = bonusSummary
    this.growthValue = growthValue
    this.growthTrack = growthTrack
    this.growthBar = growthBar
    this.feedback = feedback
    this.trigger.addEventListener("click", () => this.open())
    this.closeButton.addEventListener("click", () => this.close())
    this.modal.addEventListener("pointerdown", (event) => {
      if (event.target === this.modal) {
        this.close()
      }
    })
    this.modal.addEventListener("keydown", (event) => this.handleModalKeydown(event))
    this.refresh()
  }

  refresh(message = ""): void {
    const progress = readCampaignProgress()
    const bonuses = getCampaignBonuses(progress)
    const triggerBalance = this.trigger.querySelector("[data-role='command-center-trigger-balance']")
    if (triggerBalance instanceof HTMLElement) {
      triggerBalance.textContent = `INT ${progress.resources.intel} · ALLOY ${progress.resources.alloy}`
    }
    this.intelBalance.textContent = String(progress.resources.intel)
    this.alloyBalance.textContent = String(progress.resources.alloy)
    const totalLevels = CAMPAIGN_FACILITY_ORDER.reduce((total, facilityId) => {
      return total + progress.facilities[facilityId]
    }, 0)
    const maxTotalLevels = CAMPAIGN_MAX_FACILITY_LEVEL * CAMPAIGN_FACILITY_ORDER.length
    this.growthValue.textContent = `${totalLevels} / ${maxTotalLevels}`
    this.growthTrack.setAttribute("aria-valuemax", String(maxTotalLevels))
    this.growthTrack.setAttribute("aria-valuenow", String(totalLevels))
    this.growthBar.style.width = `${Math.round((totalLevels / maxTotalLevels) * 100)}%`
    this.bonusSummary.innerHTML = `
      <span class="command-center-bonus-title">현재 보너스</span>
      <div><small>증원</small><strong>+${bonuses.bonusStartingUnits}</strong></div>
      <div><small>화력</small><strong>+${Math.round((bonuses.attackMultiplier - 1) * 100)}%</strong></div>
      <div><small>방어막</small><strong>+${bonuses.startingShield}</strong></div>
    `
    this.facilityGrid.replaceChildren(...CAMPAIGN_FACILITY_ORDER.map((facilityId) => {
      return this.createFacilityCard(facilityId)
    }))
    this.feedback.textContent = message
  }

  private open(): void {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    this.refresh()
    this.modal.hidden = false
    this.trigger.setAttribute("aria-expanded", "true")
    this.closeButton.focus()
  }

  private close(): void {
    if (this.modal.hidden) {
      return
    }
    this.modal.hidden = true
    this.trigger.setAttribute("aria-expanded", "false")
    const restoreTarget = this.previouslyFocused ?? this.trigger
    this.previouslyFocused = null
    restoreTarget.focus()
  }

  private createFacilityCard(facilityId: CampaignFacilityId): HTMLElement {
    const state = getCampaignFacilityState(facilityId)
    const effect = getCampaignFacilityEffectSummary(facilityId, state.level)
    const card = document.createElement("article")
    card.className = "command-center-facility"
    card.classList.toggle("command-center-facility--maxed", state.maxed)
    card.dataset["facility"] = facilityId
    const levelText = state.maxed ? `LV ${state.level} · MAX` : `LV ${state.level} / ${CAMPAIGN_MAX_FACILITY_LEVEL}`
    const costText = state.nextCost === null
      ? "MAX LEVEL"
      : `정보 ${state.nextCost.intel} · 합금 ${state.nextCost.alloy}`
    const segments = Array.from({ length: CAMPAIGN_MAX_FACILITY_LEVEL }, (_, index) => {
      return `<span class="${index < state.level ? "facility-level-segment facility-level-segment--active" : "facility-level-segment"}"></span>`
    }).join("")
    card.innerHTML = `
      <div class="command-center-facility-art">
        <img
          src="${state.definition.imageSrc}"
          alt="${state.definition.imageAlt}"
          width="960"
          height="540"
          loading="lazy"
          decoding="async"
        >
        <span class="command-center-facility-level">${levelText}</span>
      </div>
      <div class="command-center-facility-heading">
        <span>${state.definition.shortLabel}</span>
        <strong>${state.definition.label}</strong>
      </div>
      <p>${state.definition.description}</p>
      <div class="facility-level-track" aria-label="${state.definition.label} ${state.level}/${CAMPAIGN_MAX_FACILITY_LEVEL} 레벨">${segments}</div>
      <div class="command-center-facility-effect">
        <strong>${effect.currentLabel}</strong>
        <span>${effect.cadenceLabel}</span>
      </div>
      <button class="command-center-upgrade" type="button" ${state.affordable ? "" : "disabled"}>
        <span>${state.maxed ? "업그레이드 완료" : state.affordable ? "업그레이드" : "자원 부족"}</span>
        <small>${costText}</small>
      </button>
    `
    const upgrade = card.querySelector(".command-center-upgrade")
    if (!(upgrade instanceof HTMLButtonElement)) {
      throw new Error(`Campaign facility button missing: ${facilityId}`)
    }
    upgrade.setAttribute(
      "aria-label",
      state.maxed
        ? `${state.definition.label} 최대 레벨`
        : `${state.definition.label} 업그레이드, ${costText}`,
    )
    upgrade.addEventListener("click", () => {
      const result = purchaseCampaignFacility(facilityId)
      const nextEffect = getCampaignFacilityEffectSummary(facilityId, result.facility.level)
      const message = result.applied
        ? `${state.definition.label} 레벨 ${result.facility.level} 완료 · ${nextEffect.currentLabel}`
        : result.reason === "max-level"
          ? `${state.definition.label}은 이미 최대 레벨입니다.`
          : `${state.definition.label} 업그레이드 자원이 부족합니다.`
      this.refresh(message)
      const nextButton = this.facilityGrid.querySelector(`[data-facility="${facilityId}"] .command-center-upgrade`)
      if (nextButton instanceof HTMLButtonElement && !nextButton.disabled) {
        nextButton.focus()
      } else {
        this.closeButton.focus()
      }
    })
    return card
  }

  private handleModalKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault()
      this.close()
      return
    }
    if (event.key !== "Tab") {
      return
    }
    const focusable = Array.from(this.panel.querySelectorAll("button:not(:disabled)"))
      .filter((element) => element instanceof HTMLButtonElement)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (first === undefined || last === undefined) {
      return
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}
