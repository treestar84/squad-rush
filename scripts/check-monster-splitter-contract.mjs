import { readFile } from "node:fs/promises"
import { build } from "esbuild"

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(`Monster splitter contract failed: ${message}`)
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
  roadmapSource,
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
  readFile("docs/IMPLEMENTATION_ROADMAP.md", "utf8"),
])

assertContract(dataSource.includes('splitter: "SPLITTER"'), "splitter must be an explicit behavior.")
assertContract(dataSource.includes("childCount: 2") && dataSource.includes('id: "splitling"'), "splitter must author exactly two non-recursive child units.")
assertContract(roleSource.includes("shouldSpawnMonsterSplitChildren") && roleSource.includes("getMonsterSplitChildLateralOffset"), "split eligibility and child placement must be pure, bounded contracts.")
assertContract(scheduleSource.includes("splitter: progress >= 0.58") && scheduleSource.includes("ordinal % 8 === 3"), "attack and defense splitter onboarding is missing.")
assertContract(waveSource.includes("SPLITTER_CHILD_POOL_RESERVE = 16"), "split children need a bounded pool reserve under full horde pressure.")
assertContract(waveSource.includes("SPLITTER_CHILD_LIVE_OVERFLOW = 4"), "live split pressure must have a small hard overflow cap.")
assertContract(waveSource.includes("this.monsterCapacity + SPLITTER_CHILD_POOL_RESERVE"), "split reserve must be preallocated through the existing monster pool.")
assertContract(waveSource.includes("this.monsterCapacity + SPLITTER_CHILD_LIVE_OVERFLOW - this.countAlivePoolMonsters()"), "split reserve must cover dying bodies without unbounded live overflow.")
assertContract(waveSource.includes("spawnSplitterChildren(monster, config)") && waveSource.includes("MONSTER_CONFIGS.splitling"), "projectile kills must spawn pooled splitlings.")
assertContract(waveSource.includes("splitChildrenDropped") && waveSource.includes("splitChildrenSpawned"), "split pressure must expose successful and capacity-dropped children.")
assertContract(waveSource.includes("MONSTER_KILL_REASONS.escaped") && damageSource.includes("MONSTER_KILL_REASONS.contact"), "escape and contact deaths must not recursively split.")
assertContract(shootingSource.includes("MONSTER_KILL_REASONS.projectile"), "only projectile kills may activate splitting.")
assertContract(poolSource.includes("config.behavior === MONSTER_BEHAVIORS.splitter") && poolSource.includes("cue.setEnabled(true)"), "pooled splitter cues must remain visible while alive.")
assertContract(visualSource.includes("monster_role_cue_splitter_band") && visualSource.includes("monster_role_cue_splitter_core"), "splitter needs a readable twin-core silhouette.")
assertContract(visualSource.includes("segments: 6") && visualSource.includes("MONSTER_BEHAVIORS.splitter"), "splitter cue must use a compact low-poly fallback.")
assertContract(damageSource.includes("MONSTER_BEHAVIORS.splitter") && waveSource.includes("getMonsterDamageAttributionBehavior"), "splitling casualties must remain attributed to the splitter role.")
assertContract(gameSource.includes('"#E879F9"') && gameSource.includes("MONSTER_TACTICAL_GUIDANCE[behavior].warning"), "splitter warning must use its readable magenta state.")
assertContract(resultSource.includes("combatInsight.detail") && styleSource.includes('[data-cause="splitter"]'), "result screen must explain splitter losses and counterplay.")
assertContract(roadmapSource.includes("splitter") || roadmapSource.includes("분열"), "roadmap must record the splitter-only slice.")

const bundle = await build({
  stdin: {
    contents: `
      export * from "./src/game/MonsterRoleSystem.ts"
      export * from "./src/game/MonsterRoleSchedule.ts"
      export { MONSTER_CONFIGS, MONSTER_BEHAVIORS, MONSTER_TACTICAL_GUIDANCE } from "./src/game/data/monsterData.ts"
      export { GameDamageSystem } from "./src/game/GameDamageSystem.ts"
    `,
    resolveDir: process.cwd(),
    sourcefile: "monster-splitter-contract-entry.ts",
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

const splitter = roles.MONSTER_CONFIGS.splitter
const splitling = roles.MONSTER_CONFIGS.splitling
assertContract(roles.getMonsterSplitChildCount(splitter) === 2, "authored splitter child count drifted.")
assertContract(roles.getMonsterSplitChildLateralOffset(splitter, 0) === -0.36, "left splitling offset drifted.")
assertContract(roles.getMonsterSplitChildLateralOffset(splitter, 1) === 0.36, "right splitling offset drifted.")
assertContract(roles.getMonsterSplitChildForwardOffset(splitter) === 0.9, "splitlings need reaction space in front of the fallen parent.")
assertContract(roles.shouldSpawnMonsterSplitChildren(splitter, true), "projectile death must split the parent.")
assertContract(!roles.shouldSpawnMonsterSplitChildren(splitter, false), "contact or escape death must not split the parent.")
assertContract(!roles.shouldSpawnMonsterSplitChildren(splitling, true), "splitlings must never split recursively.")
assertContract(roles.getMonsterDamageAttributionBehavior(splitling) === roles.MONSTER_BEHAVIORS.splitter, "splitling damage must be attributed to its parent role.")
const splitterState = roles.createMonsterRoleState()
roles.resetMonsterRoleState(splitterState, splitter)
assertContract(roles.getMonsterTargetPriorityMultiplier(splitterState, splitter) === 0.72, "splitter must be targeted early enough to clear children at range.")

const oversizedConfig = {
  ...splitter,
  role: { split: { ...splitter.role.split, childCount: 99 } },
}
assertContract(roles.getMonsterSplitChildCount(oversizedConfig) === 3, "malformed splitter data must never create more than three children.")

const attackBefore = roles.getAttackCombatRoleSpawnCounts(189, 11)
const attackIntro = roles.getAttackCombatRoleSpawnCounts(190, 11)
const attackFinal = roles.getAttackCombatRoleSpawnCounts(260, 7)
const defenseBefore = roles.getDefenseCombatRoleSpawnCounts(0.57, 16)
const defenseIntro = roles.getDefenseCombatRoleSpawnCounts(0.58, 16)
const defenseFinal = roles.getDefenseCombatRoleSpawnCounts(0.8, 20)
assertContract(attackBefore.splitter === 0 && attackIntro.splitter === 1, "attack must introduce splitter only after the first two roles are learned.")
assertContract(attackIntro.shield === 0 && attackIntro.charger === 0, "the first attack splitter beat must not stack another advanced role in the same spawn group.")
assertContract(attackFinal.splitter === 1, "late attack must retain bounded splitter pressure.")
assertContract(defenseBefore.splitter === 0 && defenseIntro.splitter === 1, "defense must introduce splitter at 58% progress.")
assertContract(defenseFinal.splitter === 1, "late defense must retain bounded splitter pressure.")
assertContract(roles.MONSTER_TACTICAL_GUIDANCE.SPLITTER.counter.includes("먼 거리"), "splitter guidance must teach early ranged cleanup.")

globalThis.window = { location: { search: "" } }
const splitlingMonster = {
  config: splitling,
  mesh: { position: { x: -0.36 } },
}
const damageSystem = new roles.GameDamageSystem({
  audio: { playHit() {} },
  collision: { checkMonsterSquadCollision: () => [splitlingMonster] },
  fx: { playHitSpark() {} },
  hud: { showCasualties() {}, showDamage() {} },
  shooting: { willReservedImpactKill: () => false },
  squad: {
    absorbShieldDamage: () => 0,
    removeSoldiers: (count) => [{ unit: "PANGYO", count }],
  },
  waves: {
    resolveIncomingDamage: (damage) => damage,
    getMonsterContactDamage: () => 1,
    getMonsterDamageBehavior: () => roles.getMonsterDamageAttributionBehavior(splitling),
    kill() {},
    consumeEscapedThreat: () => ({ count: 0, damage: 0, behavior: roles.MONSTER_BEHAVIORS.basic }),
  },
})
damageSystem.update(0.016)
const splitterInsight = damageSystem.getCombatInsight()
assertContract(splitterInsight.cause === roles.MONSTER_BEHAVIORS.splitter, `splitling casualty attribution drifted: ${JSON.stringify(splitterInsight)}`)
assertContract(splitterInsight.detail.includes("소형 2개"), "splitter result insight must explain the split and counter.")

console.info(JSON.stringify({
  monsterSplitter: "passed",
  split: {
    childCount: roles.getMonsterSplitChildCount(splitter),
    lateralOffsets: [
      roles.getMonsterSplitChildLateralOffset(splitter, 0),
      roles.getMonsterSplitChildLateralOffset(splitter, 1),
    ],
    forwardOffset: roles.getMonsterSplitChildForwardOffset(splitter),
    targetPriorityMultiplier: roles.getMonsterTargetPriorityMultiplier(splitterState, splitter),
  },
  schedules: { attackBefore, attackIntro, attackFinal, defenseBefore, defenseIntro, defenseFinal },
  splitterInsight,
}, null, 2))
