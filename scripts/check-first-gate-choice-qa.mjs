import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const captureMs = 15000
const minProgress = 8
const maxHorizontalOverflowPx = 0
const minScreenshotBytes = 50000

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

async function assertScreenshot(path) {
  const file = await stat(path)
  assertQa(file.size >= minScreenshotBytes, `First gate screenshot is too small: ${path}`)
}

async function readHudStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      soldiers: textOf("[data-role='soldiers']"),
      attack: textOf("[data-role='attack']"),
      upgrade: textOf("[data-role='upgrade']"),
      progress: textOf("[data-role='stage']"),
      popup: document.querySelector(".hud-popup")?.textContent ?? "",
      recordedPopups: window.__firstGatePopups ?? [],
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

const gateText = await readFile("src/game/data/gateData.ts", "utf8")
const gateVisualText = await readFile("src/game/systems/GateVisualFactory.ts", "utf8")
assertQa(
  gateText.includes('{ z: 38, leftGateId: "gate_add1", rightGateId: "gate_upgrade" }'),
  "First gate must offer +1 on left and UPGRADE on centered/right play.",
)
assertQa(!gateText.includes('{ z: 38, leftGateId: "gate_add1", rightGateId: "gate_atk20" }'), "First gate must not default to ATK +20%.")
assertQa(!gateText.includes('rightGateId: "gate_fire20"'), "First gate must not use FIRE +20%.")
assertQa(gateVisualText.includes("GATE_VISUAL_SCALE = 0.7"), "Choice gates must be scaled down to 70%.")
assertQa(gateVisualText.includes("GATE_LEFT_X = -4.2"), "Left gate must sit near the left runway edge.")
assertQa(gateVisualText.includes("GATE_RIGHT_X = 4.2"), "Right gate must sit near the right runway edge.")

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

  await page.goto(`${previewUrl}?qaSpeed=3`, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    window.__firstGatePopups = []
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains("hud-popup")) {
            window.__firstGatePopups?.push(node.textContent ?? "")
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => {
    const attackText = document.querySelector("[data-role='attack']")?.textContent ?? ""
    const upgradeText = document.querySelector("[data-role='upgrade']")?.textContent ?? ""
    const attackMatch = attackText.match(/[0-9]+(?:\.[0-9]+)?/)
    const attackValue = attackMatch?.[0] === undefined ? 0 : Number.parseFloat(attackMatch[0])
    return attackValue >= 1.49 && upgradeText.includes("1/2")
  }, null, { timeout: captureMs })
  const screenshotPath = resolve(outputDir, "first-gate-upgrade-feedback-mobile.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readHudStats(page)
  await browser.close()
  browser = undefined

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= maxHorizontalOverflowPx, "First gate capture has horizontal overflow.")
  assertQa(parseNumber(stats.progress) >= minProgress, `First gate capture did not reach ${minProgress}% progress.`)
  assertQa(parseNumber(stats.soldiers) <= 3, "First gate capture grew the squad too quickly for the opening balance.")
  assertQa(parseNumber(stats.attack) >= 1.49, "Centered first gate did not apply visible UPGRADE attack feedback.")
  assertQa(stats.upgrade.includes("1/2"), "Centered first gate did not increment the first-round upgrade tier.")
  assertQa(stats.popup.includes("UPGRADE") || stats.recordedPopups.includes("UPGRADE"), "First gate popup did not announce UPGRADE.")

  console.info(JSON.stringify({ screenshotPath, stats }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
