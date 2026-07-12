import { spawn } from "node:child_process"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const previewReadyMs = 15000
const gameplayReadyMs = 30000
const expectedRouteIds = ["military", "developer", "unemployed"]

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
  while (Date.now() - startedAt < previewReadyMs) {
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

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`
  }
  if (!isRecord(value)) {
    return JSON.stringify(value)
  }
  const entries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
  return `{${entries.join(",")}}`
}

function summarizeRouteDebug(rawDebug) {
  const routes = isRecord(rawDebug) && Array.isArray(rawDebug.routes) ? rawDebug.routes : []
  const routeRecords = routes.filter(isRecord)
  const routeIds = routeRecords
    .map((route) => typeof route.id === "string" ? route.id : "")
    .filter((id) => id.length > 0)
  const routeOutputs = routeRecords
    .filter((route) => expectedRouteIds.includes(String(route.id)) && isRecord(route.output))
    .map((route) => stableJson(route.output))
  const distinctRouteOutputs = new Set(routeOutputs).size
  const recoveryBeats = isRecord(rawDebug) && Array.isArray(rawDebug.recoveryBeats) ? rawDebug.recoveryBeats : []

  return {
    hasRouteDebug: isRecord(rawDebug),
    routeIds,
    missingRouteIds: expectedRouteIds.filter((id) => !routeIds.includes(id)),
    routeOutputCount: routeOutputs.length,
    distinctRouteOutputs,
    recoveryBeatCount: recoveryBeats.filter(isRecord).length,
  }
}

async function readRouteState(page) {
  return page.evaluate(() => {
    const routeDebug = window.__squadRushDefenseRouteDebug ?? null
    return {
      mode: window.__squadRushGameModeDebug?.mode ?? "",
      progressZ: window.__squadRushGameModeDebug?.progressZ ?? 0,
      squadZ: window.__squadRushGameModeDebug?.squadZ ?? 0,
      activeMonsters: window.__squadRushMonsterDebug?.active ?? 0,
      monsterSpawnDensityMultiplier: window.__squadRushMonsterDebug?.spawnDensityMultiplier ?? null,
      hasRouteDebug: typeof routeDebug === "object" && routeDebug !== null && !Array.isArray(routeDebug),
      routeDebug,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
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
  await waitForPreview(previewUrl)

  const consoleErrors = []
  const pageErrors = []
  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  collectPageErrors(page, consoleErrors, pageErrors)

  await page.goto(`${previewUrl}?mode=defense&difficulty=easy&quality=high&qa=monsters&qa=defense-routes&qaSpeed=3`, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => window.__squadRushGameModeDebug?.mode === "defense", null, { timeout: gameplayReadyMs })
  await page.waitForFunction(() => {
    const game = window.__squadRushGameModeDebug
    const monsters = window.__squadRushMonsterDebug
    return game !== undefined
      && monsters !== undefined
      && game.progressZ - game.squadZ >= 8
      && monsters.active >= 45
      && typeof monsters.spawnDensityMultiplier === "number"
  }, null, { timeout: gameplayReadyMs })

  const routeState = await readRouteState(page)
  const observed = summarizeRouteDebug(routeState.routeDebug)

  assertQa(pageErrors.length === 0, `Page errors detected before route model assertion: ${pageErrors.join(" | ")}`)
  assertQa(consoleErrors.length === 0, `Console errors detected before route model assertion: ${consoleErrors.join(" | ")}`)
  assertQa(routeState.mode === "defense", "Defense route model probe did not enter defense mode.")
  assertQa(routeState.scrollWidth <= routeState.viewportWidth, "Defense route model probe has horizontal overflow.")
  assertQa(typeof routeState.monsterSpawnDensityMultiplier === "number", "Defense route model probe did not observe runtime monster tuning data.")
  assertQa(
    observed.hasRouteDebug
      && observed.missingRouteIds.length === 0
      && observed.routeOutputCount === expectedRouteIds.length
      && observed.distinctRouteOutputs === expectedRouteIds.length
      && observed.recoveryBeatCount > 0,
    [
      "Defense route/recovery model missing:",
      "expected runtime window.__squadRushDefenseRouteDebug.routes with military, developer, and unemployed output objects that differ, plus recoveryBeats records.",
      `Observed ${JSON.stringify({ ...observed, runtime: { progressZ: routeState.progressZ, activeMonsters: routeState.activeMonsters } })}`,
    ].join(" "),
  )

  console.info(JSON.stringify({ routeState: { ...routeState, routeDebug: undefined }, observed }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
