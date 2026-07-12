import { spawn } from "node:child_process"
import { get } from "node:http"
import { createServer } from "node:net"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const storageKey = "squad-rush-mode-progress-v1"
const previewTimeoutMs = 15000
const runtimeTimeoutMs = 60000
const infiniteStressTarget = 200

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
  while (Date.now() - startedAt < previewTimeoutMs) {
    if (await requestOk(url)) {
      return
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error("Preview server did not become ready within 15s.")
}

async function assertSourceContracts() {
  const difficulty = await readFile("src/game/data/difficultyData.ts", "utf8")
  const waves = await readFile("src/game/systems/MonsterWaveSystem.ts", "utf8")
  const game = await readFile("src/game/Game.ts", "utf8")
  const start = await readFile("src/ui/StartScreen.ts", "utf8")
  assertQa(difficulty.includes("infinite") && difficulty.includes("endless: true"), "Infinite difficulty profile is missing.")
  assertQa(waves.includes("ENDLESS_STAGE_LENGTH_Z") && waves.includes("getEndlessHealthMultiplier"), "Endless monster scaling is missing.")
  assertQa(waves.includes("ENDLESS_HEALTH_STEP") && !waves.includes("ENDLESS_MAX_HEALTH_MULTIPLIER"), "Infinite health must keep scaling without a hard cap.")
  assertQa(waves.includes("ENDLESS_DAMAGE_STEP") && !waves.includes("ENDLESS_MAX_DAMAGE_MULTIPLIER"), "Infinite damage must keep scaling without a hard cap.")
  assertQa(waves.includes("INFINITE_ACTIVE_DOGURI_TARGET = 200"), "Infinite mode must declare a 200-Doguri active target.")
  assertQa(waves.includes("getInfiniteActivePressureTarget"), "Infinite mode must use a dedicated active pressure target.")
  assertQa(waves.includes("ENDLESS_DEFENSE_BASIC_ONLY_END_RATIO"), "Infinite defense opening must use a basic-only buildup window.")
  assertQa(waves.includes("getSquadPowerHealthMultiplier"), "Infinite monster health must respond to squad power growth.")
  assertQa(waves.includes("authoredVisuals") && waves.includes("proceduralFallbackVisuals"), "Infinite QA needs authored/fallback monster visual counters.")
  assertQa(game.includes("recordHardClear") && game.includes("!this.difficulty.endless"), "Hard-clear unlock or endless finish bypass is missing.")
  assertQa(start.includes("difficulty-option--locked") && start.includes("isInfiniteModeUnlocked"), "Start screen infinite lock state is missing.")
}

async function readInfiniteButton(page) {
  return page.locator("[data-difficulty='infinite']")
}

async function assertLockedState(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}?mode=run`, { waitUntil: "networkidle" })
  const infinite = await readInfiniteButton(page)
  await infinite.waitFor({ timeout: previewTimeoutMs })
  assertQa(await infinite.isDisabled(), "Run infinite mode should be locked before hard clear.")
  await page.evaluate((key) => {
    window.localStorage.setItem(key, JSON.stringify({ hardCleared: { run: true } }))
  }, storageKey)
  await page.reload({ waitUntil: "networkidle" })
  assertQa(!(await infinite.isDisabled()), "Run infinite mode should unlock after run hard clear.")
  await page.goto(`${baseUrl}?mode=defense`, { waitUntil: "networkidle" })
  const defenseInfinite = await readInfiniteButton(page)
  assertQa(await defenseInfinite.isDisabled(), "Defense infinite mode should stay locked until defense hard clear.")
  await page.close()
}

async function assertEndlessRuntime(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(`${baseUrl}?mode=defense&difficulty=infinite&quality=low&qa=monsters&qaSpeed=4&qaSoldiers=15&qaStartZ=340`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(() => {
    const stageText = document.querySelector("[data-role='stage']")?.textContent ?? ""
    const result = document.querySelector("#result-screen")
    const resultVisible = result instanceof HTMLElement && getComputedStyle(result).display !== "none"
    return stageText.startsWith("INF") || resultVisible
  }, null, { timeout: runtimeTimeoutMs })
  const runtime = await page.evaluate(() => {
    const result = document.querySelector("#result-screen")
    return {
      stageText: document.querySelector("[data-role='stage']")?.textContent ?? "",
      resultKicker: document.querySelector("#result-screen [data-role='kicker']")?.textContent ?? "",
      resultTitle: document.querySelector("#result-screen [data-role='title']")?.textContent ?? "",
      resultVisible: result instanceof HTMLElement && getComputedStyle(result).display !== "none",
      activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
      spawnProgressZ: window.__squadRushMonsterDebug?.spawnProgressZ ?? 0,
      healthMultiplier: window.__squadRushMonsterDebug?.healthMultiplier ?? 0,
      scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  await page.close()
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(
    !runtime.resultVisible || (runtime.resultKicker === "ENDLESS RUN" && runtime.resultTitle === "DEFEAT"),
    `Infinite mode must not resolve as a finite victory: ${JSON.stringify(runtime)}`,
  )
  assertQa(runtime.activeMonsters > 0 || runtime.resultVisible, "Infinite runtime did not keep spawning monsters or resolve through endless defeat.")
  assertQa(runtime.healthMultiplier >= 1.16, `Infinite opening health tuning was not applied: ${runtime.healthMultiplier}`)
  assertQa(runtime.scrollOverflow <= 0, "Infinite mode capture has horizontal overflow.")
  return runtime
}

async function assertInfiniteOpeningIsGentle(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}?mode=defense&difficulty=infinite&quality=low&qa=monsters&qaSpeed=2&qaSoldiers=15&qaStartZ=60&qaNoDamage=1`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(() => (window.__squadRushMonsterDebug?.active ?? 0) > 0, null, { timeout: runtimeTimeoutMs })
  const opening = await page.evaluate(() => ({
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    healthMultiplier: window.__squadRushMonsterDebug?.healthMultiplier ?? 0,
    spawnDensityMultiplier: window.__squadRushMonsterDebug?.spawnDensityMultiplier ?? 0,
    maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
    spawnProgressZ: window.__squadRushMonsterDebug?.spawnProgressZ ?? 0,
    scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }))
  await page.close()
  assertQa(opening.healthMultiplier <= 1.7, `Infinite opening should not start too hard: ${JSON.stringify(opening)}`)
  assertQa(opening.maxActivePressure <= 95, `Infinite opening pressure should be softened: ${JSON.stringify(opening)}`)
  assertQa(opening.scrollOverflow <= 0, "Infinite opening capture has horizontal overflow.")
  return opening
}

async function readDefaultOpeningTimeline(browser, baseUrl, mode, samplesMs) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}?mode=${mode}&difficulty=infinite&quality=low&qa=monsters&qaSpeed=1`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  const samples = []
  let previousMs = 0
  for (const sampleMs of samplesMs) {
    await page.waitForTimeout(sampleMs - previousMs)
    previousMs = sampleMs
    samples.push(await page.evaluate((elapsedMs) => {
      const debug = window.__squadRushMonsterDebug
      const result = document.querySelector("#result-screen")
      return {
        elapsedMs,
        resultVisible: result instanceof HTMLElement && getComputedStyle(result).display !== "none",
        activeMonsters: debug?.active ?? 0,
        maxActivePressure: debug?.maxActivePressure ?? 0,
        healthMultiplier: debug?.healthMultiplier ?? 0,
        spawnDensityMultiplier: debug?.spawnDensityMultiplier ?? 0,
        spawnProgressZ: debug?.spawnProgressZ ?? 0,
        visibleCombatBandDensity: debug?.visibleCombatBandDensity ?? 0,
        bottomBreachProximity: debug?.bottomBreachProximity ?? 0,
        scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    }, sampleMs))
  }
  await page.close()
  return samples
}

async function assertDefaultInfiniteOpeningIsPlayable(browser, baseUrl) {
  const run = await readDefaultOpeningTimeline(browser, baseUrl, "run", [6000, 30000])
  const defense = await readDefaultOpeningTimeline(browser, baseUrl, "defense", [6000, 12000, 24000])
  const runOpening = run[0]
  const runLater = run[1]
  const defenseLater = defense[defense.length - 1]
  assertQa(run.every((sample) => !sample.resultVisible), `Run infinite default opening should not end immediately: ${JSON.stringify(run)}`)
  assertQa(defense.every((sample) => !sample.resultVisible), `Defense infinite default opening needs a safe buildup window: ${JSON.stringify(defense)}`)
  assertQa(runOpening.maxActivePressure <= 70, `Run infinite opening pressure is too high: ${JSON.stringify(run)}`)
  assertQa(runLater.maxActivePressure > runOpening.maxActivePressure, `Run infinite pressure should begin ramping after the opening: ${JSON.stringify(run)}`)
  assertQa(defenseLater.maxActivePressure <= 12, `Defense infinite first buildup cap should stay small: ${JSON.stringify(defense)}`)
  assertQa(defense.every((sample) => sample.scrollOverflow <= 0), "Defense infinite default opening has horizontal overflow.")
  return { run, defense }
}

async function assertInfiniteDefensePressureRampsAfterOpening(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}?mode=defense&difficulty=infinite&quality=low&qa=monsters&qaSpeed=1&qaNoDamage=1`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  const samples = []
  let previousMs = 0
  for (const sampleMs of [12000, 54000]) {
    await page.waitForTimeout(sampleMs - previousMs)
    previousMs = sampleMs
    samples.push(await page.evaluate((elapsedMs) => {
      const debug = window.__squadRushMonsterDebug
      return {
        elapsedMs,
        activeMonsters: debug?.active ?? 0,
        maxActivePressure: debug?.maxActivePressure ?? 0,
        spawnProgressZ: debug?.spawnProgressZ ?? 0,
        visibleCombatBandDensity: debug?.visibleCombatBandDensity ?? 0,
        scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    }, sampleMs))
  }
  await page.close()
  const [opening, later] = samples
  assertQa(later.maxActivePressure >= 30, `Defense infinite pressure should ramp after buildup: ${JSON.stringify(samples)}`)
  assertQa(later.maxActivePressure > opening.maxActivePressure, `Defense infinite pressure cap must grow after opening: ${JSON.stringify(samples)}`)
  assertQa(later.visibleCombatBandDensity > 0, `Defense infinite post-opening should keep visible pressure: ${JSON.stringify(samples)}`)
  assertQa(samples.every((sample) => sample.scrollOverflow <= 0), "Defense infinite pressure ramp capture has horizontal overflow.")
  return { opening, later }
}

async function readEndlessScalingSample(browser, baseUrl, startZ, soldiers = 15) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}?mode=defense&difficulty=infinite&quality=low&qa=monsters&qaSpeed=4&qaSoldiers=${soldiers}&qaStartZ=${startZ}&qaNoDamage=1`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(() => (window.__squadRushMonsterDebug?.healthMultiplier ?? 0) > 0, null, { timeout: runtimeTimeoutMs })
  const sample = await page.evaluate(() => ({
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    healthMultiplier: window.__squadRushMonsterDebug?.healthMultiplier ?? 0,
    spawnDensityMultiplier: window.__squadRushMonsterDebug?.spawnDensityMultiplier ?? 0,
    endlessSpawnDensityMultiplier: window.__squadRushMonsterDebug?.endlessSpawnDensityMultiplier ?? 0,
    endlessStage: window.__squadRushMonsterDebug?.endlessStage ?? 0,
    maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
    squadPowerSpawnMultiplier: window.__squadRushMonsterDebug?.squadPowerSpawnMultiplier ?? 0,
    spawnProgressZ: window.__squadRushMonsterDebug?.spawnProgressZ ?? 0,
    scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }))
  await page.close()
  return sample
}

async function assertEndlessScalingKeepsGrowing(browser, baseUrl) {
  const early = await readEndlessScalingSample(browser, baseUrl, 430)
  const late = await readEndlessScalingSample(browser, baseUrl, 1120)
  assertQa(late.healthMultiplier > early.healthMultiplier, `Infinite health must keep growing: ${JSON.stringify({ early, late })}`)
  assertQa(late.endlessSpawnDensityMultiplier > early.endlessSpawnDensityMultiplier, `Infinite spawn density must keep growing: ${JSON.stringify({ early, late })}`)
  assertQa(late.endlessStage > early.endlessStage, `Infinite stage must keep advancing: ${JSON.stringify({ early, late })}`)
  assertQa(late.scrollOverflow <= 0, "Late infinite scaling capture has horizontal overflow.")
  return { early, late }
}

async function assertSquadPowerKeepsEndlessMonstersRelevant(browser, baseUrl) {
  const baseline = await readEndlessScalingSample(browser, baseUrl, 430, 1)
  const powered = await readEndlessScalingSample(browser, baseUrl, 430, 15)
  assertQa(powered.squadPowerSpawnMultiplier > baseline.squadPowerSpawnMultiplier, `Squad power signal should grow with roster strength: ${JSON.stringify({ baseline, powered })}`)
  assertQa(powered.healthMultiplier > baseline.healthMultiplier, `Infinite health should respond to stronger squad power: ${JSON.stringify({ baseline, powered })}`)
  assertQa(powered.healthMultiplier >= baseline.healthMultiplier * 1.2, `Infinite health response should be large enough to matter: ${JSON.stringify({ baseline, powered })}`)
  assertQa(powered.scrollOverflow <= 0, "Squad-power infinite capture has horizontal overflow.")
  return { baseline, powered }
}

async function assertInfiniteDoguriStress(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(`${baseUrl}?mode=defense&difficulty=infinite&quality=high&qa=monsters&qaSpeed=4&qaSoldiers=1&qaStartZ=430&qaNoDamage=1`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(
    (target) => {
      const debug = window.__squadRushMonsterDebug
      if (
        debug !== undefined
        && debug.active >= target
        && debug.authoredVisuals === debug.active
        && debug.proceduralFallbackVisuals === 0
      ) {
        window.__squadRushInfiniteDoguriPeak = {
          activeMonsters: debug.active,
          authoredVisuals: debug.authoredVisuals,
          proceduralFallbackVisuals: debug.proceduralFallbackVisuals,
          maxActivePressure: debug.maxActivePressure,
          spawnDensityMultiplier: debug.spawnDensityMultiplier,
          healthMultiplier: debug.healthMultiplier,
          spawnProgressZ: debug.spawnProgressZ,
          scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
        }
        return true
      }
      return false
    },
    infiniteStressTarget,
    { timeout: runtimeTimeoutMs },
  )
  const runtime = await page.evaluate(() => ({
    ...(window.__squadRushInfiniteDoguriPeak ?? {
      activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
      authoredVisuals: window.__squadRushMonsterDebug?.authoredVisuals ?? 0,
      proceduralFallbackVisuals: window.__squadRushMonsterDebug?.proceduralFallbackVisuals ?? 0,
      maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
      spawnDensityMultiplier: window.__squadRushMonsterDebug?.spawnDensityMultiplier ?? 0,
      healthMultiplier: window.__squadRushMonsterDebug?.healthMultiplier ?? 0,
      spawnProgressZ: window.__squadRushMonsterDebug?.spawnProgressZ ?? 0,
      scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }),
  }))
  await page.screenshot({ path: "test-results/infinite-doguri-200.png", fullPage: true })
  await page.close()
  assertQa(consoleErrors.length === 0, `Console errors detected during 200-Doguri stress: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected during 200-Doguri stress: ${pageErrors.join(" | ")}`)
  assertQa(runtime.maxActivePressure >= infiniteStressTarget, `Infinite pressure target is below 200: ${JSON.stringify(runtime)}`)
  assertQa(runtime.activeMonsters >= infiniteStressTarget, `Infinite mode did not spawn 200 active Doguri: ${JSON.stringify(runtime)}`)
  assertQa(runtime.authoredVisuals === runtime.activeMonsters, `Not every infinite monster used authored Doguri: ${JSON.stringify(runtime)}`)
  assertQa(runtime.proceduralFallbackVisuals === 0, `Procedural monster fallback appeared in infinite stress: ${JSON.stringify(runtime)}`)
  assertQa(runtime.scrollOverflow <= 0, "Infinite 200-Doguri capture has horizontal overflow.")
  return runtime
}

await assertSourceContracts()

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, detached: true, stdio: "ignore" },
)
let browser

async function stopPreview() {
  if (preview.pid === undefined) {
    return
  }
  try {
    process.kill(-preview.pid, "SIGTERM")
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") {
      throw error
    }
  }
  await new Promise((resolveStop) => {
    const timeout = setTimeout(resolveStop, 2000)
    preview.once("exit", () => {
      clearTimeout(timeout)
      resolveStop()
    })
  })
}

try {
  await waitForPreview(previewUrl)
  browser = await chromium.launch({ channel: "chrome" })
  await assertLockedState(browser, previewUrl)
  const defaultOpening = await assertDefaultInfiniteOpeningIsPlayable(browser, previewUrl)
  const opening = await assertInfiniteOpeningIsGentle(browser, previewUrl)
  const defenseRamp = await assertInfiniteDefensePressureRampsAfterOpening(browser, previewUrl)
  const runtime = await assertEndlessRuntime(browser, previewUrl)
  const endlessScaling = await assertEndlessScalingKeepsGrowing(browser, previewUrl)
  const squadPowerScaling = await assertSquadPowerKeepsEndlessMonstersRelevant(browser, previewUrl)
  const doguriStress = await assertInfiniteDoguriStress(browser, previewUrl)
  console.info(JSON.stringify({ infiniteMode: "ok", defaultOpening, opening, defenseRamp, runtime, endlessScaling, squadPowerScaling, doguriStress }, null, 2))
} finally {
  await browser?.close()
  await stopPreview()
}
