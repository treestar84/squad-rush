import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const projectileSource = readFileSync(resolve("src/game/systems/ProjectileSystem.ts"), "utf8")
const projectileDebugSource = readFileSync(resolve("src/game/systems/ProjectileDebug.ts"), "utf8")
const projectileMotionSource = readFileSync(resolve("src/game/systems/ProjectileMotion.ts"), "utf8")
const projectileVisualSource = readFileSync(resolve("src/game/systems/ProjectileVisuals.ts"), "utf8")
const shootingSource = readFileSync(resolve("src/game/systems/ShootingSystem.ts"), "utf8")
const shootingHitDebugSource = readFileSync(resolve("src/game/systems/ShootingHitDebug.ts"), "utf8")
const monsterWaveSource = readFileSync(resolve("src/game/systems/MonsterWaveSystem.ts"), "utf8")
const squadSource = readFileSync(resolve("src/game/systems/SquadSystem.ts"), "utf8")
const soldierSource = readFileSync(resolve("src/game/data/soldierData.ts"), "utf8")
const monsterDataSource = readFileSync(resolve("src/game/data/monsterData.ts"), "utf8")
const hasTimeBasedImpact = projectileSource.includes("trail.traveled >= trail.travelDistance || trail.life <= 0")
const hasTimeBasedRelease = projectileSource.includes("trail.traveled >= releaseDistance || trail.life <= 0")
const hasImpactCue = projectileSource.includes("playImpactFlash(trail)") &&
  projectileSource.includes("impactPool") &&
  projectileSource.includes("IMPACT_FLASH_DURATION_SECONDS")
const hasEffectiveRangeStyle = projectileMotionSource.includes("effectiveRange") &&
  (shootingSource.includes("effectiveRange: range") || shootingSource.includes("bulletStyle.effectiveRange = range")) &&
  projectileSource.includes("style.effectiveRange")
const hasSyncedImpactVisualTravel = projectileSource.includes("impactDistance") &&
  projectileSource.includes("trail.traveled >= trail.impactDistance") &&
  projectileSource.includes("impactAt = to") &&
  shootingSource.includes("this.shotTo.copyFrom(this.shotImpact)") &&
  shootingSource.includes("BULLET_IMPACT_VISUAL_SYNC_TOLERANCE") &&
  shootingSource.includes("this.shotImpact") &&
  projectileDebugSource.includes("maxImpactToVisualDistance") &&
  projectileDebugSource.includes("maxVisualHeadWorldAdvance")

if (hasTimeBasedImpact || hasTimeBasedRelease) {
  console.error("Projectile visibility regression: life timer must not trigger impact or release before distance is covered.")
  process.exit(1)
}

if (!hasImpactCue) {
  console.error("Projectile visibility regression: bullet impacts need a pooled endpoint flash cue.")
  process.exit(1)
}

if (!hasEffectiveRangeStyle) {
  console.error("Projectile visibility regression: bullet visuals must use the current boosted attack range, not only the immediate target distance.")
  process.exit(1)
}

if (!hasSyncedImpactVisualTravel) {
  console.error("Projectile visibility regression: bullet hit timing must match the visible endpoint instead of splitting impact and visual travel.")
  process.exit(1)
}

if (shootingSource.includes("targetFrontZ + forwardOnlyLeadZ") || shootingSource.includes("calculateLeadSeconds")) {
  console.error("Projectile hit-sync regression: enemy rush velocity must not push impact timing behind the visible front surface.")
  process.exit(1)
}

if (!shootingSource.includes("targetFrontZ")) {
  console.error("Projectile visibility regression: bullet endpoint must visibly reach the monster front.")
  process.exit(1)
}

if (!shootingSource.includes("this.shotImpact.set(target.mesh.position.x") || shootingSource.includes("MAX_VISUAL_LATERAL_AIM")) {
  console.error("Projectile hit-sync regression: bullet endpoint must use the target X coordinate instead of the firing soldier X.")
  process.exit(1)
}

if (!shootingSource.includes("reservedTargets") || !shootingSource.includes("this.reservedTargets.add(target)") || !shootingSource.includes("this.reservedTargets.has(monster)")) {
  console.error("Projectile hit-sync regression: each live monster must be reserved by one in-flight bullet so one shot maps to one normal kill.")
  process.exit(1)
}

if (!shootingHitDebugSource.includes("__squadRushHitDebug") || !shootingSource.includes("this.hitDebug.recordImpact") || !shootingSource.includes("this.hitDebug.recordStaleImpact")) {
  console.error("Projectile hit-sync regression: browser QA must expose normal shot/impact/kill counters.")
  process.exit(1)
}

if (monsterWaveSource.includes("CENTER_BLOCK") || monsterWaveSource.includes("CENTER_LINE") || monsterWaveSource.includes("OPENING_CENTER")) {
  console.error("Opening horde regression: early monsters must start scattered instead of using center-only spawn patterns.")
  process.exit(1)
}

if (!monsterWaveSource.includes("getCenterPull") || !monsterWaveSource.includes("monster.originX * centerPull")) {
  console.error("Monster movement regression: attack monsters must keep accelerated center convergence.")
  process.exit(1)
}

if (!shootingSource.includes("setUntargetedImpactPoint") || !shootingSource.includes("target === null")) {
  console.error("Projectile regression: soldiers must keep firing forward even when no target is currently ahead.")
  process.exit(1)
}

if (!squadSource.includes("SOLDIER_MUZZLE_OFFSET") || !squadSource.includes("getMuzzlePositions")) {
  console.error("Projectile visibility regression: squad must expose real muzzle marker world positions.")
  process.exit(1)
}

if (!shootingSource.includes("getMuzzlePositions()") || shootingSource.includes("BULLET_MUZZLE_HEIGHT")) {
  console.error("Projectile visibility regression: bullets must spawn from soldier muzzle markers, not hardcoded offsets.")
  process.exit(1)
}

function readNumber(source, name) {
  const match = source.match(new RegExp(`${name}\\s*[:=]\\s*([0-9.]+)`))
  if (match?.[1] === undefined) {
    console.error(`Projectile visibility regression: missing numeric token ${name}.`)
    process.exit(1)
  }
  return Number.parseFloat(match[1])
}

const attackRange = readNumber(soldierSource, "attackRange")
const attackDamage = readNumber(soldierSource, "attackDamage")
const bulletSpeed = readNumber(soldierSource, "bulletSpeed")
const basicMonsterHp = readNumber(monsterDataSource, "hp")
const soldierFormationSpacing = readNumber(squadSource, "SOLDIER_FORMATION_SPACING")
const soldierFormationRowDepth = readNumber(squadSource, "SOLDIER_FORMATION_ROW_DEPTH")
const soldierFormationMaxColumns = readNumber(squadSource, "SOLDIER_FORMATION_MAX_COLUMNS")
const visualLengthCap = readNumber(projectileMotionSource, "BULLET_VISUAL_LENGTH")
const frameVisibilitySeconds = readNumber(projectileMotionSource, "BULLET_FRAME_VISIBILITY_SECONDS")
const effectiveRangeVisualRatio = readNumber(projectileMotionSource, "BULLET_EFFECTIVE_RANGE_VISUAL_RATIO")
const wakeFarOffsetRatio = readNumber(projectileMotionSource, "BULLET_WAKE_FAR_OFFSET_RATIO")
const tailClearRatio = readNumber(projectileMotionSource, "BULLET_TAIL_CLEAR_RATIO")
const tailClearMinDistance = readNumber(projectileMotionSource, "BULLET_TAIL_CLEAR_MIN_DISTANCE")
const postImpactHeadFadeDistance = readNumber(projectileMotionSource, "BULLET_POST_IMPACT_HEAD_FADE_DISTANCE")
const trailAlpha = readNumber(projectileMotionSource, "BULLET_TRAIL_ALPHA")
const wakeAlpha = readNumber(projectileMotionSource, "BULLET_WAKE_ALPHA")
const coreMinAlpha = readNumber(projectileMotionSource, "BULLET_CORE_MIN_ALPHA")
const flashMinAlpha = readNumber(projectileMotionSource, "BULLET_FLASH_MIN_ALPHA")
const coreDiameter = readNumber(projectileVisualSource, "PROJECTILE_CORE_DIAMETER")
const flashDiameter = readNumber(projectileVisualSource, "PROJECTILE_FLASH_DIAMETER")
const slugDiameter = readNumber(projectileVisualSource, "PROJECTILE_SLUG_DIAMETER")
const slugLength = readNumber(projectileVisualSource, "PROJECTILE_SLUG_LENGTH")
const streakWidth = readNumber(projectileVisualSource, "PROJECTILE_STREAK_WIDTH")
const wakeNearDiameter = readNumber(projectileVisualSource, "PROJECTILE_WAKE_NEAR_DIAMETER")
const wakeFarDiameter = readNumber(projectileVisualSource, "PROJECTILE_WAKE_FAR_DIAMETER")
const lifePaddingSeconds = readNumber(projectileMotionSource, "BULLET_LIFE_PADDING_SECONDS")
const impactVisualSyncTolerance = readNumber(shootingSource, "BULLET_IMPACT_VISUAL_SYNC_TOLERANCE")
const monsterFrontSurfaceInset = readNumber(shootingSource, "MONSTER_FRONT_SURFACE_INSET")
const hasSegmentedWake = projectileSource.includes("wakeNear") &&
  projectileSource.includes("wakeFar") &&
  projectileVisualSource.includes("bullet_wake_near") &&
  projectileVisualSource.includes("bullet_wake_far")
const hasBulletSlug = projectileSource.includes("trail.slug") &&
  projectileVisualSource.includes("bullet_slug") &&
  projectileVisualSource.includes("PROJECTILE_SLUG_LENGTH")
const hasPoolHeadroom = readFileSync(resolve("src/game/Game.ts"), "utf8").includes("soldierCapacity * 16")

const boostedRangeMultiplier = 1
const qaEffectiveRange = attackRange * boostedRangeMultiplier
const requiredVisualReach = qaEffectiveRange * effectiveRangeVisualRatio
const visualLength = Math.min(
  visualLengthCap,
  Math.max(2.4, attackRange * 0.08, requiredVisualReach / wakeFarOffsetRatio, bulletSpeed * frameVisibilitySeconds),
)
const tailClearDistance = Math.max(tailClearMinDistance, visualLength * tailClearRatio)
const lifeSeconds = (attackRange + tailClearDistance) / bulletSpeed + lifePaddingSeconds
const segmentedVisualReach = visualLength * wakeFarOffsetRatio + flashDiameter
const minimumVisibleLength = Math.max(bulletSpeed * 0.07, qaEffectiveRange * 0.13)
const maximumVisibleLength = qaEffectiveRange * 0.17
const minimumBoostedSegmentedReach = qaEffectiveRange * 0.33
const minimumRuntimeSegmentedReach = attackRange * 0.33
const minimumTailClearDistance = attackRange * 0.07
const maximumTailClearDistance = attackRange * 0.12
const minimumTrailAlpha = 0.09
const minimumWakeAlpha = 0.14
const maximumTrailAlpha = 0.12
const maximumWakeAlpha = 0.22
const minimumSlugDiameter = 0.08
const minimumSlugLength = 0.4
const maximumSlugLength = 0.52
const minimumCoreDiameter = 0.11
const minimumFlashDiameter = 0.21
const maximumCoreDiameter = 0.17
const maximumFlashDiameter = 0.3
const minimumStreakWidth = 0.03
const minimumWakeNearDiameter = 0.11
const minimumWakeFarDiameter = 0.09
const minimumCoreMinAlpha = 0.92
const minimumFlashMinAlpha = 0.2
const minimumEndpointTravelRatio = 0.8
const minimumPreImpactHeadAlpha = 0.72
const minimumPreImpactTrailAlpha = 0.1
const minimumNearImpactVisibleRatio = 0.82
const minimumHeadWorldAdvance = attackRange * 0.32
const maximumImpactToVisualDistance = impactVisualSyncTolerance + 0.05
const maximumPostImpactHeadFadeDistance = 0.75
const minimumBulletSpeed = 44
const maximumRangeTravelSeconds = 0.85
const maximumSoldierFormationSpacing = 0.82
const maximumSoldierFormationRowDepth = 0.32
const maximumSoldierFormationColumns = 3
const minimumNormalHitRadius = 0.3
const minimumNormalHitHalfDepth = 0.22
const maximumNormalImpactInset = 0.35
const epsilon = 0.001

if (visualLength + epsilon < minimumVisibleLength) {
  console.error(`Projectile visibility regression: visualLength ${visualLength} < ${minimumVisibleLength}.`)
  process.exit(1)
}

if (visualLength > maximumVisibleLength + epsilon) {
  console.error(`Projectile visibility regression: visualLength ${visualLength} > ${maximumVisibleLength}; bullets should not read as lasers.`)
  process.exit(1)
}

if (!hasSegmentedWake || segmentedVisualReach < minimumBoostedSegmentedReach) {
  console.error(
    `Projectile visibility regression: segmented wake reach ${segmentedVisualReach.toFixed(2)} < ${minimumBoostedSegmentedReach.toFixed(2)}.`,
  )
  process.exit(1)
}

if (!hasBulletSlug) {
  console.error("Projectile visibility regression: bullets need a bright short slug mesh so shots read as bullets, not fading orb/laser hints.")
  process.exit(1)
}

if (tailClearDistance < minimumTailClearDistance) {
  console.error(`Projectile visibility regression: tailClearDistance ${tailClearDistance} < ${minimumTailClearDistance}.`)
  process.exit(1)
}

if (tailClearDistance > maximumTailClearDistance + epsilon) {
  console.error(`Projectile visibility regression: tailClearDistance ${tailClearDistance} > ${maximumTailClearDistance}; bullets linger after impact.`)
  process.exit(1)
}

if (postImpactHeadFadeDistance > maximumPostImpactHeadFadeDistance) {
  console.error(
    `Projectile visibility regression: post-impact bullet head fade ${postImpactHeadFadeDistance} > ${maximumPostImpactHeadFadeDistance}; bullet heads linger after the enemy is hit.`,
  )
  process.exit(1)
}

if (trailAlpha < minimumTrailAlpha) {
  console.error(`Projectile visibility regression: trailAlpha ${trailAlpha} < ${minimumTrailAlpha}; bullet path disappears before the target.`)
  process.exit(1)
}

if (wakeAlpha < minimumWakeAlpha) {
  console.error(`Projectile visibility regression: wakeAlpha ${wakeAlpha} < ${minimumWakeAlpha}; bullet wake is too faint to show range.`)
  process.exit(1)
}

if (trailAlpha > maximumTrailAlpha) {
  console.error(`Projectile visibility regression: trailAlpha ${trailAlpha} > ${maximumTrailAlpha}; bullets read as laser beams.`)
  process.exit(1)
}

if (wakeAlpha > maximumWakeAlpha) {
  console.error(`Projectile visibility regression: wakeAlpha ${wakeAlpha} > ${maximumWakeAlpha}; bullet wake reads as a beam.`)
  process.exit(1)
}

if (slugDiameter < minimumSlugDiameter || slugLength < minimumSlugLength) {
  console.error(
    `Projectile visibility regression: projectile slug too small diameter=${slugDiameter}, length=${slugLength}.`,
  )
  process.exit(1)
}

if (slugLength > maximumSlugLength) {
  console.error(`Projectile visibility regression: projectile slug ${slugLength} is too long and reads as a laser.`)
  process.exit(1)
}

if (coreDiameter < minimumCoreDiameter || flashDiameter < minimumFlashDiameter) {
  console.error(
    `Projectile visibility regression: projectile glow too small core=${coreDiameter}, flash=${flashDiameter}.`,
  )
  process.exit(1)
}

if (coreDiameter > maximumCoreDiameter || flashDiameter > maximumFlashDiameter) {
  console.error(
    `Projectile visibility regression: projectile glow too large core=${coreDiameter}, flash=${flashDiameter}; bullets become orb-like.`,
  )
  process.exit(1)
}

if (streakWidth < minimumStreakWidth || wakeNearDiameter < minimumWakeNearDiameter || wakeFarDiameter < minimumWakeFarDiameter) {
  console.error(
    `Projectile visibility regression: bullet path is too thin streak=${streakWidth}, wakeNear=${wakeNearDiameter}, wakeFar=${wakeFarDiameter}.`,
  )
  process.exit(1)
}

if (coreMinAlpha < minimumCoreMinAlpha || flashMinAlpha < minimumFlashMinAlpha) {
  console.error(
    `Projectile visibility regression: projectile head fades too early coreMin=${coreMinAlpha}, flashMin=${flashMinAlpha}.`,
  )
  process.exit(1)
}

if (bulletSpeed < minimumBulletSpeed) {
  console.error(`Projectile visibility regression: bulletSpeed ${bulletSpeed} < ${minimumBulletSpeed}; bullets read as short-lived range hints instead of gunfire.`)
  process.exit(1)
}

if (
  soldierFormationSpacing > maximumSoldierFormationSpacing
  || soldierFormationRowDepth > maximumSoldierFormationRowDepth
  || soldierFormationMaxColumns > maximumSoldierFormationColumns
  || !squadSource.includes("rowShift")
) {
  console.error(
    `Squad formation regression: soldiers are too spread out spacing=${soldierFormationSpacing}, rowDepth=${soldierFormationRowDepth}, maxColumns=${soldierFormationMaxColumns}.`,
  )
  process.exit(1)
}

const rangeTravelSeconds = attackRange / bulletSpeed
if (rangeTravelSeconds > maximumRangeTravelSeconds + epsilon) {
  console.error(
    `Projectile visibility regression: attack range travel takes ${rangeTravelSeconds.toFixed(2)}s > ${maximumRangeTravelSeconds}s, so bullets appear to vanish before enemies.`,
  )
  process.exit(1)
}

if (basicMonsterHp > attackDamage) {
  console.error(
    `Projectile hit-sync regression: basic monster hp ${basicMonsterHp} exceeds base projectile damage ${attackDamage}; lowest-grade monsters must die from one projectile.`,
  )
  process.exit(1)
}

if (impactVisualSyncTolerance > 0.45) {
  console.error(`Projectile visibility regression: impact visual sync tolerance ${impactVisualSyncTolerance} is too loose.`)
  process.exit(1)
}

if (!hasPoolHeadroom) {
  console.error("Projectile visibility regression: projectile pool headroom must support dense boosted squads.")
  process.exit(1)
}

if (!projectileDebugSource.includes("__squadRushProjectileDebug")) {
  console.error("Projectile visibility regression: browser runtime projectile reach debug state is missing.")
  process.exit(1)
}

if (!projectileDebugSource.includes("maxPreImpactHeadWorldAdvance") ||
  !projectileDebugSource.includes("maxNearImpactVisibleRatio") ||
  !projectileDebugSource.includes("maxVisualHeadWorldAdvance") ||
  !projectileDebugSource.includes("maxImpactToVisualDistance") ||
  !projectileDebugSource.includes("maxPostImpactDistance")) {
  console.error("Projectile visibility regression: runtime debug must track world-space bullet head reach near impact.")
  process.exit(1)
}

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function findFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.once("error", rejectPort)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === "object" && address !== null) {
          resolvePort(address.port)
          return
        }
        rejectPort(new Error("Unable to allocate preview port."))
      })
    })
  })
}

function requestOk(url) {
  return new Promise((resolveOk) => {
    const req = get(url, (res) => {
      res.resume()
      resolveOk((res.statusCode ?? 500) < 500)
    })
    req.on("error", () => resolveOk(false))
    req.setTimeout(750, () => {
      req.destroy()
      resolveOk(false)
    })
  })
}

async function waitForPreview(url) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 15000) {
    if (await requestOk(url)) {
      return
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error("Preview server did not become ready within 15s.")
}

function stopPreview(preview) {
  return new Promise((resolveStop) => {
    if (preview.exitCode !== null) {
      resolveStop()
      return
    }
    const timer = setTimeout(() => {
      if (preview.exitCode === null) {
        preview.kill("SIGKILL")
      }
      resolveStop()
    }, 3000)
    preview.once("exit", () => {
      clearTimeout(timer)
      resolveStop()
    })
    preview.kill("SIGTERM")
  })
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?quality=medium&qa=projectile&qaStartZ=30&qaSoldiers=30&qaSpeed=1.2`
const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: resolve("."),
  stdio: "pipe",
})
let browser

try {
  await mkdir(resolve("logs/phase2-qa"), { recursive: true })
  await waitForPreview(previewUrl)
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForTimeout(18000)
  const debug = await page.evaluate(() => window.__squadRushProjectileDebug)
  const hitDebug = await page.evaluate(() => window.__squadRushHitDebug)
  const screenshotPath = resolve("logs/phase2-qa/projectile-reach-runtime.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await browser.close()
  browser = undefined
  const screenshot = await stat(screenshotPath)
  assertQa(screenshot.size > 50000, `Projectile runtime screenshot is too small: ${screenshot.size}`)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(debug !== undefined, "Projectile runtime debug state was not exposed.")
  assertQa(hitDebug !== undefined, "Projectile hit-sync debug state was not exposed.")
  assertQa(debug.shotsCreated >= 48, `Projectile runtime did not create enough shots: ${debug.shotsCreated}.`)
  assertQa(hitDebug.normalImpacts >= 32, `Projectile runtime did not record enough normal impacts: ${hitDebug.normalImpacts}.`)
  assertQa(hitDebug.normalKills > 0, "Normal projectile impacts did not produce kills.")
  assertQa(
    hitDebug.normalKills === hitDebug.normalImpacts,
    `Normal projectile hit-sync mismatch: impacts=${hitDebug.normalImpacts}, kills=${hitDebug.normalKills}.`,
  )
  assertQa(hitDebug.normalImpacts >= hitDebug.normalKills, "Normal projectile kills exceeded recorded impacts.")
  assertQa(hitDebug.missedNormalImpacts === 0, "A projectile reached a normal monster after it was already dead.")
  assertQa(hitDebug.staleNormalImpacts === 0, "A normal projectile callback resolved after its original monster was gone or reused.")
  assertQa(hitDebug.multiDamageImpacts === 0, "A normal projectile impact damaged more than one monster before advanced gates.")
  assertQa(hitDebug.minNormalHitRadius >= minimumNormalHitRadius, `Normal hit radius ${hitDebug.minNormalHitRadius} < ${minimumNormalHitRadius}.`)
  assertQa(
    hitDebug.minNormalHitHalfDepth >= minimumNormalHitHalfDepth,
    `Normal hit half-depth ${hitDebug.minNormalHitHalfDepth} < ${minimumNormalHitHalfDepth}.`,
  )
  assertQa(
    hitDebug.maxNormalImpactInset <= maximumNormalImpactInset,
    `Projectile impact inset ${hitDebug.maxNormalImpactInset} > ${maximumNormalImpactInset}; impacts should happen at the visible front surface.`,
  )
  assertQa(debug.minVisualReach >= minimumRuntimeSegmentedReach, `Runtime projectile reach ${debug.minVisualReach} < ${minimumRuntimeSegmentedReach}.`)
  assertQa(debug.maxPreImpactTravelRatio >= minimumEndpointTravelRatio, `Projectile endpoint ratio ${debug.maxPreImpactTravelRatio} < ${minimumEndpointTravelRatio}.`)
  assertQa(debug.maxVisualHeadWorldAdvance >= minimumHeadWorldAdvance, `Projectile head world advance ${debug.maxVisualHeadWorldAdvance} < ${minimumHeadWorldAdvance}.`)
  assertQa(debug.maxNearImpactVisibleRatio >= minimumNearImpactVisibleRatio, `Near-impact visible ratio ${debug.maxNearImpactVisibleRatio} < ${minimumNearImpactVisibleRatio}.`)
  assertQa(debug.maxImpactToVisualDistance <= maximumImpactToVisualDistance, `Impact/visual split ${debug.maxImpactToVisualDistance} > ${maximumImpactToVisualDistance}.`)
  assertQa(debug.maxPostImpactDistance <= tailClearDistance + 0.5, `Post-impact visual travel ${debug.maxPostImpactDistance} > ${tailClearDistance + 0.5}.`)
  assertQa(debug.minPreImpactHeadAlpha >= minimumPreImpactHeadAlpha, `Pre-impact head alpha ${debug.minPreImpactHeadAlpha} < ${minimumPreImpactHeadAlpha}.`)
  assertQa(debug.minPreImpactTrailAlpha >= minimumPreImpactTrailAlpha, `Pre-impact trail alpha ${debug.minPreImpactTrailAlpha} < ${minimumPreImpactTrailAlpha}.`)
  console.log(
    `Projectile visibility OK: visualLength=${visualLength.toFixed(2)}, boostedSegmentedReach=${segmentedVisualReach.toFixed(2)}, runtimeReach=${debug.minVisualReach.toFixed(2)}, endpointRatio=${debug.maxPreImpactTravelRatio.toFixed(2)}, preImpactWorldAdvance=${debug.maxPreImpactHeadWorldAdvance.toFixed(2)}, visualWorldAdvance=${debug.maxVisualHeadWorldAdvance.toFixed(2)}, nearImpactVisible=${debug.maxNearImpactVisibleRatio.toFixed(2)}, impactToVisual=${debug.maxImpactToVisualDistance.toFixed(2)}, postImpactDistance=${debug.maxPostImpactDistance.toFixed(2)}, syncTolerance=${impactVisualSyncTolerance.toFixed(2)}, postImpactHeadFade=${postImpactHeadFadeDistance.toFixed(2)}, headAlpha=${debug.minPreImpactHeadAlpha.toFixed(2)}, trailAlphaRuntime=${debug.minPreImpactTrailAlpha.toFixed(2)}, shots=${debug.shotsCreated}, normalShots=${hitDebug.normalShots}, normalImpacts=${hitDebug.normalImpacts}, normalKills=${hitDebug.normalKills}, missedNormalImpacts=${hitDebug.missedNormalImpacts}, staleNormalImpacts=${hitDebug.staleNormalImpacts}, multiDamageImpacts=${hitDebug.multiDamageImpacts}, reservedTargets=${hitDebug.reservedTargets}, hitRadius=${hitDebug.minNormalHitRadius.toFixed(2)}-${hitDebug.maxNormalHitRadius.toFixed(2)}, hitHalfDepth=${hitDebug.minNormalHitHalfDepth.toFixed(2)}-${hitDebug.maxNormalHitHalfDepth.toFixed(2)}, impactInset=${hitDebug.minNormalImpactInset.toFixed(2)}-${hitDebug.maxNormalImpactInset.toFixed(2)}, tailClear=${tailClearDistance.toFixed(2)}, trailAlpha=${trailAlpha.toFixed(2)}, wakeAlpha=${wakeAlpha.toFixed(2)}, slug=${slugDiameter.toFixed(2)}x${slugLength.toFixed(2)}, streak=${streakWidth.toFixed(3)}, wakeNear=${wakeNearDiameter.toFixed(2)}, wakeFar=${wakeFarDiameter.toFixed(2)}, core=${coreDiameter.toFixed(2)}, flash=${flashDiameter.toFixed(2)}, monsterFrontInset=${monsterFrontSurfaceInset.toFixed(2)}, formationSpacing=${soldierFormationSpacing.toFixed(2)}, formationRowDepth=${soldierFormationRowDepth.toFixed(2)}, rangeTravel=${rangeTravelSeconds.toFixed(2)}s, life=${lifeSeconds.toFixed(2)}s`,
  )
} finally {
  await browser?.close().catch(() => {})
  await stopPreview(preview)
}
