import { MONSTER_BEHAVIORS, type MonsterBehavior, type MonsterConfig } from "./data/monsterData"

export const MONSTER_CHARGE_PHASES = {
  approach: "APPROACH",
  windup: "WINDUP",
  charge: "CHARGE",
} as const

export type MonsterChargePhase = (typeof MONSTER_CHARGE_PHASES)[keyof typeof MONSTER_CHARGE_PHASES]

export type MonsterRoleState = {
  shieldHp: number
  shieldMaxHp: number
  chargePhase: MonsterChargePhase
  chargeTimer: number
  cuePhase: number
}

export function createMonsterRoleState(): MonsterRoleState {
  return {
    shieldHp: 0,
    shieldMaxHp: 0,
    chargePhase: MONSTER_CHARGE_PHASES.approach,
    chargeTimer: 0,
    cuePhase: 0,
  }
}

export function resetMonsterRoleState(state: MonsterRoleState, config: MonsterConfig): void {
  const shieldRatio = config.role?.shield?.hpRatio ?? 0
  state.shieldMaxHp = shieldRatio > 0
    ? Math.max(1, Math.ceil(config.hp * shieldRatio))
    : 0
  state.shieldHp = state.shieldMaxHp
  state.chargePhase = MONSTER_CHARGE_PHASES.approach
  state.chargeTimer = 0
  state.cuePhase = 0
}

export function updateMonsterRoleState(
  state: MonsterRoleState,
  config: MonsterConfig,
  distanceAhead: number,
  dt: number,
): void {
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0
  state.cuePhase = (state.cuePhase + elapsed) % 60
  const charge = config.role?.charge
  if (charge === undefined || state.chargePhase === MONSTER_CHARGE_PHASES.charge) {
    return
  }
  if (
    state.chargePhase === MONSTER_CHARGE_PHASES.approach
    && distanceAhead > 0
    && distanceAhead <= charge.triggerDistance
  ) {
    state.chargePhase = MONSTER_CHARGE_PHASES.windup
    state.chargeTimer = charge.windupSeconds
  }
  if (state.chargePhase !== MONSTER_CHARGE_PHASES.windup) {
    return
  }
  state.chargeTimer = Math.max(0, state.chargeTimer - elapsed)
  if (state.chargeTimer <= 0) {
    state.chargePhase = MONSTER_CHARGE_PHASES.charge
  }
}

export function getMonsterRoleSpeedMultiplier(state: MonsterRoleState, config: MonsterConfig): number {
  const charge = config.role?.charge
  if (charge === undefined) {
    return 1
  }
  if (state.chargePhase === MONSTER_CHARGE_PHASES.windup) {
    return charge.windupSpeedMultiplier
  }
  if (state.chargePhase === MONSTER_CHARGE_PHASES.charge) {
    return charge.chargeSpeedMultiplier
  }
  return 1
}

export function getMonsterContactDamageMultiplier(state: MonsterRoleState, config: MonsterConfig): number {
  const charge = config.role?.charge
  return charge !== undefined && state.chargePhase === MONSTER_CHARGE_PHASES.charge
    ? charge.chargeDamageMultiplier
    : 1
}

export function getMonsterTargetPriorityMultiplier(state: MonsterRoleState, config: MonsterConfig): number {
  if (config.behavior === MONSTER_BEHAVIORS.splitter) {
    return 0.72
  }
  if (config.behavior !== MONSTER_BEHAVIORS.charger) {
    return 1
  }
  if (state.chargePhase === MONSTER_CHARGE_PHASES.windup) {
    return 0.48
  }
  if (state.chargePhase === MONSTER_CHARGE_PHASES.charge) {
    return 0.32
  }
  return 0.85
}

export function getMonsterSplitChildCount(config: MonsterConfig): number {
  const count = config.role?.split?.childCount ?? 0
  return Math.max(0, Math.min(3, Math.floor(count)))
}

export function getMonsterSplitChildLateralOffset(
  config: MonsterConfig,
  childIndex: number,
): number {
  const split = config.role?.split
  const count = getMonsterSplitChildCount(config)
  if (split === undefined || count <= 1) {
    return 0
  }
  const index = Math.max(0, Math.min(count - 1, Math.floor(childIndex)))
  return ((index / (count - 1)) * 2 - 1) * Math.max(0, split.lateralOffset)
}

export function getMonsterSplitChildForwardOffset(config: MonsterConfig): number {
  const forwardOffset = config.role?.split?.forwardOffset
  return forwardOffset === undefined ? 0 : Math.max(0.5, Math.min(2, forwardOffset))
}

export function shouldSpawnMonsterSplitChildren(
  config: MonsterConfig,
  killedByProjectile: boolean,
): boolean {
  return killedByProjectile
    && config.role?.split !== undefined
    && getMonsterSplitChildCount(config) > 0
}

export function getMonsterDamageAttributionBehavior(config: MonsterConfig | null): MonsterBehavior {
  return config?.id === "splitling"
    ? MONSTER_BEHAVIORS.splitter
    : config?.behavior ?? MONSTER_BEHAVIORS.basic
}

export function getMonsterRoleCueIntensity(state: MonsterRoleState, config: MonsterConfig): number {
  const charge = config.role?.charge
  if (charge === undefined || state.chargePhase === MONSTER_CHARGE_PHASES.approach) {
    return 0
  }
  if (state.chargePhase === MONSTER_CHARGE_PHASES.charge) {
    return 1
  }
  const progress = charge.windupSeconds <= 0
    ? 1
    : 1 - state.chargeTimer / charge.windupSeconds
  return 0.35 + Math.max(0, Math.min(1, progress)) * 0.65
}

export function previewMonsterProjectileDamage(
  state: MonsterRoleState,
  config: MonsterConfig,
  incomingDamage: number,
): number {
  const damage = Number.isFinite(incomingDamage) ? Math.max(0, incomingDamage) : 0
  const shield = config.role?.shield
  if (shield === undefined || state.shieldHp <= 0 || damage <= 0) {
    return damage
  }
  const shieldedDamage = Math.min(state.shieldHp, damage)
  const overflowDamage = Math.max(0, damage - shieldedDamage)
  const reduction = Math.max(0, Math.min(0.95, shield.damageReduction))
  return shieldedDamage * (1 - reduction) + overflowDamage
}

export function applyMonsterProjectileDamage(
  state: MonsterRoleState,
  config: MonsterConfig,
  incomingDamage: number,
): number {
  const damage = Number.isFinite(incomingDamage) ? Math.max(0, incomingDamage) : 0
  const shieldedDamage = Math.min(state.shieldHp, damage)
  const resolvedDamage = previewMonsterProjectileDamage(state, config, damage)
  state.shieldHp = Math.max(0, state.shieldHp - shieldedDamage)
  return resolvedDamage
}

export function isMonsterCombatRole(config: MonsterConfig): boolean {
  return config.behavior === MONSTER_BEHAVIORS.shield
    || config.behavior === MONSTER_BEHAVIORS.charger
    || config.behavior === MONSTER_BEHAVIORS.splitter
}
