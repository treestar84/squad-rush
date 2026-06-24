import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const gameSource = readFileSync(resolve("src/game/Game.ts"), "utf8")
const gamePauseSource = readFileSync(resolve("src/game/GamePause.ts"), "utf8")
const pauseSource = readFileSync(resolve("src/ui/PauseControl.ts"), "utf8")
const designSource = readFileSync(resolve("DESIGN.md"), "utf8")

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parsePercent(text) {
  const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
  return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
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

async function readPauseStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const overlay = document.querySelector("[data-role='pause-panel']")
    const button = document.querySelector("[data-role='pause']")
    const overlayStyle = overlay instanceof HTMLElement ? getComputedStyle(overlay) : null
    return {
      progress: textOf("[data-role='stage']"),
      kills: textOf("[data-role='kills']"),
      buttonText: button?.textContent ?? "",
      pressed: button instanceof HTMLElement ? button.getAttribute("aria-pressed") : "",
      overlayVisible: overlayStyle?.display !== "none" && overlayStyle?.visibility !== "hidden",
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

assertQa(pauseSource.includes("data-role=\"pause\""), "Pause control must expose a HUD pause button.")
assertQa(pauseSource.includes("data-role=\"pause-panel\""), "Pause control must expose a paused overlay.")
assertQa(gamePauseSource.includes("this.control.setPaused(paused)"), "GamePause must drive PauseControl state.")
assertQa(gameSource.includes("if (this.pause.paused)"), "Game loop must stop gameplay while paused.")
assertQa(designSource.includes("Pause control QA"), "DESIGN.md must document pause control QA.")

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?quality=medium&qa=pause`
const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "pipe",
})

try {
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)
  const browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => {
    const text = document.querySelector("[data-role='stage']")?.textContent ?? ""
    const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
    return match?.[0] !== undefined && Number.parseFloat(match[0]) >= 5
  }, null, { timeout: 16000 })
  await page.locator("[data-role='pause']").click()
  await page.waitForTimeout(120)
  const pausedStart = await readPauseStats(page)
  await page.waitForTimeout(1800)
  const pausedEnd = await readPauseStats(page)
  await page.screenshot({ path: resolve(outputDir, "pause-overlay-mobile.png"), fullPage: false })
  await page.locator("[data-role='pause']").click()
  await page.waitForTimeout(1600)
  const resumed = await readPauseStats(page)
  await browser.close()

  const screenshot = await stat(resolve(outputDir, "pause-overlay-mobile.png"))
  assertQa(screenshot.size > 50000, "Pause overlay screenshot is too small.")
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(pausedEnd.overlayVisible, "Pause overlay is not visible after pressing pause.")
  assertQa(pausedEnd.buttonText.includes("RESUME"), "Pause button did not switch to RESUME.")
  assertQa(pausedEnd.pressed === "true", "Pause button aria-pressed was not true.")
  assertQa(parsePercent(pausedEnd.progress) === parsePercent(pausedStart.progress), "Stage progress changed while paused.")
  assertQa(pausedEnd.kills === pausedStart.kills, "Kill counter changed while paused.")
  assertQa(parsePercent(resumed.progress) > parsePercent(pausedEnd.progress), "Stage progress did not resume after unpausing.")
  assertQa(resumed.scrollWidth - resumed.viewportWidth <= 0, "Pause QA has horizontal overflow.")
  console.info(JSON.stringify({ pausedStart, pausedEnd, resumed }, null, 2))
} finally {
  await stopPreview(preview)
}
