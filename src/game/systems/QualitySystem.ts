import type { AbstractEngine } from "@babylonjs/core"
import { measureFPS } from "../utils/perf"

export type QualityLevel = "low" | "medium" | "high"

export type QualitySettings = {
  readonly renderScale: number
  readonly maxSoldiers: number
  readonly maxMonsters: number
  readonly particleMultiplier: number
  readonly shadowEnabled: boolean
  readonly postProcessEnabled: boolean
  readonly animationSkipRate: number
}

const QUALITY_LEVELS: readonly QualityLevel[] = ["low", "medium", "high"] as const
const PORTRAIT_AUTO_HIGH_WIDTH = 520
const PORTRAIT_AUTO_HIGH_HEIGHT = 700

const PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    renderScale: 0.7,
    maxSoldiers: 30,
    maxMonsters: 140,
    particleMultiplier: 0.35,
    shadowEnabled: false,
    postProcessEnabled: false,
    animationSkipRate: 3,
  },
  medium: {
    renderScale: 0.85,
    maxSoldiers: 30,
    maxMonsters: 180,
    particleMultiplier: 0.65,
    shadowEnabled: false,
    postProcessEnabled: false,
    animationSkipRate: 2,
  },
  high: {
    renderScale: 1,
    maxSoldiers: 30,
    maxMonsters: 360,
    particleMultiplier: 1,
    shadowEnabled: false,
    postProcessEnabled: true,
    animationSkipRate: 0,
  },
} as const

const WEBKIT_MOBILE_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    ...PRESETS.low,
    renderScale: 0.62,
    maxMonsters: 120,
    particleMultiplier: 0.28,
    animationSkipRate: 5,
  },
  medium: {
    ...PRESETS.medium,
    renderScale: 0.58,
    maxMonsters: 130,
    particleMultiplier: 0.3,
    animationSkipRate: 7,
  },
  high: {
    ...PRESETS.high,
    renderScale: 0.76,
    maxMonsters: 220,
    particleMultiplier: 0.58,
    postProcessEnabled: false,
    animationSkipRate: 3,
  },
} as const

const FIREFOX_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    ...PRESETS.low,
    renderScale: 0.64,
    maxMonsters: 120,
    particleMultiplier: 0.28,
    animationSkipRate: 5,
  },
  medium: {
    ...PRESETS.medium,
    renderScale: 0.66,
    maxMonsters: 150,
    particleMultiplier: 0.42,
    animationSkipRate: 5,
  },
  high: {
    ...PRESETS.high,
    renderScale: 0.74,
    maxMonsters: 220,
    particleMultiplier: 0.56,
    postProcessEnabled: false,
    animationSkipRate: 4,
  },
} as const

const PORTRAIT_AUTO_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    ...PRESETS.low,
    renderScale: 0.66,
    maxMonsters: 130,
    particleMultiplier: 0.32,
    animationSkipRate: 4,
  },
  medium: {
    ...PRESETS.medium,
    renderScale: 0.62,
    maxMonsters: 150,
    particleMultiplier: 0.42,
    animationSkipRate: 5,
  },
  high: {
    ...PRESETS.high,
    renderScale: 0.78,
    maxMonsters: 220,
    particleMultiplier: 0.58,
    postProcessEnabled: false,
    animationSkipRate: 3,
  },
} as const

export class QualitySystem {
  level: QualityLevel = "medium"
  settings: QualitySettings = PRESETS.medium
  private autoPortraitMode = false

  async autoDetect(engine: AbstractEngine): Promise<void> {
    const override = this.readUrlOverride()
    if (override !== null) {
      this.autoPortraitMode = false
      this.applyLevel(engine, override)
      return
    }

    this.autoPortraitMode = this.isPortraitMobileViewport()
    const fps = await measureFPS(3000)
    this.level = this.capAutoLevelForViewport(this.detectLevel(fps))
    this.applyLevel(engine, this.level)
  }

  private applyLevel(engine: AbstractEngine, level: QualityLevel): void {
    this.level = level
    this.settings = this.getSettings(level)
    engine.setHardwareScalingLevel(1 / this.settings.renderScale)
  }

  private getSettings(level: QualityLevel): QualitySettings {
    if (this.isWebKitMobile()) {
      return WEBKIT_MOBILE_PRESETS[level]
    }
    if (this.isFirefox()) {
      return FIREFOX_PRESETS[level]
    }
    if (this.autoPortraitMode) {
      return PORTRAIT_AUTO_PRESETS[level]
    }
    return PRESETS[level]
  }

  private isWebKitMobile(): boolean {
    const ua = navigator.userAgent
    return ua.includes("AppleWebKit")
      && ua.includes("Mobile")
      && !ua.includes("CriOS")
      && !ua.includes("FxiOS")
  }

  private isFirefox(): boolean {
    return navigator.userAgent.includes("Firefox/")
  }

  private detectLevel(fps: number): QualityLevel {
    if (fps >= 50) {
      return "high"
    }
    if (fps >= 28) {
      return "medium"
    }
    return "low"
  }

  private capAutoLevelForViewport(level: QualityLevel): QualityLevel {
    if (level === "high") {
      return "medium"
    }
    return level
  }

  private isPortraitMobileViewport(): boolean {
    return window.innerWidth <= PORTRAIT_AUTO_HIGH_WIDTH && window.innerHeight >= PORTRAIT_AUTO_HIGH_HEIGHT
  }

  private readUrlOverride(): QualityLevel | null {
    const params = new URLSearchParams(window.location.search)
    const requestedQuality = params.get("quality")
    for (const level of QUALITY_LEVELS) {
      if (requestedQuality === level) {
        return level
      }
    }
    return null
  }
}

export const qualitySystem = new QualitySystem()
