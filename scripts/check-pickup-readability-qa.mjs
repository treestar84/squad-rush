import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { analyzePngFile } from "./lib/pngMetrics.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const pickupFlightTimeoutMs = 12000
const minScreenshotBytes = 45000
const minColorBuckets = 85
const minEdgeDensity = 0.035

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

async function readStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      progress: textOf("[data-role='stage']"),
      kills: textOf("[data-role='kills']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      pickupDebug: window.__squadRushPickupDebug ?? null,
      recordedFlights: window.__pickupRewardFlights ?? [],
    }
  })
}

async function capturePickupMode(browser, previewUrl, mode, screenshotName) {
  const consoleErrors = []
  const pageErrors = []
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  const monsterQa = mode === "defense" ? "&qa=monsters" : ""
  await page.goto(`${previewUrl}?mode=${mode}&quality=medium&qa=pickups${monsterQa}&qaSpeed=3`, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    window.__pickupRewardFlights = []
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLImageElement && node.classList.contains("career-choice-flight")) {
            window.__pickupRewardFlights?.push({ alt: node.alt, src: node.getAttribute("src") ?? "" })
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await page.locator(".tap-to-start").click()
  if (mode === "defense") {
    await page.keyboard.down("ArrowRight")
    await page.waitForFunction(() => {
      const roster = window.__squadRushGameModeDebug?.roster ?? []
      return (roster.find((entry) => entry.label === "병사")?.count ?? 0) >= 2
    }, null, { timeout: pickupFlightTimeoutMs })
    await page.keyboard.up("ArrowRight")
  } else {
    await page.waitForFunction(() => {
      const flights = window.__pickupRewardFlights ?? []
      return flights.filter((flight) => flight.alt === "판교인").length >= 2
    }, null, { timeout: pickupFlightTimeoutMs })
  }
  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readStats(page)
  await page.close()

  const metrics = await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `${mode} console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `${mode} page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= 0, `${mode} pickup capture has horizontal overflow.`)
  assertQa(parseNumber(stats.progress) >= 6, `${mode} pickup capture did not reach the mixed combat lane.`)
  assertQa(stats.pickupDebug !== null, `${mode} pickup debug state was not exposed.`)
  assertQa(stats.pickupDebug.active >= 1, `${mode} no active pickup was present during the combat capture.`)
  assertQa(stats.pickupDebug.nearestDistance <= 45, `${mode} nearest pickup was not readable in the combat camera window.`)
  if (mode === "defense") {
    assertQa(stats.pickupDebug.defenseTrack === true, "Defense must expose the sequential side reinforcement track.")
    assertQa(stats.pickupDebug.scheduledCount >= 100, `Defense needs many +1 track cells: ${stats.pickupDebug.scheduledCount}`)
    assertQa(stats.pickupDebug.defenseGateUpright === true, "Defense +1 track gates must stand vertically.")
    assertQa(stats.pickupDebug.childNames.some((name) => name.includes("defense_track_gate_panel")), "Defense +1 track upright panel is missing.")
    assertQa(!stats.pickupDebug.childNames.some((name) => name.includes("defense_track_floor")), "Defense +1 track must not use the old floor tile visual.")
    assertQa(stats.pickupDebug.childNames.some((name) => name.includes("defense_track_gate_panel_label")), "Defense +1 track combined panel label is missing.")
    assertQa(stats.pickupDebug.activeRenderMeshes <= stats.pickupDebug.active, `Defense gates must use one render mesh each: ${JSON.stringify(stats.pickupDebug)}`)
    assertQa(stats.recordedFlights.length === 0, `Compact defense rewards must not cover combat with portrait cards: ${JSON.stringify(stats.recordedFlights)}`)
  } else {
    assertQa(stats.pickupDebug.rewardRatio.pangyo === 18, `${mode} runtime pickup ratio must expose 90% Pangyo.`)
    assertQa(stats.pickupDebug.rewardRatio.soldier === 2, `${mode} runtime pickup ratio must expose 10% soldier.`)
    assertQa(stats.pickupDebug.childNames.some((name) => name.includes("pickup_unit_reward")), `${mode} active pickup lacks the character reward visual.`)
    assertQa(stats.pickupDebug.childNames.some((name) => name.includes("squad_unit_head_marker_blackHair")), `${mode} active Pangyo pickup lacks the black-hair Pangyo marker.`)
    assertQa(stats.pickupDebug.childNames.some((name) => name.includes("pickup_reward_beam")), `${mode} active pickup lacks the reward beam.`)
    assertQa(stats.pickupDebug.childNames.some((name) => name.includes("pickup_orb_shell")), `${mode} active pickup lacks the rotating reward shell.`)
    assertQa(
      stats.recordedFlights.filter((flight) => flight.alt === "판교인" && flight.src.includes("/assets/ui/portraits/pangyo.png")).length >= 2,
      `${mode} pickup collection did not emit grouped Pangyo portrait flights: ${JSON.stringify(stats.recordedFlights)}`,
    )
  }
  return { mode, screenshotPath, stats, metrics }
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `Pickup readability screenshot is too small: ${path}`)
  const metrics = await analyzePngFile(path, "pickup readability capture")
  assertQa(metrics.colorBuckets >= minColorBuckets, `Pickup capture color buckets too low: ${metrics.colorBuckets}`)
  assertQa(metrics.edgeDensity >= minEdgeDensity, `Pickup capture edge density too low: ${metrics.edgeDensity}`)
  return metrics
}

const pickupText = await readFile("src/game/systems/BonusPickupSystem.ts", "utf8")
const pickupSoldierText = await readFile("src/game/systems/PickupSoldierVisual.ts", "utf8")
const pickupScheduleText = await readFile("src/game/systems/BonusPickupSchedule.ts", "utf8")
assertQa(!pickupText.includes("pickupSupplyShellMat"), "Fixed supply-shell box pickup visuals must stay unused.")
assertQa(!pickupText.includes("pickup_reward_gem"), "Fixed box reward gem pickup visuals must stay unused.")
assertQa(!pickupText.includes("pickup_crate"), "Fixed crate pickup visuals must stay unused.")
assertQa(!pickupText.includes("pickup_supply_band"), "Fixed supply-band pickup visuals must stay unused.")
assertQa(pickupText.includes("createPickupUnitVisual"), "Reward pickups must use a character reward visual.")
assertQa(pickupText.includes("pickup_unit_reward"), "Reward pickups must name the reward unit visual for QA.")
assertQa(pickupText.includes("pickup_orb_shell"), "Active random pickups must keep the rotating reward shell.")
assertQa(pickupText.includes("`${definition.label}+${count}`"), "Pickup field labels must use full character names.")
assertQa(pickupText.includes("`${definition.label}+${addedCount}`"), "Pickup HUD popups must use full character names.")
assertQa(!pickupText.includes("`${definition.shortLabel}+${count}`"), "Pickup field labels must not use short character names.")
assertQa(!pickupText.includes("`${definition.shortLabel}+${addedCount}`"), "Pickup HUD popups must not use short character names.")
assertQa(pickupSoldierText.includes("Idle"), "Soldier gain pickups must use the idle soldier animation.")
assertQa(pickupSoldierText.includes("attachSoldierHeadMarkers"), "Pangyo pickups must attach the shared head marker kit.")
assertQa(pickupSoldierText.includes("applySoldierUnitVisual"), "Pangyo pickups must apply shared unit visual styling.")
assertQa(pickupText.includes("__squadRushPickupDebug"), "Pickup browser QA debug state is missing.")
assertQa(pickupScheduleText.includes("pangyo: 18"), "Pickup schedule must preserve the 90% Pangyo ratio.")
assertQa(pickupScheduleText.includes("soldier: 2"), "Pickup schedule must preserve the 10% soldier ratio.")

const designText = await readFile("DESIGN.md", "utf8")
assertQa(designText.includes("idle soldier silhouette"), "DESIGN.md must document soldier reward pickup readability.")
assertQa(designText.includes("Fixed floor box/crate reward pickups stay unused"), "DESIGN.md must document fixed box pickup deactivation.")

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
  const attack = await capturePickupMode(browser, previewUrl, "run", "pickup-readability-mobile-combat.png")
  const defense = await capturePickupMode(browser, previewUrl, "defense", "pickup-readability-mobile-defense.png")
  await browser.close()
  browser = undefined

  console.info(JSON.stringify({ attack, defense }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
