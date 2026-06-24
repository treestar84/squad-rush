import { stat } from "node:fs/promises"
import { resolve } from "node:path"
import { analyzePngFile } from "./lib/pngMetrics.mjs"

const outputDir = resolve("logs/phase2-qa")

const screenshotChecks = [
  {
    name: "desktop start",
    file: "milestone-desktop-start.png",
    minBytes: 50000,
    minColors: 260,
    minContrast: 42,
    minChroma: 50,
    minEdgeDensity: 0.055,
    minActiveRatio: 0.9,
  },
  {
    name: "mobile start",
    file: "milestone-mobile-start.png",
    minBytes: 50000,
    minColors: 200,
    minContrast: 42,
    minChroma: 30,
    minEdgeDensity: 0.09,
    minActiveRatio: 0.9,
  },
  {
    name: "desktop gate",
    file: "milestone-desktop-first-gate.png",
    minBytes: 50000,
    minColors: 520,
    minContrast: 45,
    minChroma: 70,
    minEdgeDensity: 0.085,
    minActiveRatio: 0.88,
  },
  {
    name: "desktop horde",
    file: "milestone-desktop-first-horde.png",
    minBytes: 50000,
    minColors: 540,
    minContrast: 42,
    minChroma: 70,
    minEdgeDensity: 0.09,
    minActiveRatio: 0.88,
  },
  {
    name: "mobile horde",
    file: "milestone-mobile-first-horde.png",
    minBytes: 50000,
    minColors: 500,
    minContrast: 34,
    minChroma: 38,
    minEdgeDensity: 0.12,
    minActiveRatio: 0.9,
  },
  {
    name: "runtime mobile combat",
    file: "runtime-qa-mobile-combat.png",
    minBytes: 50000,
    minColors: 500,
    minContrast: 34,
    minChroma: 38,
    minEdgeDensity: 0.12,
    minActiveRatio: 0.9,
  },
  {
    name: "runtime desktop combat",
    file: "runtime-qa-desktop-combat.png",
    minBytes: 50000,
    minColors: 540,
    minContrast: 42,
    minChroma: 75,
    minEdgeDensity: 0.09,
    minActiveRatio: 0.88,
  },
  {
    name: "low quality combat",
    file: "quality-low-mobile-combat.png",
    minBytes: 50000,
    minColors: 430,
    minContrast: 32,
    minChroma: 34,
    minEdgeDensity: 0.11,
    minActiveRatio: 0.9,
  },
  {
    name: "medium quality combat",
    file: "quality-medium-mobile-combat.png",
    minBytes: 50000,
    minColors: 480,
    minContrast: 34,
    minChroma: 38,
    minEdgeDensity: 0.12,
    minActiveRatio: 0.9,
  },
  {
    name: "high quality combat",
    file: "quality-high-mobile-combat.png",
    minBytes: 50000,
    minColors: 420,
    minContrast: 38,
    minChroma: 38,
    minEdgeDensity: 0.105,
    minActiveRatio: 0.84,
  },
  {
    name: "mobile result",
    file: "fullrun-qa-mobile-result.png",
    minBytes: 10000,
    minColors: 130,
    minContrast: 32,
    minChroma: 30,
    minEdgeDensity: 0.08,
    minActiveRatio: 0.9,
  },
  {
    name: "desktop result",
    file: "fullrun-qa-desktop-result.png",
    minBytes: 10000,
    minColors: 130,
    minContrast: 22,
    minChroma: 30,
    minEdgeDensity: 0.04,
    minActiveRatio: 0.9,
  },
]

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertMetric(value, minimum, label) {
  assertQa(value >= minimum, `${label}: ${value.toFixed(3)} < ${minimum}`)
}

async function checkScreenshot(config) {
  const path = resolve(outputDir, config.file)
  const file = await stat(path)
  assertQa(file.size >= config.minBytes, `${config.name} screenshot is too small.`)
  const metrics = await analyzePngFile(path, config.name)
  assertMetric(metrics.colorBuckets, config.minColors, `${config.name} color bucket count`)
  assertMetric(metrics.contrast, config.minContrast, `${config.name} contrast`)
  assertMetric(metrics.chroma, config.minChroma, `${config.name} chroma`)
  assertMetric(metrics.edgeDensity, config.minEdgeDensity, `${config.name} edge density`)
  assertMetric(metrics.activeRatio, config.minActiveRatio, `${config.name} active pixel ratio`)
  return { name: config.name, file: config.file, metrics }
}

const results = []
for (const config of screenshotChecks) {
  results.push(await checkScreenshot(config))
}

console.info(JSON.stringify({ checked: results }, null, 2))
