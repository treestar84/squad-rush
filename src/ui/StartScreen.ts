import { gsap } from "gsap"
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_PROFILES,
  type DifficultyProfile,
} from "../game/data/difficultyData"
import {
  DEFAULT_GAME_MODE,
  GAME_MODE_PROFILES,
  type GameModeProfile,
} from "../game/data/gameModeData"
import { isInfiniteModeUnlocked } from "../game/ModeProgress"
import { CommandCenter } from "./CommandCenter"
import { GameGuide } from "./GameGuide"
import { prefersReducedMotion } from "./motionPreference"

const START_TITLE_FILTER = "brightness(1.45) contrast(1.12) drop-shadow(0 18px 42px rgba(0, 0, 0, 0.68))"

export type StartRunOptions = {
  readonly difficulty: DifficultyProfile
  readonly mode: GameModeProfile
}

type ModeUpdateOptions = {
  readonly revealDifficulty?: boolean
}

type DifficultyUpdateOptions = {
  readonly revealScenario?: boolean
}

export class StartScreen {
  private readonly el: HTMLDivElement
  private readonly startButton: HTMLButtonElement
  private readonly difficultyStage: HTMLDivElement
  private readonly scenarioCard: HTMLElement
  private readonly gameGuide: GameGuide
  private readonly commandCenter: CommandCenter
  private readonly modeButtons: readonly HTMLButtonElement[]
  private readonly difficultyButtons: readonly HTMLButtonElement[]
  private selectedDifficulty: DifficultyProfile = DEFAULT_DIFFICULTY
  private selectedGameMode: GameModeProfile = DEFAULT_GAME_MODE
  private pointerDownX = 0
  private pointerDownY = 0
  private pointerDragged = false
  private pointerTracking = false
  private startPressArmed = false
  private startTriggered = false
  private readonly handleStartPointerMove = (event: PointerEvent): void => {
    if (!this.pointerTracking) {
      return
    }
    const dx = event.clientX - this.pointerDownX
    const dy = event.clientY - this.pointerDownY
    this.pointerDragged = this.pointerDragged || Math.hypot(dx, dy) > 10
  }
  private readonly handleStartPointerUp = (): void => {
    this.pointerTracking = false
  }
  private readonly handleStartMouseMove = (event: MouseEvent): void => {
    if (!this.pointerTracking) {
      return
    }
    const dx = event.clientX - this.pointerDownX
    const dy = event.clientY - this.pointerDownY
    this.pointerDragged = this.pointerDragged || Math.hypot(dx, dy) > 10
  }
  onStart?: (options: StartRunOptions) => void
  onDifficultyChange?: (difficulty: DifficultyProfile) => void
  onGameModeChange?: (mode: GameModeProfile) => void

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "start-screen"
    this.el.innerHTML = `
      <div class="start-inner">
        <img class="start-title-logo" src="/assets/ui/start-title-logo.png" alt="바로 Go 스쿼드" width="1600" height="597" decoding="async" fetchpriority="high" />
        <p class="game-subtitle">Survive the lane. Grow the squad. Break the titan.</p>
        <article class="scenario-card" data-role="scenario-card" aria-live="polite" hidden>
          <div class="scenario-card-content">
            <span class="scenario-card-kicker" data-role="scenario-kicker"></span>
            <span class="scenario-card-day" data-role="scenario-day"></span>
            <h2 data-role="scenario-title"></h2>
            <div class="scenario-card-body" data-role="scenario-body"></div>
            <strong data-role="scenario-callout"></strong>
            <img class="scenario-card-image" data-role="scenario-image" alt="" width="920" height="518" loading="lazy" decoding="async" hidden />
          </div>
        </article>
        <div class="start-command-layout">
          <div class="start-command-main">
            <div class="mode-panel" role="radiogroup" aria-label="Game mode">
              <button class="mode-option mode-option--attack mode-option--selected" type="button" data-mode="run" role="radio" aria-checked="true">
                <span class="mode-option-visual" aria-hidden="true"></span>
                <span class="mode-option-copy"><strong>Gate Attack</strong><small>run</small></span>
              </button>
              <button class="mode-option mode-option--defense" type="button" data-mode="defense" role="radio" aria-checked="false">
                <span class="mode-option-visual" aria-hidden="true"></span>
                <span class="mode-option-copy"><strong>Wave Defence</strong><small>defence</small></span>
              </button>
            </div>
            <div class="difficulty-stage" data-role="difficulty-stage" hidden>
              <div class="difficulty-panel" role="radiogroup" aria-label="Difficulty">
                <button class="difficulty-option" type="button" data-difficulty="easy" role="radio" aria-checked="false">
                  <strong>EASY</strong><small>게이트 오픈 후 1일차</small>
                </button>
                <button class="difficulty-option" type="button" data-difficulty="medium" role="radio" aria-checked="false">
                  <strong>NORMAL</strong><small>게이트 오픈 후 10일차</small>
                </button>
                <button class="difficulty-option" type="button" data-difficulty="hard" role="radio" aria-checked="false">
                  <strong>HARD</strong><small>게이트 오픈 후 30일차</small>
                </button>
                <button class="difficulty-option difficulty-option--locked" type="button" data-difficulty="infinite" role="radio" aria-checked="false" aria-disabled="true" disabled>
                  <strong>INFINITE</strong><small>HARD 클리어 후 개방</small>
                </button>
              </div>
            </div>
            <div class="start-primary-actions">
              <div data-role="command-center-trigger"></div>
              <button class="tap-to-start" type="button">TAP TO START</button>
            </div>
            <div class="controls-hint">
              <span>Mouse drag</span>
              <span>Touch drag</span>
              <span>A/D keys</span>
            </div>
          </div>
        </div>
      </div>
    `
    root.appendChild(this.el)
    this.gameGuide = new GameGuide(this.el)
    const commandCenterTrigger = this.el.querySelector("[data-role='command-center-trigger']")
    if (!(commandCenterTrigger instanceof HTMLElement)) {
      throw new Error("Command Center trigger host missing")
    }
    this.commandCenter = new CommandCenter(this.el, commandCenterTrigger)
    const button = this.el.querySelector(".tap-to-start")
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Start screen button missing")
    }
    const inner = this.el.querySelector(".start-inner")
    if (!(inner instanceof HTMLDivElement)) {
      throw new Error("Start screen content missing")
    }
    this.startButton = button
    const difficultyStage = this.el.querySelector("[data-role='difficulty-stage']")
    const scenarioCard = this.el.querySelector("[data-role='scenario-card']")
    if (!(difficultyStage instanceof HTMLDivElement) || !(scenarioCard instanceof HTMLElement)) {
      throw new Error("Start screen scenario controls missing")
    }
    this.difficultyStage = difficultyStage
    this.scenarioCard = scenarioCard
    this.modeButtons = Array.from(this.el.querySelectorAll(".mode-option")).filter((option) => option instanceof HTMLButtonElement)
    this.difficultyButtons = Array.from(this.el.querySelectorAll(".difficulty-option")).filter((option) => option instanceof HTMLButtonElement)
    for (const option of this.modeButtons) {
      option.addEventListener("click", () => {
        const mode = this.readGameModeOption(option)
        this.setGameMode(mode)
      })
    }
    for (const option of this.difficultyButtons) {
      option.addEventListener("click", () => {
        const difficulty = this.readDifficultyOption(option)
        if (!this.canUseDifficulty(difficulty)) {
          return
        }
        this.setDifficulty(difficulty)
      })
    }
    this.updateDifficultyLocks()
    this.startButton.addEventListener("pointerdown", (event) => {
      this.pointerDownX = event.clientX
      this.pointerDownY = event.clientY
      this.pointerDragged = false
      this.pointerTracking = true
      this.startPressArmed = true
    })
    this.startButton.addEventListener("pointerup", (event) => {
      this.pointerTracking = false
      if (!this.startPressArmed) {
        return
      }
      event.preventDefault()
      this.startPressArmed = false
      if (this.pointerDragged) {
        this.pointerDragged = false
        return
      }
      this.triggerStart()
    })
    this.startButton.addEventListener("mousedown", (event) => {
      this.pointerDownX = event.clientX
      this.pointerDownY = event.clientY
      this.pointerDragged = false
      this.pointerTracking = true
      this.startPressArmed = true
    })
    window.addEventListener("pointermove", this.handleStartPointerMove, { passive: true })
    window.addEventListener("pointerup", this.handleStartPointerUp, { passive: true })
    window.addEventListener("mousemove", this.handleStartMouseMove, { passive: true })
    window.addEventListener("mouseup", this.handleStartPointerUp, { passive: true })
    this.startButton.addEventListener("click", (event) => {
      if (this.startTriggered) {
        event.preventDefault()
        return
      }
      if (this.startPressArmed && this.pointerDragged) {
        event.preventDefault()
        this.pointerDragged = false
        this.startPressArmed = false
        return
      }
      this.startPressArmed = false
      this.triggerStart()
    })
  }

  private triggerStart(): void {
    if (this.startTriggered) {
      return
    }
    this.startTriggered = true
    this.onStart?.({
      difficulty: this.selectedDifficulty,
      mode: this.selectedGameMode,
    })
  }

  setGameMode(mode: GameModeProfile, options: ModeUpdateOptions = {}): void {
    this.selectedGameMode = mode
    this.updateDifficultyLocks()
    if (!this.canUseDifficulty(this.selectedDifficulty)) {
      this.setDifficulty(DEFAULT_DIFFICULTY)
    }
    if (options.revealDifficulty !== false) {
      this.difficultyStage.hidden = false
      gsap.set(this.difficultyStage, { opacity: 1, y: 0, clearProps: "transform" })
    }
    for (const option of this.modeButtons) {
      const optionMode = this.readGameModeOption(option)
      const selected = optionMode.id === mode.id
      option.classList.toggle("mode-option--selected", selected)
      option.setAttribute("aria-checked", String(selected))
    }
    this.onGameModeChange?.(mode)
  }

  setDifficulty(difficulty: DifficultyProfile, options: DifficultyUpdateOptions = {}): void {
    this.selectedDifficulty = difficulty
    const revealScenario = options.revealScenario !== false
    this.el.classList.toggle("start-screen--scenario-open", revealScenario)
    if (revealScenario) {
      this.updateScenarioCopy(difficulty)
      this.scenarioCard.hidden = false
    } else {
      this.scenarioCard.hidden = true
      this.clearScenarioCopy()
    }
    for (const option of this.difficultyButtons) {
      const optionDifficulty = this.readDifficultyOption(option)
      const selected = optionDifficulty.id === difficulty.id
      option.classList.toggle("difficulty-option--selected", selected)
      option.setAttribute("aria-checked", String(selected))
    }
    this.onDifficultyChange?.(difficulty)
  }

  private clearScenarioCopy(): void {
    this.setText("[data-role='scenario-kicker']", "")
    this.setText("[data-role='scenario-day']", "")
    this.setText("[data-role='scenario-title']", "")
    this.setScenarioBody("")
    this.setText("[data-role='scenario-callout']", "")
    this.setScenarioImage("", "")
  }

  private updateScenarioCopy(difficulty: DifficultyProfile): void {
    this.setText("[data-role='scenario-kicker']", "PANGYO GATE INCIDENT")
    this.setText("[data-role='scenario-day']", difficulty.gateDay)
    this.setText("[data-role='scenario-title']", difficulty.scenarioTitle)
    this.setScenarioBody(difficulty.scenarioBody)
    this.setText("[data-role='scenario-callout']", difficulty.scenarioCallout)
    this.setScenarioImage(difficulty.scenarioImageSrc, difficulty.scenarioImageAlt)
  }

  private setText(selector: string, text: string): void {
    const element = this.el.querySelector(selector)
    if (element instanceof HTMLElement) {
      element.textContent = text
    }
  }

  private setScenarioBody(text: string): void {
    const element = this.el.querySelector("[data-role='scenario-body']")
    if (!(element instanceof HTMLElement)) {
      return
    }
    element.replaceChildren()
    for (const paragraph of text.split("\n\n")) {
      const trimmed = paragraph.trim()
      if (trimmed.length === 0) {
        continue
      }
      const p = document.createElement("p")
      p.textContent = trimmed
      element.appendChild(p)
    }
  }

  private setScenarioImage(src: string, alt: string): void {
    const image = this.el.querySelector("[data-role='scenario-image']")
    if (!(image instanceof HTMLImageElement)) {
      return
    }
    image.alt = alt
    if (src.length === 0) {
      image.removeAttribute("src")
      image.hidden = true
      return
    }
    image.src = src
    image.hidden = false
  }

  private readDifficultyOption(option: HTMLButtonElement): DifficultyProfile {
    const id = option.dataset["difficulty"]
    if (id === "medium") {
      return DIFFICULTY_PROFILES.medium
    }
    if (id === "hard") {
      return DIFFICULTY_PROFILES.hard
    }
    if (id === "infinite") {
      return DIFFICULTY_PROFILES.infinite
    }
    return DIFFICULTY_PROFILES.easy
  }

  private readGameModeOption(option: HTMLButtonElement): GameModeProfile {
    if (option.dataset["mode"] === "defense") {
      return GAME_MODE_PROFILES.defense
    }
    return GAME_MODE_PROFILES.run
  }

  private canUseDifficulty(difficulty: DifficultyProfile): boolean {
    return difficulty.id !== "infinite" || isInfiniteModeUnlocked(this.selectedGameMode.id)
  }

  private updateDifficultyLocks(): void {
    const unlocked = isInfiniteModeUnlocked(this.selectedGameMode.id)
    for (const option of this.difficultyButtons) {
      if (option.dataset["difficulty"] !== "infinite") {
        continue
      }
      option.disabled = !unlocked
      option.classList.toggle("difficulty-option--locked", !unlocked)
      option.setAttribute("aria-disabled", String(!unlocked))
      const copy = option.querySelector("small")
      if (copy instanceof HTMLElement) {
        copy.textContent = unlocked ? "시간 제한 없는 무한 침공" : "HARD 클리어 후 개방"
      }
    }
  }

  show(): void {
    this.commandCenter.refresh()
    this.el.style.display = "flex"
    this.el.style.opacity = "1"
    const titleLogo = this.el.querySelector(".start-title-logo")
    const subtitle = this.el.querySelector(".game-subtitle")
    const scenarioCard = this.el.querySelector(".scenario-card")
    const modePanel = this.el.querySelector(".mode-panel")
    const difficultyStage = this.el.querySelector(".difficulty-stage")
    const button = this.el.querySelector(".tap-to-start")
    const guideButton = this.gameGuide.trigger
    const commandCenterButton = this.commandCenter.trigger
    const animatedElements = [titleLogo, subtitle, scenarioCard, modePanel, difficultyStage, button, guideButton, commandCenterButton]
    gsap.killTweensOf([this.el, ...animatedElements])
    if (prefersReducedMotion()) {
      gsap.set(animatedElements, { clearProps: "transform,opacity" })
      this.startButton.focus()
      return
    }
    gsap.fromTo(titleLogo, { y: -16, opacity: 0, filter: "brightness(0.9)" }, { y: 0, opacity: 1, filter: START_TITLE_FILTER, duration: 0.55, delay: 0.18, ease: "power2.out" })
    gsap.fromTo(subtitle, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.4, ease: "power2.out" })
    gsap.fromTo(modePanel, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.58, ease: "power2.out" })
    gsap.fromTo(button, { scale: 0.9, opacity: 1 }, { scale: 1, opacity: 1, duration: 0.38, delay: 0.18, ease: "back.out(1.7)" })
    this.startButton.focus()
  }

  hide(options: { readonly immediate?: boolean } = {}): void {
    gsap.killTweensOf(this.el)
    if (options.immediate === true || prefersReducedMotion()) {
      this.el.style.display = "none"
      this.el.style.opacity = "1"
      return
    }

    gsap.to(this.el, {
      opacity: 0,
      duration: 0.24,
      ease: "power1.out",
      onComplete: () => {
        this.el.style.display = "none"
        this.el.style.opacity = "1"
      },
    })
  }
}
