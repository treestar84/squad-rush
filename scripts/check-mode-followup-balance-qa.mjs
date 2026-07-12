import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const sampleTimesMs = [12000, 24000, 36000, 48000, 60000, 72000]
const viewport = { width: 1280, height: 720 }

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

async function readModeSample(page, elapsedMs) {
  return page.evaluate((elapsed) => ({
    elapsed,
    progressZ: window.__squadRushGameModeDebug?.progressZ ?? 0,
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    midBosses: window.__squadRushMonsterDebug?.midBosses ?? 0,
    maxAbsX: window.__squadRushMonsterDebug?.maxAbsX ?? 0,
    portalZ: window.__squadRushDefenseCastleDebug?.portalZ ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }), elapsedMs)
}

async function runModeSample(browser, baseUrl, mode) {
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  collectPageErrors(page, consoleErrors, pageErrors)
  await page.goto(`${baseUrl}?mode=${mode}&difficulty=hard&quality=high&qa=monsters&qa=advanced&qaNoDamage=1`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction((expectedMode) => window.__squadRushGameModeDebug?.mode === expectedMode, mode, { timeout: 30000 })

  const samples = []
  let previous = 0
  for (const sampleTime of sampleTimesMs) {
    await page.waitForTimeout(sampleTime - previous)
    previous = sampleTime
    samples.push(await readModeSample(page, sampleTime))
  }

  const screenshotPath = resolve(outputDir, `mode-followup-${mode}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const screenshot = await stat(screenshotPath)
  await page.close()

  assertQa(screenshot.size >= 30000, `${mode}: screenshot is too small.`)
  assertQa(consoleErrors.length === 0, `${mode}: console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `${mode}: page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(samples.every((sample) => sample.scrollWidth <= sample.viewportWidth), `${mode}: horizontal overflow detected.`)
  const maxActiveBosses = mode === "defense" ? 1 : 2
  assertQa(samples.every((sample) => sample.midBosses <= maxActiveBosses), `${mode}: mid-boss cluster exceeded ${maxActiveBosses} active boss(es): ${JSON.stringify(samples)}`)

  if (mode === "defense") {
    const finalSample = samples[samples.length - 1]
    assertQa(finalSample !== undefined, "defense: final sample missing.")
    assertQa(finalSample.portalZ !== null && finalSample.portalZ >= 54 && finalSample.portalZ <= 62, `defense: portal was not pulled forward: ${JSON.stringify(finalSample)}`)
    assertQa(samples.some((sample) => sample.activeMonsters >= 200), `defense: full-road monster pressure did not materialize: ${JSON.stringify(samples)}`)
    assertQa(samples.some((sample) => sample.maxAbsX >= 4.3 && sample.maxAbsX <= 4.8), `defense: carpet did not cover both road edges: ${JSON.stringify(samples)}`)
  }

  return { mode, screenshotPath, samples }
}

async function runGateHpSample(browser, baseUrl) {
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  collectPageErrors(page, consoleErrors, pageErrors)
  await page.goto(`${baseUrl}?quality=high&qa=advanced&qaSpeed=10&qaSoldiers=10`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(() => (window.__squadRushDebug?.gates?.filter((gate) => gate.rightBarrier.maxHp > 0).length ?? 0) >= 2, null, { timeout: 90000 })
  const gates = await page.evaluate(() => window.__squadRushDebug?.gates
    ?.filter((gate) => gate.rightBarrier.maxHp > 0)
    .map((gate) => ({
      z: gate.z,
      maxHp: gate.rightBarrier.maxHp,
      progressHpMultiplier: gate.rightBarrier.progressHpMultiplier,
    })) ?? [])
  await page.close()

  assertQa(consoleErrors.length === 0, `gate: console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `gate: page errors detected: ${pageErrors.join(" | ")}`)
  const ordered = [...gates].sort((left, right) => left.z - right.z)
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  assertQa(first !== undefined && last !== undefined, `gate: not enough barrier samples: ${JSON.stringify(gates)}`)
  assertQa(last.progressHpMultiplier > first.progressHpMultiplier, `gate: later right barrier HP multiplier should be higher: ${JSON.stringify(ordered)}`)
  return ordered
}

const monsterSource = await readFile(resolve("src/game/systems/MonsterWaveSystem.ts"), "utf8")
const gateSource = await readFile(resolve("src/game/systems/GateSystem.ts"), "utf8")
const castleSource = await readFile(resolve("src/game/systems/DefenseCastleEnvironmentKit.ts"), "utf8")
assertQa(monsterSource.includes("MAX_ACTIVE_ATTACK_MID_BOSSES = 2"), "Gate Attack mid-boss active cap must remain two.")
assertQa(monsterSource.includes("MAX_ACTIVE_DEFENSE_MID_BOSSES = 1"), "Wave Defence must allow only one active mid-boss.")
assertQa(monsterSource.includes("DEFENSE_LATERAL_DISTANCE_SCALE = 0.6"), "Defense monster lateral distance must be scaled to 60%.")
assertQa(gateSource.includes("GATE_BARRIER_MAX_PROGRESS_HP_MULTIPLIER"), "Right barrier HP must scale with progress.")
assertQa(castleSource.includes("DEFENSE_PORTAL_Z = 58"), "Defense portal must be pulled forward.")

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
  browser = await chromium.launch({ channel: "chrome" })
  const run = await runModeSample(browser, previewUrl, "run")
  const defense = await runModeSample(browser, previewUrl, "defense")
  const gateHp = await runGateHpSample(browser, previewUrl)
  console.info(JSON.stringify({ run, defense, gateHp }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
