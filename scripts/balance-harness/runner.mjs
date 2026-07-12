import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { chromium } from "playwright"
import { DEFAULT_SAMPLE_TIMES_MS, DEFAULT_VIEWPORT } from "./defaults.mjs"
import { evaluateTrial, summarizeCase } from "./metrics.mjs"
import { seededRandomScript } from "./seeded-random.mjs"

export async function runHarness(options) {
  const browser = await chromium.launch({ channel: "chrome" })
  const startedAt = new Date().toISOString()
  try {
    const caseSummaries = []
    const rawTrials = []
    for (const caseConfig of options.cases) {
      const seeds = Array.from({ length: caseConfig.trials }, (_, index) => options.seed + rawTrials.length + index)
      const trials = await runTrialBatch(browser, options.baseUrl, caseConfig, seeds, options)
      rawTrials.push(...trials)
      caseSummaries.push(summarizeCase(caseConfig, trials))
    }
    const report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      seed: options.seed,
      sampleTimesMs: options.sampleTimesMs,
      strategy: options.strategy,
      summaries: caseSummaries,
      trials: rawTrials,
    }
    if (options.reportPath !== null) {
      await mkdir(dirname(options.reportPath), { recursive: true })
      await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`)
    }
    return report
  } finally {
    await browser.close()
  }
}

async function runTrialBatch(browser, baseUrl, caseConfig, seeds, options) {
  const trials = []
  let cursor = 0
  async function worker() {
    while (cursor < seeds.length) {
      const seed = seeds[cursor]
      cursor += 1
      if (seed !== undefined) {
        trials.push(await runTrial(browser, baseUrl, caseConfig, seed, options))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, seeds.length) }, () => worker()))
  return [...trials].sort((left, right) => left.seed - right.seed)
}

async function runTrial(browser, baseUrl, caseConfig, seed, options) {
  const page = await browser.newPage({ viewport: options.viewport })
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
    const url = buildCaseUrl(baseUrl, caseConfig)
    await page.goto(url, { waitUntil: "networkidle" })
    await page.locator(".tap-to-start").click()
      const samples = await collectSamples(page, caseConfig.sampleTimesMs ?? options.sampleTimesMs)
      const evaluation = evaluateTrial(caseConfig, samples)
      return {
        mode: caseConfig.mode,
        difficulty: caseConfig.difficulty,
        window: caseConfig.window ?? "full_run",
        route: caseConfig.route ?? "default",
        seed,
        url,
      metrics: evaluation.metrics,
      failures: [...evaluation.failures, ...runtimeFailures(consoleErrors, pageErrors)],
      samples,
    }
  } finally {
    await page.close()
  }
}

async function collectSamples(page, sampleTimesMs) {
  const samples = []
  let previousSampleTime = 0
  for (const sampleTime of sampleTimesMs) {
    await page.waitForTimeout(sampleTime - previousSampleTime)
    previousSampleTime = sampleTime
    samples.push(await readSample(page, sampleTime))
  }
  return samples
}

async function readSample(page, elapsedMs) {
  return page.evaluate((elapsed) => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const parseNumber = (text) => {
      const match = text.match(/[0-9]+(?:\\.[0-9]+)?/)
      return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
    }
    const result = document.querySelector("#result-screen")
    const monster = window.__squadRushMonsterDebug
    const mode = window.__squadRushGameModeDebug
    return {
      elapsedMs: elapsed,
      activeMonsters: monster?.active ?? 0,
      nearestMonsterDistance: monster?.nearestDistance ?? Number.POSITIVE_INFINITY,
      maxActivePressure: monster?.maxActivePressure ?? 0,
      pressureState: monster?.pressureState ?? "unknown",
      visibleCombatBandDensity: monster?.visibleCombatBandDensity ?? 0,
      visibleTargetMin: monster?.visibleTargetMin ?? 0,
      visibleTargetMax: monster?.visibleTargetMax ?? 0,
      spawnDensityMultiplier: monster?.spawnDensityMultiplier ?? 0,
      healthMultiplier: monster?.healthMultiplier ?? 0,
      soldiers: parseNumber(textOf("[data-role='soldiers']")),
      kills: parseNumber(textOf("[data-role='kills']")),
      progress: parseNumber(textOf("[data-role='stage']")),
      formationCount: mode?.formation.count ?? 0,
      rosterSize: mode?.roster.reduce((sum, entry) => sum + entry.count, 0) ?? 0,
      scrollOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
      resultVisible: result instanceof HTMLElement && getComputedStyle(result).display !== "none",
    }
  }, elapsedMs)
}

function runtimeFailures(consoleErrors, pageErrors) {
  const failures = []
  if (consoleErrors.length > 0) {
    failures.push("console_error")
  }
  if (pageErrors.length > 0) {
    failures.push("page_error")
  }
  return failures
}

function buildCaseUrl(baseUrl, caseConfig) {
  const url = new URL(baseUrl)
  url.searchParams.set("mode", caseConfig.mode)
  url.searchParams.set("difficulty", caseConfig.difficulty)
  for (const [key, value] of Object.entries(caseConfig.query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item)
      }
    } else {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

export function createRunOptions(baseUrl, options) {
  return {
    baseUrl,
    cases: options.cases,
    concurrency: Math.max(1, options.concurrency),
    reportPath: options.reportPath,
    sampleTimesMs: options.sampleTimesMs ?? DEFAULT_SAMPLE_TIMES_MS,
    seed: options.seed,
    strategy: options.strategy,
    viewport: options.viewport ?? DEFAULT_VIEWPORT,
  }
}
