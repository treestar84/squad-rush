import { spawn } from "node:child_process"
import { mkdir, readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const minProgress = 18
const minKills = 40
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
      shield: textOf("[data-role='shield']"),
      roster: Array.from(document.querySelectorAll(".hud-roster-item")).map((el) => el.textContent ?? ""),
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
assertQa(gateText.includes("NUMBER_INCREASE"), "Number increase gate type must be active.")
assertQa(gateText.includes("ENLIST"), "Enlist gate type must be active.")
assertQa(gateText.includes("gate_add3"), "The +3 increase gate must be active.")
assertQa(gateText.includes("LEFT_GATE_REWARD_POOL") && gateText.includes("RIGHT_GATE_REWARD_POOL"), "Randomized left/right reward pools must be active.")
assertQa(gateText.includes("gate_developer_add1") && gateText.includes("gate_unemployed_add1"), "Right reward pool must include engine-building unit rewards.")
assertQa(gateText.includes("gate_attack_amp20") && gateText.includes("gate_pangyo_damage2x"), "Right reward pool must include rare permanent build rewards.")
assertQa(!gateText.includes("gate_mul3"), "x3 rewards must remain removed.")
assertQa(!gateText.includes("SPECIAL_RECRUIT"), "Special recruit gate type must be inactive.")
assertQa(!gateText.includes("PROMOTION"), "Promotion gate type must be inactive.")
assertQa(!gateText.includes("gate_special"), "Specific-character gate ids must not remain active.")
assertQa(!gateText.includes("gate_promote"), "Promotion gate id must not remain active.")
assertQa(!gateText.includes("gate_upgrade"), "Old generic attack upgrade gate must not remain active.")
assertQa(!gateText.includes("FIRE +20%") && !gateText.includes("RANGE +20%") && !gateText.includes("EXPLOSION") && !gateText.includes("PIERCE"), "Disabled fire/range/explosion/pierce gates must be removed from active gate data.")
assertQa(!shootingText.includes("applyPierceDamage") && !shootingText.includes("applyExplosionDamage"), "Disabled pierce/explosion effects must not be wired into shooting damage.")
assertQa(!projectileText.includes("explosionGlow") && !projectileText.includes("pierceGlow"), "Disabled explosion/pierce visuals must not be wired.")

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?quality=medium&qa=advanced&qaSpeed=4&qaSoldiers=10`
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
    return Array.isArray(debug?.gates)
      && debug.gates.length >= 2
      && debug.gates.every((gate) => gate.choices?.length === 2)
      && debug.gates.some((gate) => gate.visibleChoices?.[0] !== "?" && gate.visibleChoices?.[1] === "?")
      && debug.gates.some((gate) => gate.rightBarrier?.maxHp > 0)
      && typeof debug.stats?.attackMultiplier === "number"
      && typeof debug.stats?.squadLimit === "number"
  }, null, { timeout: 56000 })
  await page.waitForFunction(() => {
    const progressText = document.querySelector("[data-role='stage']")?.textContent ?? ""
    const progressMatch = progressText.match(/[0-9]+(?:\.[0-9]+)?/)
    const progress = progressMatch?.[0] === undefined ? 0 : Number.parseFloat(progressMatch[0])
    return progress >= 18
  }, null, { timeout: 56000 })
  const screenshotPath = resolve(outputDir, "engine-gates-roster-feedback.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readHudStats(page)
  await browser.close()

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= maxHorizontalOverflowPx, "Advanced gate capture has horizontal overflow.")
  assertQa(parseNumber(stats.progress) >= minProgress, `Advanced gate capture did not reach ${minProgress}% progress.`)
  assertQa(parseNumber(stats.kills) >= minKills, `Advanced gate capture did not reach ${minKills} kills.`)
  assertQa(parseNumber(stats.attack) > 0, "Roster engine did not expose a positive attack multiplier.")
  assertQa(stats.roster.length > 0 && stats.roster.length < 12, "Roster HUD should show only owned unit rows.")
  assertQa(!stats.roster.some((text) => text.endsWith("0")), "Roster HUD should hide unowned unit rows.")
  assertQa(stats.debug?.stats.squadLimit === 15, "Debug stats did not expose the reduced 15-person squad limit.")
  assertQa(stats.debug?.gates?.every((gate) => gate.choices?.length === 2), "Debug gates did not expose exactly two choices per gate.")
  assertQa(stats.debug?.gates?.some((gate) => gate.visibleChoices?.[0] !== "?" && gate.visibleChoices?.[1] === "?"), "Debug gates did not expose left-visible/right-hidden choices before wall break.")
  assertQa(stats.debug?.gates?.some((gate) => gate.rightBarrier?.maxHp > 0), "Randomized right gates did not expose a destructible barrier.")
  assertQa(!stats.recordedPopups.some((text) => /FIRE|RANGE|EXPLOSION|PIERCE|게이머|QA|승급|x3/.test(text)), "Disabled gate popup appeared during the run.")

  console.info(JSON.stringify({ screenshotPath, stats }, null, 2))
} finally {
  cleanup()
}
