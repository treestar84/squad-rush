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
      shield: textOf("[data-role='shield']"),
      progress: textOf("[data-role='stage']"),
      roster: Array.from(document.querySelectorAll(".hud-roster-item")).map((el) => el.textContent ?? ""),
      popup: document.querySelector(".hud-popup")?.textContent ?? "",
      recordedPopups: window.__firstGatePopups ?? [],
      recordedFlights: window.__firstGateFlights ?? [],
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

async function readCloseGateCameraState(page) {
  return page.evaluate(() => {
    const gate = window.__squadRushDebug?.gates.find((item) => !item.passed)
      ?? window.__squadRushDebug?.gates[0]
    const squadZ = window.__squadRushDebug?.squadZ ?? 0
    return {
      gateDistance: gate === undefined ? Number.POSITIVE_INFINITY : gate.z - squadZ,
      camera: window.__squadRushCameraDebug,
    }
  })
}

const gateText = await readFile("src/game/data/gateData.ts", "utf8")
const gateVisualText = await readFile("src/game/systems/GateVisualFactory.ts", "utf8")
const gateSystemText = await readFile("src/game/systems/GateSystem.ts", "utf8")
assertQa(
  gateText.includes('{ z: 24, gateIds: ["gate_soldier_add1", "gate_pangyo_add2"], rightBarrier: false }'),
  "First gate must preserve the opening soldier/Pangyo tutorial pair without a wall.",
)
assertQa(gateText.includes("gate_add3"), "Gate data must include the +3 increase gate.")
assertQa(gateText.includes("LEFT_GATE_REWARD_POOL") && gateText.includes("RIGHT_GATE_REWARD_POOL"), "Gate data must include randomized left/right reward pools.")
assertQa(!gateText.includes("gate_mul3"), "x3 rewards must stay removed from gate data.")
assertQa(!gateText.includes("gate_upgrade"), "Old generic upgrade gate must be removed.")
assertQa(!gateText.includes("SPECIAL_RECRUIT"), "Specific-character reward gates must be removed.")
assertQa(!gateText.includes("PROMOTION"), "Promotion gates must be removed.")
assertQa(!gateText.includes("gate_special"), "Specific-character gate ids must be inactive.")
assertQa(!gateText.includes("gate_promote"), "Promotion gate id must be inactive.")
assertQa(gateVisualText.includes("GATE_VISUAL_SCALE = 0.7"), "Choice gates must be scaled down to 70%.")
assertQa(gateVisualText.includes("GATE_LEFT_X = -4.6"), "Left gate must sit near the left runway edge.")
assertQa(gateVisualText.includes("GATE_RIGHT_X = 4.6"), "Right gate must sit near the right runway edge.")
assertQa(!gateVisualText.includes("GATE_CENTER_X"), "Center gate lane must be removed.")
assertQa(gateVisualText.includes("gate_barrier_hp_fill"), "Right-side stronger gate must render an HP bar.")
assertQa(gateVisualText.includes("setDisplayText"), "Gate visual labels must be revealable after wall destruction.")
assertQa(gateSystemText.includes("rightBarrier"), "Gate system must track a destructible right-side barrier.")
assertQa(gateSystemText.includes("damageRightBarrier"), "Gate system must damage the right-side barrier before reward pickup.")
assertQa(gateSystemText.includes("createRewardPoolGateChoices"), "Gate system must roll mystery reward choices after the opening gate.")

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
      if (msg.text().startsWith("Failed to load resource")) {
        return
      }
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${previewUrl}?qaSpeed=3&qa=advanced`, { waitUntil: "networkidle" })
  await page.evaluate(() => {
    window.__firstGatePopups = []
    window.__firstGateFlights = []
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains("hud-popup")) {
            window.__firstGatePopups?.push(node.textContent ?? "")
          }
          if (node instanceof HTMLImageElement && node.classList.contains("career-choice-flight")) {
            window.__firstGateFlights?.push({ alt: node.alt, src: node.getAttribute("src") ?? "" })
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await page.locator(".tap-to-start").click()
  await page.keyboard.down("KeyA")
  await page.waitForFunction(() => {
    const gate = window.__squadRushDebug?.gates.find((item) => !item.passed)
      ?? window.__squadRushDebug?.gates[0]
    const camera = window.__squadRushCameraDebug
    const squadZ = window.__squadRushDebug?.squadZ ?? 0
    if (gate === undefined || camera === undefined) {
      return false
    }
    const distance = gate.z - squadZ
    return distance >= 0 && distance <= 4.8
  }, null, { timeout: captureMs })
  const closeGateCamera = await readCloseGateCameraState(page)
  await page.waitForFunction(() => {
    const popups = window.__firstGatePopups ?? []
    return popups.some((text) => text.includes("병사 +1"))
  }, null, { timeout: captureMs })
  await page.waitForFunction(() => {
    const progressText = document.querySelector("[data-role='stage']")?.textContent ?? ""
    const progressMatch = progressText.match(/[0-9]+(?:\.[0-9]+)?/)
    const progress = progressMatch?.[0] === undefined ? 0 : Number.parseFloat(progressMatch[0])
    return progress >= 8
  }, null, { timeout: captureMs })
  await page.keyboard.up("KeyA")
  const screenshotPath = resolve(outputDir, "first-gate-roster-feedback-mobile.png")
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const stats = await readHudStats(page)
  await browser.close()
  browser = undefined

  await assertScreenshot(screenshotPath)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(stats.scrollWidth - stats.viewportWidth <= maxHorizontalOverflowPx, "First gate capture has horizontal overflow.")
  assertQa(closeGateCamera.gateDistance >= 0 && closeGateCamera.gateDistance <= 4.8, `Close gate camera sample was not near the crossing line: ${closeGateCamera.gateDistance}`)
  assertQa(closeGateCamera.camera !== undefined, "Close gate camera debug state is missing.")
  assertQa(closeGateCamera.camera.gateFocus <= 0.35, `Close gate focus stayed too strong near crossing: ${closeGateCamera.camera.gateFocus}`)
  assertQa(
    Math.abs(closeGateCamera.camera.fov - 0.7) <= 0.01,
    `Gate close-up should not zoom the camera FOV: ${closeGateCamera.camera.fov}`,
  )
  assertQa(
    closeGateCamera.camera.squadScreenMaxY <= closeGateCamera.camera.viewportHeight - 8,
    `Squad projected below the render canvas near gate: y=${closeGateCamera.camera.squadScreenMaxY}, viewport=${closeGateCamera.camera.viewportHeight}`,
  )
  assertQa(parseNumber(stats.progress) >= minProgress, `First gate capture did not reach ${minProgress}% progress.`)
  assertQa(parseNumber(stats.soldiers) >= 2, "First gate capture did not apply the opening soldier reward.")
  assertQa(
    stats.recordedFlights.some((flight) => flight.alt === "병사" && flight.src.includes("/assets/ui/portraits/soldier.png")),
    `First gate did not emit a soldier portrait flight: ${JSON.stringify(stats.recordedFlights)}`,
  )
  assertQa(!stats.roster.some((text) => text.includes("개1")), "Specific-character recruit gate unexpectedly added a developer.")
  assertQa(stats.popup.includes("병사 +1") || stats.recordedPopups.some((text) => text.includes("병사 +1")), "First left gate popup did not announce the soldier tutorial reward.")
  assertQa(!stats.recordedPopups.some((text) => /개발자|승급|게이머|QA/.test(text)), "Removed special or promotion gate popup appeared.")

  console.info(JSON.stringify({ screenshotPath, closeGateCamera, stats }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
