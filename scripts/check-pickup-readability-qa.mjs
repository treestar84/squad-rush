import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { analyzePngFile } from "./lib/pngMetrics.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const captureMs = 5200
const minScreenshotBytes = 45000
const minColorBuckets = 85
const minEdgeDensity = 0.035

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parseNumber(text) {
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

async function readStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      progress: textOf("[data-role='stage']"),
      kills: textOf("[data-role='kills']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      pickupDebug: window.__squadRushPickupDebug ?? null,
    }
  })
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `Pickup readability screenshot is too small: ${path}`)
  const metrics = await analyzePngFile(path, "pickup readability capture")
  assertQa(metrics.colorBuckets >= minColorBuckets, `Pickup capture color buckets too low: ${metrics.colorBuckets}`)
  assertQa(metrics.edgeDensity >= minEdgeDensity, `Pickup capture edge density too low: ${metrics.edgeDensity}`)
  return metrics
}

const pickupText = await readFile("src/game/systems/BonusPickupSystem.ts", "utf8")
const pickupSoldierText = await readFile("src/game/systems/PickupSoldierVisual.ts", "utf8")
assertQa(pickupText.includes("pickupSupplyShellMat"), "Upgrade pickups must keep a distinct supply-shell material.")
assertQa(pickupText.includes("pickup_reward_gem"), "Upgrade pickups must keep a non-spherical reward gem core.")
assertQa(pickupText.includes("pickup_soldier_reward"), "Soldier gain pickups must use a soldier reward visual.")
assertQa(pickupSoldierText.includes("Idle"), "Soldier gain pickups must use the idle soldier animation.")
assertQa(pickupText.includes("__squadRushPickupDebug"), "Pickup browser QA debug state is missing.")

const designText = await readFile("DESIGN.md", "utf8")
assertQa(designText.includes("idle soldier silhouette"), "DESIGN.md must document soldier reward pickup readability.")

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
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${previewUrl}?quality=medium&qa=pickups&qaSpeed=3`, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForTimeout(captureMs)
  const screenshotPath = resolve(outputDir, "pickup-readability-mobile-combat.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readStats(page)
  await browser.close()
  browser = undefined

  const metrics = await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= 0, "Pickup capture has horizontal overflow.")
  assertQa(parseNumber(stats.progress) >= 6, "Pickup capture did not reach the mixed combat lane.")
  assertQa(stats.pickupDebug !== null, "Pickup debug state was not exposed.")
  assertQa(stats.pickupDebug.active >= 1, "No active pickup was present during the combat capture.")
  assertQa(stats.pickupDebug.nearestDistance <= 45, "Nearest pickup was not readable in the combat camera window.")
  assertQa(stats.pickupDebug.childNames.some((name) => name.includes("pickup_soldier_reward")), "Active soldier pickup lacks the idle soldier reward visual.")
  assertQa(stats.pickupDebug.childNames.some((name) => name.includes("pickup_reward_beam")), "Active pickup lacks the reward beam.")
  assertQa(stats.pickupDebug.childNames.some((name) => name.includes("pickup_orb_shell")), "Active pickup lacks the rotating reward shell.")

  console.info(JSON.stringify({ screenshotPath, stats, metrics }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
