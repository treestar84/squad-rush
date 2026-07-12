import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const previewReadyMs = 15000
const runtimeTimeoutMs = 60000
const viewport = { width: 1280, height: 720 }
const sampleTimesMs = [2000, 6000, 12000, 24000, 36000, 48000]

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
  while (Date.now() - startedAt < previewReadyMs) {
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
  return page.evaluate((elapsed) => ({
    elapsed,
    progressZ: window.__squadRushGameModeDebug?.progressZ ?? 0,
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    visibleCombatBandDensity: window.__squadRushMonsterDebug?.visibleCombatBandDensity ?? 0,
    maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
    spawnDensityMultiplier: window.__squadRushMonsterDebug?.spawnDensityMultiplier ?? 0,
    pressureState: window.__squadRushMonsterDebug?.pressureState ?? "",
    nearestMonsterDistance: window.__squadRushMonsterDebug?.nearestDistance ?? Number.POSITIVE_INFINITY,
    resultVisible: (() => {
      const result = document.querySelector("#result-screen")
      return result instanceof HTMLElement && getComputedStyle(result).display !== "none"
    })(),
    squadSize: window.__squadRushGameModeDebug?.formation?.count ?? 0,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }), elapsedMs)
}

async function runHardCase(browser, baseUrl, mode) {
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  collectPageErrors(page, consoleErrors, pageErrors)
  const noDamageParam = mode === "run" ? "&qaNoDamage=1" : ""
  await page.goto(`${baseUrl}?mode=${mode}&difficulty=hard&quality=high&qa=monsters${noDamageParam}`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction((expectedMode) => window.__squadRushGameModeDebug?.mode === expectedMode, mode, { timeout: runtimeTimeoutMs })

  const samples = []
  let previous = 0
  for (const sampleTime of sampleTimesMs) {
    await page.waitForTimeout(sampleTime - previous)
    previous = sampleTime
    samples.push(await readSample(page, sampleTime))
  }
  const screenshotPath = resolve(outputDir, `hard-opening-density-${mode}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await page.close()
  const screenshot = await stat(screenshotPath)

  assertQa(screenshot.size >= 30000, `${mode}: hard opening screenshot is too small.`)
  assertQa(consoleErrors.length === 0, `${mode}: console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `${mode}: page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(samples.every((sample) => sample.scrollWidth <= sample.viewportWidth), `${mode}: horizontal overflow detected.`)
  assertQa(samples.every((sample) => sample.activeMonsters <= sample.maxActivePressure), `${mode}: active monsters exceeded pressure cap.`)

  const opening = samples.slice(0, 4)
  const middle = samples[samples.length - 1]
  assertQa(middle !== undefined, `${mode}: missing middle pressure sample.`)
  if (mode === "defense") {
    const sampleAt2 = samples.find((sample) => sample.elapsed === 2000)
    const sampleAt6 = samples.find((sample) => sample.elapsed === 6000)
    const sampleAt24 = samples.find((sample) => sample.elapsed === 24000)
    assertQa(samples.every((sample) => !sample.resultVisible && sample.squadSize >= 1), `${mode}: hard defense must survive default opening pressure: ${JSON.stringify(samples)}`)
    assertQa(sampleAt2 !== undefined && sampleAt2.activeMonsters >= 60, `${mode}: hard defense opening must fill with pressure immediately: ${JSON.stringify(samples)}`)
    assertQa(sampleAt6 !== undefined && sampleAt6.visibleCombatBandDensity >= 40, `${mode}: hard defense opening pressure must be visible: ${JSON.stringify(samples)}`)
    assertQa(sampleAt24 !== undefined && sampleAt24.activeMonsters >= 110, `${mode}: hard defense buildup must sustain a large wave: ${JSON.stringify(samples)}`)
  } else {
    assertQa(
      opening.every((sample) => sample.activeMonsters <= 150),
      `${mode}: hard opening active density spikes too high: ${JSON.stringify(samples)}`,
    )
    assertQa(
      opening.every((sample) => sample.visibleCombatBandDensity <= 85),
      `${mode}: hard opening visible combat band is too crowded: ${JSON.stringify(samples)}`,
    )
  }
  const minMiddlePressure = mode === "defense" ? 170 : 170
  assertQa(
    middle.activeMonsters >= minMiddlePressure,
    `${mode}: hard midgame pressure did not recover after opening smoothing: ${JSON.stringify(samples)}`,
  )

  return { mode, screenshotPath, samples }
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "ignore" },
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
  browser = await chromium.launch({ channel: "chrome" })
  const run = await runHardCase(browser, previewUrl, "run")
  const defense = await runHardCase(browser, previewUrl, "defense")
  console.info(JSON.stringify({ run, defense }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
