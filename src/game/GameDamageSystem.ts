import type { Hud } from "../ui/Hud"
import {
  MONSTER_BEHAVIORS,
  MONSTER_KILL_REASONS,
  MONSTER_TACTICAL_GUIDANCE,
  type MonsterBehavior,
} from "./data/monsterData"
import { UNIT_DEFINITIONS } from "./data/squadRosterData"
import type { AudioSystem } from "./systems/AudioSystem"
import type { CollisionSystem } from "./systems/CollisionSystem"
import type { FXSystem } from "./systems/FXSystem"
import type { MonsterWaveSystem } from "./systems/MonsterWaveSystem"
import type { ShootingSystem } from "./systems/ShootingSystem"
import type { SquadSystem } from "./systems/SquadSystem"

const MONSTER_BREACH_CASUALTIES = 1
const SQUAD_HIT_RECOVERY_SECONDS = 1.25

export type CombatDamageCause = MonsterBehavior | "BREACH"

export type CombatInsight = {
  readonly cause: CombatDamageCause | null
  readonly label: string
  readonly casualties: number
  readonly detail: string
}

const DAMAGE_CAUSE_ORDER = [
  MONSTER_BEHAVIORS.splitter,
  MONSTER_BEHAVIORS.charger,
  MONSTER_BEHAVIORS.shield,
  MONSTER_BEHAVIORS.tank,
  MONSTER_BEHAVIORS.fast,
  MONSTER_BEHAVIORS.basic,
  "BREACH",
] as const satisfies readonly CombatDamageCause[]

type GameDamageDeps = {
  readonly audio: AudioSystem
  readonly collision: CollisionSystem
  readonly fx: FXSystem
  readonly hud: Hud
  readonly shooting: ShootingSystem
  readonly squad: SquadSystem
  readonly waves: MonsterWaveSystem
}

export class GameDamageSystem {
  private popupAmount = 0
  private popupLaneX = 0
  private popupTimer = 0
  private squadHitRecovery = 0
  private readonly casualtiesByCause: Record<CombatDamageCause, number> = {
    [MONSTER_BEHAVIORS.basic]: 0,
    [MONSTER_BEHAVIORS.fast]: 0,
    [MONSTER_BEHAVIORS.shield]: 0,
    [MONSTER_BEHAVIORS.charger]: 0,
    [MONSTER_BEHAVIORS.splitter]: 0,
    [MONSTER_BEHAVIORS.tank]: 0,
    BREACH: 0,
  }

  constructor(private readonly deps: GameDamageDeps) {}

  queueShotDamage(damage: number, laneX: number): void {
    this.popupAmount += damage
    this.popupLaneX = this.popupAmount > damage ? (this.popupLaneX + laneX) * 0.5 : laneX
    this.popupTimer = Math.max(this.popupTimer, 0.25)
  }

  update(dt: number): void {
    this.squadHitRecovery = Math.max(0, this.squadHitRecovery - dt)
    this.resolveMonsterHits()
    this.resolveEscapedMonsters()
    this.flushShotDamage(dt)
  }

  private resolveMonsterHits(): void {
    let canDamageSquad = this.squadHitRecovery <= 0
    for (const monster of this.deps.collision.checkMonsterSquadCollision()) {
      if (this.deps.shooting.willReservedImpactKill(monster)) {
        continue
      }
      if (!canDamageSquad) {
        continue
      }
      const behavior = this.deps.waves.getMonsterDamageBehavior(monster)
      const damage = this.deps.waves.resolveIncomingDamage(this.deps.waves.getMonsterContactDamage(monster))
      if (damage > 0) {
        this.applySquadDamage(damage, monster.mesh.position.x, behavior)
        this.squadHitRecovery = SQUAD_HIT_RECOVERY_SECONDS
        canDamageSquad = false
      }
      this.deps.waves.kill(monster, MONSTER_KILL_REASONS.contact)
      this.deps.fx.playHitSpark(monster.mesh.position)
      this.deps.audio.playHit()
    }
  }

  private resolveEscapedMonsters(): void {
    const escapedThreat = this.deps.waves.consumeEscapedThreat()
    if (escapedThreat.damage <= 0) {
      return
    }
    this.applySquadDamage(escapedThreat.damage, 0, escapedThreat.behavior)
  }

  applyMonsterBreaches(monsterCount: number, laneX: number): void {
    const breachCount = Math.max(0, Math.floor(monsterCount))
    this.applySquadDamage(breachCount * MONSTER_BREACH_CASUALTIES, laneX, "BREACH")
  }

  getCombatInsight(): CombatInsight {
    let dominantCause: CombatDamageCause | null = null
    let dominantCasualties = 0
    let totalCasualties = 0
    for (const cause of DAMAGE_CAUSE_ORDER) {
      const casualties = this.casualtiesByCause[cause]
      totalCasualties += casualties
      if (casualties > dominantCasualties) {
        dominantCause = cause
        dominantCasualties = casualties
      }
    }
    if (dominantCause === null || totalCasualties <= 0) {
      return {
        cause: null,
        label: "대형 유지",
        casualties: 0,
        detail: "사상자 없이 전선을 유지했습니다. 청색 방패는 사선을 바꾸고, 황색 돌진 신호는 옆 라인으로 피하세요.",
      }
    }
    if (dominantCause === "BREACH") {
      return {
        cause: dominantCause,
        label: "방어선 돌파",
        casualties: dominantCasualties,
        detail: "후방으로 통과한 적이 가장 큰 피해를 냈습니다. 중앙에만 머물지 말고 비어 있는 사선을 먼저 정리하세요.",
      }
    }
    const guidance = MONSTER_TACTICAL_GUIDANCE[dominantCause]
    return {
      cause: dominantCause,
      label: guidance.label,
      casualties: dominantCasualties,
      detail: guidance.counter,
    }
  }

  private applySquadDamage(damage: number, laneX: number, cause: CombatDamageCause): void {
    if (window.location.search.includes("qaNoDamage=1")) {
      return
    }
    const resolvedDamage = Math.max(0, Math.floor(damage))
    if (resolvedDamage <= 0) {
      return
    }
    const absorbed = this.deps.squad.absorbShieldDamage(resolvedDamage)
    const casualties = resolvedDamage - absorbed
    const removedUnits = this.deps.squad.removeSoldiers(casualties)
    if (removedUnits.length > 0) {
      const removedCount = removedUnits.reduce((total, removedUnit) => total + removedUnit.count, 0)
      this.casualtiesByCause[cause] += removedCount
      this.deps.hud.showCasualties(removedUnits.map((removedUnit) => {
        const definition = UNIT_DEFINITIONS[removedUnit.unit]
        return {
          label: definition.label,
          color: definition.color,
          portraitSrc: definition.portraitSrc,
          count: removedUnit.count,
        }
      }))
      this.deps.hud.showDamage(removedCount, laneX)
    }
  }

  private flushShotDamage(dt: number): void {
    if (this.popupAmount <= 0) {
      return
    }
    this.popupTimer -= dt
    if (this.popupTimer > 0) {
      return
    }
    this.deps.hud.showDamage(this.popupAmount, this.popupLaneX)
    this.popupAmount = 0
    this.popupLaneX = 0
  }
}
