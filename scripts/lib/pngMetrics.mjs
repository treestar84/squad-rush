import { readFile } from "node:fs/promises"
import { inflateSync } from "node:zlib"

const pngSignature = "89504e470d0a1a0a"
const sampleStep = 4

function assertPng(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function chunkType(buffer, offset) {
  return buffer.toString("ascii", offset + 4, offset + 8)
}

function bytesPerPixel(colorType) {
  if (colorType === 6) {
    return 4
  }
  if (colorType === 2) {
    return 3
  }
  throw new Error(`Unsupported PNG color type: ${colorType}`)
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upLeftDistance = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left
  }
  return upDistance <= upLeftDistance ? up : upLeft
}

function scanlineValue(filter, values) {
  switch (filter) {
    case 0:
      return 0
    case 1:
      return values.left
    case 2:
      return values.up
    case 3:
      return Math.floor((values.left + values.up) / 2)
    case 4:
      return paethPredictor(values.left, values.up, values.upLeft)
    default:
      throw new Error(`Unsupported PNG filter: ${filter}`)
  }
}

function decodeScanlines(raw, meta) {
  const stride = meta.width * meta.channels
  const decoded = Buffer.alloc(stride * meta.height)
  let rawOffset = 0
  for (let y = 0; y < meta.height; y += 1) {
    const filter = raw[rawOffset]
    rawOffset += 1
    const row = raw.subarray(rawOffset, rawOffset + stride)
    rawOffset += stride
    const dst = decoded.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? decoded.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x += 1) {
      const values = {
        left: x >= meta.channels ? dst[x - meta.channels] : 0,
        up: prev === null ? 0 : prev[x],
        upLeft: prev !== null && x >= meta.channels ? prev[x - meta.channels] : 0,
      }
      dst[x] = (row[x] + scanlineValue(filter, values)) & 255
    }
  }
  return decoded
}

function parsePng(buffer, label) {
  assertPng(buffer.subarray(0, 8).toString("hex") === pngSignature, `${label} is not a PNG file.`)
  let offset = 8
  let width = 0
  let height = 0
  let channels = 0
  const idatChunks = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = chunkType(buffer, offset)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      assertPng(data[8] === 8, `${label} must be 8-bit PNG.`)
      channels = bytesPerPixel(data[9])
    }
    if (type === "IDAT") {
      idatChunks.push(data)
    }
    if (type === "IEND") {
      break
    }
    offset += length + 12
  }
  assertPng(width > 0 && height > 0 && channels > 0, `${label} PNG metadata is incomplete.`)
  return { width, height, channels, data: decodeScanlines(inflateSync(Buffer.concat(idatChunks)), { width, height, channels }) }
}

function luminance(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function isRoadLike(red, green, blue, lum) {
  return Math.abs(red - green) < 28 && Math.abs(green - blue) < 28 && lum > 70 && lum < 225
}

function isSkyLike(red, green, blue, lum) {
  return blue > red * 1.15 && blue > green * 0.85 && lum > 90
}

function isRedThreat(red, green, blue) {
  return red > 120 && red > green * 1.28 && red > blue * 1.12
}

function isOrangeCue(red, green, blue) {
  return red > 150 && green > 50 && green < 170 && blue < 100
}

function isNeutralGrey(red, green, blue) {
  return Math.abs(red - green) < 28 && Math.abs(green - blue) < 28 && red > 60 && red < 180
}

function analyzeImageRegion(image, region) {
  const colors = new Set()
  let samples = 0
  let luminanceSum = 0
  let luminanceSquareSum = 0
  let chromaSum = 0
  let edgeCount = 0
  let activeCount = 0
  let roadLikeCount = 0
  let skyLikeCount = 0
  let redThreatCount = 0
  let orangeCueCount = 0
  let neutralGreyCount = 0
  for (let y = region.y0; y < region.y1; y += sampleStep) {
    for (let x = region.x0; x < region.x1; x += sampleStep) {
      const index = (y * image.width + x) * image.channels
      const red = image.data[index]
      const green = image.data[index + 1]
      const blue = image.data[index + 2]
      const lum = luminance(red, green, blue)
      samples += 1
      luminanceSum += lum
      luminanceSquareSum += lum * lum
      chromaSum += Math.max(red, green, blue) - Math.min(red, green, blue)
      colors.add(`${red >> 4},${green >> 4},${blue >> 4}`)
      if (lum > 18 && lum < 238) {
        activeCount += 1
      }
      if (isRoadLike(red, green, blue, lum)) {
        roadLikeCount += 1
      }
      if (isSkyLike(red, green, blue, lum)) {
        skyLikeCount += 1
      }
      if (isRedThreat(red, green, blue)) {
        redThreatCount += 1
      }
      if (isOrangeCue(red, green, blue)) {
        orangeCueCount += 1
      }
      if (isNeutralGrey(red, green, blue)) {
        neutralGreyCount += 1
      }
      if (x + sampleStep < region.x1 && y + sampleStep < region.y1) {
        const rightIndex = (y * image.width + x + sampleStep) * image.channels
        const downIndex = ((y + sampleStep) * image.width + x) * image.channels
        const rightLum = luminance(image.data[rightIndex], image.data[rightIndex + 1], image.data[rightIndex + 2])
        const downLum = luminance(image.data[downIndex], image.data[downIndex + 1], image.data[downIndex + 2])
        if (Math.abs(lum - rightLum) + Math.abs(lum - downLum) > 35) {
          edgeCount += 1
        }
      }
    }
  }
  const mean = luminanceSum / samples
  return {
    colorBuckets: colors.size,
    contrast: Math.sqrt(luminanceSquareSum / samples - mean * mean),
    chroma: chromaSum / samples,
    edgeDensity: edgeCount / samples,
    activeRatio: activeCount / samples,
    roadLikeRatio: roadLikeCount / samples,
    skyLikeRatio: skyLikeCount / samples,
    redThreatRatio: redThreatCount / samples,
    orangeCueRatio: orangeCueCount / samples,
    neutralGreyRatio: neutralGreyCount / samples,
  }
}

export async function analyzePngFile(path, label) {
  const image = parsePng(await readFile(path), label)
  return analyzeImageRegion(image, { x0: 0, y0: 0, x1: image.width, y1: image.height })
}

export async function analyzePngRegionFile(path, label, regionRatio) {
  const image = parsePng(await readFile(path), label)
  return analyzeImageRegion(image, {
    x0: Math.floor(image.width * regionRatio.x0),
    y0: Math.floor(image.height * regionRatio.y0),
    x1: Math.floor(image.width * regionRatio.x1),
    y1: Math.floor(image.height * regionRatio.y1),
  })
}
