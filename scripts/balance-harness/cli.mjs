#!/usr/bin/env node
import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { DEFENSE_ROUTES, DEFENSE_WINDOWS, DEFAULT_CASES, DEFAULT_SAMPLE_TIMES_MS, DEFAULT_STRATEGY } from "./defaults.mjs"
import { findFreePort, startPreview, waitForPreview } from "./preview.mjs"
import { createRunOptions, runHarness } from "./runner.mjs"

const args = parseArgs(process.argv.slice(2))
const config = await loadConfig(args.config)
const selectedCases = selectCases(config.cases, args)
const port = await findFreePort()
const baseUrl = `http://127.0.0.1:${port}/`
let preview

try {
  if (!args.skipBuild) {
    await runCommand("npm", ["run", "build"])
  }
  preview = startPreview(port)
  await waitForPreview(baseUrl)
  const report = await runHarness(createRunOptions(baseUrl, {
    cases: selectedCases,
    concurrency: args.concurrency,
    reportPath: args.report,
    sampleTimesMs: config.sampleTimesMs,
    seed: args.seed,
    strategy: config.strategy,
  }))
  printSummary(report)
  process.exitCode = args.allowFail || report.summaries.every((summary) => summary.passRate === 1) ? 0 : 1
} finally {
  if (preview !== undefined && !preview.killed) {
    preview.kill("SIGTERM")
  }
}

async function loadConfig(configPath) {
  if (configPath === null) {
    return {
      cases: DEFAULT_CASES,
      sampleTimesMs: DEFAULT_SAMPLE_TIMES_MS,
      strategy: DEFAULT_STRATEGY,
    }
  }
  const source = await readFile(resolve(configPath), "utf8")
  const parsed = JSON.parse(source)
  const config = {
    cases: parsed.cases ?? DEFAULT_CASES,
    sampleTimesMs: parsed.sampleTimesMs ?? DEFAULT_SAMPLE_TIMES_MS,
    strategy: parsed.strategy ?? DEFAULT_STRATEGY,
  }
  validateConfig(config, configPath)
  return config
}

function parseArgs(argv) {
  const parsed = {
    cases: null,
    config: null,
    report: "logs/balance-harness/latest.json",
    seed: 41001,
    allowFail: false,
    concurrency: 1,
    skipBuild: false,
    trials: null,
  }
  for (const arg of argv) {
    if (arg === "--allow-fail") {
      parsed.allowFail = true
    } else if (arg === "--skip-build") {
      parsed.skipBuild = true
    } else if (arg.startsWith("--cases=")) {
      parsed.cases = arg.slice("--cases=".length).split(",").filter(Boolean)
    } else if (arg.startsWith("--config=")) {
      parsed.config = arg.slice("--config=".length)
    } else if (arg.startsWith("--concurrency=")) {
      parsed.concurrency = parsePositiveInt(arg.slice("--concurrency=".length), "concurrency")
    } else if (arg.startsWith("--report=")) {
      parsed.report = arg.slice("--report=".length)
    } else if (arg.startsWith("--seed=")) {
      parsed.seed = parsePositiveInt(arg.slice("--seed=".length), "seed")
    } else if (arg.startsWith("--trials=")) {
      parsed.trials = parsePositiveInt(arg.slice("--trials=".length), "trials")
    } else {
      throw new Error(`Unknown balance harness argument: ${arg}`)
    }
  }
  return parsed
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected --${name} to be a positive integer, got ${value}`)
  }
  return parsed
}

function selectCases(cases, args) {
  const selected = cases
    .filter((caseConfig) => args.cases === null || caseKeys(caseConfig).some((key) => args.cases.includes(key)))
    .map((caseConfig) => ({
      ...caseConfig,
      trials: args.trials ?? caseConfig.trials,
  }))
  if (selected.length === 0) {
    throw new Error(`Unknown case selection: ${args.cases?.join(", ") ?? "all"}`)
  }
  return selected
}

function validateConfig(config, configPath) {
  const context = configPath ?? "default config"
  if (!Array.isArray(config.cases)) {
    throw new Error(`${context} must define cases as an array.`)
  }
  for (const caseConfig of config.cases) {
    if (caseConfig.window !== undefined && DEFENSE_WINDOWS[caseConfig.window] === undefined) {
      throw new Error(`${context} has unknown-window '${caseConfig.window}'.`)
    }
    if (caseConfig.route !== undefined) {
      const route = DEFENSE_ROUTES[caseConfig.route]
      if (route === undefined) {
        throw new Error(`${context} has unknown-route '${caseConfig.route}'.`)
      }
      if (route.status !== "supported") {
        throw new Error(`${context} route '${caseConfig.route}' is unsupported.`)
      }
    }
  }
}

function caseKeys(caseConfig) {
  const base = `${caseConfig.mode}:${caseConfig.difficulty}`
  const window = caseConfig.window
  const route = caseConfig.route ?? "default"
  return [
    route === "default" ? base : null,
    window === undefined || route !== "default" ? null : `${base}:${window}`,
    window === undefined ? null : `${base}:${window}:${route}`,
  ].filter((key) => key !== null)
}

function runCommand(command, commandArgs) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, commandArgs, { cwd: resolve("."), stdio: "inherit" })
    child.once("error", rejectCommand)
    child.once("exit", (code) => {
      if (code === 0) {
        resolveCommand()
        return
      }
      rejectCommand(new Error(`${command} ${commandArgs.join(" ")} exited ${code ?? "without code"}`))
    })
  })
}

function printSummary(report) {
  console.info(`balance harness report: ${report.trials.length} trials, seed ${report.seed}`)
  for (const summary of report.summaries) {
    const failures = Object.entries(summary.failureCounts)
      .map(([name, count]) => `${name}:${count}`)
      .join(", ") || "none"
    console.info(`${summary.mode}/${summary.difficulty} pass=${(summary.passRate * 100).toFixed(1)}% failures=${failures}`)
    for (const recommendation of summary.recommendations) {
      console.info(`  - ${recommendation}`)
    }
  }
}
