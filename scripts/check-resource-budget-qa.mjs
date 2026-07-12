import { readdir, readFile, stat } from "node:fs/promises"
import { extname, join, relative } from "node:path"

const runtimeBudgetBytes = 8 * 1024 * 1024
const maxSingleAssetBytes = 3 * 1024 * 1024
const maxLooseRasterBytes = 64 * 1024

const assetRoot = "public/assets"
const optionalDesktopAssetPrefix = "public/assets/models/environment/attack_buildings/"
const optionalDefenseAssetPrefix = "public/assets/models/environment/defense/"
const optionalDesktopBudgetBytes = 8 * 1024 * 1024
const optionalDefenseBudgetBytes = 3 * 1024 * 1024
const gltfPolicies = [
  {
    path: "public/assets/models/soldier.gltf",
    maxBytes: 2.5 * 1024 * 1024,
    maxImages: 0,
    maxExternalImages: 0,
    label: "soldier animated rig",
  },
  {
    path: "public/assets/models/ghost.gltf",
    maxBytes: 600 * 1024,
    maxImages: 1,
    maxExternalImages: 0,
    label: "ghost lightweight material atlas",
  },
  {
    path: "public/assets/models/yeti.gltf",
    maxBytes: 700 * 1024,
    maxImages: 1,
    maxExternalImages: 0,
    label: "yeti lightweight material atlas",
  },
]

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(path)))
      continue
    }
    if (entry.isFile()) {
      files.push(path)
    }
  }
  return files
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function isRasterAsset(path) {
  return [".png", ".jpg", ".jpeg", ".webp"].includes(extname(path).toLowerCase())
}

function isForbiddenSourceAsset(path) {
  return [".fbx", ".prefab", ".blend", ".max", ".ma", ".mb"].includes(extname(path).toLowerCase())
}

async function readGltfPolicy(policy) {
  const text = await readFile(policy.path, "utf8")
  const gltf = parseJson(text, policy.path)
  const file = await stat(policy.path)
  const images = Array.isArray(gltf.images) ? gltf.images : []
  const textures = Array.isArray(gltf.textures) ? gltf.textures : []
  const externalImages = images.filter((image) => typeof image.uri === "string" && !image.uri.startsWith("data:"))
  const embeddedImages = images.filter((image) => image.bufferView !== undefined || typeof image.uri === "string" && image.uri.startsWith("data:"))

  assertQa(file.size <= policy.maxBytes, `${policy.path} exceeds policy budget (${file.size} > ${policy.maxBytes}).`)
  assertQa(images.length <= policy.maxImages, `${policy.path} has too many images (${images.length} > ${policy.maxImages}).`)
  assertQa(externalImages.length <= policy.maxExternalImages, `${policy.path} uses loose external texture images.`)
  assertQa(textures.length <= Math.max(1, policy.maxImages), `${policy.path} has too many texture slots.`)
  if (policy.maxImages > 0) {
    assertQa(embeddedImages.length === images.length, `${policy.path} texture atlas must be embedded or KTX2-ready, not loose.`)
  }

  return {
    path: policy.path,
    label: policy.label,
    bytes: file.size,
    images: images.length,
    textures: textures.length,
    externalImages: externalImages.length,
  }
}

const files = await walkFiles(assetRoot)
const fileStats = await Promise.all(
  files.map(async (path) => {
    const file = await stat(path)
    return {
      path: relative(".", path),
      bytes: file.size,
    }
  }),
)

const optionalDesktopFiles = fileStats.filter((file) => file.path.startsWith(optionalDesktopAssetPrefix))
const optionalDefenseFiles = fileStats.filter((file) => file.path.startsWith(optionalDefenseAssetPrefix))
const commonRuntimeFiles = fileStats.filter((file) => {
  return !file.path.startsWith(optionalDesktopAssetPrefix)
    && !file.path.startsWith(optionalDefenseAssetPrefix)
})
const totalBytes = commonRuntimeFiles.reduce((sum, file) => sum + file.bytes, 0)
const optionalDesktopBytes = optionalDesktopFiles.reduce((sum, file) => sum + file.bytes, 0)
const optionalDefenseBytes = optionalDefenseFiles.reduce((sum, file) => sum + file.bytes, 0)
const largest = [...commonRuntimeFiles].sort((a, b) => b.bytes - a.bytes)[0]
const looseRasterFiles = commonRuntimeFiles.filter((file) => isRasterAsset(file.path))
const oversizedLooseRasterFiles = looseRasterFiles.filter((file) => file.bytes > maxLooseRasterBytes)
const forbiddenSourceFiles = commonRuntimeFiles.filter((file) => isForbiddenSourceAsset(file.path))

assertQa(totalBytes <= runtimeBudgetBytes, `runtime assets exceed 8MB budget (${totalBytes} > ${runtimeBudgetBytes}).`)
assertQa(largest !== undefined, "public/assets has no runtime assets.")
assertQa(largest.bytes <= maxSingleAssetBytes, `${largest.path} exceeds 3MB single-file budget.`)
assertQa(optionalDesktopBytes <= optionalDesktopBudgetBytes, `optional desktop assets exceed 8MB budget (${optionalDesktopBytes} > ${optionalDesktopBudgetBytes}).`)
assertQa(optionalDefenseBytes <= optionalDefenseBudgetBytes, `optional defense assets exceed 3MB budget (${optionalDefenseBytes} > ${optionalDefenseBudgetBytes}).`)
for (const file of optionalDesktopFiles) {
  assertQa(file.bytes <= maxSingleAssetBytes, `${file.path} exceeds 3MB single-file budget.`)
}
for (const file of optionalDefenseFiles) {
  assertQa(file.bytes <= maxSingleAssetBytes, `${file.path} exceeds 3MB single-file budget.`)
}
assertQa(oversizedLooseRasterFiles.length === 0, `loose raster textures exceed 64KB: ${oversizedLooseRasterFiles.map((file) => file.path).join(", ")}`)
assertQa(forbiddenSourceFiles.length === 0, `source-format assets are not runtime-ready: ${forbiddenSourceFiles.map((file) => file.path).join(", ")}`)

const packageJson = parseJson(await readFile("package.json", "utf8"), "package.json")
assertQa(packageJson.dependencies?.["@babylonjs/ktx2decoder"] !== undefined, "Babylon KTX2 decoder dependency is missing.")

const prdText = await readFile("prd.md", "utf8")
const designText = await readFile("DESIGN.md", "utf8")
const pipelineText = await readFile("scripts/download-assets.sh", "utf8")
assertQa(prdText.includes("Texture: KTX2/Basis"), "PRD KTX2/Basis texture requirement is missing.")
assertQa(designText.includes("Resource budget QA"), "DESIGN.md resource budget QA policy is missing.")
assertQa(designText.includes("lightweight embedded material atlases"), "DESIGN.md lightweight atlas policy is missing.")
assertQa(pipelineText.includes("commercial-use GLB/KTX2/audio files"), "asset pipeline script does not mention GLB/KTX2/audio upgrade targets.")

const gltfSummaries = []
for (const policy of gltfPolicies) {
  gltfSummaries.push(await readGltfPolicy(policy))
}

console.info(
  JSON.stringify(
    {
      runtimeBudgetBytes,
      totalBytes,
      optionalDesktopBytes,
      optionalDesktopFiles,
      optionalDefenseBytes,
      optionalDefenseFiles,
      largest,
      looseRasterFiles,
      gltfSummaries,
    },
    null,
    2,
  ),
)
