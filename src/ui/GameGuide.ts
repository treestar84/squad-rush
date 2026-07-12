import {
  UNIT_DEFINITIONS,
  UNIT_TYPES,
  type UnitType,
} from "../game/data/squadRosterData"
import {
  GUIDE_LANES,
  GUIDE_RULES,
  GUIDE_UNIT_TIERS,
  findGuideUnit,
  getGuidePortraitSource,
  type GuideLane,
  type GuideUnit,
} from "./GameGuideData"
import { createGuideDetail } from "./GameGuideDetailView"

export class GameGuide {
  private readonly button: HTMLButtonElement
  private readonly overlay: HTMLDivElement
  private readonly detail: HTMLElement
  private readonly unitCards = new Map<UnitType, HTMLButtonElement[]>()
  private selectedUnit: UnitType = UNIT_TYPES.pangyo
  private previouslyFocused: HTMLElement | null = null

  constructor(root: HTMLElement) {
    this.button = document.createElement("button")
    this.button.className = "game-guide-button"
    this.button.type = "button"
    this.button.setAttribute("aria-haspopup", "dialog")
    this.button.setAttribute("aria-expanded", "false")
    this.button.innerHTML = `
      <strong>PERSONNEL</strong>
      <span>ROSTER GUIDE</span>
    `

    this.overlay = document.createElement("div")
    this.overlay.className = "game-guide-overlay"
    this.overlay.setAttribute("role", "dialog")
    this.overlay.setAttribute("aria-modal", "true")
    this.overlay.setAttribute("aria-labelledby", "game-guide-title")
    this.overlay.setAttribute("aria-describedby", "game-guide-description")
    this.overlay.hidden = true
    const panel = this.createPanel()
    this.overlay.append(panel)
    const detail = panel.querySelector(".game-guide-detail")
    if (!(detail instanceof HTMLElement)) {
      throw new Error("Game guide detail panel missing")
    }
    this.detail = detail
    this.selectUnit(this.selectedUnit)

    this.button.addEventListener("click", () => this.open())
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) {
        this.close()
      }
    })
    this.overlay.addEventListener("keydown", (event) => this.handleOverlayKeydown(event))

    root.append(this.button, this.overlay)
  }

  get trigger(): HTMLButtonElement {
    return this.button
  }

  private open(): void {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    this.overlay.hidden = false
    this.button.setAttribute("aria-expanded", "true")
    const closeButton = this.overlay.querySelector(".game-guide-close")
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.focus()
    }
  }

  private close(): void {
    if (this.overlay.hidden) {
      return
    }
    this.overlay.hidden = true
    this.button.setAttribute("aria-expanded", "false")
    const restoreTarget = this.previouslyFocused ?? this.button
    this.previouslyFocused = null
    restoreTarget.focus()
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement("section")
    panel.className = "game-guide-panel"
    panel.innerHTML = `
      <header class="game-guide-header">
        <div class="game-guide-header-copy">
          <span>PERSONNEL COMMAND // ACTIVE ROSTER 09</span>
          <h2 id="game-guide-title">전투 인사 기록부</h2>
          <p id="game-guide-description">작전 투입 인원, 승급 체계, 전투 효과를 확인합니다.</p>
        </div>
        <button class="game-guide-close" type="button" aria-label="전투 인사 기록부 닫기">CLOSE</button>
      </header>
      <div class="game-guide-body">
        <section class="game-guide-map-shell" aria-labelledby="game-guide-roster-title">
          <div class="game-guide-section-heading">
            <span id="game-guide-roster-title">ROSTER MATRIX</span>
            <strong>09 ACTIVE</strong>
          </div>
          <div class="game-guide-map"></div>
        </section>
        <aside class="game-guide-side">
          <div class="game-guide-section-heading">
            <span>SELECTED DOSSIER</span>
            <strong>LIVE DATA</strong>
          </div>
          <section class="game-guide-detail" aria-live="polite"></section>
          <section class="game-guide-rules" aria-label="Core rules"></section>
        </aside>
      </div>
    `
    const map = panel.querySelector(".game-guide-map")
    const rules = panel.querySelector(".game-guide-rules")
    const closeButton = panel.querySelector(".game-guide-close")
    if (!(map instanceof HTMLDivElement) || !(rules instanceof HTMLElement) || !(closeButton instanceof HTMLButtonElement)) {
      throw new Error("Game guide panel structure missing")
    }
    map.replaceChildren(...GUIDE_LANES.map((lane) => this.createLane(lane)))
    rules.replaceChildren(this.createRules())
    closeButton.addEventListener("click", () => this.close())
    return panel
  }

  private createLane(lane: GuideLane): HTMLElement {
    const section = document.createElement("section")
    section.className = `game-guide-lane game-guide-lane--${lane.tone}`
    const laneHeader = document.createElement("header")
    laneHeader.className = "game-guide-lane-header"
    const code = document.createElement("span")
    code.textContent = getLaneCode(lane.tone)
    const heading = document.createElement("h3")
    heading.textContent = lane.title
    laneHeader.append(code, heading)
    const summary = document.createElement("p")
    summary.textContent = lane.summary
    const units = document.createElement("div")
    units.className = "game-guide-units"
    units.replaceChildren(...lane.units.map((unit) => this.createUnit(unit)))
    section.append(laneHeader, summary, units)
    return section
  }

  private createUnit(unit: GuideUnit): HTMLElement {
    const definition = UNIT_DEFINITIONS[unit.type]
    const guideTier = GUIDE_UNIT_TIERS[unit.type]
    const card = document.createElement("button")
    card.className = `game-guide-unit game-guide-unit--tier-${guideTier}`
    card.type = "button"
    card.setAttribute("aria-pressed", "false")
    card.addEventListener("click", () => this.selectUnit(unit.type))
    this.unitCards.set(unit.type, [...(this.unitCards.get(unit.type) ?? []), card])

    const portrait = document.createElement("img")
    portrait.src = getGuidePortraitSource(unit.type)
    portrait.alt = `${definition.label} 전술 인사기록 초상화`
    portrait.width = 48
    portrait.height = 48
    portrait.decoding = "async"
    portrait.loading = "eager"

    const copy = document.createElement("div")
    copy.className = "game-guide-unit-copy"
    const heading = document.createElement("div")
    heading.className = "game-guide-unit-heading"
    const title = document.createElement("strong")
    title.textContent = definition.label
    const tier = document.createElement("small")
    tier.textContent = `CLASS ${guideTier}`
    heading.append(title, tier)
    const meta = document.createElement("span")
    meta.textContent = `FIREPOWER ${definition.basePower}`
    const detail = document.createElement("p")
    detail.textContent = unit.detail
    copy.append(heading, meta, detail)
    card.append(portrait, copy)
    return card
  }

  private createRules(): HTMLElement {
    const section = document.createElement("section")
    section.className = "game-guide-rules-card"
    const button = document.createElement("button")
    button.className = "game-guide-rules-toggle"
    button.type = "button"
    button.setAttribute("aria-expanded", "false")
    button.textContent = "FIELD DIRECTIVES // 핵심 규칙"
    const panel = document.createElement("div")
    panel.className = "game-guide-rules-popover"
    panel.hidden = true
    const title = document.createElement("h3")
    title.textContent = "핵심 규칙"
    const list = document.createElement("ul")
    list.replaceChildren(...GUIDE_RULES.map((rule) => {
      const item = document.createElement("li")
      item.textContent = rule
      return item
    }))
    panel.append(title, list)
    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden
      button.setAttribute("aria-expanded", String(!panel.hidden))
      button.textContent = panel.hidden ? "FIELD DIRECTIVES // 핵심 규칙" : "FIELD DIRECTIVES // 닫기"
    })
    section.append(button, panel)
    return section
  }

  private selectUnit(type: UnitType): void {
    this.selectedUnit = type
    for (const [unit, cards] of this.unitCards) {
      const selected = unit === type
      for (const card of cards) {
        card.classList.toggle("game-guide-unit--selected", selected)
        card.setAttribute("aria-pressed", String(selected))
      }
    }
    const guideUnit = findGuideUnit(type)
    if (guideUnit !== null) {
      this.detail.replaceChildren(createGuideDetail(guideUnit))
    }
  }

  private handleOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault()
      this.close()
      return
    }
    if (event.key !== "Tab") {
      return
    }
    const focusable = Array.from(this.overlay.querySelectorAll("button:not(:disabled)"))
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

function getLaneCode(tone: GuideLane["tone"]): string {
  switch (tone) {
    case "start":
      return "ENTRY-00"
    case "military":
      return "MIL-10"
    case "developer":
      return "DEV-20"
    case "unemployed":
      return "CIV-30"
  }
}
