import { MONSTER_BEHAVIORS, type MonsterBehavior } from "../data/monsterData"
import type { MonsterInstance } from "../pools/MonsterPool"

type ShootingHitDebugState = {
  readonly normalShots: number
  readonly normalImpacts: number
  readonly normalKills: number
  readonly missedNormalImpacts: number
  readonly staleNormalImpacts: number
  readonly multiDamageImpacts: number
  readonly reservedTargets: number
  readonly minNormalHitRadius: number
  readonly maxNormalHitRadius: number
  readonly minNormalHitHalfDepth: number
  readonly maxNormalHitHalfDepth: number
  readonly minNormalImpactInset: number
  readonly maxNormalImpactInset: number
}

type ShotRecord = {
  readonly target: MonsterInstance
  readonly impactInset: number
}

type ImpactRecord = {
  readonly wasAlive: boolean
  readonly killed: boolean
  readonly damagedTargets: number
  readonly behavior: MonsterBehavior | null
}

declare global {
  interface Window {
    __squadRushHitDebug?: ShootingHitDebugState
  }
}

export class ShootingHitDebug {
  private readonly enabled = window.location.search.includes("qa=projectile") || window.location.search.includes("qa=hit-sync")
  private normalShots = 0
  private normalImpacts = 0
  private normalKills = 0
  private missedNormalImpacts = 0
  private staleNormalImpacts = 0
  private multiDamageImpacts = 0
  private minNormalHitRadius = Number.POSITIVE_INFINITY
  private maxNormalHitRadius = 0
  private minNormalHitHalfDepth = Number.POSITIVE_INFINITY
  private maxNormalHitHalfDepth = 0
  private minNormalImpactInset = Number.POSITIVE_INFINITY
  private maxNormalImpactInset = 0

  recordShot(record: ShotRecord): void {
    if (this.isNormal(record.target)) {
      this.normalShots += 1
      this.minNormalHitRadius = Math.min(this.minNormalHitRadius, record.target.hitRadius)
      this.maxNormalHitRadius = Math.max(this.maxNormalHitRadius, record.target.hitRadius)
      this.minNormalHitHalfDepth = Math.min(this.minNormalHitHalfDepth, record.target.hitHalfDepth)
      this.maxNormalHitHalfDepth = Math.max(this.maxNormalHitHalfDepth, record.target.hitHalfDepth)
      this.minNormalImpactInset = Math.min(this.minNormalImpactInset, record.impactInset)
      this.maxNormalImpactInset = Math.max(this.maxNormalImpactInset, record.impactInset)
    }
  }

  recordImpact(record: ImpactRecord): void {
    if (!this.isNormalBehavior(record.behavior)) {
      return
    }
    this.normalImpacts += 1
    if (!record.wasAlive) {
      this.missedNormalImpacts += 1
    }
    if (record.killed) {
      this.normalKills += 1
    }
    if (record.damagedTargets > 1) {
      this.multiDamageImpacts += 1
    }
  }

  recordStaleImpact(behavior: MonsterBehavior | null): void {
    if (this.isNormalBehavior(behavior)) {
      this.staleNormalImpacts += 1
    }
  }

  publish(reservedTargets: number): void {
    if (!this.enabled) {
      return
    }
    window.__squadRushHitDebug = {
      normalShots: this.normalShots,
      normalImpacts: this.normalImpacts,
      normalKills: this.normalKills,
      missedNormalImpacts: this.missedNormalImpacts,
      staleNormalImpacts: this.staleNormalImpacts,
      multiDamageImpacts: this.multiDamageImpacts,
      reservedTargets,
      minNormalHitRadius: this.finiteOrZero(this.minNormalHitRadius),
      maxNormalHitRadius: this.maxNormalHitRadius,
      minNormalHitHalfDepth: this.finiteOrZero(this.minNormalHitHalfDepth),
      maxNormalHitHalfDepth: this.maxNormalHitHalfDepth,
      minNormalImpactInset: this.finiteOrZero(this.minNormalImpactInset),
      maxNormalImpactInset: this.maxNormalImpactInset,
    }
  }

  private isNormal(target: MonsterInstance): boolean {
    return this.isNormalBehavior(target.config?.behavior ?? null)
  }

  private isNormalBehavior(behavior: MonsterBehavior | null): boolean {
    return behavior === MONSTER_BEHAVIORS.basic
  }

  private finiteOrZero(value: number): number {
    return Number.isFinite(value) ? value : 0
  }
}
