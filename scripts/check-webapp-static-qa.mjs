import { spawn } from "node:child_process"
import { readFile, stat } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { resolve } from "node:path"

const rootDir = resolve(".")
const htmlNeedles = [
  "<html lang=\"ko\">",
  "name=\"viewport\"",
  "user-scalable=no",
  "name=\"theme-color\"",
  "name=\"description\"",
  "name=\"mobile-web-app-capable\" content=\"yes\"",
  "name=\"apple-mobile-web-app-capable\" content=\"yes\"",
  "property=\"og:title\" content=\"바로 Go 스쿼드\"",
  "name=\"twitter:card\" content=\"summary\"",
  "rel=\"manifest\" href=\"/manifest.webmanifest\"",
  "rel=\"icon\" type=\"image/svg+xml\" href=\"/assets/ui/icon-192.svg\"",
  "<canvas id=\"game-canvas\"",
  "<title>바로 Go 스쿼드</title>",
]

const iconSpecs = [
  { src: "/assets/ui/icon-192.svg", sizes: "192x192", file: "public/assets/ui/icon-192.svg" },
  { src: "/assets/ui/icon-512.svg", sizes: "512x512", file: "public/assets/ui/icon-512.svg" },
]

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function readText(path) {
  return readFile(resolve(rootDir, path), "utf8")
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function assertReadableFile(path, minBytes) {
  const fileStat = await stat(resolve(rootDir, path))
  assertQa(fileStat.size >= minBytes, `${path} is too small to be a valid app asset`)
}

function assertHtmlShell(html) {
  for (const needle of htmlNeedles) {
    assertQa(html.includes(needle), `index.html missing ${needle}`)
  }
}

function assertManifest(manifest) {
  assertQa(manifest.name === "바로 Go 스쿼드", "manifest name mismatch")
  assertQa(manifest.short_name === "바로 Go 스쿼드", "manifest short_name mismatch")
  assertQa(manifest.start_url === "/", "manifest start_url must be /")
  assertQa(manifest.display === "fullscreen", "manifest display must be fullscreen")
  assertQa(manifest.orientation === "portrait", "manifest orientation must be portrait")
  assertQa(typeof manifest.background_color === "string", "manifest background_color missing")
  assertQa(typeof manifest.theme_color === "string", "manifest theme_color missing")
  assertQa(Array.isArray(manifest.icons), "manifest icons must be an array")
  for (const spec of iconSpecs) {
    const icon = manifest.icons.find((candidate) => candidate.src === spec.src)
    assertQa(icon !== undefined, `manifest missing ${spec.src}`)
    assertQa(icon.sizes === spec.sizes, `${spec.src} size mismatch`)
    assertQa(icon.type === "image/svg+xml", `${spec.src} type mismatch`)
  }
}

function assertSquadCap({ squadSource, gameSource, hudSource, qualitySource }) {
  assertQa(squadSource.includes("MAX_SQUAD_SOLDIERS = 30"), "Squad max cap must be 30")
  assertQa(squadSource.includes("this.maxSoldiers - this.soldiers.length"), "Squad add path must clamp to remaining capacity")
  assertQa(squadSource.includes("get soldierCapacity()"), "Squad capacity getter missing")
  assertQa(squadSource.includes("get isAtMaxSoldiers()"), "Squad max state getter missing")
  assertQa(gameSource.includes("soldierCapacity * 16"), "Projectile pool must use capped squad capacity")
  assertQa(gameSource.includes("soldierMaxed: this.squad.isAtMaxSoldiers"), "HUD stats must expose squad max state")
  assertQa(hudSource.includes("data-role=\"soldier-cap\""), "HUD soldier cap label missing")
  assertQa(hudSource.includes("\"MAX\""), "HUD max state label missing")
  assertQa(qualitySource.includes("maxSoldiers: 30"), "Quality presets must not exceed the gameplay cap")
}

async function assertIcons() {
  for (const spec of iconSpecs) {
    await assertReadableFile(spec.file, 300)
    const iconSvg = await readText(spec.file)
    assertQa(iconSvg.includes("<svg"), `${spec.file} is not svg`)
    assertQa(iconSvg.includes(spec.sizes.split("x")[0]), `${spec.file} does not expose expected size`)
  }
}

function findHeaderRule(vercel, source) {
  return vercel.headers.find((rule) => rule.source === source)
}

function assertCacheRule(vercel, source, requiredValue) {
  const rule = findHeaderRule(vercel, source)
  assertQa(rule !== undefined, `vercel.json missing ${source}`)
  const cacheHeader = rule.headers.find((header) => header.key === "Cache-Control")
  assertQa(cacheHeader?.value === requiredValue, `${source} Cache-Control mismatch`)
}

function assertVercelHeaders(vercel) {
  assertQa(Array.isArray(vercel.headers), "vercel.json headers must be an array")
  assertCacheRule(vercel, "/assets/(.*)", "public, max-age=31536000, immutable")
  assertCacheRule(vercel, "/(.*).html", "no-cache")
  assertCacheRule(vercel, "/manifest.webmanifest", "public, max-age=3600")
}

function requestText(url) {
  return new Promise((resolveRequest, rejectRequest) => {
    const request = get(url, (response) => {
      let body = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => {
        body += chunk
      })
      response.on("end", () => {
        resolveRequest({ status: response.statusCode ?? 0, body })
      })
    })
    request.on("error", rejectRequest)
    request.setTimeout(5000, () => {
      request.destroy(new Error(`Timed out fetching ${url}`))
    })
  })
}

function findFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (address !== null && typeof address === "object") {
          resolvePort(address.port)
        } else {
          rejectPort(new Error("Could not allocate preview port"))
        }
      })
    })
    server.on("error", rejectPort)
  })
}

async function waitForPreview(baseUrl, preview) {
  const start = Date.now()
  while (Date.now() - start < 15000) {
    if (preview.exitCode !== null) {
      throw new Error(`vite preview exited early with code ${preview.exitCode}`)
    }
    try {
      const response = await requestText(`${baseUrl}/`)
      if (response.status === 200) {
        return
      }
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
    }
  }
  throw new Error("vite preview did not become ready")
}

async function assertPreview(baseUrl) {
  const index = await requestText(`${baseUrl}/`)
  assertQa(index.status === 200, "preview root did not return 200")
  assertHtmlShell(index.body)

  const manifest = await requestText(`${baseUrl}/manifest.webmanifest`)
  assertQa(manifest.status === 200, "preview manifest did not return 200")
  assertManifest(parseJson(manifest.body, "preview manifest"))

  for (const spec of iconSpecs) {
    const icon = await requestText(`${baseUrl}${spec.src}`)
    assertQa(icon.status === 200, `preview ${spec.src} did not return 200`)
    assertQa(icon.body.includes("<svg"), `preview ${spec.src} is not svg`)
  }
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

async function main() {
  const sourceHtml = await readText("index.html")
  const manifest = parseJson(await readText("public/manifest.webmanifest"), "manifest")
  const vercel = parseJson(await readText("vercel.json"), "vercel.json")
  const squadSource = await readText("src/game/systems/SquadSystem.ts")
  const gameSource = await readText("src/game/Game.ts")
  const hudSource = await readText("src/ui/Hud.ts")
  const qualitySource = await readText("src/game/systems/QualitySystem.ts")
  assertHtmlShell(sourceHtml)
  assertManifest(manifest)
  assertSquadCap({ squadSource, gameSource, hudSource, qualitySource })
  assertVercelHeaders(vercel)
  await assertIcons()
  await assertReadableFile("dist/index.html", 300)
  await assertReadableFile("dist/manifest.webmanifest", 100)

  const port = await findFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: rootDir,
    stdio: "ignore",
  })
  try {
    await waitForPreview(baseUrl, preview)
    await assertPreview(baseUrl)
  } finally {
    await stopPreview(preview)
  }

  console.info(JSON.stringify({ ok: true, checked: "webapp-static", baseUrl }, null, 2))
}

await main()
