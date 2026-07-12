import { createServer } from "node:net"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { resolve } from "node:path"
import { spawn } from "node:child_process"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const minCombatKills = 30
const minCombatProgress = 15
const minRuntimeFps = 24
const maxMobileOverflowPx = 0
const maxMobileCommandHeight = 56
const requiredAudioCues = [
  "run-footsteps",
]
const requiredBgmCues = [
  "bgm-run-1",
  "bgm-run-2",
  "bgm-run-3",
  "bgm-run-4",
  "bgm-run-5",
]

function loadedAudioCue(assets, cue) {
  return assets.has(`${cue}.mp3`) || assets.has(`${cue}.ogg`)
}

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === "object" && address !== null) {
          resolvePort(address.port)
          return
        }
        reject(new Error("Unable to allocate preview port."))
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

function parseNumber(text) {
  const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
  return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
}

function assertRuntime(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function captureStats(page) {
  return page.evaluate(() => {
    const commandRect = document.querySelector(".hud-command-strip")?.getBoundingClientRect()
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    return {
      soldiers: textOf("[data-role='soldiers']"),
      kills: textOf("[data-role='kills']"),
      fps: textOf("[data-role='fps']"),
      progress: textOf("[data-role='stage']"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      commandHeight: commandRect?.height ?? -1,
    }
  })
}

async function assertScreenshot(path) {
  const file = await stat(path)
  assertRuntime(file.size > 10000, `Runtime QA screenshot is too small: ${path}`)
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?qaNoDamage=1`
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
  const loadedAudioAssets = new Set()
  browser = await chromium.launch({ channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("response", (response) => {
    const url = response.url()
    if (response.status() < 400 && url.includes("/assets/audio/")) {
      loadedAudioAssets.add(url.slice(url.lastIndexOf("/") + 1))
    }
  })

  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await page.locator(".tap-to-start").click()
  await page.waitForTimeout(30000)
  const mobilePath = resolve(outputDir, "runtime-qa-mobile-combat.png")
  await page.screenshot({ path: mobilePath, fullPage: false })
  const mobileStats = await captureStats(page)

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(1600)
  const desktopPath = resolve(outputDir, "runtime-qa-desktop-combat.png")
  await page.screenshot({ path: desktopPath, fullPage: false })
  const desktopStats = await captureStats(page)
  await browser.close()
  browser = undefined

  await assertScreenshot(mobilePath)
  await assertScreenshot(desktopPath)
  assertRuntime(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertRuntime(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertRuntime(mobileStats.scrollWidth - mobileStats.viewportWidth <= maxMobileOverflowPx, "Mobile viewport has horizontal overflow.")
  assertRuntime(mobileStats.commandHeight > 0 && mobileStats.commandHeight <= maxMobileCommandHeight, "Mobile HUD command strip is too tall.")
  assertRuntime(parseNumber(mobileStats.kills) >= minCombatKills, `Mobile combat did not reach ${minCombatKills} kills.`)
  assertRuntime(parseNumber(mobileStats.progress) >= minCombatProgress, `Mobile combat did not reach ${minCombatProgress}% progress.`)
  assertRuntime(parseNumber(mobileStats.fps) >= minRuntimeFps, `Mobile FPS text is below ${minRuntimeFps}.`)
  assertRuntime(parseNumber(desktopStats.fps) >= minRuntimeFps, `Desktop FPS text is below ${minRuntimeFps}.`)
  for (const cue of requiredAudioCues) {
    assertRuntime(loadedAudioCue(loadedAudioAssets, cue), `Chrome runtime did not load ${cue}.mp3 or ${cue}.ogg on demand.`)
  }
  assertRuntime(
    requiredBgmCues.some((cue) => loadedAudioCue(loadedAudioAssets, cue)),
    "Chrome runtime did not load any optimized BGM track on demand.",
  )

  console.info(JSON.stringify({ mobilePath, desktopPath, mobileStats, desktopStats, loadedAudioAssets: [...loadedAudioAssets].sort() }, null, 2))
} finally {
  await browser?.close().catch(() => {})
  cleanup()
}
