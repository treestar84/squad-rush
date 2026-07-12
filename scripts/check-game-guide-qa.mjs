import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const minScreenshotBytes = 50000

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
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
  assertQa(file.size >= minScreenshotBytes, `Game guide screenshot is too small: ${path}`)
}

async function clickGuideUnit(page, label) {
  await page.locator(".game-guide-unit").evaluateAll((cards, unitLabel) => {
    const target = cards.find((card) => card.querySelector("strong")?.textContent === unitLabel)
    if (!(target instanceof HTMLElement)) {
      throw new Error(`Missing guide unit: ${unitLabel}`)
    }
    target.click()
  }, label)
}

const guideSource = await readFile("src/ui/GameGuide.ts", "utf8")
const guideDataSource = await readFile("src/ui/GameGuideData.ts", "utf8")
const guideDetailSource = await readFile("src/ui/GameGuideDetailView.ts", "utf8")
const startSource = await readFile("src/ui/StartScreen.ts", "utf8")
const styleSource = await readFile("src/styles/global.css", "utf8")
const designSource = await readFile("DESIGN.md", "utf8")

assertQa(startSource.includes("new GameGuide"), "Start screen must mount the game guide.")
assertQa(startSource.includes("gameGuide.trigger"), "Start screen animation must include the guide trigger.")
assertQa(guideDataSource.includes("백수 5명은 CEO 또는 게이머"), "Guide must explain the random unemployed branch.")
assertQa(guideSource.includes("selectedUnit"), "Guide must expose a selected-unit detail panel.")
assertQa(guideDetailSource.includes("game-guide-requirement-icons"), "Guide must render promotion requirements as small portrait icons.")
assertQa(guideDataSource.includes("80%"), "Guide must explain the CEO-heavy unemployed branch odds.")
assertQa(guideSource.includes("getGuidePortraitSource"), "Guide must render dedicated character portraits.")
assertQa(guideSource.includes("FIREPOWER"), "Guide must show character firepower as tactical dossier data.")
assertQa(styleSource.includes(".game-guide-button"), "Guide trigger styling is missing.")
assertQa(styleSource.includes(".game-guide-panel"), "Large guide panel styling is missing.")
assertQa(styleSource.includes(".game-guide-unit--selected"), "Selected guide unit styling is missing.")
assertQa(styleSource.includes(".game-guide-requirement-icon"), "Requirement portrait icon styling is missing.")
assertQa(guideDataSource.includes("/assets/ui/portraits/tactical/"), "Guide must use its dedicated realistic tactical portraits.")
assertQa(styleSource.includes("--tier-color: #f59e0b") && styleSource.includes("--tier-color: #d4d4d8") && styleSource.includes("--tier-color: #a1a1aa"), "Guide tiers must use the neutral gray and restrained amber command palette.")
assertQa(styleSource.includes(".game-guide-unit strong {\n  color: #f4f4f5;"), "Guide character names must use neutral dossier text.")
assertQa(styleSource.includes(".game-guide-detail-header h3 {\n  margin: 0;\n  color: #f4f4f5;"), "Guide detail character name must use neutral dossier text.")
assertQa(styleSource.includes(".game-guide-unit span {\n  margin-top: 2px;\n  color: #a1a1aa;"), "Guide firepower meta text must use neutral gray.")
assertQa(styleSource.includes(".game-guide-detail-header span:not(.game-guide-detail-eyebrow)"), "Guide detail meta text needs a separate neutral dossier style.")
assertQa(styleSource.includes("rgba(63, 63, 70, 0.99)") && styleSource.includes("rgba(39, 39, 42, 0.99)"), "Guide panel must match the neutral Command Center surface.")
assertQa(styleSource.includes("filter: grayscale(0.82)"), "Guide portraits must receive a restrained dossier treatment.")
assertQa(!guideSource.includes("--unit-color"), "Game guide must not inject per-character colors into internal text styles.")
assertQa(!guideDetailSource.includes("--unit-color"), "Game guide detail must not inject per-character colors into internal text styles.")
assertQa(guideSource.includes("game-guide-rules-toggle"), "Core rules must be opened through a guide-panel button.")
assertQa(designSource.includes("게임 가이드"), "DESIGN.md must document the main-screen game guide.")
assertQa(designSource.includes("백수 5명은 CEO 또는 게이머"), "DESIGN.md must document the random unemployed branch.")
assertQa(designSource.includes("8:2"), "DESIGN.md must document the CEO-to-gamer branch ratio.")

const tacticalPortraitPaths = [
  "pangyo",
  "unemployed",
  "soldier",
  "developer",
  "officer",
  "general",
  "senior-developer",
  "ceo",
  "gamer",
].map((name) => `public/assets/ui/portraits/tactical/${name}.webp`)
const tacticalPortraitBytes = (await Promise.all(tacticalPortraitPaths.map(async (path) => (await stat(path)).size)))
  .reduce((total, size) => total + size, 0)
assertQa(tacticalPortraitBytes <= 64 * 1024, `Tactical guide portraits exceed 64KB: ${tacticalPortraitBytes}`)

if (process.env["GAME_GUIDE_STATIC_ONLY"] === "1") {
  console.info(JSON.stringify({ gameGuideStatic: "passed", tacticalPortraitBytes }, null, 2))
  process.exit(0)
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await page.locator(".game-guide-button").click()
  await page.waitForFunction(() => {
    const overlay = document.querySelector(".game-guide-overlay")
    return overlay instanceof HTMLElement && !overlay.hidden && overlay.textContent?.includes("게이머")
  }, null, { timeout: 6000 })
  const initialPanelState = await page.evaluate(() => ({
    detailCardCount: document.querySelectorAll(".game-guide-detail-card").length,
    topTierCards: document.querySelectorAll(".game-guide-unit--tier-1").length,
    tier2Cards: document.querySelectorAll(".game-guide-unit--tier-2").length,
    tier3Cards: document.querySelectorAll(".game-guide-unit--tier-3").length,
    tier4Cards: document.querySelectorAll(".game-guide-unit--tier-4").length,
    rulesHidden: document.querySelector(".game-guide-rules-popover") instanceof HTMLElement
      ? document.querySelector(".game-guide-rules-popover")?.hasAttribute("hidden") === true
      : false,
    rulesButton: document.querySelector(".game-guide-rules-toggle")?.textContent ?? "",
    metaColor: window.getComputedStyle(document.querySelector(".game-guide-unit span") ?? document.body).color,
    bodyColor: window.getComputedStyle(document.querySelector(".game-guide-unit p") ?? document.body).color,
    titleColor: window.getComputedStyle(document.querySelector(".game-guide-unit strong") ?? document.body).color,
  }))
  assertQa(initialPanelState.detailCardCount === 1, "Right guide panel must show only the selected character detail.")
  assertQa(initialPanelState.topTierCards === 4, "Top tier must include general, CEO, gamer, and senior developer.")
  assertQa(initialPanelState.tier2Cards === 1, "Tier 2 must include only officer.")
  assertQa(initialPanelState.tier3Cards === 2, "Tier 3 must include soldier and developer.")
  assertQa(initialPanelState.tier4Cards === 2, "Tier 4 must include Pangyo and unemployed.")
  assertQa(initialPanelState.rulesHidden && initialPanelState.rulesButton.includes("핵심 규칙"), "Core rules must start hidden behind a button.")
  assertQa(initialPanelState.metaColor === "rgb(161, 161, 170)", `Guide meta text must be tactical neutral gray, got ${initialPanelState.metaColor}.`)
  assertQa(initialPanelState.bodyColor === "rgb(212, 212, 216)", `Guide body text must be neutral gray, got ${initialPanelState.bodyColor}.`)
  assertQa(initialPanelState.titleColor === "rgb(244, 244, 245)", `Initial character name must use neutral dossier white, got ${initialPanelState.titleColor}.`)
  await page.locator(".game-guide-rules-toggle").click()
  const rulesOpened = await page.locator(".game-guide-rules-popover").isVisible()
  assertQa(rulesOpened, "Core rules button must reveal the rules panel.")
  await page.locator(".game-guide-rules-toggle").click()

  await clickGuideUnit(page, "개발자")
  const developerDetail = await page.locator(".game-guide-detail-card").textContent()
  assertQa(developerDetail?.includes("개발자") === true, "Right guide panel must update to the clicked developer.")
  assertQa(developerDetail?.includes("효과") === true && developerDetail.includes("전진 속도"), "Developer detail must include its movement-speed effect.")
  assertQa(developerDetail?.includes("개발자 3명 -> 시니어 개발자") === true, "Developer upgrade detail must be a two-step promotion.")
  assertQa(developerDetail?.includes("시니어 -> 시니어") !== true, "Developer upgrade detail has duplicate senior wording.")

  await clickGuideUnit(page, "시니어 개발자")
  const seniorDetail = await page.locator(".game-guide-detail-card").textContent()
  assertQa(seniorDetail?.includes("전체 화력 +20%") === true && seniorDetail.includes("게이머 화력 2배"), "Senior developer detail must include all power effects.")

  await clickGuideUnit(page, "장교")
  const officerDetail = await page.locator(".game-guide-detail-card").textContent()
  assertQa(officerDetail?.includes("장교") === true, "Right guide panel must update to the clicked officer.")
  assertQa(officerDetail?.includes("25초") === true && officerDetail.includes("20/15/10/5초"), "Officer detail must include spawn cadence acceleration.")
  assertQa(officerDetail?.includes("장교 5명 -> 장군") === true, "Officer upgrade detail must point to general once.")
  assertQa(officerDetail?.includes("장군 -> 장군") !== true, "Officer upgrade detail has duplicate general wording.")

  await clickGuideUnit(page, "백수")
  const unemployedDetail = await page.locator(".game-guide-detail-card").textContent()
  assertQa(unemployedDetail?.includes("백수") === true, "Right guide panel must update to the clicked unemployed.")
  assertQa(unemployedDetail?.includes("50%") === true && unemployedDetail.includes("10초"), "Unemployed detail must include its random conversion effect.")
  assertQa(unemployedDetail?.includes("백수 5명 -> CEO 80% / 게이머 20%") === true, "Unemployed upgrade detail must show CEO/gamer odds.")

  await clickGuideUnit(page, "CEO")
  const ceoDetail = await page.locator(".game-guide-detail-card").textContent()
  assertQa(ceoDetail?.includes("30%") === true && ceoDetail.includes("추가 캐릭터"), "CEO detail must include its promotion bonus effect.")

  await clickGuideUnit(page, "게이머")
  const gamerDetail = await page.locator(".game-guide-detail-card").textContent()
  assertQa(gamerDetail?.includes("화력 8") === true && gamerDetail.includes("화력이 2배"), "Gamer detail must include rare high-power effect.")

  await clickGuideUnit(page, "장군")
  const screenshotPath = resolve(outputDir, "game-guide-mobile.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyClientHeight: document.querySelector(".game-guide-body") instanceof HTMLElement ? document.querySelector(".game-guide-body")?.clientHeight ?? 0 : 0,
    bodyScrollHeight: document.querySelector(".game-guide-body") instanceof HTMLElement ? document.querySelector(".game-guide-body")?.scrollHeight ?? 0 : 0,
    mapClientHeight: document.querySelector(".game-guide-map") instanceof HTMLElement ? document.querySelector(".game-guide-map")?.clientHeight ?? 0 : 0,
    mapScrollHeight: document.querySelector(".game-guide-map") instanceof HTMLElement ? document.querySelector(".game-guide-map")?.scrollHeight ?? 0 : 0,
    detailClientHeight: document.querySelector(".game-guide-detail") instanceof HTMLElement ? document.querySelector(".game-guide-detail")?.clientHeight ?? 0 : 0,
    detailScrollHeight: document.querySelector(".game-guide-detail") instanceof HTMLElement ? document.querySelector(".game-guide-detail")?.scrollHeight ?? 0 : 0,
    portraitCount: document.querySelectorAll(".game-guide-unit img").length,
    requirementIconCount: document.querySelectorAll(".game-guide-requirement-icon").length,
    selectedText: document.querySelector(".game-guide-detail-card")?.textContent ?? "",
    text: document.querySelector(".game-guide-panel")?.textContent ?? "",
  }))
  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= 0, "Game guide capture has horizontal overflow.")
  assertQa(stats.bodyScrollHeight <= stats.bodyClientHeight + 1, "Mobile game guide body should not need vertical scrolling.")
  assertQa(stats.mapScrollHeight <= stats.mapClientHeight + 1, "Mobile tech-tree map should fit without vertical scrolling.")
  assertQa(stats.detailScrollHeight <= stats.detailClientHeight + 1, "Mobile selected detail should fit without vertical scrolling.")
  assertQa(stats.portraitCount >= 9, "Game guide did not render enough active character portraits.")
  assertQa(stats.requirementIconCount >= 5, "Selected upper-tier unit must show required lower characters as small portrait icons.")
  assertQa(stats.selectedText.includes("장교") && stats.selectedText.includes("5"), "Selected general detail must show five officer requirements.")
  assertQa(stats.text.includes("CEO") && stats.text.includes("게이머") && stats.text.includes("장군"), "Game guide omitted core tech-tree branches.")
  assertQa(!stats.text.includes("창업가") && !stats.text.includes("QA") && !stats.text.includes("AI"), "Game guide exposed inactive tech-tree units.")

  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await desktopPage.goto(previewUrl, { waitUntil: "networkidle" })
  await desktopPage.locator(".game-guide-button").click()
  await desktopPage.waitForFunction(() => {
    const overlay = document.querySelector(".game-guide-overlay")
    return overlay instanceof HTMLElement && !overlay.hidden && overlay.textContent?.includes("게이머")
  }, null, { timeout: 6000 })
  const desktopScreenshotPath = resolve(outputDir, "game-guide-desktop.png")
  await desktopPage.screenshot({ path: desktopScreenshotPath, fullPage: false })
  const desktopStats = await desktopPage.evaluate(() => {
    const body = document.querySelector(".game-guide-body")
    const map = document.querySelector(".game-guide-map")
    return {
      bodyClientHeight: body instanceof HTMLElement ? body.clientHeight : 0,
      bodyScrollHeight: body instanceof HTMLElement ? body.scrollHeight : 0,
      mapClientHeight: map instanceof HTMLElement ? map.clientHeight : 0,
      mapScrollHeight: map instanceof HTMLElement ? map.scrollHeight : 0,
      detailClientHeight: document.querySelector(".game-guide-detail") instanceof HTMLElement ? document.querySelector(".game-guide-detail")?.clientHeight ?? 0 : 0,
      detailScrollHeight: document.querySelector(".game-guide-detail") instanceof HTMLElement ? document.querySelector(".game-guide-detail")?.scrollHeight ?? 0 : 0,
      laneToneCount: document.querySelectorAll("[class*='game-guide-lane--']").length,
      rulesInitiallyHidden: document.querySelector(".game-guide-rules-popover")?.hasAttribute("hidden") === true,
    }
  })
  await desktopPage.close()
  await browser.close()
  browser = undefined

  await assertScreenshot(desktopScreenshotPath)
  assertQa(desktopStats.bodyScrollHeight <= desktopStats.bodyClientHeight + 1, "Desktop game guide body should not need vertical scrolling.")
  assertQa(desktopStats.mapScrollHeight <= desktopStats.mapClientHeight + 1, "Desktop tech-tree map should fit without vertical scrolling.")
  assertQa(desktopStats.detailScrollHeight <= desktopStats.detailClientHeight + 1, "Desktop selected detail should fit without vertical scrolling.")
  assertQa(desktopStats.laneToneCount >= 4, "Guide lanes must expose distinct color tone classes.")
  assertQa(desktopStats.rulesInitiallyHidden, "Desktop rules panel should be hidden until the guide button is pressed.")

  console.info(JSON.stringify({ screenshotPath, stats: { ...stats, text: stats.text.slice(0, 160) } }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
