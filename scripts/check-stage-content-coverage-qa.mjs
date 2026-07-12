import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const viewport = { width: 1280, height: 720 }
const levelLength = 380
const difficulties = [
  { id: "medium", multiplier: 1.5 },
  { id: "hard", multiplier: 2.1 },
]
const modes = ["run", "defense"]
const sampleRatios = [0.64, 0.86]

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

function collectPageErrors(page, consoleErrors, pageErrors) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
}

async function assertStaticContracts() {
  const difficultySource = await readFile(resolve("src/game/data/difficultyData.ts"), "utf8")
  const gateSource = await readFile(resolve("src/game/systems/GateSystem.ts"), "utf8")
  const pickupSource = await readFile(resolve("src/game/systems/BonusPickupSystem.ts"), "utf8")
  const roadSource = await readFile(resolve("src/game/SceneEnvironment.ts"), "utf8")

  assertQa(difficultySource.includes("stageDurationMultiplier: 1.5"), "NORMAL must remain 1.5x EASY length.")
  assertQa(difficultySource.includes("stageDurationMultiplier: 2.1"), "HARD must be reduced to 70% of the previous 3x length.")
  assertQa(gateSource.includes("projectBaseStageZ") && gateSource.includes("authoredZ"), "Gate spawns must project authored Z onto the scaled stage length.")
  assertQa(pickupSource.includes("projectBaseStageZ") && pickupSource.includes("lastScheduledZ"), "Pickup spawns must project authored Z onto the scaled stage length.")
  assertQa(pickupSource.includes("createDefenseReinforcementSpawns"), "Defense must project the sequential side reinforcement track.")
  assertQa(roadSource.includes("__squadRushRoadDebug") && roadSource.includes("getMaxFiniteStageLength"), "Road coverage must expose scaled finite-stage debug state.")
}

async function sampleRuntime(browser, baseUrl, mode, difficulty, ratio) {
  const stageLength = levelLength * difficulty.multiplier
  const qaStartZ = Math.round(stageLength * ratio)
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  collectPageErrors(page, consoleErrors, pageErrors)
  const params = new URLSearchParams({
    mode,
    difficulty: difficulty.id,
    quality: "high",
    qaNoDamage: "1",
    qaSoldiers: "24",
    qaStartZ: String(qaStartZ),
  })
  params.append("qa", "advanced")
  params.append("qa", "pickups")
  params.append("qa", "monsters")
  await page.goto(`${baseUrl}?${params}`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(
    (expectedMode) => window.__squadRushGameModeDebug?.mode === expectedMode &&
      window.__squadRushPickupDebug !== undefined &&
      window.__squadRushRoadDebug !== undefined &&
      (expectedMode === "defense" || (window.__squadRushDebug?.gates?.length ?? 0) > 0),
    mode,
    { timeout: 30000 },
  )
  await page.waitForTimeout(350)
  const snapshot = await page.evaluate(() => {
    const progressZ = window.__squadRushGameModeDebug?.progressZ ?? 0
    const gates = window.__squadRushDebug?.gates ?? []
    const pickup = window.__squadRushPickupDebug ?? null
    return {
      progressZ,
      gateZs: gates.map((gate) => gate.z),
      nearbyGateCount: gates.filter((gate) => !gate.passed && gate.z >= progressZ - 28 && gate.z <= progressZ + 96).length,
      pickup: pickup === null ? null : {
        active: pickup.active,
        childCount: pickup.childNames.length,
        nearestDistance: pickup.nearestDistance,
        stageLength: pickup.stageLength,
        scheduledCount: pickup.scheduledCount,
        lastScheduledZ: pickup.lastScheduledZ,
        rewardRatio: pickup.rewardRatio,
        defenseTrack: pickup.defenseTrack,
      },
      road: window.__squadRushRoadDebug ?? null,
      castle: window.__squadRushDefenseCastleDebug ?? null,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  const screenshotPath = resolve("logs/phase2-qa", `stage-content-${mode}-${difficulty.id}-${Math.round(ratio * 100)}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await page.close()

  const screenshot = await stat(screenshotPath)
  assertQa(screenshot.size >= 30000, `${mode}/${difficulty.id}/${ratio}: screenshot is too small.`)
  assertQa(consoleErrors.length === 0, `${mode}/${difficulty.id}/${ratio}: console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `${mode}/${difficulty.id}/${ratio}: page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(snapshot.scrollWidth <= snapshot.viewportWidth, `${mode}/${difficulty.id}/${ratio}: horizontal overflow detected.`)
  assertQa(snapshot.road?.roadCoverageEndZ >= stageLength, `${mode}/${difficulty.id}/${ratio}: road coverage ended before stage length.`)
  assertQa(snapshot.pickup?.lastScheduledZ >= stageLength * 0.95, `${mode}/${difficulty.id}/${ratio}: pickups do not reach late stage.`)
  assertQa(snapshot.pickup?.active >= 1, `${mode}/${difficulty.id}/${ratio}: no active pickup/effect character near late-stage sample.`)
  if (mode === "defense") {
    assertQa(snapshot.gateZs.length === 0, `${mode}/${difficulty.id}/${ratio}: obsolete one-shot gates are still active.`)
    assertQa(snapshot.pickup?.defenseTrack === true && snapshot.pickup.scheduledCount >= 100, `${mode}/${difficulty.id}/${ratio}: sequential +1 track is missing.`)
    assertQa(snapshot.castle?.roadLength >= 150, `${mode}/${difficulty.id}/${ratio}: defense castle road debug is missing.`)
  } else {
    assertQa(snapshot.nearbyGateCount >= 1, `${mode}/${difficulty.id}/${ratio}: no effect gate near late-stage sample.`)
  }
  return { mode, difficulty: difficulty.id, ratio, stageLength, qaStartZ, screenshotPath, snapshot }
}

await assertStaticContracts()

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)
let browser

try {
  await mkdir(resolve("logs/phase2-qa"), { recursive: true })
  await waitForPreview(previewUrl)
  browser = await chromium.launch({ channel: "chrome" })
  const samples = []
  for (const mode of modes) {
    for (const difficulty of difficulties) {
      for (const ratio of sampleRatios) {
        samples.push(await sampleRuntime(browser, previewUrl, mode, difficulty, ratio))
      }
    }
  }
  console.info(JSON.stringify({ samples }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  if (!preview.killed) {
    preview.kill("SIGTERM")
  }
}
