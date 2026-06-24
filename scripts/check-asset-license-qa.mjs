import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"

const licensePath = resolve("public/assets/LICENSES.md")
const loaderPath = resolve("src/game/utils/assetLoader.ts")

const runtimeAssets = [
  { path: "public/assets/models/soldier.gltf", loaderName: "soldier.gltf", format: "gltf", minBytes: 1000000, minMeshes: 8, minAnimations: 4 },
  { path: "public/assets/models/ghost.gltf", loaderName: "ghost.gltf", format: "gltf", minBytes: 100000, minMeshes: 1, minAnimations: 4 },
  { path: "public/assets/models/monster_basic.glb", loaderName: "monster_basic.glb", format: "glb", minBytes: 100000 },
  { path: "public/assets/models/monster_tank.glb", loaderName: "monster_tank.glb", format: "glb", minBytes: 8000 },
  { path: "public/assets/models/yeti.gltf", loaderName: "yeti.gltf", format: "gltf", minBytes: 100000, minMeshes: 1, minAnimations: 4 },
  { path: "public/assets/models/environment/road_segment.glb", loaderName: "environment/road_segment.glb", format: "glb", minBytes: 8000 },
  { path: "public/assets/models/environment/gate_frame.glb", loaderName: "environment/gate_frame.glb", format: "glb", minBytes: 8000 },
]

function assertAsset(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parseGltf(text, path) {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${path} is not valid JSON glTF: ${error.message}`)
    }
    throw error
  }
}

async function assertGltf(asset) {
  const text = await readFile(asset.path, "utf8")
  const gltf = parseGltf(text, asset.path)
  assertAsset(gltf.asset?.version === "2.0", `${asset.path} is not glTF 2.0.`)
  assertAsset((gltf.meshes?.length ?? 0) >= asset.minMeshes, `${asset.path} has too few meshes.`)
  assertAsset((gltf.animations?.length ?? 0) >= asset.minAnimations, `${asset.path} has too few animations.`)
  assertAsset((gltf.buffers?.length ?? 0) > 0, `${asset.path} has no buffers.`)
}

async function assertGlb(asset) {
  const bytes = await readFile(asset.path)
  assertAsset(bytes.subarray(0, 4).toString("utf8") === "glTF", `${asset.path} is not a GLB file.`)
  assertAsset(bytes.readUInt32LE(4) === 2, `${asset.path} is not GLB version 2.`)
}

function assertLicenseEntry(licenseText, path) {
  const start = licenseText.indexOf(`### \`${path}\``)
  assertAsset(start >= 0, `${path} is missing from public/assets/LICENSES.md.`)
  const rest = licenseText.slice(start)
  const next = rest.indexOf("\n### `", 1)
  const section = next >= 0 ? rest.slice(0, next) : rest
  assertAsset(section.includes("License basis:"), `${path} license basis is missing.`)
  assertAsset(section.includes("Commercial use: yes"), `${path} commercial-use clearance is missing.`)
  assertAsset(section.includes("Raw redistribution:"), `${path} raw redistribution rule is missing.`)
}

async function assertRuntimeAsset(asset, licenseText, loaderText) {
  const file = await stat(asset.path)
  assertAsset(file.size >= asset.minBytes, `${asset.path} is smaller than expected.`)
  assertAsset(loaderText.includes(`"${asset.loaderName}"`), `${asset.loaderName} is not loaded by assetLoader.ts.`)
  assertLicenseEntry(licenseText, asset.path)
  if (asset.format === "gltf") {
    await assertGltf(asset)
    return
  }
  await assertGlb(asset)
}

const licenseText = await readFile(licensePath, "utf8")
const loaderText = await readFile(loaderPath, "utf8")
const results = []
for (const asset of runtimeAssets) {
  await assertRuntimeAsset(asset, licenseText, loaderText)
  results.push(asset.path)
}

assertAsset(licenseText.includes("Adobe Mixamo FAQ"), "Mixamo source reference is missing.")
assertAsset(licenseText.includes("Quaternius Ultimate Monsters"), "Quaternius source reference is missing.")
assertAsset(licenseText.includes("Kenney support/license guidance"), "Kenney source reference is missing.")

console.info(JSON.stringify({ runtimeAssets: results }, null, 2))
