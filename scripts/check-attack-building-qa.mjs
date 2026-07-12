import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotName = "attack-buildings-desktop.png"
const minMovingBuildings = 20
const minBuildingVariants = 4
const minZDelta = 0.35

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
const previewUrl = `http://127.0.0.1:${port}/?mode=run&difficulty=easy&quality=high&qa=attack-buildings`
const defensePreviewUrl = `http://127.0.0.1:${port}/?mode=defense&difficulty=easy&quality=high&qa=attack-buildings`
const defenseSelectionUrl = `http://127.0.0.1:${port}/?difficulty=easy&quality=high&qa=attack-buildings`
const mobilePreviewUrl = `http://127.0.0.1:${port}/?mode=run&difficulty=easy&quality=high&qa=attack-buildings`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)

let browser
try {
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
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
    const debug = window.__squadRushAttackBuildingDebug
    return debug?.mode === "run" && debug.assetLoaded === true && debug.totalCount >= 20
  }, null, { timeout: 60000 })
  await page.waitForTimeout(900)

  const first = await page.evaluate(() => window.__squadRushAttackBuildingDebug)
  await page.waitForTimeout(900)
  const second = await page.evaluate(() => window.__squadRushAttackBuildingDebug)
  const desktopEnvironment = await page.evaluate(() => ({
    setpieces: window.__squadRushEnvironmentDebug,
    surface: window.__squadRushEnvironmentSurfaceDebug,
  }))

  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 60000 })

  const screenshot = await stat(screenshotPath)
  const firstAverageZ = first?.sampleAverageZ ?? 0
  const secondAverageZ = second?.sampleAverageZ ?? 0
  const movedTowardCamera = firstAverageZ - secondAverageZ
  await page.locator("[data-role='pause']").dispatchEvent("click")
  await page.waitForTimeout(450)
  const pausedFirst = await page.evaluate(() => window.__squadRushAttackBuildingDebug)
  await page.waitForTimeout(700)
  const pausedSecond = await page.evaluate(() => window.__squadRushAttackBuildingDebug)
  const pauseDrift = Math.abs((pausedFirst?.sampleAverageZ ?? 0) - (pausedSecond?.sampleAverageZ ?? 0))
  assertQa(screenshot.size > 90000, `Attack building screenshot is too small: ${screenshot.size}`)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(second?.totalCount >= minMovingBuildings, `Attack mode building count too low: ${second?.totalCount ?? 0}`)
  assertQa(second.assetLoaded === true, "Attack building GLB asset did not load.")
  assertQa(second.mobileDisabled === false, "Desktop attack buildings should not be mobile-disabled.")
  assertQa(second.variantCount >= minBuildingVariants, `Attack building variant count too low: ${second.variantCount}`)
  assertQa(second.leftCount > 0 && second.rightCount > 0, "Attack buildings must appear on both sides.")
  assertQa(second.maxGroundContactError <= 0.02, `Attack buildings are not snapped to the ground: ${second.maxGroundContactError.toFixed(3)}`)
  assertQa(movedTowardCamera >= minZDelta, `Attack buildings did not move past the squad: ${movedTowardCamera.toFixed(2)}`)
  assertQa(pauseDrift < 0.01, `Attack buildings moved while paused: ${pauseDrift.toFixed(3)}`)
  assertQa(second.scrollOverflow <= 0, "Attack building capture has horizontal overflow.")
  assertQa(desktopEnvironment.setpieces?.serviceDecks === 0, "Desktop attack buildings must suppress side service decks.")
  assertQa(desktopEnvironment.setpieces?.cargoStacks === 0, "Desktop attack buildings must suppress side cargo stacks.")
  assertQa(desktopEnvironment.setpieces?.authoredRoadSegments === 0, "Desktop attack buildings must suppress authored side road modules.")
  assertQa(desktopEnvironment.surface?.desktopAttackEnvironment === true, "Desktop attack mode must use the building ground palette.")
  assertQa(desktopEnvironment.surface?.sideObjectsHidden === true, "Desktop attack mode must hide old side objects under buildings.")
  await page.close()

  const defensePage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await defensePage.goto(defensePreviewUrl, { waitUntil: "domcontentloaded" })
  await clickStartButton(defensePage)
  await defensePage.waitForFunction(() => window.__squadRushAttackBuildingDebug?.mode === "defense", null, { timeout: 36000 })
  const defense = await defensePage.evaluate(() => window.__squadRushAttackBuildingDebug)
  assertQa(defense?.totalCount === 0, `Defense mode must not spawn attack buildings: ${defense?.totalCount ?? 0}`)
  await defensePage.close()

  const defenseSelectionPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await defenseSelectionPage.goto(defenseSelectionUrl, { waitUntil: "domcontentloaded" })
  await defenseSelectionPage.waitForSelector("[data-mode='defense']", { timeout: 60000 })
  await defenseSelectionPage.locator("[data-mode='defense']").click()
  await clickStartButton(defenseSelectionPage)
  await defenseSelectionPage.waitForFunction(() => window.__squadRushAttackBuildingDebug?.mode === "defense", null, { timeout: 36000 })
  const defenseSelection = await defenseSelectionPage.evaluate(() => window.__squadRushAttackBuildingDebug)
  assertQa(defenseSelection?.totalCount === 0, `UI-selected defense mode must not spawn attack buildings: ${defenseSelection?.totalCount ?? 0}`)
  await defenseSelectionPage.close()

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } })
  await mobilePage.goto(mobilePreviewUrl, { waitUntil: "domcontentloaded" })
  await clickStartButton(mobilePage)
  await mobilePage.waitForFunction(() => window.__squadRushAttackBuildingDebug?.mode === "run", null, { timeout: 36000 })
  const mobile = await mobilePage.evaluate(() => window.__squadRushAttackBuildingDebug)
  const mobileEnvironment = await mobilePage.evaluate(() => ({
    setpieces: window.__squadRushEnvironmentDebug,
    surface: window.__squadRushEnvironmentSurfaceDebug,
  }))
  assertQa(mobile?.mobileDisabled === true, "Mobile attack buildings must be disabled.")
  assertQa(mobile?.totalCount === 0, `Mobile attack mode must not spawn attack buildings: ${mobile?.totalCount ?? 0}`)
  assertQa(mobile?.assetLoaded === false, "Mobile attack mode must not load desktop building GLBs.")
  assertQa((mobileEnvironment.setpieces?.serviceDecks ?? 0) > 0, "Mobile attack mode must keep lightweight side setpieces.")
  assertQa(mobileEnvironment.setpieces?.cargoStacks === 0, "Mobile attack mode must suppress floor-attached cargo boxes.")
  assertQa(mobileEnvironment.surface?.desktopAttackEnvironment === false, "Mobile attack mode must keep the default blue road-side palette.")
  await mobilePage.close()
  await browser.close()
  browser = undefined

  console.info(JSON.stringify({
    screenshotPath,
    first,
    second,
    movedTowardCamera,
    pausedFirst,
    pausedSecond,
    pauseDrift,
    desktopEnvironment,
    defense,
    defenseSelection,
    mobile,
    mobileEnvironment,
  }, null, 2))
} finally {
  if (browser !== undefined) {
    await browser.close()
  }
  await stopPreview(preview)
}
