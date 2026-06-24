import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const minProgress = 58
const minKills = 60
const minScreenshotBytes = 50000
const maxHorizontalOverflowPx = 0

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
  assertQa(file.size >= minScreenshotBytes, `Advanced gate screenshot is too small: ${path}`)
}

async function readHudStats(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      kills: textOf("[data-role='kills']"),
      fps: textOf("[data-role='fps']"),
      progress: textOf("[data-role='stage']"),
      attack: textOf("[data-role='attack']"),
      upgrade: textOf("[data-role='upgrade']"),
      popup: document.querySelector(".hud-popup")?.textContent ?? "",
      recordedPopups: window.__advancedGatePopups ?? [],
      debug: window.__squadRushDebug ?? null,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

const gateText = await readFile("src/game/data/gateData.ts", "utf8")
const shootingText = await readFile("src/game/systems/ShootingSystem.ts", "utf8")
const projectileText = await readFile("src/game/systems/ProjectileStyling.ts", "utf8")
assertQa(gateText.includes("UNUSED_GATE_CONFIGS"), "Unused gate configs must remain available for future reuse.")
assertQa(gateText.includes("FIRE +20%") && gateText.includes("RANGE +20%") && gateText.includes("EXPLOSION") && gateText.includes("PIERCE"), "Disabled fire/range/explosion/pierce gate definitions must be retained as unused configs.")
assertQa(!gateText.includes("FIRE_RATE_UP") && !gateText.includes("RANGE_UP") && !gateText.includes("EXPLOSION_UP") && !gateText.includes("PIERCE_UP"), "Disabled gate effect types must not remain active.")
assertQa(!gateText.includes("gate_fire20\", rightGateId") && !gateText.includes("gate_rng20\", rightGateId") && !gateText.includes("gate_explosion\", rightGateId") && !gateText.includes("gate_pierce\", rightGateId"), "Disabled gates must not appear in the stage spawn list.")
assertQa(!shootingText.includes("applyPierceDamage") && !shootingText.includes("applyExplosionDamage"), "Disabled pierce/explosion effects must not be wired into shooting damage.")
assertQa(!projectileText.includes("explosionGlow") && !projectileText.includes("pierceGlow"), "Disabled explosion/pierce visuals must not be wired.")

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?quality=medium&qa=advanced&qaSpeed=3`
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "pipe" },
)

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
  const browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    window.__advancedGatePopups = []
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains("hud-popup")) {
            window.__advancedGatePopups?.push(node.textContent ?? "")
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await page.locator(".tap-to-start").click()
  await page.waitForFunction(() => {
    const debug = window.__squadRushDebug
    const progressText = document.querySelector("[data-role='stage']")?.textContent ?? ""
    const attackText = document.querySelector("[data-role='attack']")?.textContent ?? ""
    const upgradeText = document.querySelector("[data-role='upgrade']")?.textContent ?? ""
    const progressMatch = progressText.match(/[0-9]+(?:\.[0-9]+)?/)
    const attackMatch = attackText.match(/[0-9]+(?:\.[0-9]+)?/)
    const progress = progressMatch?.[0] === undefined ? 0 : Number.parseFloat(progressMatch[0])
    const attack = attackMatch?.[0] === undefined ? 0 : Number.parseFloat(attackMatch[0])
    return attack >= 2.24
      && upgradeText.includes("2/2")
      && debug?.stats.soldierUpgradeTier === 2
      && progress >= 58
  }, null, { timeout: 56000 })
  const screenshotPath = resolve(outputDir, "upgrade-gates-disabled-effects-feedback.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readHudStats(page)
  await browser.close()

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= maxHorizontalOverflowPx, "Advanced gate capture has horizontal overflow.")
  assertQa(parseNumber(stats.progress) >= minProgress, `Advanced gate capture did not reach ${minProgress}% progress.`)
  assertQa(parseNumber(stats.kills) >= minKills, `Advanced gate capture did not reach ${minKills} kills.`)
  assertQa(parseNumber(stats.attack) >= 2.24, "Second upgrade did not apply 2.25x attack feedback.")
  assertQa(stats.upgrade.includes("2/2"), "First round upgrade cap did not show 2/2.")
  assertQa(stats.debug?.stats.soldierUpgradeTier === 2, "Debug stats did not preserve the 2-upgrade first-round cap.")
  assertQa(!stats.recordedPopups.some((text) => /FIRE|RANGE|EXPLOSION|PIERCE/.test(text)), "Disabled gate popup appeared during the run.")

  console.info(JSON.stringify({ screenshotPath, stats }, null, 2))
} finally {
  cleanup()
}
