import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium, webkit } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const mobileProfile = process.env.DEFENSE_STRESS_MOBILE === "1"
const webkitProfile = process.env.DEFENSE_STRESS_WEBKIT === "1"
const qaAddedSoldiers = Math.max(0, Math.min(47, Number.parseInt(process.env.DEFENSE_STRESS_SOLDIERS ?? "47", 10)))
const immortalMonsters = process.env.DEFENSE_STRESS_IMMORTAL !== "0"
const expectedLogicalSquad = Math.min(20, qaAddedSoldiers + 1)
const expectedVisualSquadMax = expectedLogicalSquad
const overflowReinforcements = Math.max(0, qaAddedSoldiers - 19)
const expectedSpecialistPromotions = overflowReinforcements < 10
  ? 0
  : Math.floor((overflowReinforcements - 1) / 9)
const expectedReserveUnemployed = overflowReinforcements - expectedSpecialistPromotions * 9
const profileLabel = webkitProfile ? "webkit-mobile" : mobileProfile ? "mobile" : "desktop"
const screenshotPath = resolve(outputDir, `defense-density-stress-${profileLabel}-${expectedLogicalSquad}-logical-${expectedVisualSquadMax}-visual.png`)
const previewReadyMs = 15000
const gameplayReadyMs = 45000
const minScreenshotBytes = 30000
const minStressFps = mobileProfile ? 24 : 30
const stressSampleMs = 3500
const iPhoneSafariUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"

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
  while (Date.now() - startedAt < previewReadyMs) {
    if (await requestOk(url)) {
      return
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error("Preview server did not become ready within 15s.")
}

async function sampleBrowserPerformance(page, durationMs) {
  return page.evaluate((sampleMs) => new Promise((resolveSample) => {
    let frames = 0
    const startedAt = performance.now()
    let previousFrameAt = startedAt
    const frameTimes = []
    function tick(now) {
      if (frames > 0) {
        frameTimes.push(now - previousFrameAt)
      }
      previousFrameAt = now
      frames += 1
      if (now - startedAt < sampleMs) {
        requestAnimationFrame(tick)
        return
      }
      const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b)
      const percentileIndex = Math.max(0, Math.floor((sortedFrameTimes.length - 1) * 0.95))
      const elapsedSeconds = Math.max(0.001, (now - startedAt) / 1000)
      resolveSample({
        fps: frames / elapsedSeconds,
        p95FrameMs: sortedFrameTimes[percentileIndex] ?? 0,
        maxFrameMs: sortedFrameTimes[sortedFrameTimes.length - 1] ?? 0,
        longFrameRatio: frameTimes.length === 0
          ? 0
          : frameTimes.filter((frameTime) => frameTime > 50).length / frameTimes.length,
      })
    }
    requestAnimationFrame(tick)
  }), durationMs)
}

async function readStressState(page) {
  return page.evaluate(() => ({
    mode: window.__squadRushGameModeDebug?.mode ?? "",
    progressZ: window.__squadRushGameModeDebug?.progressZ ?? 0,
    squadSize: window.__squadRushGameModeDebug?.formation.count ?? 0,
    formation: window.__squadRushGameModeDebug?.formation ?? null,
    logicalSquadSize: window.__squadRushGameModeDebug?.roster.reduce((total, entry) => total + entry.count, 0) ?? 0,
    combat: window.__squadRushGameModeDebug?.combat ?? null,
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    pressureState: window.__squadRushMonsterDebug?.pressureState ?? null,
    visibleCombatBandDensity: window.__squadRushMonsterDebug?.visibleCombatBandDensity ?? 0,
    visibleTargetMin: window.__squadRushMonsterDebug?.visibleTargetMin ?? 0,
    visibleTargetMax: window.__squadRushMonsterDebug?.visibleTargetMax ?? 0,
    maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
    defenseCarpet: window.__squadRushMonsterDebug?.defenseCarpet ?? null,
    promotionTreeEnabled: window.__squadRushGameModeDebug?.promotionTreeEnabled ?? true,
    defenseProgression: window.__squadRushGameModeDebug?.defenseProgression ?? null,
    spawnDensityMultiplier: window.__squadRushMonsterDebug?.spawnDensityMultiplier ?? 0,
    projectiles: window.__squadRushProjectileDebug ?? null,
    defenseFire: window.__squadRushDefenseFireDebug ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
}

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)
let browser

const cleanup = () => {
  if (!preview.killed) {
    preview.kill("SIGTERM")
  }
}
process.once("exit", cleanup)
process.once("SIGINT", () => {
  cleanup()
  process.exit(130)
})

try {
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  const consoleErrors = []
  const pageErrors = []
  browser = webkitProfile
    ? await webkit.launch()
    : await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage(mobileProfile
    ? {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      userAgent: iPhoneSafariUserAgent,
    }
    : { viewport: { width: 1280, height: 720 } })
  collectPageErrors(page, consoleErrors, pageErrors)

  const immortalParam = immortalMonsters ? "&qaImmortalMonsters=1" : ""
  await page.goto(`${previewUrl}?mode=defense&difficulty=easy&quality=high&qa=monsters&qa=projectile&qa=defense-fire&qaSoldiers=${qaAddedSoldiers}&qaStartZ=300&qaSpeed=0.2&qaNoDamage=1${immortalParam}`, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => window.__squadRushGameModeDebug?.mode === "defense", null, { timeout: gameplayReadyMs })
  try {
    await page.waitForFunction(() => {
      const debug = window.__squadRushMonsterDebug
      return debug !== undefined
        && debug.pressureState === "final_squeeze"
        && debug.visibleCombatBandDensity >= debug.visibleTargetMin
    }, null, { timeout: gameplayReadyMs })
  } catch (error) {
    const state = await readStressState(page)
    throw new Error(`Timed out waiting for doubled final-squeeze density. Last state: ${JSON.stringify(state)}. ${error instanceof Error ? error.message : String(error)}`)
  }

  const performanceSample = await sampleBrowserPerformance(page, stressSampleMs)
  const stressState = await readStressState(page)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const screenshot = await stat(screenshotPath)

  assertQa(pageErrors.length === 0, `Page errors detected during stress QA: ${pageErrors.join(" | ")}`)
  assertQa(consoleErrors.length === 0, `Console errors detected during stress QA: ${consoleErrors.join(" | ")}`)
  assertQa(screenshot.size >= minScreenshotBytes, `Defense density stress screenshot is too small: ${screenshotPath}`)
  assertQa(stressState.mode === "defense", "Stress QA did not enter defense mode.")
  assertQa(stressState.logicalSquadSize === expectedLogicalSquad, `Stress QA expected ${expectedLogicalSquad} logical squad members, observed ${stressState.logicalSquadSize}.`)
  assertQa(stressState.squadSize === expectedVisualSquadMax, `Stress QA expected ${expectedVisualSquadMax} visual squad members, observed ${stressState.squadSize}.`)
  assertQa(stressState.formation?.columns === 3, `Defense formation must stay at three columns: ${JSON.stringify(stressState.formation)}.`)
  assertQa(stressState.formation?.rows === 7, `Twenty defense actors must extend through seven rear rows: ${JSON.stringify(stressState.formation)}.`)
  assertQa(stressState.formation?.frontRowCount === 3, `Defense front row must contain exactly three actors: ${JSON.stringify(stressState.formation)}.`)
  assertQa((stressState.formation?.width ?? Number.POSITIVE_INFINITY) <= 0.9, `Defense formation is still too wide: ${JSON.stringify(stressState.formation)}.`)
  assertQa((stressState.formation?.depth ?? 0) >= 1.2, `Defense formation did not move enough members behind the front row: ${JSON.stringify(stressState.formation)}.`)
  assertQa(stressState.combat?.projectileCount === 8, `Defense must aggregate squad power into eight emitters: ${JSON.stringify(stressState.combat)}.`)
  assertQa((stressState.combat?.effectiveAttackPower ?? 0) > stressState.squadSize, `Logical squad power was capped by visual actors: ${JSON.stringify(stressState.combat)}.`)
  assertQa(stressState.promotionTreeEnabled === false, "Defense stress QA must keep the combination tree disabled.")
  assertQa(stressState.defenseProgression?.enabled === true, `Defense specialist progression must stay enabled: ${JSON.stringify(stressState.defenseProgression)}.`)
  assertQa(stressState.defenseProgression?.reserveUnemployed === expectedReserveUnemployed, `Expected reserve ${expectedReserveUnemployed}, observed ${JSON.stringify(stressState.defenseProgression)}.`)
  const specialistCount = stressState.defenseProgression?.branches.reduce(
    (total, branch) => total + branch.base + branch.middle + branch.top,
    0,
  ) ?? 0
  assertQa(specialistCount === expectedSpecialistPromotions, `Expected ${expectedSpecialistPromotions} defense specialist replacements, observed ${specialistCount}.`)
  assertQa(stressState.spawnDensityMultiplier === 1, `Late defense spawn density should be curve-count driven: ${stressState.spawnDensityMultiplier}.`)
  assertQa(stressState.visibleTargetMin >= 100, `Final defense visible target was not doubled: ${stressState.visibleTargetMin}-${stressState.visibleTargetMax}.`)
  assertQa(stressState.visibleCombatBandDensity >= stressState.visibleTargetMin, `Stress visible density ${stressState.visibleCombatBandDensity} below target ${stressState.visibleTargetMin}.`)
  assertQa(stressState.defenseCarpet?.columns === 11, `Defense carpet must cover all 11 road columns: ${JSON.stringify(stressState.defenseCarpet)}.`)
  assertQa((stressState.defenseCarpet?.occupiedRows ?? 0) >= 18, `Defense carpet did not fill enough descending rows: ${JSON.stringify(stressState.defenseCarpet)}.`)
  assertQa(stressState.scrollWidth <= stressState.viewportWidth, "Stress QA capture has horizontal overflow.")
  assertQa(stressState.projectiles !== null, "Stress QA must expose projectile telemetry.")
  assertQa(stressState.defenseFire?.emitterCount === 8, `Defense stagger QA must keep eight representative emitters: ${JSON.stringify(stressState.defenseFire)}.`)
  assertQa(stressState.defenseFire?.observedEmitterCount === 8, `Every representative emitter must participate in staggered fire: ${JSON.stringify(stressState.defenseFire)}.`)
  assertQa(stressState.defenseFire?.configuredMaxShotsPerUpdate === 2, `Defense firing must cap a rendered update at two shots: ${JSON.stringify(stressState.defenseFire)}.`)
  assertQa((stressState.defenseFire?.maxShotsPerUpdate ?? Number.POSITIVE_INFINITY) <= 2, `Defense recreated a simultaneous horizontal volley: ${JSON.stringify(stressState.defenseFire)}.`)
  assertQa((stressState.defenseFire?.shotUpdates ?? 0) >= (stressState.defenseFire?.shots ?? 0) * 0.5, `Defense shots are clustering instead of chaining over time: ${JSON.stringify(stressState.defenseFire)}.`)
  assertQa(Math.abs((stressState.defenseFire?.staggerIntervalSeconds ?? 0) - 0.03125) < 0.001, `Defense emitter phase interval must stay near 31.25ms: ${JSON.stringify(stressState.defenseFire)}.`)
  assertQa((stressState.defenseFire?.maxSameUpdateOriginWidth ?? Number.POSITIVE_INFINITY) <= 1.1, `Same-update projectile origins still cover too much horizontal range: ${JSON.stringify(stressState.defenseFire)}.`)
  console.info(JSON.stringify({ screenshotPath, performanceSample, stressState }, null, 2))
  assertQa(performanceSample.fps >= minStressFps, `Stress FPS ${performanceSample.fps.toFixed(1)} is below ${minStressFps}.`)
  const maxP95FrameMs = mobileProfile ? 50 : 40
  const maxLongFrameRatio = mobileProfile ? 0.1 : 0.08
  assertQa(performanceSample.p95FrameMs <= maxP95FrameMs, `Stress p95 frame time ${performanceSample.p95FrameMs.toFixed(1)}ms exceeds ${maxP95FrameMs}ms.`)
  assertQa(performanceSample.longFrameRatio <= maxLongFrameRatio, `Stress long-frame ratio ${(performanceSample.longFrameRatio * 100).toFixed(1)}% exceeds ${maxLongFrameRatio * 100}%.`)
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
