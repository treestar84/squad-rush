import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotPath = resolve(outputDir, "defense-castle-environment-desktop.png")
const minScreenshotBytes = 90000
const minBuildingCount = 20
const minPortalZ = 54
const maxPortalZ = 62
const minRoadLength = 150
const minVisibleWaveMonsters = 40
const maxVisibleWaveMonsters = 70

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
const previewUrl = `http://127.0.0.1:${port}/?mode=defense&difficulty=easy&quality=high&qa=monsters`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)

let browser
try {
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(previewUrl, { waitUntil: "domcontentloaded" })
  await clickStartButton(page)
  await page.waitForFunction(() => {
    const debug = window.__squadRushDefenseCastleDebug
    return debug?.portalLoaded === true && debug.buildingCount >= 20
  }, null, { timeout: 60000 })
  await page.waitForFunction(
    (minimum) => (window.__squadRushMonsterDebug?.active ?? 0) >= minimum,
    minVisibleWaveMonsters,
    { timeout: 30000 },
  )
  await page.waitForTimeout(900)

  const state = await page.evaluate(() => ({
    castle: window.__squadRushDefenseCastleDebug,
    environment: window.__squadRushEnvironmentDebug,
    mode: window.__squadRushGameModeDebug,
    monsters: window.__squadRushMonsterDebug,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const screenshot = await stat(screenshotPath)

  assertQa(screenshot.size >= minScreenshotBytes, `Defense castle screenshot is too small: ${screenshot.size}`)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(state.castle?.enabled === true, "Defense castle environment debug state is missing.")
  assertQa(state.castle.portalLoaded === true, "Defense portal GLB did not load.")
  assertQa(state.castle.textureLoaded === true, "Defense cobblestone texture was not registered.")
  assertQa(state.castle.buildingVariantCount >= 4, `Defense building variants too low: ${state.castle.buildingVariantCount}`)
  assertQa(state.castle.buildingCount >= minBuildingCount, `Defense building count too low: ${state.castle.buildingCount}`)
  assertQa(state.castle.leftBuildingCount > 0 && state.castle.rightBuildingCount > 0, "Defense buildings must fill both sides.")
  assertQa(state.castle.portalZ >= minPortalZ, `Defense portal was pulled too close: ${state.castle.portalZ}`)
  assertQa(state.castle.portalZ <= maxPortalZ, `Defense portal should be pulled closer to the squad: ${state.castle.portalZ}`)
  assertQa(state.castle.roadLength >= minRoadLength, `Defense road is too short: ${state.castle.roadLength}`)
  assertQa(state.environment?.serviceDecks === 0, "Defense castle should suppress legacy service decks.")
  assertQa(state.environment?.cargoStacks === 0, "Defense castle should suppress legacy cargo stacks.")
  assertQa(state.environment?.authoredRoadSegments === 0, "Defense castle should suppress legacy authored road segments.")
  assertQa(state.mode?.mode === "defense", "Defense mode was not active.")
  assertQa((state.monsters?.active ?? 0) >= minVisibleWaveMonsters, `Defense wave pressure too low: ${state.monsters?.active ?? 0}`)
  assertQa((state.monsters?.active ?? 0) <= maxVisibleWaveMonsters, `Defense wave pressure should stay bounded after spawn pull: ${state.monsters?.active ?? 0}`)
  assertQa(state.scrollWidth <= state.viewportWidth, "Defense castle capture has horizontal overflow.")

  await browser.close()
  browser = undefined
  console.info(JSON.stringify({ screenshotPath, state }, null, 2))
} finally {
  if (browser !== undefined) {
    await browser.close()
  }
  await stopPreview(preview)
}
