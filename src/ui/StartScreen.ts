import { gsap } from "gsap"
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_PROFILES,
  type DifficultyProfile,
} from "../game/data/difficultyData"
import { prefersReducedMotion } from "./motionPreference"

export class StartScreen {
  private readonly el: HTMLDivElement
  private readonly startButton: HTMLButtonElement
  private readonly difficultyButtons: readonly HTMLButtonElement[]
  private selectedDifficulty: DifficultyProfile = DEFAULT_DIFFICULTY
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
  onStart?: (difficulty: DifficultyProfile) => void
  onDifficultyChange?: (difficulty: DifficultyProfile) => void

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "start-screen"
    this.el.innerHTML = `
      <div class="start-inner">
        <div class="game-kicker">TACTICAL RUNNER</div>
        <h1 class="game-title">바로 Go 스쿼드</h1>
        <p class="game-subtitle">Survive the lane. Grow the squad. Break the titan.</p>
        <div class="mission-strip" aria-label="Run briefing">
          <div><span>START</span><strong>1</strong><small>SOLDIER</small></div>
          <div><span>RUN</span><strong>54s</strong><small>SLICE</small></div>
          <div><span>THREAT</span><strong>460+</strong><small>HOSTILES</small></div>
        </div>
        <div class="difficulty-panel" role="radiogroup" aria-label="Difficulty">
          <button class="difficulty-option" type="button" data-difficulty="easy" role="radio" aria-checked="true">
            <span>EASY</span><strong>기본 런</strong><small>완성된 현재 밸런스</small>
          </button>
          <button class="difficulty-option" type="button" data-difficulty="medium" role="radio" aria-checked="false">
            <span>NORMAL</span><strong>강화 런</strong><small>적 밀도와 체력 상승</small>
          </button>
          <button class="difficulty-option" type="button" data-difficulty="hard" role="radio" aria-checked="false">
            <span>HARD</span><strong>위험 런</strong><small>고밀도 고피해 압박</small>
          </button>
        </div>
        <p class="difficulty-brief" data-role="difficulty-brief">기존 밸런스 그대로 시작합니다.</p>
        <button class="tap-to-start" type="button">TAP TO START</button>
        <div class="controls-hint">
          <span>Mouse drag</span>
          <span>Touch drag</span>
          <span>A/D keys</span>
        </div>
      </div>
    `
    root.appendChild(this.el)
    const button = this.el.querySelector(".tap-to-start")
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Start screen button missing")
    }
    this.startButton = button
    this.difficultyButtons = Array.from(this.el.querySelectorAll(".difficulty-option")).filter((option) => option instanceof HTMLButtonElement)
    for (const option of this.difficultyButtons) {
      option.addEventListener("click", () => {
        const difficulty = this.readDifficultyOption(option)
        this.setDifficulty(difficulty)
      })
    }
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
    this.onStart?.(this.selectedDifficulty)
  }

  setDifficulty(difficulty: DifficultyProfile): void {
    this.selectedDifficulty = difficulty
    for (const option of this.difficultyButtons) {
      const optionDifficulty = this.readDifficultyOption(option)
      const selected = optionDifficulty.id === difficulty.id
      option.classList.toggle("difficulty-option--selected", selected)
      option.setAttribute("aria-checked", String(selected))
    }
    const brief = this.el.querySelector("[data-role='difficulty-brief']")
    if (brief instanceof HTMLElement) {
      brief.textContent = difficulty.briefing
    }
    this.onDifficultyChange?.(difficulty)
  }

  private readDifficultyOption(option: HTMLButtonElement): DifficultyProfile {
    const id = option.dataset["difficulty"]
    if (id === "medium") {
      return DIFFICULTY_PROFILES.medium
    }
    if (id === "hard") {
      return DIFFICULTY_PROFILES.hard
    }
    return DIFFICULTY_PROFILES.easy
  }

  show(): void {
    this.el.style.display = "flex"
    this.el.style.opacity = "1"
    const title = this.el.querySelector(".game-title")
    const subtitle = this.el.querySelector(".game-subtitle")
    const missionStrip = this.el.querySelector(".mission-strip")
    const difficultyPanel = this.el.querySelector(".difficulty-panel")
    const button = this.el.querySelector(".tap-to-start")
    const animatedElements = [title, subtitle, missionStrip, difficultyPanel, button]
    gsap.killTweensOf([this.el, ...animatedElements])
    if (prefersReducedMotion()) {
      gsap.set(animatedElements, { clearProps: "transform,opacity" })
      this.startButton.focus()
      return
    }
    gsap.fromTo(title, { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" })
    gsap.fromTo(subtitle, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.4, ease: "power2.out" })
    gsap.fromTo(missionStrip, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.58, ease: "power2.out" })
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
