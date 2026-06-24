import { spawn } from "node:child_process"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const minLaneDelta = 0.2
const maxOverflowPx = 0

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parseNumber(text) {
  const match = text.match(/-?[0-9]+(?:\.[0-9]+)?/)
  return match?.[0] === undefined ? 0 : Number.parseFloat(match[0])
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

async function readPageState(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.textContent ?? ""
    const startScreen = document.querySelector("#start-screen")
    const startVisible = startScreen instanceof HTMLElement && getComputedStyle(startScreen).display !== "none"
    return {
      laneX: textOf("[data-role='lane-x']"),
      progress: textOf("[data-role='stage']"),
      hudVisible: (() => {
        const hud = document.querySelector("#hud")
        return hud instanceof HTMLElement && getComputedStyle(hud).display !== "none"
      })(),
      startVisible,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

async function assertPreStartInputBlocked(page) {
  await page.goto(page.url(), { waitUntil: "networkidle" })
  await page.waitForFunction(() => {
    const start = document.querySelector("#start-screen")
    return start instanceof HTMLElement && getComputedStyle(start).display !== "none"
  }, null, { timeout: 6000 })
  await page.mouse.move(190, 420)
  await page.mouse.down()
  await page.mouse.move(320, 420, { steps: 6 })
  await page.mouse.up()
  await page.mouse.wheel(0, 600)
  await page.keyboard.press("KeyD")
  await page.waitForTimeout(500)
  const state = await readPageState(page)
  assertQa(state.startVisible, "Pre-start pointer/key input hid the start screen.")
  assertQa(!state.hudVisible, "Pre-start pointer/key input showed the game HUD.")
  assertQa(state.scrollX === 0 && state.scrollY === 0, "Pre-start input moved the page scroll position.")
  assertQa(state.scrollWidth - state.viewportWidth <= maxOverflowPx, "Pre-start input created horizontal overflow.")
}

async function holdKey(page, key, durationMs) {
  await page.keyboard.down(key)
  await page.waitForTimeout(durationMs)
  await page.keyboard.up(key)
  await page.waitForTimeout(350)
  return readPageState(page)
}

async function dragMouse(page, fromX, toX) {
  await page.mouse.move(fromX, 520)
  await page.mouse.down()
  await page.mouse.move(toX, 520, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(450)
  return readPageState(page)
}

async function dragTouch(page, fromX, toX) {
  const client = await page.context().newCDPSession(page)
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y: 520 }] })
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: toX, y: 520 }] })
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await page.waitForTimeout(450)
  return readPageState(page)
}

async function assertPlayingInputMoves(page) {
  await clickStartButton(page)
  await page.waitForTimeout(700)
  const start = await readPageState(page)
  const afterRight = await holdKey(page, "KeyD", 320)
  const rightLane = parseNumber(afterRight.laneX)
  assertQa(rightLane > parseNumber(start.laneX) + minLaneDelta, "KeyD did not move squad right.")

  const afterLeft = await holdKey(page, "KeyA", 520)
  const leftLane = parseNumber(afterLeft.laneX)
  assertQa(leftLane < rightLane - minLaneDelta, "KeyA did not move squad left.")

  const afterMouse = await dragMouse(page, 150, 330)
  const mouseLane = parseNumber(afterMouse.laneX)
  assertQa(mouseLane > leftLane + minLaneDelta, "Mouse drag did not move squad right.")

  const afterTouch = await dragTouch(page, 330, 90)
  const touchLane = parseNumber(afterTouch.laneX)
  assertQa(touchLane < mouseLane - minLaneDelta, "Touch drag did not move squad left.")
  assertQa(parseNumber(afterTouch.progress) > parseNumber(start.progress), "Game did not advance while testing input.")
  assertQa(afterTouch.scrollX === 0 && afterTouch.scrollY === 0, "Playing input moved page scroll position.")
}

function stopPreview(preview) {
  return new Promise((resolveStop) => {
    if (preview.exitCode !== null) {
      resolveStop()
      return
    }
    const timeout = setTimeout(() => {
      if (preview.exitCode === null) {
        preview.kill("SIGKILL")
      }
      resolveStop()
    }, 2000)
    preview.once("exit", () => {
      clearTimeout(timeout)
      resolveStop()
    })
    preview.kill("SIGTERM")
  })
}

const port = await findFreePort()
const previewUrl = `http://127.0.0.1:${port}/`
const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "ignore",
})

try {
  await waitForPreview(previewUrl)
  const browser = await chromium.launch({ channel: "chrome" })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto(previewUrl, { waitUntil: "networkidle" })
  await assertPreStartInputBlocked(page)
  await assertPlayingInputMoves(page)
  const finalState = await readPageState(page)
  await browser.close()
  console.info(JSON.stringify({ finalState }, null, 2))
} finally {
  await stopPreview(preview)
}
