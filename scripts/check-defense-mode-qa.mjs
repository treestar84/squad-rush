import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotPath = resolve(outputDir, "defense-mode-wave-desktop.png")
const captureMs = 22000
const minOpeningDefenseMonsters = 44
const maxOpeningDefenseMonsters = 66
const minEarlyDefenseMonsters = 240
const maxEarlyDefenseMonsters = 360
const maxSquadZDrift = 0.35
const minProgressAdvance = 8
const minScreenshotBytes = 50000
const expectedDefenseContentScrollSpeed = 1.6
const expectedCurveSpawnDensityMultiplier = 1
const expectedCurveHealthMultiplier = 1.04
const maxOpeningProgressPercent = 10

async function assertSquadAssetContracts() {
  const squadSource = await readFile("src/game/systems/SquadSystem.ts", "utf8")
  assertQa(squadSource.match(/case UNIT_TYPES\.pangyo:[\s\S]*?return "pangyo"/) !== null, "Pangyo units must render through the authored Pangyo runner asset, not the soldier mesh.")
  assertQa(!squadSource.includes("createPangyoActorVisual(index: number)") || !squadSource.match(/createPangyoActorVisual[\s\S]*?attachSoldierHeadMarkers[\s\S]*?return \{ mesh, runAnimation \}/), "Pangyo runner visuals must not receive soldier head marker overlays.")
}

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
  assertQa(file.size >= minScreenshotBytes, `Defense mode screenshot is too small: ${path}`)
}

async function readDefenseState(page) {
  return page.evaluate(() => ({
    mode: window.__squadRushGameModeDebug?.mode ?? "",
    squadX: window.__squadRushGameModeDebug?.squadX ?? 0,
    squadZ: window.__squadRushGameModeDebug?.squadZ ?? 0,
    progressZ: window.__squadRushGameModeDebug?.progressZ ?? 0,
    contentScrollSpeed: window.__squadRushGameModeDebug?.contentScrollSpeed ?? 0,
    roster: window.__squadRushGameModeDebug?.roster ?? [],
    activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
    midBosses: window.__squadRushMonsterDebug?.midBosses ?? 0,
    nearestMonsterDistance: window.__squadRushMonsterDebug?.nearestDistance ?? Number.POSITIVE_INFINITY,
    spawnDensityMultiplier: window.__squadRushMonsterDebug?.spawnDensityMultiplier ?? 0,
    healthMultiplier: window.__squadRushMonsterDebug?.healthMultiplier ?? 0,
    maxActivePressure: window.__squadRushMonsterDebug?.maxActivePressure ?? 0,
    defenseCarpet: window.__squadRushMonsterDebug?.defenseCarpet ?? null,
    openingGrace: window.__squadRushMonsterDebug?.openingGrace ?? null,
    promotionTreeEnabled: window.__squadRushGameModeDebug?.promotionTreeEnabled ?? true,
    defenseProgression: window.__squadRushGameModeDebug?.defenseProgression ?? null,
    squadLimit: window.__squadRushDebug?.stats?.squadLimit ?? 0,
    gates: window.__squadRushDebug?.gates ?? [],
    pickupTrack: window.__squadRushPickupDebug ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
}

function countRoster(roster, label) {
  return roster.find((entry) => entry.label === label)?.count ?? 0
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
  await assertSquadAssetContracts()
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  const consoleErrors = []
  const pageErrors = []
  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${previewUrl}?mode=defense&difficulty=easy&quality=high&qa=monsters&qa=advanced&qa=pickups`, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => window.__squadRushGameModeDebug?.mode === "defense", null, { timeout: captureMs })
  const startState = await readDefenseState(page)
  await page.keyboard.down("ArrowRight")
  await page.waitForFunction(() => (window.__squadRushMonsterDebug?.active ?? 0) >= 44, null, { timeout: captureMs })
  const openingState = await readDefenseState(page)
  try {
    await page.waitForFunction(() => {
      const roster = window.__squadRushGameModeDebug?.roster ?? []
      return (roster.find((entry) => entry.label === "병사")?.count ?? 0) >= 3
    }, null, { timeout: captureMs })
  } catch (error) {
    const state = await readDefenseState(page)
    throw new Error(`Timed out collecting the opening +1 track. Last state: ${JSON.stringify(state)}. ${error instanceof Error ? error.message : String(error)}`)
  }
  await page.keyboard.up("ArrowRight")
  const pickupState = await readDefenseState(page)
  await page.waitForFunction(() => (window.__squadRushMonsterDebug?.active ?? 0) >= 240, null, { timeout: captureMs })
  await page.waitForFunction(() => {
    const debug = window.__squadRushGameModeDebug
    return debug !== undefined && debug.progressZ - debug.squadZ >= 8
  }, null, { timeout: captureMs })

  const earlyState = await readDefenseState(page)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await browser.close()
  browser = undefined

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(countRoster(startState.roster, "판교인") === 0, `Defense should reserve Pangyo for automatic specialist promotion: ${JSON.stringify(startState.roster)}`)
  assertQa(countRoster(startState.roster, "병사") === 1, `Defense should start with one soldier: ${JSON.stringify(startState.roster)}`)
  assertQa(startState.gates.length === 0, `Defense must remove the old one-shot center gates: ${JSON.stringify(startState.gates)}`)
  assertQa(startState.promotionTreeEnabled === false, "Defense must disable the automatic combination tree.")
  assertQa(startState.squadLimit === 20, `Defense active squad limit must be 20: ${startState.squadLimit}`)
  assertQa(startState.defenseProgression?.enabled === true, `Defense reserve progression must be enabled: ${JSON.stringify(startState.defenseProgression)}`)
  assertQa(startState.defenseProgression?.promotionCost === 10, `Defense reserve promotion must cost 10 unemployed: ${JSON.stringify(startState.defenseProgression)}`)
  assertQa(startState.defenseProgression?.reserveUnemployed === 0, `Defense reserve should start empty: ${JSON.stringify(startState.defenseProgression)}`)
  assertQa(startState.pickupTrack?.defenseTrack === true, `Defense +1 side track did not initialize: ${JSON.stringify(startState.pickupTrack)}`)
  assertQa((startState.pickupTrack?.scheduledCount ?? 0) >= 100, `Defense side track needs many sequential +1 cells: ${JSON.stringify(startState.pickupTrack)}`)
  assertQa(countRoster(pickupState.roster, "병사") >= 3, `Defense opening +1 track did not build the squad: ${JSON.stringify(pickupState.roster)}`)
  assertQa((pickupState.progressZ / 380) * 100 <= maxOpeningProgressPercent, `Defense +1 track payoff arrived after opening 10%: ${pickupState.progressZ}`)
  assertQa(openingState.midBosses === 0, `Defense opening 10% should not spawn giant Doguri: ${openingState.midBosses}`)
  assertQa((openingState.progressZ / 380) * 100 <= maxOpeningProgressPercent, `Defense opening boss lock was sampled after 10%: ${openingState.progressZ}`)
  assertQa(openingState.activeMonsters >= minOpeningDefenseMonsters, `Defense opening monster pressure too low: ${openingState.activeMonsters}`)
  assertQa(openingState.activeMonsters <= maxOpeningDefenseMonsters, `Defense opening monster pressure front-loaded too high: ${openingState.activeMonsters}`)
  assertQa(openingState.openingGrace?.active === true, `Defense must begin with a five-second grace window: ${JSON.stringify(openingState.openingGrace)}`)
  assertQa((openingState.openingGrace?.remainingSeconds ?? 0) > 0, `Defense opening grace expired too early: ${JSON.stringify(openingState.openingGrace)}`)
  assertQa(openingState.maxActivePressure === maxOpeningDefenseMonsters, `Defense opening pressure must stay at ${maxOpeningDefenseMonsters}: ${openingState.maxActivePressure}`)
  assertQa(openingState.nearestMonsterDistance >= 15, `Defense opening monsters spawned too close: ${openingState.nearestMonsterDistance}`)
  assertQa(openingState.defenseCarpet?.columns === 11, `Defense opening did not cover all road columns: ${JSON.stringify(openingState.defenseCarpet)}`)
  assertQa(earlyState.mode === "defense", "Defense mode was not active.")
  assertQa(Math.abs(earlyState.squadZ - 10) <= maxSquadZDrift, `Defense squad drifted forward: ${earlyState.squadZ}`)
  assertQa(
    Math.abs(earlyState.contentScrollSpeed - expectedDefenseContentScrollSpeed) < 0.01,
    `Defense content scroll speed should be reduced to ${expectedDefenseContentScrollSpeed}: ${earlyState.contentScrollSpeed}`,
  )
  assertQa(earlyState.progressZ - earlyState.squadZ >= minProgressAdvance, "Defense progress did not advance while squad stayed fixed.")
  assertQa(earlyState.activeMonsters >= minEarlyDefenseMonsters, `Defense early monster pressure too low: ${earlyState.activeMonsters}`)
  assertQa(earlyState.activeMonsters <= maxEarlyDefenseMonsters, `Defense early monster pressure too high: ${earlyState.activeMonsters}`)
  assertQa(earlyState.openingGrace?.active === false, `Defense five-second opening grace did not finish: ${JSON.stringify(earlyState.openingGrace)}`)
  assertQa(earlyState.maxActivePressure >= 300, `Defense pressure did not recover after the opening grace: ${earlyState.maxActivePressure}`)
  assertQa((earlyState.defenseCarpet?.occupiedRows ?? 0) >= 20, `Defense road is not packed with enough descending rows: ${JSON.stringify(earlyState.defenseCarpet)}`)
  assertQa(
    earlyState.spawnDensityMultiplier === expectedCurveSpawnDensityMultiplier,
    `Defense spawn density should be curve-count driven: ${earlyState.spawnDensityMultiplier}`,
  )
  assertQa(earlyState.healthMultiplier === expectedCurveHealthMultiplier, `Defense health should be curve-HP driven: ${earlyState.healthMultiplier}`)
  assertQa(earlyState.nearestMonsterDistance < 40, `Defense opening did not keep a nearby threat: ${earlyState.nearestMonsterDistance}`)
  assertQa(earlyState.scrollWidth <= earlyState.viewportWidth, "Defense mode start/game UI has horizontal overflow.")

  console.info(JSON.stringify({ screenshotPath, startState, pickupState, openingState, earlyState }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
