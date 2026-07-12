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
const peakCaptureMs = 20000
const maxHorizontalOverflowPx = 0
const minScreenshotBytes = 20000
const minPeakProgress = 10
const minPeakKills = 0
const minPeakFps = 24
const minPeakEdgeDensity = 0.08
const minPeakColorBuckets = 150
const maxUpperVoidSkyRatio = 0.74
const minUpperVoidEdgeDensity = 0.018
const minMidBossDeathBurstCount = 70
const minMidBossDeathBurstScale = 1.1
const minMidBossDeathParticleScale = 0.75
const minMidBossDeathTiltRadians = 0.04
const minDyingMidBossScaleYRatio = 0.82

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
      midBosses: window.__squadRushMonsterDebug?.midBosses ?? 0,
      midBossHpBars: window.__squadRushMonsterDebug?.midBossHpBars ?? 0,
      midBossRedHpFills: window.__squadRushMonsterDebug?.midBossRedHpFills ?? 0,
      midBossGrayHpFills: window.__squadRushMonsterDebug?.midBossGrayHpFills ?? 0,
      dyingMidBosses: window.__squadRushMonsterDebug?.dyingMidBosses ?? 0,
      maxMidBossDeathTiltRadians: window.__squadRushMonsterDebug?.maxMidBossDeathTiltRadians ?? 0,
      lowestDyingMidBossScaleYRatio: window.__squadRushMonsterDebug?.lowestDyingMidBossScaleYRatio ?? 1,
      midBossDeathBurstCount: window.__squadRushFxDebug?.lastMidBossDeathBurstCount ?? 0,
      midBossDeathBurstScale: window.__squadRushFxDebug?.lastMidBossDeathBurstScale ?? 0,
      midBossDeathParticleMaxScale: window.__squadRushFxDebug?.lastMidBossDeathParticleMaxScale ?? 0,
      lowestMidBossHpBarY: window.__squadRushMonsterDebug?.lowestMidBossHpBarY ?? 0,
      largestMonsterScale: window.__squadRushMonsterDebug?.largestMonsterScale ?? 0,
      tankMeshes: Array.from(document.querySelectorAll("canvas")).length,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      if (msg.text().startsWith("Failed to load resource")) {
        return
      }
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
  const monsterPoolSource = await readFile("src/game/pools/MonsterPool.ts", "utf8")
  assertQa(
    waveSource.includes("MID_BOSS_SPAWN_Z = [96, 116, 136, 156, 176, 196, 216, 236, 256, 276, 296, 316, 336, 356]"),
    "Mid-boss spawn schedule must keep frequent pressure in both attack and defense waves.",
  )
  assertQa(waveSource.includes("getMidBossCount"), "Mid-boss waves must use a dedicated count guard.")
  assertQa(waveSource.includes("MAX_ACTIVE_DEFENSE_MID_BOSSES = 1"), "Wave Defence must limit the visible mid-boss to one at a time.")
  assertQa(!waveSource.includes("MID_BOSS_DOUBLE_COUNT_Z"), "Mid-boss waves must not spawn two giant doguri at the same spawn point.")
  assertQa(waveSource.includes("MONSTER_CONFIGS.tank"), "Mid-boss must use the regular tank monster config inside wave batches.")
  assertQa(waveSource.includes("midBossHpBars") && waveSource.includes("lowestMidBossHpBarY"), "Mid-boss QA must expose giant doguri and overhead HP bar debug state.")
  assertQa(waveSource.includes("midBossRedHpFills") && waveSource.includes("midBossGrayHpFills"), "Mid-boss QA must expose red and gray HP fill debug state.")
  assertQa(monsterPoolSource.includes("MID_BOSS_HP_FILL_DIFFUSE = [0.95, 0.16, 0.2]"), "Giant doguri HP fill must use the red danger color.")
  assertQa(monsterPoolSource.includes("restoreHpBarFillMaterial"), "Giant doguri HP fill must recover from pooled monster tinting.")
  assertQa(monsterPoolSource.includes("MID_BOSS_HP_BAR_FILL_FRONT_Z"), "Giant doguri HP fill must be offset in front of the back plate.")
  assertQa(waveSource.includes("MID_BOSS_DEATH_FALL_PROGRESS"), "Giant doguri death must keep a visible falling phase before bursting.")
  assertQa(!waveSource.includes("MID_BOSS_DEATH_FLAT_SCALE"), "Giant doguri death must not flatten the body before bursting.")
  assertQa(hudSource.includes("data-role=\"boss\"") === false, "Giant doguri mid-boss must not use a separate screen-space boss HUD.")
  assertQa(!levelSource.includes("BOSS"), "Level must not include a standalone boss segment.")

  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  const consoleErrors = []
  const pageErrors = []
  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  collectPageErrors(page, consoleErrors, pageErrors)

  await page.goto(`${previewUrl}?mode=defense&difficulty=easy&quality=high&qa=monsters&qaSoldiers=30&qaSpeed=3`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction((minimumProgress) => {
    const debug = window.__squadRushMonsterDebug
    const stageText = document.querySelector("[data-role='stage']")?.textContent ?? ""
    const stage = Number.parseFloat(stageText)
    return Number.isFinite(stage)
      && stage >= minimumProgress
      && debug !== undefined
      && debug.midBosses > 0
      && debug.midBossHpBars > 0
      && debug.midBossRedHpFills === debug.midBossHpBars
      && debug.midBossGrayHpFills === 0
      && debug.lowestMidBossHpBarY >= 2.1
  }, minPeakProgress, { timeout: peakCaptureMs })
  await page.waitForTimeout(500)
  const peakPath = resolve(outputDir, "mid-boss-wave-mobile.png")
  await page.screenshot({ path: peakPath, fullPage: false })
  const peakStats = await readWaveStats(page)
  const killedMidBoss = await page.evaluate(() => window.__squadRushMonsterQa?.killMidBoss() ?? false)
  assertQa(killedMidBoss, "QA hook could not kill a visible giant doguri mid-boss.")
  await page.waitForTimeout(100)
  const grayDeathPath = resolve(outputDir, "mid-boss-death-gray-frame.png")
  await page.screenshot({ path: grayDeathPath, fullPage: false })
  const grayDeathStats = await readWaveStats(page)
  await page.waitForTimeout(180)
  const burstPath = resolve(outputDir, "mid-boss-death-burst-frame.png")
  await page.screenshot({ path: burstPath, fullPage: false })
  const burstStats = await readWaveStats(page)
  await browser.close()

  await assertScreenshot(peakPath)
  await assertScreenshot(grayDeathPath)
  await assertScreenshot(burstPath)
  const peakMetrics = await analyzePngFile(peakPath, "mid-boss wave")
  const burstMetrics = await analyzePngFile(burstPath, "mid-boss death burst")
  const upperCombatBand = await analyzePngRegionFile(peakPath, "mid-boss wave upper combat band", {
    x0: 0.15,
    y0: 0.2,
    x1: 0.85,
    y1: 0.54,
  })
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(peakStats.scrollWidth - peakStats.viewportWidth <= maxHorizontalOverflowPx, "Mid-boss wave capture has horizontal overflow.")
  assertQa(!peakStats.bossVisible, "Separate boss HUD must stay hidden for walking giant doguri mid-bosses.")
  assertQa(!peakStats.bossWarningVisible, "Separate boss warning must stay hidden for walking giant doguri mid-bosses.")
  assertQa(peakStats.midBosses === 1, `Exactly one giant doguri mid-boss must be active in Wave Defence: ${peakStats.midBosses}.`)
  assertQa(peakStats.midBossHpBars > 0, "Giant doguri mid-boss must have an active overhead HP bar.")
  assertQa(peakStats.midBossRedHpFills === peakStats.midBossHpBars, `Giant doguri HP fill must be red: red=${peakStats.midBossRedHpFills}, bars=${peakStats.midBossHpBars}.`)
  assertQa(peakStats.midBossGrayHpFills === 0, `Giant doguri HP fill must not be gray: gray=${peakStats.midBossGrayHpFills}.`)
  assertQa(peakStats.lowestMidBossHpBarY >= 2.1, `Giant doguri HP bar is too low to read: y=${peakStats.lowestMidBossHpBarY}.`)
  assertQa(peakStats.largestMonsterScale >= 1, `Giant doguri body is too small: scale ${peakStats.largestMonsterScale}.`)
  assertQa(parseNumber(peakStats.soldiers) > 0, "Squad must still be alive during the mixed mid-boss wave capture.")
  assertQa(parseNumber(peakStats.progress) >= minPeakProgress, `Mid-boss wave did not reach ${minPeakProgress}% progress.`)
  assertQa(parseNumber(peakStats.kills) >= minPeakKills, `Mid-boss wave did not keep enough combat pressure.`)
  assertQa(parseNumber(peakStats.fps) >= minPeakFps, `Mid-boss wave FPS is below ${minPeakFps}.`)
  assertQa(peakMetrics.edgeDensity >= minPeakEdgeDensity, `Mid-boss wave camera framing is too empty: edgeDensity ${peakMetrics.edgeDensity.toFixed(3)} < ${minPeakEdgeDensity}.`)
  assertQa(peakMetrics.colorBuckets >= minPeakColorBuckets, `Mid-boss wave camera framing lacks combat detail: colorBuckets ${peakMetrics.colorBuckets} < ${minPeakColorBuckets}.`)
  assertQa(upperCombatBand.skyLikeRatio <= maxUpperVoidSkyRatio, `Mid-boss wave upper framing is mostly empty sky: skyLikeRatio ${upperCombatBand.skyLikeRatio.toFixed(3)} > ${maxUpperVoidSkyRatio}.`)
  assertQa(upperCombatBand.edgeDensity >= minUpperVoidEdgeDensity, `Mid-boss wave upper framing lacks visible combat/road detail: edgeDensity ${upperCombatBand.edgeDensity.toFixed(3)} < ${minUpperVoidEdgeDensity}.`)
  assertQa(grayDeathStats.dyingMidBosses > 0, "Giant doguri gray death frame must keep the dying mid-boss visible before the burst.")
  assertQa(
    grayDeathStats.maxMidBossDeathTiltRadians >= minMidBossDeathTiltRadians,
    `Giant doguri gray death frame is too static: tilt=${grayDeathStats.maxMidBossDeathTiltRadians.toFixed(3)}.`,
  )
  assertQa(
    grayDeathStats.lowestDyingMidBossScaleYRatio >= minDyingMidBossScaleYRatio,
    `Giant doguri gray death frame flattened too much: scaleY=${grayDeathStats.lowestDyingMidBossScaleYRatio.toFixed(3)}.`,
  )
  assertQa(burstStats.midBossDeathBurstCount >= minMidBossDeathBurstCount, `Giant doguri burst emitted too few particles: ${burstStats.midBossDeathBurstCount}.`)
  assertQa(burstStats.midBossDeathBurstScale >= minMidBossDeathBurstScale, `Giant doguri burst radius is too small: ${burstStats.midBossDeathBurstScale}.`)
  assertQa(
    burstStats.midBossDeathParticleMaxScale >= minMidBossDeathParticleScale,
    `Giant doguri burst particles are too small: ${burstStats.midBossDeathParticleMaxScale}.`,
  )
  assertQa(
    burstMetrics.edgeDensity >= peakMetrics.edgeDensity * 0.82,
    `Giant doguri death burst frame lost too much visual detail: burst=${burstMetrics.edgeDensity.toFixed(3)}, peak=${peakMetrics.edgeDensity.toFixed(3)}.`,
  )

  console.info(JSON.stringify({ peakPath, grayDeathPath, burstPath, peakStats, grayDeathStats, burstStats, peakMetrics, burstMetrics, upperCombatBand }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
