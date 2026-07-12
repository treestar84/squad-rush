import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotPath = resolve(outputDir, "defense-pressure-curve-red.png")
const previewReadyMs = 15000
const gameplayReadyMs = 30000
const minScreenshotBytes = 20000

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

async function readPressureState(page) {
  return page.evaluate(() => ({
    mode: window.__squadRushGameModeDebug?.mode ?? "",
    progressZ: window.__squadRushGameModeDebug?.progressZ ?? 0,
    squadZ: window.__squadRushGameModeDebug?.squadZ ?? 0,
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    pressureState: window.__squadRushMonsterDebug?.pressureState ?? null,
    visiblePressureBands: window.__squadRushMonsterDebug?.visiblePressureBands ?? null,
    visibleCombatBandDensity: window.__squadRushMonsterDebug?.visibleCombatBandDensity ?? null,
    centerPressureBandDensity: window.__squadRushMonsterDebug?.centerPressureBandDensity ?? null,
    bottomBreachProximity: window.__squadRushMonsterDebug?.bottomBreachProximity ?? null,
    visibleTargetMin: window.__squadRushMonsterDebug?.visibleTargetMin ?? null,
    visibleTargetMax: window.__squadRushMonsterDebug?.visibleTargetMax ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `Defense pressure curve screenshot is too small: ${path}`)
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
  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  collectPageErrors(page, consoleErrors, pageErrors)

  await page.goto(`${previewUrl}?mode=defense&difficulty=easy&quality=high&qa=monsters`, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => window.__squadRushGameModeDebug?.mode === "defense", null, { timeout: gameplayReadyMs })
  await page.waitForFunction(() => {
    const debug = window.__squadRushGameModeDebug
    const monsters = window.__squadRushMonsterDebug
    return debug !== undefined
      && debug.progressZ - debug.squadZ >= 8
      && monsters !== undefined
      && monsters.visibleCombatBandDensity >= monsters.visibleTargetMin
      && monsters.visibleCombatBandDensity <= monsters.visibleTargetMax
  }, null, { timeout: gameplayReadyMs })

  const pressureState = await readPressureState(page)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await assertScreenshot(screenshotPath)

  assertQa(pageErrors.length === 0, `Page errors detected before pressure telemetry assertion: ${pageErrors.join(" | ")}`)
  assertQa(consoleErrors.length === 0, `Console errors detected before pressure telemetry assertion: ${consoleErrors.join(" | ")}`)
  assertQa(pressureState.mode === "defense", "Defense pressure curve did not enter defense mode.")
  assertQa(pressureState.scrollWidth <= pressureState.viewportWidth, "Defense pressure curve capture has horizontal overflow.")
  assertQa(
    pressureState.visiblePressureBands !== null
      && typeof pressureState.visibleCombatBandDensity === "number"
      && typeof pressureState.centerPressureBandDensity === "number"
      && typeof pressureState.bottomBreachProximity === "number"
      && typeof pressureState.visibleTargetMin === "number"
      && typeof pressureState.visibleTargetMax === "number"
      && typeof pressureState.pressureState === "string",
    `Defense visible pressure telemetry missing: expected pressureState, visiblePressureBands, visibleCombatBandDensity, centerPressureBandDensity, bottomBreachProximity, visibleTargetMin, and visibleTargetMax after preview load. Observed ${JSON.stringify(pressureState)}`,
  )
  assertQa(
    pressureState.visibleCombatBandDensity >= pressureState.visibleTargetMin
      && pressureState.visibleCombatBandDensity <= pressureState.visibleTargetMax,
    `Defense visible pressure density ${pressureState.visibleCombatBandDensity} outside ${pressureState.pressureState} target ${pressureState.visibleTargetMin}-${pressureState.visibleTargetMax}. Observed ${JSON.stringify(pressureState)}`,
  )

  console.info(JSON.stringify({ screenshotPath, pressureState }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
