import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const screenshotName = "environment-setpiece-desktop.png"
const setpieceSource = readFileSync(resolve("src/game/EnvironmentSetpieces.ts"), "utf8")
const designSource = readFileSync(resolve("DESIGN.md"), "utf8")

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

function stopPreview(preview) {
  return new Promise((resolveStop) => {
    if (preview.exitCode !== null) {
      resolveStop()
      return
    }
    const timer = setTimeout(() => {
      if (preview.exitCode === null) {
        preview.kill("SIGKILL")
      }
      resolveStop()
    }, 3000)
    preview.once("exit", () => {
      clearTimeout(timer)
      resolveStop()
    })
    preview.kill("SIGTERM")
  })
}

assertQa(setpieceSource.includes("side_service_deck"), "Service deck setpieces are missing.")
assertQa(setpieceSource.includes("authored_side_cargo"), "Side cargo dressing is missing.")
assertQa(setpieceSource.includes("__squadRushEnvironmentDebug"), "Environment debug state is missing.")
assertQa(!setpieceSource.includes("combat_gantry_beam"), "Gate gantry beams must not reconnect the two choice gates.")
assertQa(!setpieceSource.includes("authored_gate_frame"), "Authored gate frames must stay disabled around choice gates.")
assertQa(designSource.includes("Environment setpiece QA"), "DESIGN.md must document environment setpiece QA.")

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?quality=high&qa=environment`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)

try {
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await clickStartButton(page)
  await page.waitForFunction(() => {
    const debug = window.__squadRushEnvironmentDebug
    return debug !== undefined &&
      debug.serviceDecks >= 14 &&
      debug.gantries === 0 &&
      debug.cargoStacks >= 20
  }, null, { timeout: 36000 })
  await page.waitForTimeout(1200)

  const runtime = await page.evaluate(() => ({
    environment: window.__squadRushEnvironmentDebug,
    scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }))
  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  await browser.close()

  const screenshot = await stat(screenshotPath)
  assertQa(screenshot.size > 90000, `Environment screenshot is too small: ${screenshot.size}`)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(runtime.scrollOverflow <= 0, "Environment setpiece capture has horizontal overflow.")
  assertQa(runtime.environment?.authoredRoadSegments === 18, "Authored road side modules did not load.")
  assertQa(runtime.environment?.authoredGateFrames === 0, "Authored gate frame modules must not reconnect the choice gates.")
  console.info(JSON.stringify({ screenshotPath, runtime }, null, 2))
} finally {
  await stopPreview(preview)
}
