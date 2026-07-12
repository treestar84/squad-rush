import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotPath = resolve(outputDir, "defense-squad-progression-desktop.png")
const readyTimeoutMs = 45000

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
    const request = get(url, (response) => {
      response.resume()
      resolveOk((response.statusCode ?? 500) < 500)
    })
    request.on("error", () => resolveOk(false))
    request.setTimeout(750, () => {
      request.destroy()
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

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

async function captureScenario(browser, previewUrl, qaSoldiers, takeScreenshot = false) {
  const consoleErrors = []
  const pageErrors = []
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  collectPageErrors(page, consoleErrors, pageErrors)
  await page.goto(
    `${previewUrl}?mode=defense&difficulty=easy&quality=high&qa=monsters&qaSoldiers=${qaSoldiers}&qaNoDamage=1&qaSpeed=0.2`,
    { waitUntil: "networkidle" },
  )
  await clickStartButton(page, readyTimeoutMs)
  await page.waitForFunction(() => {
    const debug = window.__squadRushGameModeDebug
    return debug?.mode === "defense"
      && debug.defenseProgression?.enabled === true
      && debug.roster.reduce((total, entry) => total + entry.count, 0) === 20
  }, null, { timeout: readyTimeoutMs })

  const state = await page.evaluate(() => {
    const debug = window.__squadRushGameModeDebug
    const roster = Object.fromEntries((debug?.roster ?? []).map((entry) => [entry.label, entry.count]))
    const reservePanel = document.querySelector("[data-role='defense-reserve']")
    const reserveCount = document.querySelector("[data-role='defense-reserve-count']")
    const reserveNext = document.querySelector("[data-role='defense-reserve-next']")
    const careerPanel = document.querySelector("[data-role='career-choice']")
    return {
      roster,
      activeCount: Object.values(roster).reduce((total, count) => total + Number(count), 0),
      progression: debug?.defenseProgression ?? null,
      combat: debug?.combat ?? null,
      promotionTreeEnabled: debug?.promotionTreeEnabled ?? true,
      reservePanelVisible: reservePanel instanceof HTMLElement
        && getComputedStyle(reservePanel).display !== "none"
        && reservePanel.getAttribute("aria-hidden") === "false",
      reserveCountText: reserveCount?.textContent ?? "",
      reserveNextText: reserveNext?.textContent ?? "",
      careerPanelHidden: careerPanel?.getAttribute("aria-hidden") === "true",
      visiblePromotionEvents: document.querySelectorAll(".hud-promotion-event").length,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  if (takeScreenshot) {
    await page.screenshot({ path: screenshotPath, fullPage: false })
  }
  await page.close()
  assertQa(consoleErrors.length === 0, `Console errors for qaSoldiers=${qaSoldiers}: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors for qaSoldiers=${qaSoldiers}: ${pageErrors.join(" | ")}`)
  return state
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
  browser = await chromium.launch({ channel: "chrome" })

  // 1 starter + 29 QA reinforcements = 20 active, 10 overflow, one specialist,
  // and one unemployed refunded by the displaced soldier.
  const firstPromotion = await captureScenario(browser, previewUrl, 29)
  assertQa(firstPromotion.activeCount === 20, `Active defense squad must stay at 20: ${JSON.stringify(firstPromotion)}`)
  assertQa(firstPromotion.roster["병사"] === 19, `First promotion must replace exactly one soldier: ${JSON.stringify(firstPromotion.roster)}`)
  assertQa(firstPromotion.roster["판교인"] === 1, `The deterministic first specialist must be Pangyo: ${JSON.stringify(firstPromotion.roster)}`)
  assertQa((firstPromotion.roster["백수"] ?? 0) === 0, `Reserve unemployed must not enter the active roster: ${JSON.stringify(firstPromotion.roster)}`)
  assertQa(firstPromotion.progression?.reserveUnemployed === 1, `Displaced soldier must refund one unemployed: ${JSON.stringify(firstPromotion.progression)}`)
  assertQa(firstPromotion.progression?.promotionCost === 10, `Automatic promotion cost must be 10: ${JSON.stringify(firstPromotion.progression)}`)
  assertQa(firstPromotion.progression?.promotionCount === 1, `First overflow should resolve one promotion: ${JSON.stringify(firstPromotion.progression)}`)
  assertQa(firstPromotion.progression?.nextUnitLabel === "개발자", `The smaller technology branch must be next: ${JSON.stringify(firstPromotion.progression)}`)
  assertQa(firstPromotion.reservePanelVisible, "The unemployed reserve panel must be visible on the right side.")
  assertQa(firstPromotion.reserveCountText === "1/10", `Reserve HUD must show 1/10: ${firstPromotion.reserveCountText}`)
  assertQa(firstPromotion.reserveNextText.includes("개발자"), `Reserve HUD must preview Developer: ${firstPromotion.reserveNextText}`)
  assertQa(firstPromotion.careerPanelHidden, "The manual Gate Attack career panel must stay hidden in defense.")
  assertQa(firstPromotion.promotionTreeEnabled === false, "The shared Gate Attack combination tree must stay disabled.")
  assertQa(Math.abs((firstPromotion.combat?.effectiveAttackPower ?? 0) - 30.5) < 0.001, `First specialist must increase power from the 20-soldier baseline: ${JSON.stringify(firstPromotion.combat)}`)

  // A large deterministic injection exercises both complete upper-tier ladders.
  const fullTree = await captureScenario(browser, previewUrl, 200, true)
  assertQa(fullTree.activeCount === 20, `Upper-tier progression must preserve 20 active units: ${JSON.stringify(fullTree)}`)
  assertQa((fullTree.roster["병사"] ?? 0) === 0, `Twenty specialist replacements should remove all soldiers: ${JSON.stringify(fullTree.roster)}`)
  assertQa((fullTree.roster["백수"] ?? 0) === 0, `Reserve unemployed must remain outside the active roster: ${JSON.stringify(fullTree.roster)}`)
  const command = fullTree.progression?.branches.find((branch) => branch.id === "command")
  const technology = fullTree.progression?.branches.find((branch) => branch.id === "technology")
  assertQa(command?.base === 2 && command.middle === 2 && command.top === 6, `Command ladder did not resolve 2/2/6: ${JSON.stringify(command)}`)
  assertQa(technology?.base === 2 && technology.middle === 2 && technology.top === 6, `Technology ladder did not resolve 2/2/6: ${JSON.stringify(technology)}`)
  assertQa(fullTree.progression?.reserveUnemployed === 1, `Repeated full-squad swaps must preserve the final refund: ${JSON.stringify(fullTree.progression)}`)
  assertQa(fullTree.progression?.promotionCount === 48, `Expected 20 specialist joins plus 28 upper-tier transfers: ${JSON.stringify(fullTree.progression)}`)
  assertQa(fullTree.progression?.nextUnitLabel === "장교", `A fully specialized squad must preview direct command training: ${JSON.stringify(fullTree.progression)}`)
  assertQa(Math.abs((fullTree.combat?.effectiveAttackPower ?? 0) - 120) < 0.001, `Full specialist tree must produce monotonic 120 power: ${JSON.stringify(fullTree.combat)}`)
  assertQa((fullTree.combat?.effectiveAttackPower ?? 0) > (firstPromotion.combat?.effectiveAttackPower ?? 0), "Upper-tier progression must never reduce total power.")
  assertQa(fullTree.combat?.projectileCount === 8, `Defense specialist power must remain aggregated into eight emitters: ${JSON.stringify(fullTree.combat)}`)
  assertQa(fullTree.reserveCountText === "1/10", `Full-tree reserve HUD must stay synchronized: ${fullTree.reserveCountText}`)
  assertQa(fullTree.reserveNextText.includes("장교"), `Full-tree reserve HUD must preview Officer training: ${fullTree.reserveNextText}`)
  assertQa(fullTree.visiblePromotionEvents <= 3, `Promotion feedback must stay visually bounded: ${fullTree.visiblePromotionEvents}`)
  assertQa(fullTree.scrollWidth <= fullTree.viewportWidth, "Defense progression HUD must not create horizontal overflow.")

  // Once all soldiers are gone, more reserve promotions must keep improving
  // specialists instead of replacing a base unit with the same base unit.
  const refinement = await captureScenario(browser, previewUrl, 220)
  const refinedCommand = refinement.progression?.branches.find((branch) => branch.id === "command")
  const refinedTechnology = refinement.progression?.branches.find((branch) => branch.id === "technology")
  assertQa(refinedCommand?.base === 1 && refinedCommand.middle === 2 && refinedCommand.top === 7, `Command refinement stalled: ${JSON.stringify(refinedCommand)}`)
  assertQa(refinedTechnology?.base === 1 && refinedTechnology.middle === 2 && refinedTechnology.top === 7, `Technology refinement stalled: ${JSON.stringify(refinedTechnology)}`)
  assertQa(refinement.progression?.reserveUnemployed === 1, `Post-soldier refinement reserve mismatch: ${JSON.stringify(refinement.progression)}`)
  assertQa(refinement.progression?.promotionCount === 52, `Post-soldier refinement should include both direct and cascade promotions: ${JSON.stringify(refinement.progression)}`)
  assertQa(Math.abs((refinement.combat?.effectiveAttackPower ?? 0) - 132) < 0.001, `Post-soldier training must keep increasing power: ${JSON.stringify(refinement.combat)}`)
  assertQa((refinement.combat?.effectiveAttackPower ?? 0) > (fullTree.combat?.effectiveAttackPower ?? 0), "Post-soldier reserve training must not stall or reduce power.")

  const maxedTree = await captureScenario(browser, previewUrl, 300)
  const maxedCommand = maxedTree.progression?.branches.find((branch) => branch.id === "command")
  const maxedTechnology = maxedTree.progression?.branches.find((branch) => branch.id === "technology")
  assertQa(maxedCommand?.base === 0 && maxedCommand.middle === 0 && maxedCommand.top === 10, `Command final tier did not max out: ${JSON.stringify(maxedCommand)}`)
  assertQa(maxedTechnology?.base === 0 && maxedTechnology.middle === 0 && maxedTechnology.top === 10, `Technology final tier did not max out: ${JSON.stringify(maxedTechnology)}`)
  assertQa(maxedTree.progression?.maxed === true, `Final specialist tree must report maxed: ${JSON.stringify(maxedTree.progression)}`)
  assertQa(maxedTree.progression?.reserveUnemployed === 21, `Maxed tree must stop consuming reserve: ${JSON.stringify(maxedTree.progression)}`)
  assertQa(maxedTree.progression?.promotionCount === 60, `Maxed tree promotion count mismatch: ${JSON.stringify(maxedTree.progression)}`)
  assertQa(Math.abs((maxedTree.combat?.effectiveAttackPower ?? 0) - 160) < 0.001, `Twenty final-tier specialists must produce 160 power: ${JSON.stringify(maxedTree.combat)}`)
  assertQa(maxedTree.reserveCountText === "예비 21", `Maxed reserve HUD should stop showing a consumable fraction: ${maxedTree.reserveCountText}`)
  assertQa(maxedTree.reserveNextText === "최종 전직 완료", `Maxed reserve HUD label mismatch: ${maxedTree.reserveNextText}`)

  const screenshot = await stat(screenshotPath)
  assertQa(screenshot.size >= 30000, `Defense progression screenshot is too small: ${screenshotPath}`)
  console.info(JSON.stringify({ screenshotPath, firstPromotion, fullTree, refinement, maxedTree }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
