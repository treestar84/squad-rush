import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const cssSource = readFileSync(resolve("src/styles/global.css"), "utf8")
const startSource = readFileSync(resolve("src/ui/StartScreen.ts"), "utf8")
const resultSource = readFileSync(resolve("src/ui/ResultScreen.ts"), "utf8")
const designSource = readFileSync(resolve("DESIGN.md"), "utf8")
const screenshotName = "reduced-motion-mobile-combat.png"
const maxHorizontalOverflowPx = 0
const minCombatProgress = 8
const minCombatKills = 4

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

function parseNumber(text) {
  const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
  return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
}

function parseCssSeconds(duration) {
  const trimmed = duration.trim()
  if (trimmed.endsWith("ms")) {
    return Number.parseFloat(trimmed) / 1000
  }
  if (trimmed.endsWith("s")) {
    return Number.parseFloat(trimmed)
  }
  return Number.POSITIVE_INFINITY
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size > 10000, `Reduced-motion QA screenshot is too small: ${path}`)
}

async function readReducedMotionStats(page) {
  return page.evaluate(() => {
    const button = document.querySelector(".tap-to-start")
    const startScreen = document.querySelector("#start-screen")
    const title = document.querySelector(".game-title")
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      startVisible: startScreen instanceof HTMLElement && getComputedStyle(startScreen).display !== "none",
      titleTransform: title instanceof HTMLElement ? getComputedStyle(title).transform : "",
      buttonAnimationDuration: button instanceof HTMLElement ? getComputedStyle(button).animationDuration : "",
      progress: textOf("[data-role='stage']"),
      kills: textOf("[data-role='kills']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

assertQa(cssSource.includes("@media (prefers-reduced-motion: reduce)"), "Reduced-motion CSS media query is missing.")
assertQa(startSource.includes("prefersReducedMotion"), "StartScreen must bypass GSAP animation when reduced motion is requested.")
assertQa(resultSource.includes("prefersReducedMotion"), "ResultScreen must bypass GSAP animation when reduced motion is requested.")
assertQa(designSource.includes("Reduced motion QA"), "DESIGN.md must document reduced-motion browser QA.")

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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  })
  const page = await context.newPage()
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${previewUrl}?quality=medium`, { waitUntil: "networkidle" })
  const startStats = await readReducedMotionStats(page)
  await page.locator(".tap-to-start").click()
  await page.waitForTimeout(5600)
  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const combatStats = await readReducedMotionStats(page)
  await browser.close()

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Reduced-motion console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Reduced-motion page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(startStats.prefersReducedMotion && combatStats.prefersReducedMotion, "Browser did not apply reduced-motion preference.")
  assertQa(startStats.startVisible, "Reduced-motion start screen is not visible before play.")
  assertQa(startStats.titleTransform === "none", `Reduced-motion start title still has transform: ${startStats.titleTransform}`)
  assertQa(parseCssSeconds(startStats.buttonAnimationDuration) <= 0.001, `Reduced-motion CSS did not clamp button animation: ${startStats.buttonAnimationDuration}`)
  assertQa(combatStats.scrollWidth - combatStats.viewportWidth <= maxHorizontalOverflowPx, "Reduced-motion viewport has horizontal overflow.")
  assertQa(parseNumber(combatStats.progress) >= minCombatProgress, `Reduced-motion combat did not reach ${minCombatProgress}% progress.`)
  assertQa(parseNumber(combatStats.kills) >= minCombatKills, `Reduced-motion combat did not reach ${minCombatKills} kills.`)

  console.info(JSON.stringify({ screenshotPath, startStats, combatStats }, null, 2))
} finally {
  cleanup()
}
