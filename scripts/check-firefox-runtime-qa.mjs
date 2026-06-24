import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { firefox } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotName = "firefox-desktop-combat.png"
const minCombatKills = 20
const minCombatProgress = 14
const minRuntimeFps = 24
const maxOverflowPx = 0

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
  assertQa(file.size > 10000, `Firefox QA screenshot is too small: ${path}`)
}

async function readFirefoxStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const canvasRect = document.querySelector("#game-canvas")?.getBoundingClientRect()
    return {
      soldiers: textOf("[data-role='soldiers']"),
      kills: textOf("[data-role='kills']"),
      fps: textOf("[data-role='fps']"),
      progress: textOf("[data-role='stage']"),
      monsters: textOf("[data-role='monsters']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
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
  const browser = await firefox.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
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
  const stats = await readFirefoxStats(page)
  await browser.close()

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Firefox console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Firefox page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= maxOverflowPx, "Firefox desktop viewport has horizontal overflow.")
  assertQa(stats.canvasWidth >= 1280 && stats.canvasHeight >= 720, "Firefox canvas did not fill the desktop viewport.")
  assertQa(parseNumber(stats.kills) >= minCombatKills, `Firefox combat did not reach ${minCombatKills} kills.`)
  assertQa(parseNumber(stats.progress) >= minCombatProgress, `Firefox combat did not reach ${minCombatProgress}% progress.`)
  assertQa(parseNumber(stats.fps) >= minRuntimeFps, `Firefox FPS text ${stats.fps} is below ${minRuntimeFps}.`)
  assertQa(parseNumber(stats.monsters) >= 40, "Firefox combat did not preserve visible horde density.")

  console.info(JSON.stringify({ screenshotPath, stats }, null, 2))
} finally {
  cleanup()
}
