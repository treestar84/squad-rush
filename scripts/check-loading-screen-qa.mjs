import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { mkdir, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")
const outputDir = resolve("logs/phase2-qa")
const loadingSource = readFileSync(resolve("src/ui/LoadingScreen.ts"), "utf8")
const appSource = readFileSync(resolve("src/app/App.ts"), "utf8")
const designSource = readFileSync(resolve("DESIGN.md"), "utf8")
const cssSource = readFileSync(resolve("src/styles/global.css"), "utf8")
const maxEntryMs = 15000
const maxHorizontalOverflowPx = 0
const screenshotName = "loading-screen-mobile.png"

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
  assertQa(file.size > 10000, `Loading QA screenshot is too small: ${path}`)
}

async function readLoadingStats(page) {
  return page.evaluate(() => {
    const loading = document.querySelector("#loading-screen")
    const progressbar = document.querySelector("[role='progressbar']")
    const start = document.querySelector("#start-screen")
    return {
      loadingVisible: loading instanceof HTMLElement && getComputedStyle(loading).display !== "none",
      startVisible: start instanceof HTMLElement && getComputedStyle(start).display !== "none",
      logo: document.querySelector(".loading-logo")?.textContent ?? "",
      kicker: document.querySelector(".loading-kicker")?.textContent ?? "",
      stage: document.querySelector("[data-role='loading-stage']")?.textContent ?? "",
      text: document.querySelector(".loading-text")?.textContent ?? "",
      progressNow: progressbar instanceof HTMLElement ? progressbar.getAttribute("aria-valuenow") ?? "" : "",
      progressMax: progressbar instanceof HTMLElement ? progressbar.getAttribute("aria-valuemax") ?? "" : "",
      metricCount: document.querySelectorAll(".loading-metrics span").length,
      startButton: document.querySelector(".tap-to-start")?.textContent ?? "",
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

assertQa(loadingSource.includes("role=\"progressbar\""), "LoadingScreen must expose an accessible progressbar.")
assertQa(loadingSource.includes("MISSION BOOT"), "LoadingScreen must use tactical boot copy.")
assertQa(loadingSource.includes("stageForProgress"), "LoadingScreen must map loading progress to readable stages.")
assertQa(appSource.includes('get("qa") === "loading"'), "App must expose qa=loading hold for browser capture.")
assertQa(cssSource.includes(".loading-metrics"), "Loading screen readiness chips are missing.")
assertQa(designSource.includes("Loading QA"), "DESIGN.md must document Loading QA.")

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/?qa=loading`
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  const startedAt = Date.now()
  await page.goto(previewUrl, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => {
    const loading = document.querySelector("#loading-screen")
    return loading instanceof HTMLElement && getComputedStyle(loading).display !== "none"
  }, null, { timeout: 2000 })
  const loadingPath = resolve(outputDir, screenshotName)
  await page.screenshot({ path: loadingPath, fullPage: false })
  const loadingStats = await readLoadingStats(page)
  await page.waitForFunction(() => {
    const start = document.querySelector("#start-screen")
    return start instanceof HTMLElement && getComputedStyle(start).display !== "none"
  }, null, { timeout: maxEntryMs })
  const entryMs = Date.now() - startedAt
  const startStats = await readLoadingStats(page)
  await browser.close()

  await assertScreenshot(loadingPath)
  assertQa(consoleErrors.length === 0, `Loading console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `Loading page errors detected: ${pageErrors.join(" | ")}`)
  assertQa(loadingStats.loadingVisible, "Loading screen was not visible during asset boot.")
  assertQa(loadingStats.logo.includes("바로 Go 스쿼드"), "Loading logo is missing.")
  assertQa(loadingStats.kicker.includes("MISSION BOOT"), "Loading kicker is missing.")
  assertQa(loadingStats.stage.length > 0, "Loading stage copy is missing.")
  assertQa(loadingStats.progressNow === "0" && loadingStats.progressMax === "100", "Loading progressbar ARIA values are incorrect at boot.")
  assertQa(loadingStats.metricCount === 3, "Loading readiness chips are missing.")
  assertQa(loadingStats.scrollWidth - loadingStats.viewportWidth <= maxHorizontalOverflowPx, "Loading screen has horizontal overflow.")
  assertQa(startStats.startVisible && startStats.startButton.includes("TAP TO START"), "Start screen did not appear after loading.")
  assertQa(entryMs <= maxEntryMs, `Loading entry exceeded ${maxEntryMs}ms: ${entryMs}ms.`)

  console.info(JSON.stringify({ loadingPath, entryMs, loadingStats, startStats }, null, 2))
} finally {
  cleanup()
}
