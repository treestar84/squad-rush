import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"
import { analyzePngRegionFile } from "./lib/pngMetrics.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const minScreenshotBytes = 50000
const minMonsters = 140
const minProgress = 15
const minRedThreatRatio = 0.018
const minOrangeCueRatio = 0.01
const maxNeutralGreyRatio = 0.5

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parseNumber(text) {
  const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
  return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
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

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `Monster material screenshot is too small: ${path}`)
}

async function readCombatStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      monsters: textOf("[data-role='monsters']"),
      progress: textOf("[data-role='stage']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

const visualFactoryText = await readFile("src/game/pools/MonsterVisualFactory.ts", "utf8")
const monsterPoolText = await readFile("src/game/pools/MonsterPool.ts", "utf8")
const designText = await readFile("DESIGN.md", "utf8")
assertQa(visualFactoryText.includes("monster_slime_body"), "Monster body must render as a slime silhouette.")
assertQa(visualFactoryText.includes("monster_slime_base"), "Monster slime needs a flattened base so it does not read as face-only.")
assertQa(monsterPoolText.includes("inst.swaySpeed = 0.62"), "Monster crawl sway must be slow.")
assertQa(designText.includes("rounded slime bodies"), "DESIGN.md must document slime monster silhouettes.")
assertQa(designText.includes("very slow forward crawl"), "DESIGN.md must document slow monster crawl pacing.")
assertQa(visualFactoryText.includes("monster_slime_eye"), "Slime monsters need small embedded eyes.")
assertQa(visualFactoryText.includes("segments: 8"), "Slime bodies must stay low-poly enough for dense hordes.")
assertQa(!visualFactoryText.includes("width: 1.58"), "Monster cues are too wide and read as flat red bars.")
assertQa(visualFactoryText.includes("monster_back_spine"), "Monster horde needs small 3D spine cues instead of oversized flat bars.")
assertQa(visualFactoryText.includes("monster_variant_fast_side_fin"), "Fast monsters need side-fin silhouette cues.")
assertQa(visualFactoryText.includes("monster_variant_tank_armor_plate"), "Tank monsters need visible armor-plate silhouette cues.")
assertQa(designText.includes("fast side fins"), "DESIGN.md must document fast slime silhouette cues.")
assertQa(designText.includes("tank armor blobs"), "DESIGN.md must document tank slime silhouette cues.")

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?quality=medium`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)

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
  const browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForTimeout(27000)
  const screenshotPath = resolve(outputDir, "monster-slime-combat.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readCombatStats(page)
  await browser.close()

  await assertScreenshot(screenshotPath)
  const combatLaneMetrics = await analyzePngRegionFile(screenshotPath, "monster material combat lane", {
    x0: 0.1,
    y0: 0.25,
    x1: 0.9,
    y1: 0.96,
  })
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= 0, "Monster material capture has horizontal overflow.")
  assertQa(parseNumber(stats.progress) >= minProgress, `Monster material capture did not reach ${minProgress}% progress.`)
  assertQa(parseNumber(stats.monsters) >= minMonsters, `Monster material capture did not preserve ${minMonsters}+ active monsters.`)
  assertQa(combatLaneMetrics.redThreatRatio >= minRedThreatRatio, `Monster horde lost red threat pressure: ${combatLaneMetrics.redThreatRatio.toFixed(3)} < ${minRedThreatRatio}.`)
  assertQa(combatLaneMetrics.orangeCueRatio >= minOrangeCueRatio, `Monster horde lacks amber fast/variant cues: ${combatLaneMetrics.orangeCueRatio.toFixed(3)} < ${minOrangeCueRatio}.`)
  assertQa(combatLaneMetrics.neutralGreyRatio <= maxNeutralGreyRatio, `Monster horde is too neutral/washed out: ${combatLaneMetrics.neutralGreyRatio.toFixed(3)} > ${maxNeutralGreyRatio}.`)

  console.info(JSON.stringify({ screenshotPath, stats, combatLaneMetrics }, null, 2))
} finally {
  cleanup()
}
