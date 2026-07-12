#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const baseline = await loadReport(args.baseline)
    const candidate = await loadReport(args.candidate)
    const comparison = compareReports(baseline, candidate)
    printComparison(comparison)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

export async function loadReport(path) {
  let source
  try {
    source = await readFile(resolve(path), "utf8")
  } catch (error) {
    throw new Error(`Missing or unreadable report: ${path}`)
  }
  const parsed = JSON.parse(source)
  if (!Array.isArray(parsed.summaries) || !Array.isArray(parsed.trials) || typeof parsed.seed !== "number") {
    throw new Error(`Invalid balance harness report structure: ${path}`)
  }
  return parsed
}

export function compareReports(baseline, candidate) {
  assertComparable(baseline, candidate)
  const candidateSummaries = new Map(candidate.summaries.map((summary) => [summaryKey(summary), summary]))
  return baseline.summaries.map((baselineSummary) => {
    const key = summaryKey(baselineSummary)
    const candidateSummary = candidateSummaries.get(key)
    if (candidateSummary === undefined) {
      throw new Error(`Candidate report missing comparable summary: ${key}`)
    }
    return compareSummary(key, baselineSummary, candidateSummary)
  })
}

export function formatComparison(comparison) {
  return comparison.map((entry) => [
    `${entry.key}: passRate delta ${formatDelta(entry.passRateDelta)}`,
    ...entry.metricDeltas.map((metric) => `  ${metric.name}: p10 ${formatDelta(metric.p10)}, mean ${formatDelta(metric.mean)}, p90 ${formatDelta(metric.p90)}`),
    `  new failures: ${entry.newFailures.join(", ") || "none"}`,
    `  resolved failures: ${entry.resolvedFailures.join(", ") || "none"}`,
    `  recommendation changes: ${entry.recommendationChanges.join(" | ") || "none"}`,
  ].join("\n")).join("\n")
}

function parseArgs(argv) {
  const parsed = { baseline: null, candidate: null }
  for (const arg of argv) {
    if (arg.startsWith("--baseline=")) {
      parsed.baseline = arg.slice("--baseline=".length)
    } else if (arg.startsWith("--candidate=")) {
      parsed.candidate = arg.slice("--candidate=".length)
    } else {
      throw new Error(`Unknown compare argument: ${arg}`)
    }
  }
  if (parsed.baseline === null || parsed.candidate === null) {
    throw new Error("Usage: compare.mjs --baseline=<report.json> --candidate=<report.json>")
  }
  return parsed
}

function assertComparable(baseline, candidate) {
  if (baseline.seed !== candidate.seed) {
    throw new Error(`Reports use different seeds: baseline ${baseline.seed}, candidate ${candidate.seed}`)
  }
  if (JSON.stringify(baseline.sampleTimesMs) !== JSON.stringify(candidate.sampleTimesMs)) {
    throw new Error("Reports use different global sampleTimesMs.")
  }
}

function compareSummary(key, baseline, candidate) {
  return {
    key,
    passRateDelta: candidate.passRate - baseline.passRate,
    metricDeltas: compareMetrics(baseline.metrics, candidate.metrics),
    newFailures: diffNames(candidate.failureCounts, baseline.failureCounts),
    resolvedFailures: diffNames(baseline.failureCounts, candidate.failureCounts),
    recommendationChanges: diffLists(candidate.recommendations, baseline.recommendations),
  }
}

function compareMetrics(baselineMetrics, candidateMetrics) {
  return Object.keys(baselineMetrics)
    .filter((name) => candidateMetrics[name] !== undefined)
    .map((name) => ({
      name,
      p10: candidateMetrics[name].p10 - baselineMetrics[name].p10,
      mean: candidateMetrics[name].mean - baselineMetrics[name].mean,
      p90: candidateMetrics[name].p90 - baselineMetrics[name].p90,
    }))
}

function diffNames(left, right) {
  return Object.keys(left).filter((name) => right[name] === undefined)
}

function diffLists(left, right) {
  return left.filter((entry) => !right.includes(entry))
}

function summaryKey(summary) {
  return `${summary.mode}:${summary.difficulty}:${summary.window ?? "full_run"}:${summary.route ?? "default"}`
}

function printComparison(comparison) {
  console.info(formatComparison(comparison))
}

function formatDelta(value) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(3)}`
}
