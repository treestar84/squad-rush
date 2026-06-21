import type { Engine } from "@babylonjs/core"
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

const PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    renderScale: 0.7,
    maxSoldiers: 24,
    maxMonsters: 48,
    particleMultiplier: 0.35,
    shadowEnabled: false,
    postProcessEnabled: false,
    animationSkipRate: 3,
  },
  medium: {
    renderScale: 0.85,
    maxSoldiers: 44,
    maxMonsters: 78,
    particleMultiplier: 0.65,
    shadowEnabled: false,
    postProcessEnabled: false,
    animationSkipRate: 2,
  },
  high: {
    renderScale: 1,
    maxSoldiers: 60,
    maxMonsters: 110,
    particleMultiplier: 1,
    shadowEnabled: false,
    postProcessEnabled: true,
    animationSkipRate: 0,
  },
} as const

export class QualitySystem {
  level: QualityLevel = "medium"
  settings: QualitySettings = PRESETS.medium

  async autoDetect(engine: Engine): Promise<void> {
    const fps = await measureFPS(3000)
    if (fps >= 50) {
      this.level = "high"
    } else if (fps >= 28) {
      this.level = "medium"
    } else {
      this.level = "low"
    }
    this.settings = PRESETS[this.level]
    engine.setHardwareScalingLevel(1 / this.settings.renderScale)
    console.info(`[Quality] detected fps=${fps.toFixed(1)} -> ${this.level}`)
  }
}

export const qualitySystem = new QualitySystem()
