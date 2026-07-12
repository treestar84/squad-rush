import { spawn } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { dirname, resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./startGame.mjs"
import { seededRandomScript } from "../balance-harness/seeded-random.mjs"

const root = resolve(".")
const viewport = { width: 390, height: 844 }
const sampleTimesMs = [12000, 24000, 36000, 48000]
const careerKeys = ["KeyJ", "KeyK", "KeyL", "KeyJ", "KeyK", "KeyL"]

export async function runAttackUrgencyHarness(options) {
  const port = await findFreePort()
  const previewUrl = `http://127.0.0.1:${port}/`
  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: "pipe" })
  let browser
  try {
    await waitForPreview(previewUrl)
    browser = await chromium.launch({ channel: "chrome" })
    const trials = await runTrialBatch(browser, previewUrl, options)
    const report = summarize(trials, options)
    await mkdir(dirname(options.report), { recursive: true })
    await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`)
    return report
  } finally {
    await browser?.close().catch(() => {})
    if (!preview.killed) {
      preview.kill("SIGTERM")
    }
  }
}

async function runTrialBatch(browser, baseUrl, options) {
  const seeds = Array.from({ length: options.trials }, (_, index) => options.seed + index)
  const trials = []
  let cursor = 0
  async function worker() {
    while (cursor < seeds.length) {
      const seed = seeds[cursor]
      cursor += 1
      if (seed !== undefined) {
        trials.push(await runTrial(browser, baseUrl, seed, options))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, seeds.length) }, () => worker()))
  return [...trials].sort((left, right) => left.seed - right.seed)
}

async function runTrial(browser, baseUrl, seed, options) {
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  try {
    await page.addInitScript(seededRandomScript(seed))
    await page.goto(buildUrl(baseUrl, options), { waitUntil: "networkidle" })
    await clickStartButton(page)
    await page.waitForFunction(() => window.__squadRushGameModeDebug?.mode === "run", null, { timeout: 30000 })
    const initial = await readSample(page, 0)
    const samples = []
    let previous = 0
    let careerIndex = 0
    for (const sampleTime of sampleTimesMs) {
      careerIndex = await waitAndDriveCareer(page, sampleTime - previous, careerIndex)
      previous = sampleTime
      samples.push(await readSample(page, sampleTime))
      if (samples[samples.length - 1]?.resultVisible === true) {
        break
      }
    }
    const final = samples[samples.length - 1] ?? initial
    const casualties = getPeakDrawdown([initial, ...samples])
    return {
      seed,
      initial,
      final,
      samples,
      careerChoices: careerIndex,
      casualties,
      urgent: casualties > 0 && final.soldiers > 0,
      defeated: final.resultVisible && final.resultTitle === "DEFEAT",
      victorious: final.resultVisible && final.resultTitle === "VICTORY",
      consoleErrors,
      pageErrors,
    }
  } finally {
    await page.close()
  }
}

async function waitAndDriveCareer(page, durationMs, startIndex) {
  let elapsed = 0
  let careerIndex = startIndex
  while (elapsed < durationMs) {
    await page.waitForTimeout(Math.min(500, durationMs - elapsed))
    elapsed += 500
    const active = await page.evaluate(() => document.querySelector("[data-role='career-choice']")?.getAttribute("aria-hidden") === "false")
    if (active) {
      await page.keyboard.press(careerKeys[careerIndex % careerKeys.length] ?? "KeyJ")
      careerIndex += 1
    }
  }
  return careerIndex
}

function buildUrl(baseUrl, options) {
  const url = new URL(baseUrl)
  url.searchParams.set("mode", "run")
  url.searchParams.set("difficulty", options.difficulty)
  url.searchParams.set("quality", "high")
  url.searchParams.set("qa", "monsters")
  url.searchParams.set("qaSoldiers", String(options.soldiers))
  url.searchParams.set("qaPangyo", String(options.pangyo))
  return url.toString()
}

async function readSample(page, elapsedMs) {
  return page.evaluate((elapsed) => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const parseNumber = (text) => {
      const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
      return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
    }
    const result = document.querySelector("#result-screen")
    return {
      elapsedMs: elapsed,
      soldiers: parseNumber(textOf("[data-role='soldiers']")),
      kills: parseNumber(textOf("[data-role='kills']")),
      progress: parseNumber(textOf("[data-role='stage']")),
      activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
      nearestMonsterDistance: window.__squadRushMonsterDebug?.nearestDistance ?? Number.POSITIVE_INFINITY,
      maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
      bottomBreachProximity: window.__squadRushMonsterDebug?.bottomBreachProximity ?? 0,
      monsterConfigCounts: window.__squadRushMonsterDebug?.monsterConfigCounts ?? {},
      resultVisible: result instanceof HTMLElement && getComputedStyle(result).display !== "none",
      resultTitle: textOf("[data-role='title']"),
      scrollOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
    }
  }, elapsedMs)
}

function getPeakDrawdown(samples) {
  let peak = 0
  let drawdown = 0
  for (const sample of samples) {
    peak = Math.max(peak, sample.soldiers)
    drawdown = Math.max(drawdown, peak - sample.soldiers)
  }
  return drawdown
}

function summarize(trials, options) {
  const mean = (values) => values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)
  return {
    options,
    summary: {
      trials: trials.length,
      urgencyRate: trials.filter((trial) => trial.urgent).length / Math.max(1, trials.length),
      defeatRate: trials.filter((trial) => trial.defeated).length / Math.max(1, trials.length),
      victoryRate: trials.filter((trial) => trial.victorious).length / Math.max(1, trials.length),
      careerChoicesMean: mean(trials.map((trial) => trial.careerChoices)),
      casualtyMean: mean(trials.map((trial) => trial.casualties)),
      finalSoldiersMean: mean(trials.map((trial) => trial.final.soldiers)),
      finalKillsMean: mean(trials.map((trial) => trial.final.kills)),
      finalActiveMean: mean(trials.map((trial) => trial.final.activeMonsters)),
      consoleErrorTrials: trials.filter((trial) => trial.consoleErrors.length > 0).length,
      pageErrorTrials: trials.filter((trial) => trial.pageErrors.length > 0).length,
    },
    trials,
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
