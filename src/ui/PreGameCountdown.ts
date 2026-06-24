const COUNTDOWN_VALUES = [3, 2, 1] as const
const COUNTDOWN_STEP_MS = 1000
const COUNTDOWN_FINAL_INDEX = COUNTDOWN_VALUES.length - 1

declare global {
  interface Window {
    __squadRushQaCountdown?: number
  }
}

export class PreGameCountdown {
  private readonly el: HTMLDivElement
  private readonly valueEl: HTMLDivElement

  constructor(root: HTMLElement) {
    this.el = document.createElement("div")
    this.el.id = "pregame-countdown"
    this.el.setAttribute("aria-live", "assertive")
    this.el.innerHTML = `
      <div class="pregame-countdown-inner">
        <div class="pregame-countdown-kicker">RUNWAY SYNC</div>
        <div class="pregame-countdown-value" data-role="countdown">3</div>
        <div class="pregame-countdown-status">Squad entering lane</div>
      </div>
    `
    root.appendChild(this.el)
    const valueEl = this.el.querySelector("[data-role='countdown']")
    if (!(valueEl instanceof HTMLDivElement)) {
      throw new Error("Countdown value missing")
    }
    this.valueEl = valueEl
    this.hide()
  }

  async run(prepare: () => void, onStep?: (value: number) => void): Promise<void> {
    this.show(COUNTDOWN_VALUES[0])
    await nextPaint()
    const prepareDone = runPrepare(prepare)
    for (let index = 0; index < COUNTDOWN_VALUES.length; index += 1) {
      const value = COUNTDOWN_VALUES[index]
      if (value === undefined) {
        continue
      }
      this.setValue(value)
      onStep?.(value)
      await delay(COUNTDOWN_STEP_MS)
    }
    await prepareDone
    this.hide()
  }

  show(value: number): void {
    this.setValue(value)
    this.el.style.display = "flex"
  }

  hide(): void {
    this.el.style.display = "none"
    delete window.__squadRushQaCountdown
  }

  private setValue(value: number): void {
    this.valueEl.textContent = String(value)
    this.el.style.setProperty("--countdown-progress", String((COUNTDOWN_VALUES[0] - value) / COUNTDOWN_FINAL_INDEX))
    window.__squadRushQaCountdown = value
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => window.setTimeout(resolveDelay, ms))
}

function runPrepare(prepare: () => void): Promise<void> {
  return new Promise((resolvePrepare, rejectPrepare) => {
    window.requestAnimationFrame(() => {
      try {
        prepare()
        resolvePrepare()
      } catch (error: unknown) {
        rejectPrepare(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}

function nextPaint(): Promise<void> {
  return new Promise((resolvePaint) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolvePaint()))
  })
}
