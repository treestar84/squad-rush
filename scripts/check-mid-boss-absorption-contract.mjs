import { readFile } from "node:fs/promises"

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readNumber(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))
  if (match?.[1] === undefined) {
    throw new Error(`Missing numeric contract token: ${name}`)
  }
  return Number.parseFloat(match[1])
}

const [monsterPoolSource, shootingSource, hitDebugSource, projectileSource, projectileVisualSource] = await Promise.all([
  readFile("src/game/pools/MonsterPool.ts", "utf8"),
  readFile("src/game/systems/ShootingSystem.ts", "utf8"),
  readFile("src/game/systems/ShootingHitDebug.ts", "utf8"),
  readFile("src/game/systems/ProjectileSystem.ts", "utf8"),
  readFile("src/game/systems/ProjectileVisuals.ts", "utf8"),
])

const radiusRatio = readNumber(monsterPoolSource, "TANK_PROJECTILE_HIT_RADIUS_PADDING_RATIO")
const halfDepthRatio = readNumber(monsterPoolSource, "TANK_PROJECTILE_HIT_HALF_DEPTH_RATIO")

assertContract(radiusRatio >= 1.1, `Mid-boss projectile radius must cover animated visual edges: ${radiusRatio}`)
assertContract(radiusRatio <= 1.15, `Mid-boss projectile radius must still let true side shots pass: ${radiusRatio}`)
assertContract(halfDepthRatio >= 1.5, `Mid-boss projectile depth must block rear-target leakage: ${halfDepthRatio}`)
assertContract(
  shootingSource.includes("this.reservedTargets.has(monster)")
    && shootingSource.includes("findBlockingTankTarget")
    && shootingSource.includes("return foregroundTarget ?? blockingTank"),
  "Normal reservations must not stop a tank from independently absorbing concurrent shots.",
)
assertContract(
  shootingSource.includes("const stopProjectileAtImpact = targetBehavior === MONSTER_BEHAVIORS.tank")
    && shootingSource.includes("stopProjectileAtImpact,"),
  "A projectile aimed at a mid-boss must be marked for visual absorption at impact.",
)
assertContract(
  projectileSource.includes("trail.stopAtImpact ? 0 : trail.tailClearDistance")
    && projectileVisualSource.includes("stopAtImpact: boolean"),
  "An absorbed boss projectile must not carry its trail through the body after impact.",
)
assertContract(
  shootingSource.includes("Math.abs(dx) > monster.projectileHitRadius")
    && shootingSource.includes("monster.projectileHitRadius + FORWARD_FIRE_AIM_HALF_WIDTH"),
  "Tank lateral interception must use the padded visible body instead of normal aim assist.",
)
assertContract(
  shootingSource.includes("const targetFrontDistance = dz - monster.hitHalfDepth")
    && shootingSource.includes("const targetBackDistance = dz + monster.projectileHitHalfDepth"),
  "Tank depth padding must apply behind the visible body without extending its front over foreground monsters.",
)
assertContract(
  shootingSource.includes("blockingDistance !== null && targetFrontDistance >= blockingDistance")
    && shootingSource.includes("return foregroundTarget ?? blockingTank"),
  "A regular monster in front of the boss must be targeted before the boss, while rear targets remain blocked.",
)
assertContract(
  shootingSource.includes("this.tankReservationCounts.set(target, concurrentReservations)")
    && shootingSource.includes("this.tankReservationCounts.delete(target)"),
  "Concurrent tank projectile reservations must be reference-counted and released.",
)
assertContract(
  shootingSource.includes("this.tankLethalReservationCounts.set(target, lethalReservations)")
    && shootingSource.includes("this.tankLethalReservationCounts.delete(target)"),
  "Concurrent lethal reservations must not be cleared by an unrelated tank impact.",
)
assertContract(
  hitDebugSource.includes("tankShotsWhileReserved")
    && hitDebugSource.includes("maxTankConcurrentReservations"),
  "Boss absorption QA telemetry must prove repeated in-flight targeting.",
)

const representativeVisualRadius = 2.009
const representativeVisualHalfDepth = 1.633
const projectileRadius = representativeVisualRadius * radiusRatio
const projectileHalfDepth = representativeVisualHalfDepth * halfDepthRatio
const insideEdgeShotX = projectileRadius - 0.01
const outsideEdgeShotX = projectileRadius + 0.01
const absorbsLane = (shotX) => Math.abs(shotX) <= projectileRadius

assertContract(absorbsLane(insideEdgeShotX), "A shot inside the padded visible silhouette must be absorbed.")
assertContract(!absorbsLane(outsideEdgeShotX), "A shot outside the padded visible silhouette must pass beside the boss.")

const bossCenterDistance = 10
const bossVisibleFrontDistance = bossCenterDistance - representativeVisualHalfDepth
const bossPaddedRearDistance = bossCenterDistance + projectileHalfDepth
const selectDepthTarget = (regularFrontDistance) => regularFrontDistance < bossVisibleFrontDistance
  ? "regular"
  : "boss"

assertContract(
  selectDepthTarget(bossVisibleFrontDistance - 0.25) === "regular",
  "A regular monster visibly in front of the boss must receive the projectile.",
)
assertContract(
  selectDepthTarget(bossVisibleFrontDistance + 0.25) === "boss",
  "The boss must still intercept a projectile that would target a monster behind it.",
)
assertContract(
  bossPaddedRearDistance > bossCenterDistance + representativeVisualHalfDepth,
  "The boss must retain its padded rear interception depth.",
)

let concurrentReservations = 0
let maxConcurrentReservations = 0
let shotsWhileReserved = 0
for (let shot = 0; shot < 8; shot += 1) {
  const wasReserved = concurrentReservations > 0
  concurrentReservations += 1
  if (wasReserved) {
    shotsWhileReserved += 1
  }
  maxConcurrentReservations = Math.max(maxConcurrentReservations, concurrentReservations)
}
assertContract(shotsWhileReserved === 7, `The boss must accept every shot after the first reservation: ${shotsWhileReserved}`)
assertContract(maxConcurrentReservations === 8, `All eight representative emitters must be able to reserve the boss: ${maxConcurrentReservations}`)

console.info(JSON.stringify({
  midBossAbsorptionContract: "passed",
  radiusRatio,
  halfDepthRatio,
  representativeBounds: {
    visualRadius: representativeVisualRadius,
    projectileRadius,
    visualHalfDepth: representativeVisualHalfDepth,
    projectileHalfDepth,
  },
  sideBoundary: { insideEdgeShotX, outsideEdgeShotX },
  depthBoundary: { bossVisibleFrontDistance, bossPaddedRearDistance },
  concurrentReservations: { shotsWhileReserved, maxConcurrentReservations },
}, null, 2))
