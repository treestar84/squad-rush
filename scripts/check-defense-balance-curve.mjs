import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const curve = JSON.parse(await readFile(resolve("src/game/data/defenseBalanceCurve.json"), "utf8"))
const EXPECTED_CURVE_VERSION = 3
const SENIOR_ATTACK_BONUS = 0.2
const SQUAD_LIMIT = 15
const TRIALS = 2000
const SEED = 20260703
const STAGE_LENGTH = 380 * 2.1
const GATE_AUTHORED_Z = [24, 76, 118, 162, 206, 250, 294, 338]
const STATE_ORDER = ["onboarding_crowd", "contested_pickup", "boss_jam", "recovery_burst", "final_squeeze"]
const UNIT_POWER = {
  PANGYO: 1,
  SOLDIER: 1.5,
  UNEMPLOYED: 0.5,
  DEVELOPER: 1.6,
  OFFICER: 3.5,
  QA: 4,
  GAMER: 8,
  ENTREPRENEUR: 3.4,
  SENIOR_DEVELOPER: 3,
  GENERAL: 7,
  CEO: 4.5,
  AI: 4,
}
const PROMOTIONS = [
  { unit: "SOLDIER", count: 5, results: [["OFFICER", 1]] },
  { unit: "OFFICER", count: 5, results: [["GENERAL", 1]] },
  { unit: "DEVELOPER", count: 3, results: [["SENIOR_DEVELOPER", 1]] },
  { unit: "UNEMPLOYED", count: 5, results: [["CEO", 0.8], ["GAMER", 0.2]] },
]
const NUMBER_INCREASE_GATES = new Set(["gate_add1", "gate_add2", "gate_add3", "gate_mul2"])

function projectHardZ(baseZ) {
  const openingEnd = 124 * 0.9
  if (baseZ <= 124) {
    return baseZ * 0.9
  }
  return openingEnd + (STAGE_LENGTH - openingEnd) * ((baseZ - 124) / (380 - 124))
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function sampleAnchors(anchors, p) {
  const ratio = clamp01(p)
  let previous = anchors[0] ?? [0, 0]
  for (const anchor of anchors) {
    if (ratio <= anchor[0]) {
      const span = anchor[0] - previous[0]
      if (span <= 0) {
        return anchor[1]
      }
      return previous[1] + (anchor[1] - previous[1]) * ((ratio - previous[0]) / span)
    }
    previous = anchor
  }
  return previous[1]
}

function stateForRatio(p) {
  const [b0, b1, b2, b3] = curve.stateBoundaries
  if (p < b0) return "onboarding_crowd"
  if (p < b1) return "contested_pickup"
  if (p < b2) return "boss_jam"
  if (p < b3) return "recovery_burst"
  return "final_squeeze"
}

function sampleStateValue(p, pick) {
  const ratio = clamp01(p)
  const state = stateForRatio(ratio)
  const stateIndex = STATE_ORDER.indexOf(state)
  for (const boundary of curve.stateBoundaries) {
    if (Math.abs(ratio - boundary) < curve.boundaryBlend) {
      const before = STATE_ORDER[Math.max(0, ratio < boundary ? stateIndex : stateIndex - 1)]
      const after = STATE_ORDER[Math.min(STATE_ORDER.length - 1, ratio < boundary ? stateIndex + 1 : stateIndex)]
      const t = clamp01((ratio - (boundary - curve.boundaryBlend)) / (curve.boundaryBlend * 2))
      return pick(curve.states[before]) + (pick(curve.states[after]) - pick(curve.states[before])) * t
    }
  }
  return pick(curve.states[state])
}

function getTargetEap(p) {
  return sampleAnchors(curve.eapAnchors, p)
}

function getTargetDps(p) {
  return getTargetEap(p) * curve.fireRate
}

function getBalanceFactor(p, difficulty) {
  return Math.min(sampleStateValue(p, (state) => state.balanceFactor), curve.difficultyDerivation[difficulty].balanceCap)
}

function getInfluxHp(p, difficulty) {
  return getTargetDps(p) * getBalanceFactor(p, difficulty) * curve.difficultyDerivation[difficulty].influx
}

function getBossHp(p, difficulty) {
  return getTargetDps(p) * curve.boss.focusRatio * curve.boss.killTimeSeconds * curve.difficultyDerivation[difficulty].bossHp
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function createRoster() {
  const roster = {}
  for (const unit of Object.keys(UNIT_POWER)) {
    roster[unit] = 0
  }
  roster.PANGYO = 4
  return roster
}

function totalCount(roster) {
  return Object.values(roster).reduce((sum, count) => sum + count, 0)
}

function computeEap(squad) {
  const total = Math.max(1, totalCount(squad.roster))
  let power = 0
  for (const [unit, count] of Object.entries(squad.roster)) {
    const unitPower = unit === "PANGYO" ? UNIT_POWER.PANGYO * squad.pangyoDamageMultiplier : UNIT_POWER[unit]
    power += unitPower * count
  }
  const attackMultiplier = Math.max(0.5, power / total)
    * (1 + squad.roster.SENIOR_DEVELOPER * SENIOR_ATTACK_BONUS)
    * squad.permanentAttack
  return attackMultiplier * Math.min(total, SQUAD_LIMIT)
}

function resolvePromotions(roster, random) {
  let applied = true
  while (applied) {
    applied = false
    for (const rule of PROMOTIONS) {
      const required = Math.max(1, rule.count - (roster.SENIOR_DEVELOPER > 0 ? 1 : 0))
      if (roster[rule.unit] >= required) {
        roster[rule.unit] -= required
        let roll = random()
        for (const [result, weight] of rule.results) {
          roll -= weight
          if (roll <= 0) {
            roster[result] += 1
            break
          }
        }
        applied = true
        break
      }
    }
  }
}

function mostCommonUnit(roster) {
  let best = "PANGYO"
  let bestCount = -1
  for (const [unit, count] of Object.entries(roster)) {
    if (count > bestCount) {
      best = unit
      bestCount = count
    }
  }
  return best
}

function applyGate(squad, gateId, random) {
  const roster = squad.roster
  if (gateId === "gate_add1" || gateId === "gate_add2" || gateId === "gate_add3") {
    roster[mostCommonUnit(roster)] += Number(gateId.slice(-1))
  } else if (gateId === "gate_mul2") {
    const unit = mostCommonUnit(roster)
    roster[unit] += roster[unit]
  } else if (gateId === "gate_soldier_add1") {
    roster.SOLDIER += 1
  } else if (gateId === "gate_pangyo_add2") {
    roster.PANGYO += 2
  } else if (gateId === "gate_developer_add1") {
    roster.DEVELOPER += 1
  } else if (gateId === "gate_unemployed_add1") {
    roster.UNEMPLOYED += 1
  } else if (gateId === "gate_officer_add1") {
    roster.OFFICER += 1
  } else if (gateId === "gate_attack_amp20") {
    squad.permanentAttack *= 1.2
  } else if (gateId === "gate_pangyo_damage2x") {
    squad.pangyoDamageMultiplier *= 2
  } else {
    throw new Error(`Unknown gate in defense pool: ${gateId}`)
  }
  resolvePromotions(roster, random)
}

function pickWeighted(pool, random) {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = random() * total
  for (const entry of pool) {
    roll -= entry.weight
    if (roll <= 0) {
      return entry.gateId
    }
  }
  return pool[pool.length - 1].gateId
}

function segmentFor(z) {
  return curve.gateSegments.find((segment) => z < segment.maxAuthoredZ) ?? curve.gateSegments[curve.gateSegments.length - 1]
}

function rollGatePair(z, random) {
  const segment = segmentFor(z)
  const left = pickWeighted(segment.left, random)
  let right = pickWeighted(segment.right, random)
  if (left === right || (NUMBER_INCREASE_GATES.has(left) && NUMBER_INCREASE_GATES.has(right))) {
    right = pickWeighted(segment.right, random)
  }
  return [left, right]
}

function cloneSquad(squad) {
  return {
    roster: { ...squad.roster },
    permanentAttack: squad.permanentAttack,
    pangyoDamageMultiplier: squad.pangyoDamageMultiplier,
  }
}

function chooseGate(squad, pair) {
  const [left, right] = pair
  const leftSquad = cloneSquad(squad)
  applyGate(leftSquad, left, mulberry32(1))
  const rightSquad = cloneSquad(squad)
  applyGate(rightSquad, right, mulberry32(1))
  return computeEap(leftSquad) > computeEap(rightSquad) ? left : right
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

let failed = false
function fail(message) {
  console.error(`FAIL: ${message}`)
  failed = true
}

function warn(message) {
  console.warn(`WARN: ${message}`)
}

const gateProgress = GATE_AUTHORED_Z.map((z) => projectHardZ(z) / STAGE_LENGTH)
const eapSamples = GATE_AUTHORED_Z.map(() => [])
for (let trial = 0; trial < TRIALS; trial += 1) {
  const random = mulberry32(SEED + trial)
  const squad = { roster: createRoster(), permanentAttack: 1, pangyoDamageMultiplier: 1 }
  GATE_AUTHORED_Z.forEach((z, index) => {
    const chosen = chooseGate(squad, rollGatePair(z, random))
    applyGate(squad, chosen, random)
    eapSamples[index].push(computeEap(squad))
  })
}

if (curve.curveVersion !== EXPECTED_CURVE_VERSION) {
  fail(`curveVersion ${curve.curveVersion} !== ${EXPECTED_CURVE_VERSION}`)
}

console.log("progress | targetEAP | simMean | simP10 | B(hard) | bossKillSec")
gateProgress.forEach((p, index) => {
  const target = getTargetEap(p)
  const simMean = mean(eapSamples[index])
  const simP10 = percentile(eapSamples[index], 0.1)
  const balance = getInfluxHp(p, "hard") / getTargetDps(p)
  const bossSeconds = getBossHp(p, "hard") / (getTargetDps(p) * curve.boss.focusRatio)
  console.log(`${(p * 100).toFixed(1).padStart(6)}% | ${target.toFixed(1).padStart(9)} | ${simMean.toFixed(1).padStart(7)} | ${simP10.toFixed(1).padStart(6)} | ${balance.toFixed(2).padStart(7)} | ${bossSeconds.toFixed(1).padStart(11)}`)
  if (Math.abs(simMean - target) > target * 0.15) {
    fail(`gate ${index + 1} p=${p.toFixed(2)}: sim mean EAP ${simMean.toFixed(1)} vs target ${target.toFixed(1)}`)
  }
})

{
  const lastIndex = GATE_AUTHORED_Z.length - 1
  const p = gateProgress[lastIndex]
  const p10Dps = percentile(eapSamples[lastIndex], 0.1) * curve.fireRate
  const b10 = getInfluxHp(p, "hard") / p10Dps
  if (b10 > 1.25) {
    warn(`legacy gate-only P10 comparison ${b10.toFixed(2)} > 1.25; runtime +1-track QA now covers defense survivability`)
  }
}

const STATE_MIDPOINTS = { onboarding_crowd: 0.11, contested_pickup: 0.3, boss_jam: 0.5, recovery_burst: 0.7, final_squeeze: 0.89 }
for (const [state, p] of Object.entries(STATE_MIDPOINTS)) {
  const actual = getInfluxHp(p, "hard") / getTargetDps(p)
  const target = curve.states[state].balanceFactor
  if (Math.abs(actual - target) > 0.08) {
    fail(`${state}: B(${p}) = ${actual.toFixed(2)} vs target ${target}`)
  }
}

for (let p = 0.15; p <= 1.001; p += 0.05) {
  const seconds = getBossHp(p, "hard") / (getTargetDps(p) * curve.boss.focusRatio)
  if (seconds < curve.boss.killTimeMinSeconds || seconds > curve.boss.killTimeMaxSeconds) {
    fail(`boss kill time ${seconds.toFixed(1)}s at p=${p.toFixed(2)}`)
  }
}

{
  const p = 0.5
  const easy = getInfluxHp(p, "easy")
  const medium = getInfluxHp(p, "medium")
  const hard = getInfluxHp(p, "hard")
  if (!(easy < medium && medium < hard)) {
    fail(`difficulty influx not monotonic at p=0.5: easy ${easy.toFixed(0)}, medium ${medium.toFixed(0)}, hard ${hard.toFixed(0)}`)
  }
  const endlessStart = getInfluxHp(curve.endless.startProgress, "infinite")
  const hardFinal = getInfluxHp(1, "hard")
  if (Math.abs(endlessStart - hardFinal) > hardFinal * 0.05) {
    fail(`endless start influx ${endlessStart.toFixed(0)} deviates from hard final ${hardFinal.toFixed(0)}`)
  }
}

if (failed) {
  console.error("defense balance curve: FAIL")
  process.exit(1)
}
console.log("defense balance curve: OK")
