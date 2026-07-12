import { createServer } from "node:net"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { resolve } from "node:path"
import { spawn } from "node:child_process"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const minRunMs = 12000
const maxRunMs = 65000
const maxMobileOverflowPx = 0
const minKilledEnemies = 100
const minSurvivors = 1
const minQualityCombatKills = 5
const minLowQualityHorde = 120
const resultLayoutOnly = process.env.RESULT_LAYOUT_ONLY === "1"
const qualityCapturePlans = [
  { level: "low", screenshotName: "quality-low-mobile-combat.png" },
  { level: "medium", screenshotName: "quality-medium-mobile-combat.png" },
  { level: "high", screenshotName: "quality-high-mobile-combat.png" },
]
const browserCloseTimeoutMs = 5000

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === "object" && address !== null) {
          resolvePort(address.port)
          return
        }
        reject(new Error("Unable to allocate preview port."))
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

function assertRuntime(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertRuntime(file.size > 10000, `Full-run QA screenshot is too small: ${path}`)
}

async function closeBrowser(browser) {
  const closeTimer = new Promise((resolveClose) => {
    setTimeout(resolveClose, browserCloseTimeoutMs)
  })
  await Promise.race([browser.close(), closeTimer])
}

async function readResultStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const result = document.querySelector("#result-screen")
    const inner = document.querySelector(".result-inner")
    const retry = document.querySelector(".retry-btn")
    const next = document.querySelector(".next-btn")
    const share = document.querySelector(".share-btn")
    const shareStatus = document.querySelector("[data-role='share-status']")
    const resultStyle = result instanceof HTMLElement ? getComputedStyle(result) : null
    const innerStyle = inner instanceof HTMLElement ? getComputedStyle(inner) : null
    const innerRect = inner instanceof HTMLElement ? inner.getBoundingClientRect() : null
    const retryRect = retry instanceof HTMLElement ? retry.getBoundingClientRect() : null
    const nextRect = next instanceof HTMLElement ? next.getBoundingClientRect() : null
    const shareRect = share instanceof HTMLElement ? share.getBoundingClientRect() : null
    return {
      title: textOf("[data-role='title']"),
      rank: textOf("[data-role='rank']"),
      summary: textOf("[data-role='summary']"),
      stats: textOf("[data-role='stats']"),
      report: textOf("[data-role='report']"),
      retryText: textOf(".retry-btn"),
      nextText: textOf(".next-btn"),
      shareText: textOf(".share-btn"),
      shareStatus: shareStatus?.textContent ?? "",
      koreanTitle: textOf("[data-role='title-ko']"),
      koreanKicker: textOf("[data-role='kicker-ko']"),
      visible: resultStyle?.display !== "none",
      panelFullyVisible: innerRect !== null
        && innerRect.top >= 0
        && innerRect.left >= 0
        && innerRect.right <= window.innerWidth
        && innerRect.bottom <= window.innerHeight,
      resultOverflowY: resultStyle?.overflowY ?? "",
      innerOverflowY: innerStyle?.overflowY ?? "",
      resultClientHeight: result instanceof HTMLElement ? result.clientHeight : 0,
      resultScrollHeight: result instanceof HTMLElement ? result.scrollHeight : 0,
      innerClientHeight: inner instanceof HTMLElement ? inner.clientHeight : 0,
      innerScrollHeight: inner instanceof HTMLElement ? inner.scrollHeight : 0,
      retryFullyVisible: retryRect !== null && retryRect.top >= 0 && retryRect.bottom <= window.innerHeight,
      nextFullyVisible: nextRect !== null && nextRect.top >= 0 && nextRect.bottom <= window.innerHeight,
      shareFullyVisible: shareRect !== null && shareRect.top >= 0 && shareRect.bottom <= window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })
}

function assertResultFits(resultStats, label) {
  assertRuntime(resultStats.panelFullyVisible, `${label}: result panel is clipped by the viewport.`)
  assertRuntime(resultStats.resultOverflowY === "hidden", `${label}: result overlay permits vertical scrolling: ${resultStats.resultOverflowY}.`)
  assertRuntime(resultStats.innerOverflowY === "hidden", `${label}: result panel permits internal scrolling: ${resultStats.innerOverflowY}.`)
  assertRuntime(resultStats.resultScrollHeight <= resultStats.resultClientHeight + 1, `${label}: result overlay content exceeds its height.`)
  assertRuntime(resultStats.innerScrollHeight <= resultStats.innerClientHeight + 1, `${label}: result panel content exceeds its height.`)
  assertRuntime(resultStats.scrollHeight <= resultStats.viewportHeight + 1, `${label}: document height exceeds the viewport.`)
  assertRuntime(resultStats.scrollWidth - resultStats.viewportWidth <= maxMobileOverflowPx, `${label}: result screen has horizontal overflow.`)
  assertRuntime(resultStats.retryFullyVisible && resultStats.nextFullyVisible && resultStats.shareFullyVisible, `${label}: a result action is clipped.`)
}

async function readCombatStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      soldiers: textOf("[data-role='soldiers']"),
      kills: textOf("[data-role='kills']"),
      fps: textOf("[data-role='fps']"),
      progress: textOf("[data-role='stage']"),
      monsters: textOf("[data-role='monsters']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

async function startRun(page) {
  await clickStartButton(page)
}

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

async function runToVictory(browser, url, viewport, screenshotName) {
  const page = await browser.newPage({ viewport })
  await page.goto(url, { waitUntil: "networkidle" })
  await startRun(page)
  const startedAt = Date.now()
  await page.waitForFunction(
    () => {
      const result = document.querySelector("#result-screen")
      if (!(result instanceof HTMLElement)) {
        return false
      }
      return getComputedStyle(result).display !== "none"
    },
    null,
    { timeout: maxRunMs + 15000 },
  )
  const runMs = Date.now() - startedAt
  await page.waitForTimeout(800)
  await page.locator(".share-btn").click()
  await page.waitForTimeout(300)
  const resultPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: resultPath, fullPage: false })
  const resultStats = await readResultStats(page)
  const compactViewportStats = []
  if (screenshotName.includes("mobile")) {
    for (const compactViewport of [
      { width: 390, height: 667 },
      { width: 320, height: 480 },
      { width: 844, height: 390 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(compactViewport)
      await page.waitForTimeout(100)
      const compactStats = await readResultStats(page)
      assertResultFits(compactStats, `${compactViewport.width}x${compactViewport.height}`)
      if (compactViewport.width === 1280) {
        await page.screenshot({ path: resolve(outputDir, "result-layout-desktop.png"), fullPage: false })
      }
      compactViewportStats.push({ viewport: compactViewport, stats: compactStats })
    }
  }
  await page.close()

  await assertScreenshot(resultPath)
  assertRuntime(resultStats.visible, "Result screen did not remain visible.")
  assertResultFits(resultStats, `${viewport.width}x${viewport.height}`)
  assertRuntime(resultStats.retryText.includes("RUN AGAIN"), "Result retry control is missing.")
  assertRuntime(resultStats.nextText.includes("NEXT RUN"), "Result next control is missing.")
  assertRuntime(resultStats.shareText.includes("SHARE"), "Result share control is missing.")
  assertRuntime(["승리", "패배"].includes(resultStats.koreanTitle) && resultStats.koreanKicker.length > 0, "Result screen is missing its Korean half of the bilingual hierarchy.")
  assertRuntime(resultStats.retryFullyVisible, "Result retry control is clipped in the viewport.")
  assertRuntime(resultStats.nextFullyVisible, "Result next control is clipped in the viewport.")
  assertRuntime(resultStats.shareFullyVisible, "Result share control is clipped in the viewport.")
  assertRuntime(resultStats.shareStatus.includes("바로 Go 스쿼드") || resultStats.shareStatus.includes("COPIED") || resultStats.shareStatus.includes("SHARED"), "Result share control did not expose share feedback.")
  assertRuntime(resultStats.rank.length > 0 && resultStats.report.length > 0, "Result debrief is incomplete.")
  if (!resultLayoutOnly) {
    assertRuntime(runMs >= minRunMs, `Full run ended too quickly: ${runMs}ms.`)
    assertRuntime(runMs <= maxRunMs, `Full run took too long: ${runMs}ms.`)
    assertRuntime(resultStats.title === "VICTORY", `Full run did not end in victory: ${resultStats.title}`)
    assertRuntime(resultStats.koreanTitle === "승리", "Victory result is missing its Korean victory title.")
    assertRuntime(parseNumber(resultStats.summary) >= minSurvivors, "Victory summary does not report surviving soldiers.")
    assertRuntime(parseNumber(resultStats.stats) >= minKilledEnemies, `Result did not report at least ${minKilledEnemies} enemies cleared.`)
  }

  return { resultPath, runMs, resultStats, compactViewportStats }
}

async function captureQualitySlice(browser, baseUrl, plan) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}?quality=${plan.level}&qaSpeed=3`, { waitUntil: "networkidle" })
  await startRun(page)
  await page.waitForTimeout(12600)
  const screenshotPath = resolve(outputDir, plan.screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const combatStats = await readCombatStats(page)
  await page.close()

  await assertScreenshot(screenshotPath)
  assertRuntime(parseNumber(combatStats.progress) >= 15, `${plan.level} quality did not reach combat progress.`)
  assertRuntime(parseNumber(combatStats.kills) >= minQualityCombatKills, `${plan.level} quality did not register enough combat kills.`)
  if (plan.level === "low") {
    assertRuntime(parseNumber(combatStats.monsters) >= minLowQualityHorde, `low quality did not preserve ${minLowQualityHorde}+ active horde density.`)
  }
  assertRuntime(combatStats.scrollWidth - combatStats.viewportWidth <= maxMobileOverflowPx, `${plan.level} quality has mobile horizontal overflow.`)
  return { level: plan.level, screenshotPath, combatStats }
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
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  const consoleErrors = []
  const pageErrors = []
  browser = await chromium.launch({ channel: "chrome" })
  browser.on("page", (page) => collectPageErrors(page, consoleErrors, pageErrors))

  const qaPreviewUrl = `${previewUrl}?qaSpeed=3&qaSoldiers=30`
  const mobileResult = await runToVictory(browser, qaPreviewUrl, { width: 390, height: 844 }, "fullrun-qa-mobile-result.png")
  const desktopResult = resultLayoutOnly
    ? null
    : await runToVictory(browser, qaPreviewUrl, { width: 1280, height: 720 }, "fullrun-qa-desktop-result.png")
  const qualityCaptures = []
  if (!resultLayoutOnly) {
    for (const plan of qualityCapturePlans) {
      qualityCaptures.push(await captureQualitySlice(browser, previewUrl, plan))
    }
  }
  await closeBrowser(browser)
  browser = undefined

  assertRuntime(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertRuntime(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)

  console.info(JSON.stringify({ mobileResult, desktopResult, qualityCaptures }, null, 2))
} finally {
  if (browser !== undefined) {
    await closeBrowser(browser)
  }
  cleanup()
}
