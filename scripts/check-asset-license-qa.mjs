import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"

const licensePath = resolve("public/assets/LICENSES.md")
const loaderPath = resolve("src/game/utils/assetLoader.ts")
const environmentModePath = resolve("src/game/EnvironmentMode.ts")
const attackBuildingPath = resolve("src/game/systems/AttackBuildingSystem.ts")
const gateVisualFactoryPath = resolve("src/game/systems/GateVisualFactory.ts")
const defenseCastlePath = resolve("src/game/systems/DefenseCastleEnvironmentSystem.ts")
const defenseCastleKitPath = resolve("src/game/systems/DefenseCastleEnvironmentKit.ts")

const runtimeAssets = [
  { path: "public/assets/models/soldier.gltf", loaderName: "soldier.gltf", format: "gltf", minBytes: 1000000, minMeshes: 8, minAnimations: 4 },
  { path: "public/assets/models/ghost.gltf", loaderName: "ghost.gltf", format: "gltf", minBytes: 100000, minMeshes: 1, minAnimations: 4 },
  { path: "public/assets/models/monster_basic.glb", loaderName: "monster_basic.glb", format: "glb", minBytes: 100000 },
  { path: "public/assets/models/monster_tank.glb", loaderName: "monster_tank.glb", format: "glb", minBytes: 8000 },
  { path: "public/assets/models/yeti.gltf", loaderName: "yeti.gltf", format: "gltf", minBytes: 100000, minMeshes: 1, minAnimations: 4 },
  { path: "public/assets/models/squad/pangyo_runner.glb", loaderName: "squad/pangyo_runner.glb", format: "glb", minBytes: 100000 },
  { path: "public/assets/models/pickups/pangyo_man.glb", loaderName: "pickups/pangyo_man.glb", format: "glb", minBytes: 100000 },
  { path: "public/assets/models/environment/attack_buildings/nc.glb", loaderName: "environment/attack_buildings/nc.glb", format: "glb", minBytes: 1000000 },
  { path: "public/assets/models/environment/attack_buildings/new_office.glb", loaderName: "environment/attack_buildings/new_office.glb", format: "glb", minBytes: 1000000 },
  { path: "public/assets/models/environment/attack_buildings/alparium.glb", loaderName: "environment/attack_buildings/alparium.glb", format: "glb", minBytes: 1000000 },
  { path: "public/assets/models/environment/attack_buildings/avenue.glb", loaderName: "environment/attack_buildings/avenue.glb", format: "glb", minBytes: 1000000 },
  { path: "public/assets/models/environment/defense/portal.glb", loaderName: "environment/defense/portal.glb", format: "glb", minBytes: 1000000 },
  { path: "public/assets/textures/defense_cobblestone.webp", loaderName: "/assets/textures/defense_cobblestone.webp", format: "webp", minBytes: 10000 },
  { path: "public/assets/textures/attack_dirt_ground.webp", loaderName: "/assets/textures/attack_dirt_ground.webp", format: "webp", minBytes: 10000 },
  { path: "public/assets/textures/attack_dirt_ground_hard.webp", loaderName: "/assets/textures/attack_dirt_ground_hard.webp", format: "webp", minBytes: 10000 },
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

async function assertWebp(asset) {
  const bytes = await readFile(asset.path)
  assertAsset(bytes.subarray(0, 4).toString("ascii") === "RIFF", `${asset.path} is not a RIFF container.`)
  assertAsset(bytes.subarray(8, 12).toString("ascii") === "WEBP", `${asset.path} is not a WebP file.`)
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
  assertAsset(loaderText.includes(`"${asset.loaderName}"`), `${asset.loaderName} is not loaded by runtime asset code.`)
  assertLicenseEntry(licenseText, asset.path)
  if (asset.format === "gltf") {
    await assertGltf(asset)
    return
  }
  if (asset.format === "webp") {
    await assertWebp(asset)
    return
  }
  await assertGlb(asset)
}

const licenseText = await readFile(licensePath, "utf8")
const loaderText = [
  await readFile(loaderPath, "utf8"),
  await readFile(environmentModePath, "utf8"),
  await readFile(attackBuildingPath, "utf8"),
  await readFile(gateVisualFactoryPath, "utf8"),
  await readFile(defenseCastlePath, "utf8"),
  await readFile(defenseCastleKitPath, "utf8"),
].join("\n")
assertAsset(!loaderText.includes("/assets/textures/gate_portal_"), "Illustrated gate portal textures must not be part of runtime gate visuals.")
const results = []
for (const asset of runtimeAssets) {
  await assertRuntimeAsset(asset, licenseText, loaderText)
  results.push(asset.path)
}

assertAsset(licenseText.includes("Adobe Mixamo FAQ"), "Mixamo source reference is missing.")
assertAsset(licenseText.includes("Quaternius Ultimate Monsters"), "Quaternius source reference is missing.")
assertAsset(licenseText.includes("Kenney support/license guidance"), "Kenney source reference is missing.")

console.info(JSON.stringify({ runtimeAssets: results }, null, 2))
