import curve from "./defenseBalanceCurve.json"
import type { DifficultyId } from "./difficultyData"
import type { DefensePressureState } from "../systems/DefenseWaveTuning"

export const DEFENSE_BALANCE_CURVE = curve

const STATE_ORDER: readonly DefensePressureState[] = [
  "onboarding_crowd",
  "contested_pickup",
  "boss_jam",
  "recovery_burst",
  "final_squeeze",
]

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function sampleAnchors(anchors: readonly (readonly number[])[], p: number): number {
  const ratio = clamp01(p)
  let previous = anchors[0] ?? [0, 0]
  for (const anchor of anchors) {
    const [anchorP = 0, anchorValue = 0] = anchor
    if (ratio <= anchorP) {
      const [prevP = 0, prevValue = 0] = previous
      const span = anchorP - prevP
      if (span <= 0) {
        return anchorValue
      }
      return prevValue + (anchorValue - prevValue) * ((ratio - prevP) / span)
    }
    previous = anchor
  }
  const [, lastValue = 0] = previous
  return lastValue
}

export function getDefensePressureStateForRatio(p: number): DefensePressureState {
  const [b0 = 0.22, b1 = 0.38, b2 = 0.62, b3 = 0.78] = curve.stateBoundaries
  if (p < b0) return "onboarding_crowd"
  if (p < b1) return "contested_pickup"
  if (p < b2) return "boss_jam"
  if (p < b3) return "recovery_burst"
  return "final_squeeze"
}

function sampleStateValue(p: number, pick: (state: DefensePressureState) => number): number {
  const ratio = clamp01(p)
  const state = getDefensePressureStateForRatio(ratio)
  const stateIndex = STATE_ORDER.indexOf(state)
  const blend = curve.boundaryBlend
  for (const boundary of curve.stateBoundaries) {
    if (Math.abs(ratio - boundary) < blend) {
      const before = STATE_ORDER[Math.max(0, ratio < boundary ? stateIndex : stateIndex - 1)] ?? state
      const after = STATE_ORDER[Math.min(STATE_ORDER.length - 1, ratio < boundary ? stateIndex + 1 : stateIndex)] ?? state
      const t = (ratio - (boundary - blend)) / (blend * 2)
      return pick(before) + (pick(after) - pick(before)) * clamp01(t)
    }
  }
  return pick(state)
}

export function getTargetEap(p: number): number {
  return sampleAnchors(curve.eapAnchors, p)
}

export function getTargetDps(p: number): number {
  return getTargetEap(p) * curve.fireRate
}

export function getExpectedProjectileCount(p: number): number {
  return sampleAnchors(curve.projectileAnchors, p)
}

function getDerivation(difficultyId: DifficultyId): typeof curve.difficultyDerivation.easy {
  return curve.difficultyDerivation[difficultyId]
}

export function getDefenseBalanceFactor(p: number, difficultyId: DifficultyId): number {
  const factor = sampleStateValue(p, (state) => curve.states[state].balanceFactor)
  return Math.min(factor, getDerivation(difficultyId).balanceCap)
}

export function getDefenseInfluxHpPerSecond(p: number, difficultyId: DifficultyId): number {
  return getTargetDps(p) * getDefenseBalanceFactor(p, difficultyId) * getDerivation(difficultyId).influx
}

export function getDefenseBasicMonsterHp(p: number): number {
  const bulletDamage = getTargetEap(p) / Math.max(1, getExpectedProjectileCount(p))
  const shots = sampleStateValue(p, (state) => curve.states[state].shotsToKill)
  return Math.max(1, bulletDamage * shots)
}

export function getDefenseMonsterMix(p: number): { readonly basic: number; readonly fast: number; readonly brute: number } {
  return {
    basic: sampleStateValue(p, (state) => curve.states[state].mix.basic),
    fast: sampleStateValue(p, (state) => curve.states[state].mix.fast),
    brute: sampleStateValue(p, (state) => curve.states[state].mix.brute),
  }
}

export function getDefenseAverageMonsterHp(p: number): number {
  const mix = getDefenseMonsterMix(p)
  const basicHp = getDefenseBasicMonsterHp(p)
  return basicHp * (
    mix.basic * curve.monsterHpRatios.basic
    + mix.fast * curve.monsterHpRatios.fast
    + mix.brute * curve.monsterHpRatios.brute
  )
}

export function getDefenseInfluxCountPerSecond(p: number, difficultyId: DifficultyId): number {
  return getDefenseInfluxHpPerSecond(p, difficultyId) / getDefenseAverageMonsterHp(p)
}

export function getDefenseSpawnCountPerBatch(p: number, difficultyId: DifficultyId): number {
  const batchesPerSecond = curve.contentScrollSpeed / curve.spawnSpacing
  return getDefenseInfluxCountPerSecond(p, difficultyId) / batchesPerSecond
}

export function getDefenseVisibleTargetBand(p: number, difficultyId: DifficultyId): { readonly min: number; readonly max: number } {
  const scale = getDerivation(difficultyId).visibleTarget
  return {
    min: Math.round(sampleStateValue(p, (state) => curve.states[state].visibleTarget[0] ?? 0) * scale),
    max: Math.round(sampleStateValue(p, (state) => curve.states[state].visibleTarget[1] ?? 0) * scale),
  }
}

export function getDefenseBossEffectiveHp(p: number, difficultyId: DifficultyId): number {
  return getTargetDps(p) * curve.boss.focusRatio * curve.boss.killTimeSeconds * getDerivation(difficultyId).bossHp
}
