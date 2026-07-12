import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotPath = resolve(outputDir, "defense-hard-opening-survival.png")
const viewport = { width: 1280, height: 720 }
const sampleTimesMs = [6000, 12000, 18000, 24000, 36000, 60000, 90000, 120000, 150000]

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

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

async function readSample(page, elapsedMs) {
  return page.evaluate((elapsed) => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const parseNumber = (text) => Number.parseFloat((text.match(/[0-9]+(?:\.[0-9]+)?/) ?? ["0"])[0])
    const result = document.querySelector("#result-screen")
    return {
      elapsed,
      soldiers: parseNumber(textOf("[data-role='soldiers']")),
      kills: parseNumber(textOf("[data-role='kills']")),
      progress: parseNumber(textOf("[data-role='stage']")),
      resultVisible: result instanceof HTMLElement && getComputedStyle(result).display !== "none",
      activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
      visibleCombatBandDensity: window.__squadRushMonsterDebug?.visibleCombatBandDensity ?? 0,
      bottomBreachProximity: window.__squadRushMonsterDebug?.bottomBreachProximity ?? 0,
      nearestMonsterDistance: window.__squadRushMonsterDebug?.nearestDistance ?? Number.POSITIVE_INFINITY,
      maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
      pressureState: window.__squadRushMonsterDebug?.pressureState ?? "",
      pickupActive: window.__squadRushPickupDebug?.active ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  }, elapsedMs)
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
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
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  collectPageErrors(page, consoleErrors, pageErrors)
  await page.goto(`${previewUrl}?mode=defense&difficulty=hard&quality=high&qa=monsters&qa=advanced&qa=pickups`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(() => window.__squadRushGameModeDebug?.mode === "defense", null, { timeout: 30000 })

  const samples = []
  let previous = 0
  for (const sampleTime of sampleTimesMs) {
    await page.waitForTimeout(sampleTime - previous)
    previous = sampleTime
    samples.push(await readSample(page, sampleTime))
  }
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const screenshot = await stat(screenshotPath)
  await page.close()

  const sampleAt18 = samples.find((sample) => sample.elapsed === 18000)
  const sampleAt120 = samples.find((sample) => sample.elapsed === 120000)
  const sampleAt150 = samples.find((sample) => sample.elapsed === 150000)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(screenshot.size >= 30000, `Defense hard opening screenshot is too small: ${screenshot.size}`)
  assertQa(samples.every((sample) => sample.scrollWidth <= sample.viewportWidth), "Defense hard opening has horizontal overflow.")
  assertQa(sampleAt18 !== undefined && !sampleAt18.resultVisible && sampleAt18.soldiers >= 1, `Hard defense must survive the old 15-20s failure window: ${JSON.stringify(samples)}`)
  assertQa(sampleAt120 !== undefined && !sampleAt120.resultVisible && sampleAt120.progress >= 30 && sampleAt120.soldiers >= 1, `Hard defense must reach the 30-40% buildup window alive: ${JSON.stringify(samples)}`)
  assertQa(sampleAt150 !== undefined && sampleAt150.maxActivePressure >= 100, `Hard defense pressure must recover after buildup: ${JSON.stringify(samples)}`)
  console.info(JSON.stringify({ screenshotPath, samples }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  if (!preview.killed) {
    preview.kill("SIGTERM")
  }
}
