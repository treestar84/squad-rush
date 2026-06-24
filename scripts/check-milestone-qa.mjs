import { spawn } from "node:child_process"
import { stat, mkdir } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const maxHorizontalOverflowPx = 0
const minScreenshotBytes = 50000
const startWaitMs = 1200
const startVisibleTimeoutMs = 12000
const firstGateWaitMs = 5200
const firstHordeWaitMs = 12600

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === "object" && address !== null) {
          resolvePort(address.port)
          return
        }
        reject(new Error("Unable to allocate preview port."))
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

function parseNumber(text) {
  const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
  return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
}

function assertRuntime(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertRuntime(file.size >= minScreenshotBytes, `Milestone screenshot is too small: ${path}`)
}

async function readStartStats(page) {
  return page.evaluate(() => {
    const startScreen = document.querySelector("#start-screen")
    const button = document.querySelector(".tap-to-start")
    const buttonRect = button instanceof HTMLElement ? button.getBoundingClientRect() : null
    const hero = window.__squadRushStartHeroDebug
    return {
      title: document.querySelector(".game-title")?.textContent ?? "",
      mission: document.querySelector(".mission-strip")?.textContent ?? "",
      button: button?.textContent ?? "",
      visible: startScreen instanceof HTMLElement && getComputedStyle(startScreen).display !== "none",
      buttonFullyVisible: buttonRect !== null && buttonRect.top >= 0 && buttonRect.bottom <= window.innerHeight,
      heroVisible: hero?.visible === true,
      heroRole: hero?.role ?? "",
      heroRunAnimation: hero?.runAnimation === true,
      heroKitMeshes: hero?.kitMeshes ?? 0,
      heroScreenZone: hero?.screenZone ?? "",
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

async function readCombatStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      soldiers: textOf("[data-role='soldiers']"),
      kills: textOf("[data-role='kills']"),
      fps: textOf("[data-role='fps']"),
      progress: textOf("[data-role='stage']"),
      obstacles: textOf("[data-role='obstacles']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

async function captureStart(page, screenshotName) {
  await page.waitForFunction(() => {
    const start = document.querySelector("#start-screen")
    return start instanceof HTMLElement && getComputedStyle(start).display !== "none"
  }, null, { timeout: startVisibleTimeoutMs })
  await page.waitForTimeout(startWaitMs)
  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readStartStats(page)
  await assertScreenshot(screenshotPath)
  assertRuntime(stats.visible, `${screenshotName} start screen is not visible.`)
  assertRuntime(stats.title.includes("바로 Go 스쿼드"), `${screenshotName} title is missing.`)
  assertRuntime(stats.mission.includes("START1SOLDIER"), `${screenshotName} one-soldier briefing is missing.`)
  assertRuntime(stats.button.includes("TAP TO START"), `${screenshotName} start button is missing.`)
  assertRuntime(stats.buttonFullyVisible, `${screenshotName} start button is clipped.`)
  assertRuntime(stats.heroVisible, `${screenshotName} start hero preview is not visible.`)
  assertRuntime(stats.heroRole === "heavy", `${screenshotName} start hero does not use the heavy role kit.`)
  assertRuntime(stats.heroRunAnimation, `${screenshotName} start hero run animation is missing.`)
  assertRuntime(stats.heroKitMeshes >= 4, `${screenshotName} start hero role kit is incomplete.`)
  assertRuntime(stats.heroScreenZone === "hero-lane", `${screenshotName} start hero is not framed in the lane.`)
  assertRuntime(stats.scrollWidth - stats.viewportWidth <= maxHorizontalOverflowPx, `${screenshotName} has horizontal overflow.`)
  return { screenshotPath, stats }
}

async function captureCombat(page, options) {
  await clickStartButton(page)
  await page.waitForTimeout(options.waitMs)
  const screenshotPath = resolve(outputDir, options.screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readCombatStats(page)
  await assertScreenshot(screenshotPath)
  assertRuntime(stats.scrollWidth - stats.viewportWidth <= maxHorizontalOverflowPx, `${options.screenshotName} has horizontal overflow.`)
  assertRuntime(parseNumber(stats.progress) >= options.requirements.minProgress, `${options.screenshotName} did not reach required progress.`)
  assertRuntime(parseNumber(stats.soldiers) >= options.requirements.minSoldiers, `${options.screenshotName} squad count is too low.`)
  assertRuntime(parseNumber(stats.fps) >= options.requirements.minFps, `${options.screenshotName} FPS text is below ${options.requirements.minFps}.`)
  if (options.requirements.minKills > 0) {
    assertRuntime(parseNumber(stats.kills) >= options.requirements.minKills, `${options.screenshotName} did not reach required kills.`)
  }
  if ((options.requirements.minObstacles ?? 0) > 0) {
    assertRuntime(parseNumber(stats.obstacles) >= options.requirements.minObstacles, `${options.screenshotName} has no active lane obstacle.`)
  }
  return { screenshotPath, stats }
}

async function openPage(options) {
  const page = await options.browser.newPage({ viewport: options.viewport })
  collectPageErrors(page, options.consoleErrors, options.pageErrors)
  await page.goto(options.url, { waitUntil: "networkidle" })
  return page
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)

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
  const browser = await chromium.launch({ channel: "chrome" })

  const desktopStartPage = await openPage({
    browser,
    url: previewUrl,
    viewport: { width: 1280, height: 900 },
    consoleErrors,
    pageErrors,
  })
  const desktopStart = await captureStart(desktopStartPage, "milestone-desktop-start.png")
  await desktopStartPage.close()

  const desktopGatePage = await openPage({
    browser,
    url: previewUrl,
    viewport: { width: 1280, height: 900 },
    consoleErrors,
    pageErrors,
  })
  const desktopGate = await captureCombat(desktopGatePage, {
    screenshotName: "milestone-desktop-first-gate.png",
    waitMs: firstGateWaitMs,
    requirements: {
      minProgress: 2,
      minSoldiers: 1,
      minKills: 0,
      minFps: 12,
    },
  })
  await desktopGatePage.close()

  const desktopHordePage = await openPage({
    browser,
    url: previewUrl,
    viewport: { width: 1280, height: 900 },
    consoleErrors,
    pageErrors,
  })
  const desktopHorde = await captureCombat(desktopHordePage, {
    screenshotName: "milestone-desktop-first-horde.png",
    waitMs: firstHordeWaitMs,
    requirements: {
      minProgress: 9,
      minSoldiers: 1,
      minKills: 30,
      minFps: 24,
      minObstacles: 1,
    },
  })
  await desktopHordePage.close()

  const mobileStartPage = await openPage({
    browser,
    url: previewUrl,
    viewport: { width: 390, height: 844 },
    consoleErrors,
    pageErrors,
  })
  const mobileStart = await captureStart(mobileStartPage, "milestone-mobile-start.png")
  await mobileStartPage.close()

  const mobileHordePage = await openPage({
    browser,
    url: previewUrl,
    viewport: { width: 390, height: 844 },
    consoleErrors,
    pageErrors,
  })
  const mobileHorde = await captureCombat(mobileHordePage, {
    screenshotName: "milestone-mobile-first-horde.png",
    waitMs: firstHordeWaitMs,
    requirements: {
      minProgress: 9,
      minSoldiers: 1,
      minKills: 30,
      minFps: 24,
      minObstacles: 1,
    },
  })
  await mobileHordePage.close()
  await browser.close()

  assertRuntime(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertRuntime(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)

  console.info(JSON.stringify({ desktopStart, desktopGate, desktopHorde, mobileStart, mobileHorde }, null, 2))
} finally {
  cleanup()
}
