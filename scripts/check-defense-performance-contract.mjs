import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(".")

async function readSource(path) {
  return readFile(resolve(root, path), "utf8")
}

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(`Defense performance contract failed: ${message}`)
  }
}

const [
  gameLoop,
  game,
  camera,
  hudPresenter,
  hud,
  monsterPool,
  monsterVisuals,
  monsterWaves,
  shooting,
  squad,
  collision,
] = await Promise.all([
  readSource("src/game/GameLoop.ts"),
  readSource("src/game/Game.ts"),
  readSource("src/game/CameraController.ts"),
  readSource("src/game/GameHudPresenter.ts"),
  readSource("src/ui/Hud.ts"),
  readSource("src/game/pools/MonsterPool.ts"),
  readSource("src/game/pools/MonsterVisualFactory.ts"),
  readSource("src/game/systems/MonsterWaveSystem.ts"),
  readSource("src/game/systems/ShootingSystem.ts"),
  readSource("src/game/systems/SquadSystem.ts"),
  readSource("src/game/systems/CollisionSystem.ts"),
])

assertContract(gameLoop.includes("MAX_FRAME_DELTA_SECONDS = 0.25"), "the frame delta must preserve real-time play down to 4 FPS.")
assertContract(!gameLoop.includes("MAX_FRAME_CATCHUP_SECONDS"), "long stalls must not accumulate catch-up work.")
assertContract(!gameLoop.includes("while (remainingTime"), "one rendered frame must run at most one simulation pass.")

assertContract(monsterWaves.includes("DEFENSE_CARPET_SPAWN_BUDGET_PER_FRAME = DEFENSE_CARPET_X.length"), "dense carpet creation must be spread across rows.")
assertContract(monsterWaves.includes("compactHordeVisuals: true"), "attack and defense must share compact horde visuals.")
assertContract(monsterWaves.includes("hordeContactShadows: false"), "regular Doguri hordes must omit per-monster contact shadows in both modes.")
assertContract(monsterVisuals.includes("isCombatRoleBehavior(behavior)"), "compact hordes must limit auxiliary cue meshes to bounded readable combat roles.")
assertContract(monsterVisuals.includes("monster_role_cue_shield_plate") && monsterVisuals.includes("monster_role_cue_charge_lane") && monsterVisuals.includes("monster_role_cue_splitter_core"), "combat-role cues must stay low-poly and authored once per pooled visual.")
assertContract(monsterPool.includes("this.getFallbackHitBounds(inst)"), "regular compact monsters must skip hierarchy hit-bound scans.")
assertContract(monsterPool.includes("child.material?.freeze()"), "compact monster materials must be frozen after creation.")
assertContract(monsterVisuals.includes("monsterDeathGreySharedMat") && monsterVisuals.includes("mat.freeze()"), "all falling monsters must reuse one frozen gray material.")
assertContract(monsterPool.includes("restoreDeathMaterial") && monsterPool.includes("deathMaterialBindings"), "pooled monsters must restore original material references without per-kill material allocation.")

assertContract(hudPresenter.includes("HUD_REFRESH_INTERVAL_SECONDS = 1 / 12"), "HUD rendering must be frame-rate independent.")
assertContract(hud.includes("rosterSignature") && hud.includes("effectSummarySignature"), "unchanged HUD trees must not be rebuilt.")

assertContract(shooting.includes("hasReadyEmitter") && shooting.includes("if (!hasReadyEmitter)"), "muzzle transforms must run only when a weapon is ready.")
assertContract(shooting.includes("NOOP_PROJECTILE_IMPACT"), "untargeted fire must reuse its no-op callback.")
assertContract(!squad.includes("this.alivePositions.slice") && !squad.includes("this.muzzlePositions.slice"), "squad position views must be allocation-free.")
assertContract(squad.includes("private readonly combatStats") && game.includes("this.shooting.update(dt, combatStats)"), "combat stats must be shared across the frame.")
assertContract(collision.includes("squadCollisionHits") && collision.includes("hits.length = 0"), "collision results must reuse a stable buffer.")
assertContract(game.includes("private readonly waveUpdate") && game.includes("this.waves.update(this.waveUpdate)"), "wave updates must reuse their parameter object.")
assertContract(game.includes("if (this.camera.isDebugEnabled)"), "production frames must not build camera QA data.")
assertContract(camera.includes("private readonly debugEnabled"), "camera QA mode must be cached.")

console.info("Defense performance contract passed: single-pass frame loop, compact horde rendering, bounded HUD work, and allocation-free combat buffers.")
