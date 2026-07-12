import { readFile } from "node:fs/promises"
import { build } from "esbuild"

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(`Monster combat role contract failed: ${message}`)
  }
}

const [
  dataSource,
  roleSource,
  scheduleSource,
  waveSource,
  poolSource,
  visualSource,
  shootingSource,
  damageSource,
  gameSource,
  resultSource,
  styleSource,
] = await Promise.all([
  readFile("src/game/data/monsterData.ts", "utf8"),
  readFile("src/game/MonsterRoleSystem.ts", "utf8"),
  readFile("src/game/MonsterRoleSchedule.ts", "utf8"),
  readFile("src/game/systems/MonsterWaveSystem.ts", "utf8"),
  readFile("src/game/pools/MonsterPool.ts", "utf8"),
  readFile("src/game/pools/MonsterVisualFactory.ts", "utf8"),
  readFile("src/game/systems/ShootingSystem.ts", "utf8"),
  readFile("src/game/GameDamageSystem.ts", "utf8"),
  readFile("src/game/Game.ts", "utf8"),
  readFile("src/ui/ResultScreen.ts", "utf8"),
  readFile("src/styles/global.css", "utf8"),
])

assertContract(dataSource.includes('shield: "SHIELD"') && dataSource.includes('charger: "CHARGER"'), "shield and charger behaviors must be explicit data contracts.")
assertContract(dataSource.includes("damageReduction: 0.72") && dataSource.includes("windupSeconds: 0.72"), "role tuning must remain authored in monster data.")
assertContract(roleSource.includes("previewMonsterProjectileDamage") && roleSource.includes("applyMonsterProjectileDamage"), "shield damage must support preview and mutation without reservation drift.")
assertContract(roleSource.includes("MONSTER_CHARGE_PHASES.windup") && roleSource.includes("chargeDamageMultiplier"), "charger needs a readable windup before boosted impact.")
assertContract(scheduleSource.includes("curveZ < 96") && scheduleSource.includes("progress >= 0.42"), "roles need staged attack and defense onboarding.")
assertContract(waveSource.includes("updateCombatRole(monster, distanceAhead, dt)"), "role state must update in the live monster loop.")
assertContract(waveSource.includes("getAttackCombatRoleSpawnCounts") && waveSource.includes("getDefenseCombatRoleSpawnCounts"), "both modes must consume the shared role schedule.")
assertContract(waveSource.includes("consumeEscapedThreat()") && waveSource.includes("escapedThreatSnapshot"), "escaped damage must preserve a dominant cause without per-frame allocation.")
assertContract(waveSource.includes("combatRoles: {") && waveSource.includes("windingUpChargers"), "role states must be observable through monster QA telemetry.")
assertContract(poolSource.includes("roleState: createMonsterRoleState()") && poolSource.includes("updateRoleCue(inst"), "pooled monsters must reset and reuse role state and cues.")
assertContract(visualSource.includes("monster_role_cue_shield_plate") && visualSource.includes("monster_role_cue_charge_lane"), "shield and charge silhouettes are missing.")
assertContract(visualSource.includes("tessellation: 3") && visualSource.includes("isCombatRoleBehavior"), "compact mode needs low-cost role cues.")
assertContract(shootingSource.includes("previewProjectileDamage(target, damage)") && shootingSource.includes("resolveProjectileDamage(target, damage)"), "projectile reservations and impacts must honor shield mitigation.")
assertContract(shootingSource.includes("getTargetPriorityMultiplier(monster)"), "charging targets must receive tactical target priority.")
assertContract(damageSource.includes("casualtiesByCause") && damageSource.includes("getCombatInsight()"), "squad losses must retain a human-readable cause.")
assertContract(gameSource.includes("onRoleWarning") && gameSource.includes("combatInsight: this.damage.getCombatInsight()"), "live warnings and result telemetry must be connected to Game.")
assertContract(resultSource.includes('data-role="threat-insight"') && resultSource.includes("combatInsight.detail"), "result screen must explain the dominant threat and counter.")
assertContract(styleSource.includes('.result-threat-insight[data-cause="shield"]') && styleSource.includes('.result-threat-insight[data-cause="charger"]'), "result hints need distinct shield and charger states.")

const bundle = await build({
  stdin: {
    contents: `
      export * from "./src/game/MonsterRoleSystem.ts"
      export * from "./src/game/MonsterRoleSchedule.ts"
      export { MONSTER_CONFIGS, MONSTER_BEHAVIORS, MONSTER_TACTICAL_GUIDANCE } from "./src/game/data/monsterData.ts"
      export { GameDamageSystem } from "./src/game/GameDamageSystem.ts"
    `,
    resolveDir: process.cwd(),
    sourcefile: "monster-role-contract-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
const roles = await import(moduleUrl)

const shieldState = roles.createMonsterRoleState()
roles.resetMonsterRoleState(shieldState, roles.MONSTER_CONFIGS.shield)
assertContract(shieldState.shieldMaxHp === 3 && shieldState.shieldHp === 3, `shield pool reset drifted: ${JSON.stringify(shieldState)}`)
const shieldPreview = roles.previewMonsterProjectileDamage(shieldState, roles.MONSTER_CONFIGS.shield, 1)
assertContract(Math.abs(shieldPreview - 0.28) < 0.000001, `shield reduction drifted: ${shieldPreview}`)
for (let hit = 0; hit < 3; hit += 1) {
  roles.applyMonsterProjectileDamage(shieldState, roles.MONSTER_CONFIGS.shield, 1)
}
assertContract(shieldState.shieldHp === 0, "three base hits must visibly break the authored shield.")
assertContract(roles.previewMonsterProjectileDamage(shieldState, roles.MONSTER_CONFIGS.shield, 1) === 1, "body damage must return to full after shield break.")
roles.resetMonsterRoleState(shieldState, roles.MONSTER_CONFIGS.shield)
const shieldOverflow = roles.applyMonsterProjectileDamage(shieldState, roles.MONSTER_CONFIGS.shield, 5)
assertContract(Math.abs(shieldOverflow - 2.84) < 0.000001, `overflow damage must pass through a broken shield: ${shieldOverflow}`)

const chargerState = roles.createMonsterRoleState()
roles.resetMonsterRoleState(chargerState, roles.MONSTER_CONFIGS.charger)
roles.updateMonsterRoleState(chargerState, roles.MONSTER_CONFIGS.charger, 13, 0.1)
assertContract(chargerState.chargePhase === roles.MONSTER_CHARGE_PHASES.approach, "charger must not wind up outside its warning distance.")
roles.updateMonsterRoleState(chargerState, roles.MONSTER_CONFIGS.charger, 12, 0)
assertContract(chargerState.chargePhase === roles.MONSTER_CHARGE_PHASES.windup, "charger must enter windup at the authored trigger distance.")
assertContract(roles.getMonsterRoleSpeedMultiplier(chargerState, roles.MONSTER_CONFIGS.charger) === 0.12, "windup must visibly slow the charger.")
assertContract(roles.getMonsterTargetPriorityMultiplier(chargerState, roles.MONSTER_CONFIGS.charger) === 0.48, "windup must increase charger target priority.")
assertContract(roles.getMonsterRoleCueIntensity(chargerState, roles.MONSTER_CONFIGS.charger) >= 0.35, "windup cue must be visible immediately.")
roles.updateMonsterRoleState(chargerState, roles.MONSTER_CONFIGS.charger, 10, 0.8)
assertContract(chargerState.chargePhase === roles.MONSTER_CHARGE_PHASES.charge, "windup completion must enter charge.")
assertContract(roles.getMonsterRoleSpeedMultiplier(chargerState, roles.MONSTER_CONFIGS.charger) === 3.4, "charge speed multiplier drifted.")
assertContract(roles.getMonsterContactDamageMultiplier(chargerState, roles.MONSTER_CONFIGS.charger) === 2, "charged impact must deal double contact damage.")

const attackOpening = roles.getAttackCombatRoleSpawnCounts(95, 7)
const attackOnboarding = roles.getAttackCombatRoleSpawnCounts(100, 7)
const attackMixed = roles.getAttackCombatRoleSpawnCounts(150, 42)
const defenseOpening = roles.getDefenseCombatRoleSpawnCounts(0.23, 84)
const defenseChargerIntro = roles.getDefenseCombatRoleSpawnCounts(0.24, 14)
const defenseMixed = roles.getDefenseCombatRoleSpawnCounts(0.42, 84)
assertContract(attackOpening.shield === 0 && attackOpening.charger === 0, "attack must teach normal movement before combat roles.")
assertContract(attackOnboarding.shield === 0 && attackOnboarding.charger === 1, "attack must introduce charger before mixing roles.")
assertContract(attackMixed.shield === 1 && attackMixed.charger === 1, "mid attack must support mixed role pressure.")
assertContract(defenseOpening.shield === 0 && defenseOpening.charger === 0, "defense opening grace must remain role-free.")
assertContract(defenseChargerIntro.shield === 0 && defenseChargerIntro.charger === 1, "defense must introduce charger before shield.")
assertContract(defenseMixed.shield === 1 && defenseMixed.charger === 1, "defense midgame must support both combat roles.")
assertContract(roles.MONSTER_TACTICAL_GUIDANCE.SHIELD.counter.includes("사선을"), "shield counter must teach lane switching.")
assertContract(roles.MONSTER_TACTICAL_GUIDANCE.CHARGER.counter.includes("라인"), "charger counter must teach warning-line evasion.")

globalThis.window = { location: { search: "" } }
const chargerMonster = {
  config: { behavior: roles.MONSTER_BEHAVIORS.charger },
  mesh: { position: { x: 1 } },
}
const damageSystem = new roles.GameDamageSystem({
  audio: { playHit() {} },
  collision: { checkMonsterSquadCollision: () => [chargerMonster] },
  fx: { playHitSpark() {} },
  hud: { showCasualties() {}, showDamage() {} },
  shooting: { willReservedImpactKill: () => false },
  squad: {
    absorbShieldDamage: () => 0,
    removeSoldiers: (count) => [{ unit: "PANGYO", count }],
  },
  waves: {
    resolveIncomingDamage: (damage) => damage,
    getMonsterContactDamage: () => 2,
    getMonsterDamageBehavior: () => roles.MONSTER_BEHAVIORS.charger,
    kill() {},
    consumeEscapedThreat: () => ({ count: 0, damage: 0, behavior: roles.MONSTER_BEHAVIORS.basic }),
  },
})
damageSystem.update(0.016)
const chargerInsight = damageSystem.getCombatInsight()
assertContract(chargerInsight.cause === roles.MONSTER_BEHAVIORS.charger && chargerInsight.casualties === 2, `charger casualty telemetry drifted: ${JSON.stringify(chargerInsight)}`)
assertContract(chargerInsight.detail.includes("라인"), "charger result insight must include its playable counter.")

console.info(JSON.stringify({
  monsterCombatRoles: "passed",
  shield: {
    maxHp: 3,
    damagePerBlockedBaseShot: shieldPreview,
    overflowDamage: shieldOverflow,
  },
  charger: {
    phase: chargerState.chargePhase,
    speedMultiplier: roles.getMonsterRoleSpeedMultiplier(chargerState, roles.MONSTER_CONFIGS.charger),
    damageMultiplier: roles.getMonsterContactDamageMultiplier(chargerState, roles.MONSTER_CONFIGS.charger),
  },
  schedules: { attackOnboarding, attackMixed, defenseChargerIntro, defenseMixed },
  chargerInsight,
}, null, 2))
