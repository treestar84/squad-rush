import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const shootingSource = readFileSync(resolve("src/game/systems/ShootingSystem.ts"), "utf8")
const monsterPoolSource = readFileSync(resolve("src/game/pools/MonsterPool.ts"), "utf8")
const shootingHitDebugSource = readFileSync(resolve("src/game/systems/ShootingHitDebug.ts"), "utf8")
const monsterDataSource = readFileSync(resolve("src/game/data/monsterData.ts"), "utf8")

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!monsterPoolSource.includes("hitRadius") || !monsterPoolSource.includes("hitHalfDepth")) {
  fail("Projectile hit-volume regression: MonsterInstance must expose visual hitRadius and hitHalfDepth derived from the rendered NPC.")
}

if (!monsterPoolSource.includes("projectileHitRadius") || !monsterPoolSource.includes("projectileHitHalfDepth")) {
  fail("Projectile hit-volume regression: MonsterInstance must expose projectile-specific hit bounds so boss bullet hits can be larger without changing breach/contact rules.")
}

if (!monsterPoolSource.includes("calculateVisualHitBounds") || !monsterPoolSource.includes("getChildMeshes(false)")) {
  fail("Projectile hit-volume regression: monster hit volume must be calculated from visual child mesh bounds, not only config.scale.")
}

if (shootingSource.includes("PREFERRED_TARGET_RANGE_RATIO") || shootingSource.includes("preferredDistance")) {
  fail("Projectile hit-sync regression: target selection must choose the first visible monster surface, not a preferred mid-range monster behind it.")
}

if (!shootingSource.includes("target.mesh.position.z - target.hitHalfDepth")) {
  fail("Projectile hit-sync regression: projectile damage timing must use the visible monster front surface instead of padded boss depth.")
}

if (!shootingSource.includes("monster.projectileHitRadius") || !shootingSource.includes("monster.projectileHitHalfDepth")) {
  fail("Projectile hit-sync regression: bullet target filtering must use projectile-specific hit bounds.")
}

if (!monsterPoolSource.includes("TANK_PROJECTILE_HIT_RADIUS_PADDING_RATIO = 1.12")) {
  fail("Projectile hit-volume regression: mid-boss Doguri projectile hit radius must stay padded by 12% beyond the visual body.")
}

if (!monsterPoolSource.includes("TANK_PROJECTILE_HIT_HALF_DEPTH_RATIO")) {
  fail("Projectile hit-volume regression: mid-boss Doguri projectile hit depth must use a dedicated rear-blocking multiplier.")
}

const tankProjectileHalfDepthRatio = readNumber(monsterPoolSource, "TANK_PROJECTILE_HIT_HALF_DEPTH_RATIO")
if (tankProjectileHalfDepthRatio < 1.5) {
  fail(
    `Projectile hit-volume regression: mid-boss Doguri projectile hit depth ratio ${tankProjectileHalfDepthRatio} < 1.5; rear shots can pass through the body.`,
  )
}

if (!shootingSource.includes("return foregroundTarget ?? blockingTank")) {
  fail("Mid-boss absorption regression: foreground regular monsters must be selected before the independently reserved boss.")
}

if (!shootingSource.includes("tankReservationCounts") || !shootingHitDebugSource.includes("maxTankConcurrentReservations")) {
  fail("Mid-boss absorption regression: concurrent boss projectile reservations must be counted and exposed to QA.")
}

if (!shootingSource.includes("Math.abs(dx) > monster.projectileHitRadius")
  || !shootingSource.includes("monster.projectileHitRadius + FORWARD_FIRE_AIM_HALF_WIDTH")) {
  fail("Mid-boss side-pass regression: boss aim width must follow its padded visual hit radius without the normal-monster aim extension.")
}

if (!shootingSource.includes("const targetFrontDistance = dz - monster.hitHalfDepth")
  || !shootingSource.includes("const targetBackDistance = dz + monster.projectileHitHalfDepth")) {
  fail("Mid-boss depth regression: padded depth must remain behind the visible boss front so foreground monsters are not protected.")
}

if (!shootingSource.includes("blockingDistance !== null && targetFrontDistance >= blockingDistance")) {
  fail("Mid-boss ordering regression: normal targets behind the boss must be blocked without hiding normal targets in front.")
}

if (!monsterDataSource.includes("speed: 0.06")) {
  fail("Mid-boss speed regression: tank Doguri speed must be reduced by half to 0.06 in every mode.")
}

if (!monsterDataSource.includes("hp: 34")) {
  fail("Mid-boss health regression: tank Doguri base HP must be reduced from 42 to 34, roughly 80% of the prior value.")
}

if (!shootingHitDebugSource.includes("minNormalHitRadius") || !shootingHitDebugSource.includes("maxNormalImpactInset") || !shootingHitDebugSource.includes("maxTankProjectileHitRadius")) {
  fail("Projectile hit-sync regression: browser QA must expose visual hit radius and impact inset metrics.")
}

function readNumber(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))
  if (match?.[1] === undefined) {
    fail(`Projectile hit-sync regression: missing numeric token ${name}.`)
  }
  return Number.parseFloat(match[1])
}

function currentSelectionScore(visibleDistance, lateralMiss) {
  const lateralTargetWeight = readNumber(shootingSource, "LATERAL_TARGET_WEIGHT")
  const scoreExpression = shootingSource.match(/const score = ([^\n]+)/)?.[1] ?? ""
  if (scoreExpression.includes("closePenalty")) {
    const minVisualTargetDistance = readNumber(shootingSource, "MIN_VISUAL_TARGET_DISTANCE")
    const closeTargetPenalty = readNumber(shootingSource, "CLOSE_TARGET_PENALTY")
    const closePenalty = Math.max(0, minVisualTargetDistance - visibleDistance) * closeTargetPenalty
    return visibleDistance + lateralMiss * lateralTargetWeight + closePenalty
  }
  return visibleDistance + lateralMiss * lateralTargetWeight
}

const foregroundScore = currentSelectionScore(2, 0)
const backgroundScore = currentSelectionScore(8, 0)
if (foregroundScore > backgroundScore) {
  fail(
    `Projectile hit-sync regression: foreground visible surface score ${foregroundScore} is worse than background score ${backgroundScore}.`,
  )
}

console.log("Projectile hit-volume QA OK: visual hit volume and first-surface impact checks are present.")
