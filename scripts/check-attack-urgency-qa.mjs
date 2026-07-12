import { runAttackUrgencyHarness } from "./lib/attackUrgencyHarness.mjs"

const options = parseArgs(process.argv.slice(2))
const report = await runAttackUrgencyHarness(options)
console.info(JSON.stringify(report.summary, null, 2))

function parseArgs(argv) {
  const parsed = {
    trials: 10,
    seed: 52001,
    report: "logs/attack-urgency/latest.json",
    difficulty: "easy",
    soldiers: 10,
    pangyo: 4,
    concurrency: 4,
  }
  for (const arg of argv) {
    if (arg.startsWith("--trials=")) {
      parsed.trials = parseIntArg(arg.slice("--trials=".length), "trials", 1)
    } else if (arg.startsWith("--seed=")) {
      parsed.seed = parseIntArg(arg.slice("--seed=".length), "seed", 1)
    } else if (arg.startsWith("--report=")) {
      parsed.report = arg.slice("--report=".length)
    } else if (arg.startsWith("--difficulty=")) {
      parsed.difficulty = arg.slice("--difficulty=".length)
    } else if (arg.startsWith("--soldiers=")) {
      parsed.soldiers = parseIntArg(arg.slice("--soldiers=".length), "soldiers", 1)
    } else if (arg.startsWith("--pangyo=")) {
      parsed.pangyo = parseIntArg(arg.slice("--pangyo=".length), "pangyo", 0)
    } else if (arg.startsWith("--concurrency=")) {
      parsed.concurrency = parseIntArg(arg.slice("--concurrency=".length), "concurrency", 1)
    } else {
      throw new Error(`Unknown attack urgency QA argument: ${arg}`)
    }
  }
  return parsed
}

function parseIntArg(value, name, min) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`Expected --${name} to be an integer >= ${min}, got ${value}`)
  }
  return parsed
}
