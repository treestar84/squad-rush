import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { webkit } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const maxMobileOverflowPx = 0
const maxCommandHeight = 56
const minCombatKills = 20
const minCombatProgress = 15
const minSafariFps = 24
const screenshotName = "safari-mobile-combat.png"
const safariProfileLabel = "iPhone Safari"
const iPhoneSafariUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

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

function parseNumber(text) {
  const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
  return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
}

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size > 10000, `Safari mobile QA screenshot is too small: ${path}`)
}

async function readSafariStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const commandRect = document.querySelector(".hud-command-strip")?.getBoundingClientRect()
    const canvasRect = document.querySelector("#game-canvas")?.getBoundingClientRect()
    return {
      soldiers: textOf("[data-role='soldiers']"),
      kills: textOf("[data-role='kills']"),
      fps: textOf("[data-role='fps']"),
      progress: textOf("[data-role='stage']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      commandHeight: commandRect?.height ?? -1,
      canvasWidth: canvasRect?.width ?? 0,
      canvasHeight: canvasRect?.height ?? 0,
    }
  })
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
  const browser = await webkit.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent: iPhoneSafariUserAgent,
  })
  const page = await context.newPage()
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${previewUrl}?quality=medium`, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForTimeout(12600)
  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readSafariStats(page)
  await browser.close()

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Safari console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Safari page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= maxMobileOverflowPx, "Safari mobile viewport has horizontal overflow.")
  assertQa(stats.commandHeight > 0 && stats.commandHeight <= maxCommandHeight, "Safari mobile HUD command strip is too tall.")
  assertQa(stats.canvasWidth >= 390 && stats.canvasHeight >= 844, "Safari canvas did not fill the mobile viewport.")
  assertQa(parseNumber(stats.kills) >= minCombatKills, `Safari mobile combat did not reach ${minCombatKills} kills.`)
  assertQa(parseNumber(stats.progress) >= minCombatProgress, `Safari mobile combat did not reach ${minCombatProgress}% progress.`)
  assertQa(parseNumber(stats.fps) >= minSafariFps, `Safari mobile FPS text ${stats.fps} is below ${minSafariFps}.`)

  console.info(JSON.stringify({ profile: safariProfileLabel, screenshotPath, stats }, null, 2))
} finally {
  cleanup()
}
