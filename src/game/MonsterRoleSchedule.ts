export type MonsterCombatRoleSpawnCounts = {
  readonly shield: number
  readonly charger: number
  readonly splitter: number
}

const NO_COMBAT_ROLES: MonsterCombatRoleSpawnCounts = { shield: 0, charger: 0, splitter: 0 }

export function getAttackCombatRoleSpawnCounts(
  curveZ: number,
  spawnOrdinal: number,
): MonsterCombatRoleSpawnCounts {
  const ordinal = Math.max(0, Math.floor(spawnOrdinal))
  if (curveZ < 96) {
    return NO_COMBAT_ROLES
  }
  if (curveZ < 132) {
    return { shield: 0, charger: ordinal % 7 === 0 ? 1 : 0, splitter: 0 }
  }
  if (curveZ < 190) {
    return {
      shield: ordinal % 7 === 0 ? 1 : 0,
      charger: ordinal % 6 === 0 ? 1 : 0,
      splitter: 0,
    }
  }
  if (curveZ < 250) {
    const shield = ordinal % 5 === 0 ? 1 : 0
    const charger = ordinal % 4 === 0 ? 1 : 0
    return {
      shield,
      charger,
      splitter: shield === 0 && charger === 0 && ordinal % 8 === 3 ? 1 : 0,
    }
  }
  const shield = ordinal % 4 === 0 ? 1 : 0
  const charger = ordinal % 3 === 0 ? 1 : 0
  return {
    shield,
    charger,
    splitter: shield === 0 && charger === 0 && ordinal % 7 === 0 ? 1 : 0,
  }
}

export function getDefenseCombatRoleSpawnCounts(
  progressRatio: number,
  spawnOrdinal: number,
): MonsterCombatRoleSpawnCounts {
  const progress = Math.max(0, Math.min(1, progressRatio))
  const ordinal = Math.max(0, Math.floor(spawnOrdinal))
  const shieldInterval = progress >= 0.78 ? 7 : 12
  const chargerInterval = progress >= 0.78 ? 8 : 14
  const splitterInterval = progress >= 0.78 ? 10 : 16
  return {
    shield: progress >= 0.42 && ordinal % shieldInterval === 0 ? 1 : 0,
    charger: progress >= 0.24 && ordinal % chargerInterval === 0 ? 1 : 0,
    splitter: progress >= 0.58 && ordinal % splitterInterval === 0 ? 1 : 0,
  }
}
