import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const sampleTimesMs = [12000, 24000, 36000]
const viewport = { width: 390, height: 844 }
const maxHorizontalOverflowPx = 0

async function assertDifficultyBalanceContract() {
  const difficultySource = await readFile(resolve("src/game/data/difficultyData.ts"), "utf8")
  const waveSource = await readFile(resolve("src/game/systems/MonsterWaveSystem.ts"), "utf8")
  const defenseTuningSource = await readFile(resolve("src/game/systems/DefenseWaveTuning.ts"), "utf8")
  const gameSource = await readFile(resolve("src/game/Game.ts"), "utf8")
  const hudSource = await readFile(resolve("src/game/GameHudPresenter.ts"), "utf8")

  assertQa(difficultySource.includes("stageDurationMultiplier: 1.5"), "NORMAL must run 1.5x longer than EASY.")
  assertQa(difficultySource.includes("stageDurationMultiplier: 2.1"), "HARD must run 70% of the previous 3x EASY length.")
  assertQa(difficultySource.includes("regularHealthMultiplier"), "Difficulty profiles must separate regular Doguri health growth.")
  assertQa(difficultySource.includes("midBossHealthMultiplier"), "Difficulty profiles must separate mid-boss Doguri health growth.")
  assertQa(difficultySource.includes("regularSpawnMultiplier"), "Difficulty profiles must separate regular Doguri population growth.")
  assertQa(waveSource.includes("getStageDurationMultiplier"), "Monster waves must scale finite-mode spawn timelines by difficulty duration.")
  assertQa(waveSource.includes("getStageCurveProgressZ"), "Monster waves must evaluate pressure and boss schedules on the scaled stage curve.")
  assertQa(waveSource.includes("DIFFICULTY_BUILDUP_GRACE_PROGRESS_RATIO"), "All modes must define an early build-up grace window.")
  assertQa(waveSource.includes("ATTACK_OPENING_ACTIVE_CAP"), "Attack mode must cap opening active pressure before the midgame ramp.")
  assertQa(waveSource.includes("getDifficultySpawnMultiplier"), "Difficulty spawn pressure must ramp in after the opening build-up window.")
  assertQa(waveSource.includes("getDefenseDifficultyRamp"), "Difficulty pressure, spawn, and health bonuses must ramp in after the opening build-up window.")
  assertQa(waveSource.includes("regularHealthMultiplier"), "Regular Doguri health multiplier must be applied by MonsterWaveSystem.")
  assertQa(waveSource.includes("midBossHealthMultiplier"), "Mid-boss Doguri health multiplier must be applied by MonsterWaveSystem.")
  assertQa(waveSource.includes("regularSpawnMultiplier"), "Regular Doguri spawn multiplier must be applied by MonsterWaveSystem.")
  assertQa(defenseTuningSource.includes("DifficultyProfile"), "Defense pressure tuning must receive difficulty duration.")
  assertQa(gameSource.includes("getDifficultyStageLength"), "Game victory timing must use difficulty-scaled stage length.")
  assertQa(hudSource.includes("getDifficultyStageLength"), "HUD progress must use difficulty-scaled stage length.")
}

const cases = [
  {
    mode: "run",
    difficulty: "easy",
    minActive: 260,
    maxActive: 360,
    minKills: 80,
    maxKills: 420,
    maxNearest: 28,
    minSurvivors: 4,
  },
  {
    mode: "run",
    difficulty: "medium",
    minActive: 230,
    maxActive: 360,
    minKills: 52,
    maxKills: 440,
    maxNearest: 32,
    minSurvivors: 3,
  },
  {
    mode: "run",
    difficulty: "hard",
    minActive: 130,
    maxActive: 300,
    minKills: 32,
    maxKills: 460,
    maxNearest: 36,
    minSurvivors: 2,
  },
  {
    mode: "defense",
    difficulty: "easy",
    minActive: 120,
    maxActive: 360,
    minKills: 50,
    maxKills: 240,
    maxNearest: 8,
    minSurvivors: 4,
  },
  {
    mode: "defense",
    difficulty: "medium",
    minActive: 90,
    maxActive: 360,
    minKills: 32,
    maxKills: 220,
    maxNearest: 10,
    minSurvivors: 2,
    maxOpeningActive: 120,
  },
  {
    mode: "defense",
    difficulty: "hard",
    minActive: 90,
    maxActive: 360,
    minKills: 20,
    maxKills: 180,
    maxNearest: 12,
    minSurvivors: 1,
    maxOpeningActive: 130,
  },
]

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

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

async function readBalanceSample(page, elapsedMs) {
  return page.evaluate((elapsed) => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const result = document.querySelector("#result-screen")
    return {
      elapsed,
      soldiersText: textOf("[data-role='soldiers']"),
      killsText: textOf("[data-role='kills']"),
      progressText: textOf("[data-role='stage']"),
      activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
      nearestMonsterDistance: window.__squadRushMonsterDebug?.nearestDistance ?? Number.POSITIVE_INFINITY,
      maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      resultVisible: result instanceof HTMLElement && getComputedStyle(result).display !== "none",
    }
  }, elapsedMs)
}

async function runBalanceCase(browser, baseUrl, config) {
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  collectPageErrors(page, consoleErrors, pageErrors)
  const url = `${baseUrl}?mode=${config.mode}&difficulty=${config.difficulty}&quality=high&qa=monsters&qaNoDamage=1`
  await page.goto(url, { waitUntil: "networkidle" })
  await clickStartButton(page)

  const samples = []
  let previousSampleTime = 0
  for (const sampleTime of sampleTimesMs) {
    await page.waitForTimeout(sampleTime - previousSampleTime)
    previousSampleTime = sampleTime
    const raw = await readBalanceSample(page, sampleTime)
    samples.push({
      ...raw,
      soldiers: parseNumber(raw.soldiersText),
      kills: parseNumber(raw.killsText),
      progress: parseNumber(raw.progressText),
    })
  }
  await page.close()

  const finalSample = samples[samples.length - 1]
  assertQa(finalSample !== undefined, `${config.mode}/${config.difficulty}: no balance samples captured.`)
  assertQa(consoleErrors.length === 0, `${config.mode}/${config.difficulty}: console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `${config.mode}/${config.difficulty}: page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(finalSample.scrollWidth - finalSample.viewportWidth <= maxHorizontalOverflowPx, `${config.mode}/${config.difficulty}: horizontal overflow detected.`)
  assertQa(!finalSample.resultVisible, `${config.mode}/${config.difficulty}: run ended before the pressure window completed. Final sample: ${JSON.stringify(finalSample)}`)
  assertQa(finalSample.soldiers >= config.minSurvivors, `${config.mode}/${config.difficulty}: overloaded before growth stabilized, survivors=${finalSample.soldiers}.`)
  assertQa(finalSample.activeMonsters >= config.minActive, `${config.mode}/${config.difficulty}: pressure too low, active=${finalSample.activeMonsters}. Final sample: ${JSON.stringify(finalSample)}`)
  assertQa(finalSample.activeMonsters <= config.maxActive, `${config.mode}/${config.difficulty}: pressure over cap, active=${finalSample.activeMonsters}. Final sample: ${JSON.stringify(finalSample)}`)
  assertQa(finalSample.kills >= config.minKills, `${config.mode}/${config.difficulty}: squad cannot clear enough monsters, kills=${finalSample.kills}.`)
  assertQa(finalSample.kills <= config.maxKills, `${config.mode}/${config.difficulty}: monsters are dying too easily, kills=${finalSample.kills}.`)
  assertQa(
    samples.some((sample) => sample.nearestMonsterDistance <= config.maxNearest),
    `${config.mode}/${config.difficulty}: monsters never entered tight threat range, nearest=${samples.map((sample) => sample.nearestMonsterDistance.toFixed(1)).join("/")}.`,
  )
  assertQa(
    samples.every((sample) => sample.activeMonsters <= sample.maxActivePressure),
    `${config.mode}/${config.difficulty}: active monsters exceeded pressure cap.`,
  )
  if (typeof config.maxOpeningActive === "number") {
    const openingSample = samples[0]
    assertQa(openingSample !== undefined, `${config.mode}/${config.difficulty}: no opening sample captured.`)
    assertQa(
      openingSample.activeMonsters <= config.maxOpeningActive,
      `${config.mode}/${config.difficulty}: defense opening pressure is too high, active=${openingSample.activeMonsters}.`,
    )
  }

  return {
    mode: config.mode,
    difficulty: config.difficulty,
    samples,
  }
}

const port = await findFreePort()
await assertDifficultyBalanceContract()
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
  await waitForPreview(previewUrl)
  browser = await chromium.launch({ channel: "chrome" })
  const results = []
  for (const balanceCase of cases) {
    results.push(await runBalanceCase(browser, previewUrl, balanceCase))
  }
  await browser.close()
  browser = undefined
  console.info(JSON.stringify({ results }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
