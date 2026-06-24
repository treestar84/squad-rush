import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { analyzePngFile, analyzePngRegionFile } from "./lib/pngMetrics.mjs"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const peakCaptureMs = 12500
const maxHorizontalOverflowPx = 0
const minScreenshotBytes = 20000
const minPeakProgress = 28
const minPeakKills = 24
const minPeakFps = 24
const minPeakEdgeDensity = 0.08
const minPeakColorBuckets = 150
const maxUpperVoidSkyRatio = 0.74
const minUpperVoidEdgeDensity = 0.018

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

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `Mid-boss wave screenshot is too small: ${path}`)
}

async function readWaveStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const bossBar = document.querySelector("[data-role='boss']")
    const bossWarning = document.querySelector("[data-role='boss-warning']")
    const bossStyle = bossBar instanceof HTMLElement ? getComputedStyle(bossBar) : null
    const warningStyle = bossWarning instanceof HTMLElement ? getComputedStyle(bossWarning) : null
    return {
      soldiers: textOf("[data-role='soldiers']"),
      kills: textOf("[data-role='kills']"),
      fps: textOf("[data-role='fps']"),
      progress: textOf("[data-role='stage']"),
      bossVisible: bossStyle !== null && bossStyle.display !== "none",
      bossWarningVisible: warningStyle !== null && warningStyle.display !== "none",
      tankMeshes: Array.from(document.querySelectorAll("canvas")).length,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

const port = await findFreePort()
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
  const waveSource = await readFile("src/game/systems/MonsterWaveSystem.ts", "utf8")
  const hudSource = await readFile("src/ui/Hud.ts", "utf8")
  const levelSource = await readFile("src/game/data/levelData.ts", "utf8")
  assertQa(waveSource.includes("MID_BOSS_SPAWN_Z = [104, 154, 204, 258, 318]"), "Mid-boss spawn schedule must contain five appearances after 25% progress.")
  assertQa(waveSource.includes("MONSTER_CONFIGS.tank"), "Mid-boss must use the regular tank monster config inside wave batches.")
  assertQa(!hudSource.includes("showBossWarning") && !hudSource.includes("bossHpVisible"), "Mid-boss must not show a warning banner or boss HP HUD.")
  assertQa(!levelSource.includes("BOSS"), "Level must not include a standalone boss segment.")

  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  const consoleErrors = []
  const pageErrors = []
  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  collectPageErrors(page, consoleErrors, pageErrors)

  await page.goto(`${previewUrl}?qaStartZ=84&qaSoldiers=30&qaSpeed=1.6`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForTimeout(peakCaptureMs)
  const peakPath = resolve(outputDir, "mid-boss-wave-mobile.png")
  await page.screenshot({ path: peakPath, fullPage: false })
  const peakStats = await readWaveStats(page)
  await browser.close()

  await assertScreenshot(peakPath)
  const peakMetrics = await analyzePngFile(peakPath, "mid-boss wave")
  const upperCombatBand = await analyzePngRegionFile(peakPath, "mid-boss wave upper combat band", {
    x0: 0.15,
    y0: 0.2,
    x1: 0.85,
    y1: 0.54,
  })
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(peakStats.scrollWidth - peakStats.viewportWidth <= maxHorizontalOverflowPx, "Mid-boss wave capture has horizontal overflow.")
  assertQa(!peakStats.bossVisible, "Boss HP bar must stay hidden for mixed wave mid-bosses.")
  assertQa(!peakStats.bossWarningVisible, "Boss warning banner must stay hidden for mixed wave mid-bosses.")
  assertQa(parseNumber(peakStats.soldiers) > 0, "Squad must still be alive during the mixed mid-boss wave capture.")
  assertQa(parseNumber(peakStats.progress) >= minPeakProgress, `Mid-boss wave did not reach ${minPeakProgress}% progress.`)
  assertQa(parseNumber(peakStats.kills) >= minPeakKills, `Mid-boss wave did not keep enough combat pressure.`)
  assertQa(parseNumber(peakStats.fps) >= minPeakFps, `Mid-boss wave FPS is below ${minPeakFps}.`)
  assertQa(peakMetrics.edgeDensity >= minPeakEdgeDensity, `Mid-boss wave camera framing is too empty: edgeDensity ${peakMetrics.edgeDensity.toFixed(3)} < ${minPeakEdgeDensity}.`)
  assertQa(peakMetrics.colorBuckets >= minPeakColorBuckets, `Mid-boss wave camera framing lacks combat detail: colorBuckets ${peakMetrics.colorBuckets} < ${minPeakColorBuckets}.`)
  assertQa(upperCombatBand.skyLikeRatio <= maxUpperVoidSkyRatio, `Mid-boss wave upper framing is mostly empty sky: skyLikeRatio ${upperCombatBand.skyLikeRatio.toFixed(3)} > ${maxUpperVoidSkyRatio}.`)
  assertQa(upperCombatBand.edgeDensity >= minUpperVoidEdgeDensity, `Mid-boss wave upper framing lacks visible combat/road detail: edgeDensity ${upperCombatBand.edgeDensity.toFixed(3)} < ${minUpperVoidEdgeDensity}.`)

  console.info(JSON.stringify({ peakPath, peakStats, peakMetrics, upperCombatBand }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
