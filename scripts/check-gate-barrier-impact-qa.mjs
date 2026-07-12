import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/gate-barrier-impact-qa")
const captureMs = 30000
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
  assertQa(file.size >= minScreenshotBytes, `Gate barrier screenshot is too small: ${path}`)
}

const gateSystemSource = await readFile("src/game/systems/GateSystem.ts", "utf8")
const shootingSource = await readFile("src/game/systems/ShootingSystem.ts", "utf8")
assertQa(gateSystemSource.includes("findBarrierTarget"), "GateSystem must expose projectile barrier targeting.")
assertQa(gateSystemSource.includes("applyBarrierImpact"), "Gate barrier HP must be applied on projectile impact.")
assertQa(!gateSystemSource.includes("GATE_BARRIER_DAMAGE_RATE"), "Gate barrier must not use time-based DPS.")
assertQa(gateSystemSource.includes("playHitSpark") && gateSystemSource.includes("playExplosion"), "Gate barrier hit and break FX must be wired.")
assertQa(shootingSource.includes('kind: "barrier"'), "ShootingSystem must target the barrier as a projectile target.")

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${previewUrl}?qa=advanced&qaSpeed=4&qaSoldiers=10`, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.keyboard.down("KeyD")
  await page.waitForFunction(() => {
    const barrier = window.__squadRushDebug?.gates?.find((gate) => (gate.rightBarrier?.maxHp ?? 0) > 0)?.rightBarrier
    return barrier !== undefined && barrier.impacts >= 3 && barrier.hpRatio < 0.98
  }, null, { timeout: captureMs })
  const midImpact = await page.evaluate(() => window.__squadRushDebug?.gates?.find((gate) => (gate.rightBarrier?.maxHp ?? 0) > 0)?.rightBarrier ?? null)
  await page.waitForFunction(() => window.__squadRushDebug?.gates?.find((gate) => (gate.rightBarrier?.maxHp ?? 0) > 0)?.rightBarrier?.destroyed === true, null, { timeout: captureMs })
  const destroyed = await page.evaluate(() => window.__squadRushDebug?.gates?.find((gate) => (gate.rightBarrier?.maxHp ?? 0) > 0)?.rightBarrier ?? null)
  const screenshotPath = resolve(outputDir, "right-barrier-destroyed.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await page.keyboard.up("KeyD")
  await browser.close()
  browser = undefined

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(midImpact?.impacts >= 3, `Expected at least 3 barrier impacts, got ${midImpact?.impacts ?? "none"}.`)
  assertQa(midImpact?.hpRatio < 0.98, `Barrier HP did not decrease after impacts: ${midImpact?.hpRatio ?? "none"}.`)
  assertQa(destroyed?.destroyed === true, "Barrier did not report destroyed after projectile impacts.")
  assertQa(destroyed?.impacts > midImpact.impacts, "Barrier did not keep accumulating per-shot impacts before destruction.")

  console.info(JSON.stringify({ screenshotPath, midImpact, destroyed }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
