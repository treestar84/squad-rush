import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const sceneSource = readFileSync(resolve("src/game/SceneEnvironment.ts"), "utf8")
const fxSource = readFileSync(resolve("src/game/systems/FXSystem.ts"), "utf8")
const designSource = readFileSync(resolve("DESIGN.md"), "utf8")
const outputDir = resolve("logs/phase2-qa")
const screenshotName = "graphics-polish-gate-burst.png"

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readNumber(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))
  assertQa(match?.[1] !== undefined, `Missing numeric token ${name}.`)
  return Number.parseFloat(match[1])
}

const bloomWeight = readNumber(sceneSource, "HIGH_QUALITY_BLOOM_WEIGHT")
const bloomThreshold = readNumber(sceneSource, "HIGH_QUALITY_BLOOM_THRESHOLD")
const bloomScale = readNumber(sceneSource, "HIGH_QUALITY_BLOOM_SCALE")
const exposure = readNumber(sceneSource, "HIGH_QUALITY_EXPOSURE")
const contrast = readNumber(sceneSource, "HIGH_QUALITY_CONTRAST")
const gateBurstParticleCount = readNumber(fxSource, "GATE_BURST_PARTICLE_COUNT")
const gateRingParticleCount = readNumber(fxSource, "GATE_RING_PARTICLE_COUNT")
const gateBurstBaseScale = readNumber(fxSource, "GATE_BURST_BASE_SCALE")
const gateBurstScaleStep = readNumber(fxSource, "GATE_BURST_SCALE_STEP")
const gateRingBaseScale = readNumber(fxSource, "GATE_RING_BASE_SCALE")
const gateRingScaleStep = readNumber(fxSource, "GATE_RING_SCALE_STEP")
const gateParticleAlpha = readNumber(fxSource, "GATE_PARTICLE_ALPHA")
const gateMaxParticleScale = Math.max(gateBurstBaseScale + 5 * gateBurstScaleStep, gateRingBaseScale + 2 * gateRingScaleStep)

assertQa(sceneSource.includes("__squadRushGraphicsDebug"), "Graphics policy must expose runtime bloom debug state.")
assertQa(fxSource.includes("__squadRushFxDebug"), "FX system must expose runtime gate burst debug state.")
assertQa(designSource.includes("Graphics polish QA"), "DESIGN.md must document graphics polish QA.")
assertQa(bloomWeight >= 0.7 && bloomWeight <= 0.86, `Bloom weight ${bloomWeight} must create a premium highlight lift.`)
assertQa(bloomThreshold >= 0.36 && bloomThreshold <= 0.48, `Bloom threshold ${bloomThreshold} must catch gate/projectile energy.`)
assertQa(bloomScale >= 0.5 && bloomScale <= 0.65, `Bloom scale ${bloomScale} must stay performant.`)
assertQa(exposure >= 1.1 && exposure <= 1.18, `Exposure ${exposure} must stay bright without washing out.`)
assertQa(contrast >= 1.18 && contrast <= 1.25, `Contrast ${contrast} must preserve arcade punch.`)
assertQa(gateBurstParticleCount >= 60, `Gate burst count ${gateBurstParticleCount} is too sparse.`)
assertQa(gateRingParticleCount >= 16, `Gate ring count ${gateRingParticleCount} is too sparse.`)
assertQa(gateMaxParticleScale <= 0.28, `Gate particle max scale ${gateMaxParticleScale.toFixed(3)} occludes squad/projectiles.`)
assertQa(gateParticleAlpha <= 0.62, `Gate particle alpha ${gateParticleAlpha} is too opaque for combat readability.`)
assertQa(fxSource.includes("fx.baseAlpha * (1 - age)"), "FX base alpha must be preserved during runtime fade.")

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

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?quality=high&qa=graphics`
const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: resolve("."),
  stdio: "pipe",
})

try {
  await mkdir(outputDir, { recursive: true })
  await waitForPreview(previewUrl)
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
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
  await page.waitForFunction((minimumParticles) => {
    const graphics = window.__squadRushGraphicsDebug
    const fx = window.__squadRushFxDebug
    return graphics?.bloomEnabled === true &&
      graphics.bloomWeight >= 0.7 &&
      fx !== undefined &&
      fx.lastGateBurstCount >= minimumParticles
  }, gateBurstParticleCount + gateRingParticleCount, { timeout: 9000 })
  const screenshotPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  const runtime = await page.evaluate(() => ({
    graphics: window.__squadRushGraphicsDebug,
    fx: window.__squadRushFxDebug,
    scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
  }))
  await browser.close()
  const screenshot = await stat(screenshotPath)

  assertQa(screenshot.size > 70000, `Graphics polish screenshot is too small: ${screenshot.size}`)
  assertQa(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(runtime.scrollOverflow <= 0, "Graphics polish capture has horizontal overflow.")
  assertQa(runtime.fx?.lastGateBurstCount >= gateBurstParticleCount + gateRingParticleCount, "Gate burst did not emit the full layered burst.")
  assertQa(runtime.fx?.lastGateParticleAlpha <= gateParticleAlpha, "Gate burst runtime alpha exceeded the readability policy.")
  assertQa(runtime.fx?.lastGateParticleMaxScale <= gateMaxParticleScale + 0.001, "Gate burst runtime scale exceeded the readability policy.")
  console.info(JSON.stringify({ screenshotPath, runtime }, null, 2))
} finally {
  await stopPreview(preview)
}
