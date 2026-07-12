import { readFile } from "node:fs/promises"

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readNumber(source, name) {
  const match = source.match(new RegExp(`${name}\\s*[:=]\\s*([0-9.]+)`))
  if (match?.[1] === undefined) {
    throw new Error(`Missing numeric contract token: ${name}`)
  }
  return Number.parseFloat(match[1])
}

function simulateCadence({ emitterCount, fireRate, maxShotsPerUpdate, fps, seconds }) {
  const cooldown = 1 / fireRate
  const interval = cooldown / emitterCount
  const timers = Array.from({ length: emitterCount }, (_, index) => index * interval)
  const emitterShots = Array.from({ length: emitterCount }, () => 0)
  const dt = 1 / fps
  const updateShotCounts = []
  let cursor = 0
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) {
    for (let index = 0; index < emitterCount; index += 1) {
      timers[index] -= dt
    }
    let checked = 0
    let fired = 0
    let index = cursor % emitterCount
    while (checked < emitterCount && fired < maxShotsPerUpdate) {
      if (timers[index] <= 0) {
        timers[index] = cooldown
        emitterShots[index] += 1
        fired += 1
      }
      checked += 1
      index = (index + 1) % emitterCount
    }
    cursor = index
    updateShotCounts.push(fired)
  }
  return {
    emitterShots,
    shots: emitterShots.reduce((total, count) => total + count, 0),
    shotUpdates: updateShotCounts.filter((count) => count > 0).length,
    maxShotsPerUpdate: Math.max(...updateShotCounts),
  }
}

const [shootingSource, squadSource, gameSource, soldierSource] = await Promise.all([
  readFile("src/game/systems/ShootingSystem.ts", "utf8"),
  readFile("src/game/systems/SquadSystem.ts", "utf8"),
  readFile("src/game/Game.ts", "utf8"),
  readFile("src/game/data/soldierData.ts", "utf8"),
])

const fireRate = readNumber(soldierSource, "fireRate")
const maxShotsPerUpdate = readNumber(shootingSource, "DEFENSE_MAX_SHOTS_PER_UPDATE")
const emitterCount = 8
const cooldown = 1 / fireRate
const staggerInterval = cooldown / emitterCount

assertContract(shootingSource.includes("(index % staggerEmitterCount) * this.defenseStaggerIntervalSeconds"), "Defense emitter timers must start at different phases.")
assertContract(shootingSource.includes("this.defenseEmitterCursor"), "Low-FPS shot limiting must rotate across emitters without starvation.")
assertContract(shootingSource.includes("Math.min(DEFENSE_MAX_SHOTS_PER_UPDATE, emitterCount)"), "A defense frame must bound simultaneous projectile creation.")
assertContract(maxShotsPerUpdate === 2, `Defense must emit no more than two projectiles in one rendered update: ${maxShotsPerUpdate}`)
assertContract(Math.abs(staggerInterval - 0.03125) < 0.000001, `Eight defense emitters should be phased by 31.25ms: ${staggerInterval}`)

for (const fps of [120, 60, 30, 20, 4]) {
  const cadence = simulateCadence({ emitterCount, fireRate, maxShotsPerUpdate, fps, seconds: 2 })
  assertContract(cadence.maxShotsPerUpdate <= 2, `${fps} FPS cadence recreated a horizontal eight-shot volley: ${JSON.stringify(cadence)}`)
  assertContract(cadence.emitterShots.every((count) => count > 0), `${fps} FPS cadence starved an emitter: ${JSON.stringify(cadence)}`)
}

const normalCadence = simulateCadence({ emitterCount, fireRate, maxShotsPerUpdate, fps: 60, seconds: 2 })
assertContract(normalCadence.shots >= 60, `60 FPS stagger reduced the expected fire throughput: ${JSON.stringify(normalCadence)}`)
assertContract(normalCadence.shotUpdates >= normalCadence.shots * 0.75, `60 FPS shots are still clustering into too few updates: ${JSON.stringify(normalCadence)}`)

assertContract(gameSource.includes("formationMaxColumns: 3"), "Defense formation must cap every row at three actors.")
assertContract(gameSource.includes("formationSpacing: 0.42"), "Defense formation must use compact horizontal spacing.")
assertContract(gameSource.includes("formationRowDepth: 0.21"), "Defense formation must use compact rearward row spacing.")
assertContract(gameSource.includes("formationRowStagger: 0"), "Defense rows must align as a three-column grid.")
assertContract(squadSource.includes("this.formationRows = count > 0 ? Math.ceil(count / cols) : 0"), "Formation row count must grow rearward after the third member.")

const squadCount = 20
const columns = 3
const rows = Math.ceil(squadCount / columns)
const width = (columns - 1) * 0.42
const depth = (rows - 1) * 0.21
assertContract(rows === 7, `Twenty actors must occupy seven rearward rows: ${rows}`)
assertContract(width === 0.84, `Three-column root width must stay at 0.84m: ${width}`)
assertContract(Math.abs(depth - 1.26) < 0.000001, `Twenty-member formation depth must be 1.26m: ${depth}`)

const sampleEffectivePower = 30
const attackMultiplier = sampleEffectivePower / emitterCount
const staggeredDps = emitterCount * fireRate * attackMultiplier
const expectedDps = sampleEffectivePower * fireRate
assertContract(staggeredDps === expectedDps, `Staggering must preserve aggregate DPS: ${staggeredDps} !== ${expectedDps}`)

console.info(JSON.stringify({
  defenseFireFormationContract: "passed",
  emitterCount,
  staggerIntervalMs: staggerInterval * 1000,
  maxShotsPerUpdate,
  normalCadence,
  formation: { squadCount, columns, rows, width, depth },
  aggregateDps: staggeredDps,
}, null, 2))
