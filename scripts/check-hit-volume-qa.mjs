import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const shootingSource = readFileSync(resolve("src/game/systems/ShootingSystem.ts"), "utf8")
const monsterPoolSource = readFileSync(resolve("src/game/pools/MonsterPool.ts"), "utf8")
const shootingHitDebugSource = readFileSync(resolve("src/game/systems/ShootingHitDebug.ts"), "utf8")

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!monsterPoolSource.includes("hitRadius") || !monsterPoolSource.includes("hitHalfDepth")) {
  fail("Projectile hit-volume regression: MonsterInstance must expose visual hitRadius and hitHalfDepth derived from the rendered NPC.")
}

if (!monsterPoolSource.includes("calculateVisualHitBounds") || !monsterPoolSource.includes("getChildMeshes(false)")) {
  fail("Projectile hit-volume regression: monster hit volume must be calculated from visual child mesh bounds, not only config.scale.")
}

if (shootingSource.includes("PREFERRED_TARGET_RANGE_RATIO") || shootingSource.includes("preferredDistance")) {
  fail("Projectile hit-sync regression: target selection must choose the first visible monster surface, not a preferred mid-range monster behind it.")
}

if (!shootingSource.includes("target.mesh.position.z - target.hitHalfDepth")) {
  fail("Projectile hit-sync regression: projectile damage timing must use the monster front visual surface instead of the center/back side.")
}

if (!shootingSource.includes("monster.hitRadius") || !shootingSource.includes("monster.hitHalfDepth")) {
  fail("Projectile hit-sync regression: bullet target filtering must account for the visual monster hit volume.")
}

if (!shootingHitDebugSource.includes("minNormalHitRadius") || !shootingHitDebugSource.includes("maxNormalImpactInset")) {
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
