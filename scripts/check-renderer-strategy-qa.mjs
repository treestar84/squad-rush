import { spawn } from "node:child_process"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(".")

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
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

function collectMessages(page) {
  const consoleMessages = []
  const pageErrors = []
  page.on("console", (msg) => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })
  return { consoleMessages, pageErrors }
}

async function openRendererPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const messages = collectMessages(page)
  await page.goto(url, { waitUntil: "networkidle" })
  await page.waitForFunction(() => document.querySelector("#start-screen") !== null, null, { timeout: 15000 })
  await page.waitForTimeout(500)
  await page.close()
  return messages
}

function assertDefaultRenderer(messages) {
  assertQa(messages.pageErrors.length === 0, `Default renderer page errors: ${messages.pageErrors.join(" | ")}`)
  assertNoAssetFallback(messages, "Default renderer")
  assertQa(messages.consoleMessages.some((line) => line.includes("[Renderer] WebGL2 enabled")), "Default renderer did not enable WebGL2.")
  assertQa(!messages.consoleMessages.some((line) => line.includes("[Renderer] WebGPU enabled")), "Default renderer should not enable WebGPU.")
}

function assertWebGpuOption(messages) {
  assertQa(messages.pageErrors.length === 0, `WebGPU option page errors: ${messages.pageErrors.join(" | ")}`)
  assertNoAssetFallback(messages, "WebGPU option")
  const enabled = messages.consoleMessages.some((line) => line.includes("[Renderer] WebGPU enabled"))
  const fallback = messages.consoleMessages.some((line) => line.includes("falling back to WebGL2"))
    && messages.consoleMessages.some((line) => line.includes("[Renderer] WebGL2 enabled"))
  assertQa(enabled || fallback, "WebGPU option neither enabled WebGPU nor fell back to WebGL2.")
}

function assertNoAssetFallback(messages, label) {
  const fallbackWarnings = messages.consoleMessages.filter((line) => line.includes("unavailable, using procedural fallback"))
  assertQa(fallbackWarnings.length === 0, `${label} asset fallback warnings: ${fallbackWarnings.join(" | ")}`)
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
const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: "ignore" },
)

try {
  await waitForPreview(previewUrl)
  const browser = await chromium.launch({ channel: "chrome" })
  const defaultMessages = await openRendererPage(browser, previewUrl)
  const webgpuMessages = await openRendererPage(browser, `${previewUrl}?renderer=webgpu`)
  await browser.close()
  assertDefaultRenderer(defaultMessages)
  assertWebGpuOption(webgpuMessages)
  console.info(JSON.stringify({ defaultMessages, webgpuMessages }, null, 2))
} finally {
  await stopPreview(preview)
}
