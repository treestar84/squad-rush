import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotPath = resolve(outputDir, "defense-boss-jam-red.png")
const previewReadyMs = 15000
const bossCaptureMs = 90000
const minScreenshotBytes = 20000
const minBossBacklog = 8
const minBossProjectileRadiusRatio = 1.1
const maxBossProjectileRadiusRatio = 1.15
const minBossProjectileDepthRatio = 1.5

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

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

async function readBossJamState(page) {
  return page.evaluate(() => ({
    mode: window.__squadRushGameModeDebug?.mode ?? "",
    progressZ: window.__squadRushGameModeDebug?.progressZ ?? 0,
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    midBosses: window.__squadRushMonsterDebug?.midBosses ?? 0,
    midBossHpBars: window.__squadRushMonsterDebug?.midBossHpBars ?? 0,
    largestMidBossHitRadius: window.__squadRushMonsterDebug?.largestMidBossHitRadius ?? 0,
    largestMidBossHitHalfDepth: window.__squadRushMonsterDebug?.largestMidBossHitHalfDepth ?? 0,
    bossSoakShots: window.__squadRushMonsterDebug?.bossSoakShots ?? null,
    bossDamageEvents: window.__squadRushMonsterDebug?.bossDamageEvents ?? null,
    bossLowestHpRatio: window.__squadRushMonsterDebug?.bossLowestHpRatio ?? null,
    bossNearestDistance: window.__squadRushMonsterDebug?.bossNearestDistance ?? null,
    bossNearestAbsX: window.__squadRushMonsterDebug?.bossNearestAbsX ?? null,
    bossRearBacklog: window.__squadRushMonsterDebug?.bossRearBacklog ?? null,
    bossJamPickupRisk: window.__squadRushMonsterDebug?.bossJamPickupRisk ?? null,
    maxTankProjectileHitRadius: window.__squadRushHitDebug?.maxTankProjectileHitRadius ?? 0,
    maxTankProjectileHitHalfDepth: window.__squadRushHitDebug?.maxTankProjectileHitHalfDepth ?? 0,
    tankShots: window.__squadRushHitDebug?.tankShots ?? 0,
    tankImpacts: window.__squadRushHitDebug?.tankImpacts ?? 0,
    tankShotsWhileReserved: window.__squadRushHitDebug?.tankShotsWhileReserved ?? 0,
    maxTankConcurrentReservations: window.__squadRushHitDebug?.maxTankConcurrentReservations ?? 0,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `Defense boss jam screenshot is too small: ${path}`)
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
  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  collectPageErrors(page, consoleErrors, pageErrors)

  await page.goto(`${previewUrl}?mode=defense&difficulty=easy&quality=high&qa=monsters&qa=hit-sync&qaSpeed=4&qaSoldiers=30`, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => window.__squadRushGameModeDebug?.mode === "defense", null, { timeout: bossCaptureMs })
  await page.waitForFunction(() => {
    const debug = window.__squadRushMonsterDebug
    return debug !== undefined
      && debug.midBosses > 0
      && debug.midBossHpBars > 0
      && debug.bossSoakShots > 0
      && debug.bossDamageEvents > 0
      && (window.__squadRushHitDebug?.tankShotsWhileReserved ?? 0) > 0
      && (window.__squadRushHitDebug?.maxTankConcurrentReservations ?? 0) >= 2
      && debug.bossLowestHpRatio < 1
      && debug.bossRearBacklog >= 8
      && debug.bossJamPickupRisk?.active === true
  }, null, { timeout: bossCaptureMs })
  await page.waitForTimeout(500)

  const bossJamState = await readBossJamState(page)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await assertScreenshot(screenshotPath)

  assertQa(pageErrors.length === 0, `Page errors detected before boss jam assertion: ${pageErrors.join(" | ")}`)
  assertQa(consoleErrors.length === 0, `Console errors detected before boss jam assertion: ${consoleErrors.join(" | ")}`)
  assertQa(bossJamState.mode === "defense", "Defense boss jam did not enter defense mode.")
  assertQa(bossJamState.scrollWidth <= bossJamState.viewportWidth, "Defense boss jam capture has horizontal overflow.")
  assertQa(bossJamState.midBosses === 1, `Defense boss jam must keep exactly one active boss: ${bossJamState.midBosses}.`)
  assertQa(
    typeof bossJamState.bossSoakShots === "number"
      && typeof bossJamState.bossDamageEvents === "number"
      && typeof bossJamState.bossLowestHpRatio === "number"
      && typeof bossJamState.bossNearestDistance === "number"
      && typeof bossJamState.bossNearestAbsX === "number"
      && typeof bossJamState.bossRearBacklog === "number"
      && bossJamState.bossJamPickupRisk !== null,
    `Defense boss soak/backlog proof missing: expected bossSoakShots, bossDamageEvents, bossLowestHpRatio, bossNearestDistance, bossNearestAbsX, bossRearBacklog, and bossJamPickupRisk after mid-boss load. Observed ${JSON.stringify(bossJamState)}`,
  )
  assertQa(bossJamState.bossSoakShots > 0, `Defense boss did not absorb shots: ${JSON.stringify(bossJamState)}`)
  assertQa(bossJamState.bossDamageEvents > 0, `Defense boss did not receive damage events: ${JSON.stringify(bossJamState)}`)
  assertQa(bossJamState.bossLowestHpRatio < 1, `Defense boss HP did not move below full: ${JSON.stringify(bossJamState)}`)
  const bossProjectileRadiusRatio = bossJamState.maxTankProjectileHitRadius / bossJamState.largestMidBossHitRadius
  assertQa(bossProjectileRadiusRatio >= minBossProjectileRadiusRatio, `Defense boss projectile hit radius did not fully cover the visual body: ${JSON.stringify(bossJamState)}`)
  assertQa(bossProjectileRadiusRatio <= maxBossProjectileRadiusRatio, `Defense boss projectile hit radius blocks shots too far outside the visible sides: ${JSON.stringify(bossJamState)}`)
  assertQa(bossJamState.maxTankProjectileHitHalfDepth > bossJamState.largestMidBossHitHalfDepth, `Defense boss projectile hit depth was not larger than visual depth: ${JSON.stringify(bossJamState)}`)
  assertQa(
    bossJamState.maxTankProjectileHitHalfDepth >= bossJamState.largestMidBossHitHalfDepth * minBossProjectileDepthRatio,
    `Defense boss projectile hit depth ${bossJamState.maxTankProjectileHitHalfDepth} must be at least ${minBossProjectileDepthRatio}x visual depth ${bossJamState.largestMidBossHitHalfDepth}: ${JSON.stringify(bossJamState)}`,
  )
  assertQa(bossJamState.tankShotsWhileReserved > 0, `Defense boss stopped absorbing shots after the first in-flight reservation: ${JSON.stringify(bossJamState)}`)
  assertQa(bossJamState.maxTankConcurrentReservations >= 2, `Defense boss never held multiple in-flight projectiles: ${JSON.stringify(bossJamState)}`)
  assertQa(bossJamState.tankShots >= bossJamState.maxTankConcurrentReservations, `Defense boss reservation telemetry is inconsistent: ${JSON.stringify(bossJamState)}`)
  assertQa(bossJamState.bossRearBacklog >= minBossBacklog, `Defense boss backlog ${bossJamState.bossRearBacklog} < ${minBossBacklog}.`)
  assertQa(bossJamState.bossJamPickupRisk.active === true, `Defense boss pickup risk was not active: ${JSON.stringify(bossJamState)}`)

  console.info(JSON.stringify({ screenshotPath, bossJamState }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
