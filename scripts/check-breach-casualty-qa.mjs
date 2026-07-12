import { spawn } from "node:child_process"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { clickStartButton } from "./lib/startGame.mjs"

const root = resolve(".")
const viewport = { width: 390, height: 844 }

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

function countOf(snapshot, label) {
  return snapshot.roster.find((entry) => entry.label === label)?.count ?? 0
}

async function readSnapshot(page) {
  return page.evaluate(() => window.__squadRushBreachQa?.snapshot() ?? null)
}

async function installCasualtyObserver(page) {
  await page.evaluate(() => {
    window.__breachCasualtyBadges = []
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains("hud-casualty-badge")) {
            window.__breachCasualtyBadges?.push({
              label: node.getAttribute("aria-label") ?? "",
              text: node.textContent ?? "",
            })
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

async function readCasualtyBadges(page) {
  return page.evaluate(() => window.__breachCasualtyBadges ?? [])
}

async function runBreachCase(browser, baseUrl, mode) {
  const isDefense = mode === "defense"
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${baseUrl}?mode=${mode}&difficulty=easy&quality=low&qa=breach&qaSoldiers=2`, { waitUntil: "networkidle" })
  await installCasualtyObserver(page)
  await clickStartButton(page)
  await page.waitForFunction(() => window.__squadRushBreachQa !== undefined, null, { timeout: 15000 })

  const before = await readSnapshot(page)
  assertQa(before !== null, `${mode}: breach QA hook was not installed.`)
  assertQa(countOf(before, "판교인") === (isDefense ? 0 : 1), `${mode}: unexpected Pangyo start roster.`)
  assertQa(countOf(before, "병사") === (isDefense ? 3 : 2), `${mode}: unexpected soldier start roster.`)

  await page.evaluate(() => window.__squadRushBreachQa?.applyBreaches(1))
  const afterOne = await readSnapshot(page)
  assertQa(afterOne !== null, `${mode}: missing snapshot after first breach.`)
  assertQa(afterOne.soldiers === 2, `${mode}: first breach should leave two squad members, got ${afterOne.soldiers}.`)
  assertQa(countOf(afterOne, "판교인") === 0, `${mode}: no Pangyo should remain after the first breach.`)
  assertQa(countOf(afterOne, "병사") === 2, `${mode}: first breach should leave two soldiers.`)
  assertQa(!afterOne.gameOver, `${mode}: first breach should not end a three-member squad.`)
  const afterOneBadges = await readCasualtyBadges(page)
  assertQa(
    afterOneBadges.some((badge) => badge.label.includes(`${isDefense ? "병사" : "판교인"} 1 lost`) && badge.text.includes("X")),
    `${mode}: first casualty did not emit the expected red X portrait badge: ${JSON.stringify(afterOneBadges)}`,
  )

  await page.evaluate(() => window.__squadRushBreachQa?.applyBreaches(2))
  await page.waitForFunction(() => window.__squadRushBreachQa?.snapshot().gameOver === true, null, { timeout: 5000 })
  const afterThree = await readSnapshot(page)
  assertQa(afterThree !== null, `${mode}: missing snapshot after lethal breach.`)
  assertQa(afterThree.soldiers === 0, `${mode}: third breach should remove the last squad members.`)
  assertQa(afterThree.gameOver, `${mode}: lethal breach must end the game.`)
  const afterThreeBadges = await readCasualtyBadges(page)
  assertQa(
    afterThreeBadges.some((badge) => badge.label.includes("병사 2 lost") && badge.text.includes("X") && badge.text.includes("2x")),
    `${mode}: lethal soldier casualties did not emit a red X 2x portrait badge: ${JSON.stringify(afterThreeBadges)}`,
  )

  await page.close()
  assertQa(consoleErrors.length === 0, `${mode}: console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `${mode}: page errors detected: ${pageErrors.join(" | ")}`)
  return { mode, before, afterOne, afterThree }
}

async function runNaturalDefenseBreachCase(browser, baseUrl) {
  const page = await browser.newPage({ viewport })
  const consoleErrors = []
  const pageErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(`${baseUrl}?mode=defense&difficulty=easy&quality=low&qa=monsters&qa=breach&qaSoldiers=3&qaSpeed=3`, { waitUntil: "networkidle" })
  await installCasualtyObserver(page)
  await clickStartButton(page)
  await page.waitForFunction(() => window.__squadRushBreachQa !== undefined && window.__squadRushGameModeDebug?.mode === "defense", null, { timeout: 15000 })

  const before = await readSnapshot(page)
  assertQa(before !== null, "defense natural breach: missing initial snapshot.")
  assertQa(before.soldiers === 4, `defense natural breach: expected four starting members, got ${before.soldiers}.`)

  await page.waitForFunction(() => {
    const snapshot = window.__squadRushBreachQa?.snapshot()
    return snapshot !== undefined && snapshot.soldiers < 4
  }, null, { timeout: 30000 })
  const afterDamage = await readSnapshot(page)
  assertQa(afterDamage !== null, "defense natural breach: missing damage snapshot.")
  assertQa(afterDamage.soldiers < before.soldiers, "defense natural breach: escaped monsters did not reduce squad population.")
  assertQa(!afterDamage.gameOver, "defense natural breach: first escaped monsters should damage before final defeat.")

  await page.waitForFunction(() => window.__squadRushBreachQa?.snapshot().gameOver === true, null, { timeout: 30000 })
  const afterDefeat = await readSnapshot(page)
  const resultTitle = await page.locator(".result-title").textContent()
  await page.close()

  assertQa(afterDefeat !== null, "defense natural breach: missing defeat snapshot.")
  assertQa(afterDefeat.soldiers === 0, `defense natural breach: lethal escaped monsters should remove all members, got ${afterDefeat.soldiers}.`)
  assertQa(afterDefeat.gameOver, "defense natural breach: lethal escaped monsters must end the game.")
  assertQa(resultTitle === "DEFEAT", `defense natural breach: expected DEFEAT result, got ${resultTitle}.`)
  assertQa(consoleErrors.length === 0, `defense natural breach: console errors detected: ${consoleErrors.join(" | ")}`)
  assertQa(pageErrors.length === 0, `defense natural breach: page errors detected: ${pageErrors.join(" | ")}`)
  return { mode: "defense-natural", before, afterDamage, afterDefeat }
}

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
  await waitForPreview(previewUrl)
  browser = await chromium.launch({ channel: "chrome" })
  const results = [
    await runBreachCase(browser, previewUrl, "run"),
    await runBreachCase(browser, previewUrl, "defense"),
    await runNaturalDefenseBreachCase(browser, previewUrl),
  ]
  console.info(JSON.stringify({ breachCasualtyQa: results }, null, 2))
} finally {
  await browser?.close()
  cleanup()
}
