import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const minScreenshotBytes = 50000
const minActiveMonsters = 35
const minBasicBounceAmplitude = 0.14
const minTankWaddleAmplitude = 0.11
const minTankWaddleRollAmplitude = 0.18
const captureTimeoutMs = 30000
const baseForwardSpeed = 2.27
const expectedAttackProgressMultiplier = 1.2
const expectedAttackSquadForwardMultiplier = 0.68 * expectedAttackProgressMultiplier
const expectedAttackContentScrollSpeed = baseForwardSpeed * (1 - 0.68) * expectedAttackProgressMultiplier

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const [waveSource, poolSource, visualFactorySource, modeSource] = await Promise.all([
  readFile("src/game/systems/MonsterWaveSystem.ts", "utf8"),
  readFile("src/game/pools/MonsterPool.ts", "utf8"),
  readFile("src/game/pools/MonsterVisualFactory.ts", "utf8"),
  readFile("src/game/data/gameModeData.ts", "utf8"),
])
assertQa(waveSource.includes("hordeContactShadows: false"), "Attack and defense regular monsters must share the shadow-free Doguri profile.")
assertQa(waveSource.includes("compactHordeVisuals: true"), "Attack and defense monsters must share the compact Doguri profile.")
assertQa(visualFactorySource.includes("monsterDeathGreySharedMat"), "Monster deaths must use one shared gray material.")
assertQa(visualFactorySource.includes("mat.freeze()"), "The shared monster death material must be frozen.")
assertQa(poolSource.includes("restoreDeathMaterial"), "Pooled monsters must restore their live material after the death fall.")
assertQa(modeSource.includes("ATTACK_PROGRESS_SPEED_MULTIPLIER = 1.2"), "Gate Attack progression must be 20% faster.")
assertQa(modeSource.includes("squadForwardMultiplier: ATTACK_FORWARD_MULTIPLIER * ATTACK_PROGRESS_SPEED_MULTIPLIER"), "Gate Attack squad movement must receive the 20% boost.")
assertQa(modeSource.includes("contentScrollSpeed: LEVEL_1.forwardSpeed * (1 - ATTACK_FORWARD_MULTIPLIER) * ATTACK_PROGRESS_SPEED_MULTIPLIER"), "Gate Attack content scroll must receive the same 20% boost.")

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

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `Monster motion screenshot is too small: ${path}`)
}

async function sampleMotionState(page) {
  return page.evaluate(async () => {
    const startedAt = performance.now()
    let sampled = {
      mode: window.__squadRushGameModeDebug?.mode ?? "",
      squadForwardMultiplier: window.__squadRushGameModeDebug?.squadForwardMultiplier ?? 0,
      contentScrollSpeed: window.__squadRushGameModeDebug?.contentScrollSpeed ?? 0,
      activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
      midBosses: window.__squadRushMonsterDebug?.midBosses ?? 0,
      basicBounceAmplitude: window.__squadRushMonsterDebug?.basicBounceAmplitude ?? 0,
      tankWaddleAmplitude: window.__squadRushMonsterDebug?.tankWaddleAmplitude ?? 0,
      tankWaddleRollAmplitude: window.__squadRushMonsterDebug?.tankWaddleRollAmplitude ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
    while (performance.now() - startedAt < 1200) {
      await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame))
      const debug = window.__squadRushMonsterDebug
      sampled = {
        mode: window.__squadRushGameModeDebug?.mode ?? sampled.mode,
        squadForwardMultiplier: window.__squadRushGameModeDebug?.squadForwardMultiplier ?? sampled.squadForwardMultiplier,
        contentScrollSpeed: window.__squadRushGameModeDebug?.contentScrollSpeed ?? sampled.contentScrollSpeed,
        activeMonsters: Math.max(sampled.activeMonsters, debug?.active ?? 0),
        midBosses: Math.max(sampled.midBosses, debug?.midBosses ?? 0),
        basicBounceAmplitude: Math.max(sampled.basicBounceAmplitude, debug?.basicBounceAmplitude ?? 0),
        tankWaddleAmplitude: Math.max(sampled.tankWaddleAmplitude, debug?.tankWaddleAmplitude ?? 0),
        tankWaddleRollAmplitude: Math.max(sampled.tankWaddleRollAmplitude, debug?.tankWaddleRollAmplitude ?? 0),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }
    }
    return sampled
  })
}

async function captureMode(page, baseUrl, mode, screenshotName) {
  const url = `${baseUrl}?mode=${mode}&difficulty=easy&quality=high&qa=monsters&qaSoldiers=30&qaSpeed=2`
  await page.goto(url, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction((minimumActive) => {
    const debug = window.__squadRushMonsterDebug
    return debug !== undefined
      && debug.active >= minimumActive
      && debug.midBosses > 0
  }, minActiveMonsters, { timeout: captureTimeoutMs })
  const state = await sampleMotionState(page)
  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await assertScreenshot(screenshotPath)
  const killedBasic = await page.evaluate(() => window.__squadRushMonsterQa?.killBasic() ?? false)
  assertQa(killedBasic, `${mode}: QA hook could not kill a visible basic monster.`)
  const killedFast = await page.evaluate(() => window.__squadRushMonsterQa?.killFast() ?? false)
  assertQa(killedFast, `${mode}: QA hook could not kill a visible fast monster.`)
  await page.waitForFunction(() => {
    const debug = window.__squadRushMonsterDebug
    return debug !== undefined
      && debug.dyingBasics > 0
      && debug.dyingRegulars > debug.dyingBasics
      && debug.dyingGrayMonsters >= debug.dyingRegulars
  }, null, { timeout: 2000 })
  const deathState = await page.evaluate(() => ({
    dyingBasics: window.__squadRushMonsterDebug?.dyingBasics ?? 0,
    dyingRegulars: window.__squadRushMonsterDebug?.dyingRegulars ?? 0,
    dyingGrayMonsters: window.__squadRushMonsterDebug?.dyingGrayMonsters ?? 0,
    maxDeathFallRadians: window.__squadRushMonsterDebug?.maxDeathFallRadians ?? 0,
  }))
  const deathScreenshotPath = resolve(outputDir, screenshotName.replace(/\.png$/, "-gray-death.png"))
  await page.screenshot({ path: deathScreenshotPath, fullPage: false })
  await assertScreenshot(deathScreenshotPath)
  assertQa(state.mode === mode, `${mode}: expected game mode debug to match, got ${state.mode}.`)
  assertQa(state.scrollWidth <= state.viewportWidth, `${mode}: horizontal overflow detected.`)
  assertQa(
    state.basicBounceAmplitude >= minBasicBounceAmplitude,
    `${mode}: basic monster bounce amplitude ${state.basicBounceAmplitude} < ${minBasicBounceAmplitude}.`,
  )
  assertQa(
    state.tankWaddleAmplitude >= minTankWaddleAmplitude,
    `${mode}: tank waddle amplitude ${state.tankWaddleAmplitude} < ${minTankWaddleAmplitude}.`,
  )
  assertQa(
    state.tankWaddleRollAmplitude >= minTankWaddleRollAmplitude,
    `${mode}: tank waddle roll amplitude ${state.tankWaddleRollAmplitude} < ${minTankWaddleRollAmplitude}.`,
  )
  if (mode === "run") {
    assertQa(Math.abs(state.squadForwardMultiplier - expectedAttackSquadForwardMultiplier) < 0.000001, `run: squad forward multiplier did not receive the 20% boost: ${state.squadForwardMultiplier}.`)
    assertQa(Math.abs(state.contentScrollSpeed - expectedAttackContentScrollSpeed) < 0.000001, `run: content scroll did not receive the 20% boost: ${state.contentScrollSpeed}.`)
    const totalProgressSpeed = baseForwardSpeed * state.squadForwardMultiplier + state.contentScrollSpeed
    assertQa(Math.abs(totalProgressSpeed / baseForwardSpeed - expectedAttackProgressMultiplier) < 0.000001, `run: total base progression is not 20% faster: ${totalProgressSpeed}.`)
  }
  assertQa(deathState.dyingGrayMonsters >= deathState.dyingRegulars, `${mode}: a falling regular monster did not use the shared gray material.`)
  return { screenshotPath, deathScreenshotPath, state, deathState }
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "pipe",
})
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
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  const run = await captureMode(page, previewUrl, "run", "monster-motion-run.png")
  const defense = await captureMode(page, previewUrl, "defense", "monster-motion-defense.png")
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  console.info(JSON.stringify({ run, defense }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
