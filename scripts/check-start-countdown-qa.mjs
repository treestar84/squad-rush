import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const maxCountdownVisibleMs = 700
const minStartMs = 2900
const maxStartMs = 4500
const maxHorizontalOverflowPx = 0

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
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "pipe",
})
let browser

try {
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)
  browser = await chromium.launch({ channel: "chrome" })
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
  await page.waitForFunction(() => {
    const start = document.querySelector("#start-screen")
    return start instanceof HTMLElement && getComputedStyle(start).display !== "none"
  }, null, { timeout: 15000 })

  const tapToStart = page.locator(".tap-to-start")
  const buttonBox = await tapToStart.boundingBox()
  assertQa(buttonBox !== null, "Start button box was not measurable.")
  await tapToStart.click({ timeout: 5000 })
  const clickedAt = Date.now()
  await page.waitForFunction(() => window.__squadRushQaCountdown === 3, null, { timeout: maxCountdownVisibleMs })
  const countdownVisibleMs = Date.now() - clickedAt
  await page.waitForFunction(() => window.__squadRushQaCountdown === 2, null, { timeout: 1400 })
  await page.waitForFunction(() => window.__squadRushQaCountdown === 1, null, { timeout: 1400 })
  await page.waitForFunction(() => window.__squadRushQaStarted === true, null, { timeout: maxStartMs })
  const startMs = Date.now() - clickedAt
  await page.waitForTimeout(350)

  const screenshotPath = resolve(outputDir, "start-countdown-mobile.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await page.evaluate(() => {
    const countdown = document.querySelector("#pregame-countdown")
    const hud = document.querySelector("#hud")
    return {
      countdownVisible: countdown instanceof HTMLElement && getComputedStyle(countdown).display !== "none",
      hudVisible: hud instanceof HTMLElement && getComputedStyle(hud).display !== "none",
      started: window.__squadRushQaStarted === true,
      countdownValue: window.__squadRushQaCountdown ?? null,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  await browser.close()
  browser = undefined

  const screenshot = await stat(screenshotPath)
  assertQa(screenshot.size > 30000, `Start countdown screenshot is too small: ${screenshot.size}.`)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(countdownVisibleMs <= maxCountdownVisibleMs, `Countdown appeared too late: ${countdownVisibleMs}ms.`)
  assertQa(startMs >= minStartMs, `Gameplay started before the full 3-2-1 countdown elapsed: ${startMs}ms.`)
  assertQa(startMs <= maxStartMs, `Start exceeded ${maxStartMs}ms: ${startMs}ms.`)
  assertQa(!stats.countdownVisible, "Countdown remained visible after gameplay started.")
  assertQa(stats.hudVisible && stats.started, "Gameplay HUD did not appear after countdown.")
  assertQa(stats.scrollWidth - stats.viewportWidth <= maxHorizontalOverflowPx, "Start countdown created horizontal overflow.")
  console.info(JSON.stringify({ screenshotPath, countdownVisibleMs, startMs, stats }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  await stopPreview(preview)
}
