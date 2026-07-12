#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { compareReports, formatComparison, loadReport } from "./compare.mjs"

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const baseline = await loadReport(args.baseline)
    const candidate = await loadReport(args.candidate)
    const comparison = formatComparison(compareReports(baseline, candidate))
    await writeJournal(args, comparison)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

function parseArgs(argv) {
  const parsed = {
    baseline: null,
    candidate: null,
    decision: null,
    hypothesis: null,
    out: null,
  }
  for (const arg of argv) {
    if (arg.startsWith("--baseline=")) {
      parsed.baseline = arg.slice("--baseline=".length)
    } else if (arg.startsWith("--candidate=")) {
      parsed.candidate = arg.slice("--candidate=".length)
    } else if (arg.startsWith("--decision=")) {
      parsed.decision = arg.slice("--decision=".length)
    } else if (arg.startsWith("--hypothesis=")) {
      parsed.hypothesis = arg.slice("--hypothesis=".length)
    } else if (arg.startsWith("--out=")) {
      parsed.out = arg.slice("--out=".length)
    } else {
      throw new Error(`Unknown journal argument: ${arg}`)
    }
  }
  for (const [name, value] of Object.entries(parsed)) {
    if (value === null || value.length === 0) {
      throw new Error(`Missing required --${name} argument.`)
    }
  }
  return parsed
}

async function writeJournal(args, comparison) {
  const outPath = resolve(args.out)
  const body = [
    "# Defense Balance Experiment Journal",
    "",
    `## Hypothesis`,
    args.hypothesis,
    "",
    "## Changed knobs",
    "Read-only/advisory run. No balance constants changed by this journal command.",
    "",
    "## Baseline",
    args.baseline,
    "",
    "## Candidate",
    args.candidate,
    "",
    "## Comparison",
    "```text",
    comparison,
    "```",
    "",
    "## Decision",
    args.decision,
    "",
    "## Next tuning knob",
    "Prefer spawn pressure or defense wave visible-density targets before lowering monster count; use a single-hypothesis candidate report.",
    "",
    "## Follow-up",
    "Run the same-seed defense harness comparison after one manual tuning change.",
    "",
  ].join("\n")
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, body)
  console.info(`wrote ${outPath}`)
}
