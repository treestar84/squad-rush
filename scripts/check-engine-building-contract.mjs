import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import ts from "typescript"

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const rosterSource = await readFile("src/game/data/squadRosterData.ts", "utf8")
const squadSource = await readFile("src/game/systems/SquadSystem.ts", "utf8")
const inputSource = await readFile("src/game/InputController.ts", "utf8")
const hudSource = await readFile("src/ui/Hud.ts", "utf8")
const gameSource = await readFile("src/game/Game.ts", "utf8")
const designSource = await readFile("DESIGN.md", "utf8")
const { UNIT_TYPES, createEmptyUnitCounts, resolvePromotionChain } = await loadPromotionEngine()

assertContract(rosterSource.includes("export const BASE_SQUAD_LIMIT = 15"), "Squad limit must be reduced to 15.")
assertContract(!rosterSource.includes("AI_SQUAD_LIMIT"), "AI expansion cap must be removed from the core engine.")
assertContract(rosterSource.includes('id: "soldier_to_officer"'), "Soldier-to-officer promotion rule is missing.")
assertContract(rosterSource.includes("병사 5 -> 장교"), "Soldier-to-officer must require five soldiers.")
assertContract(rosterSource.includes('id: "officer_to_general"'), "Officer-to-general promotion rule is missing.")
assertContract(rosterSource.includes("장교 5 -> 장군"), "Officer-to-general must require five officers.")
assertContract(rosterSource.includes('id: "unemployed_to_ceo"'), "Unemployed random branch promotion rule is missing.")
assertContract(rosterSource.includes("백수 5 -> CEO/게이머"), "Unemployed branch must require five unemployed and document both outcomes.")
assertContract(rosterSource.includes("resultWeights: [8, 2]"), "Unemployed branch must use an 8:2 CEO-to-gamer ratio.")
assertContract(rosterSource.includes("basePower: 0.5"), "Unemployed power must be lower than Pangyo at 0.5.")
assertContract(rosterSource.includes("basePower: 8"), "Gamer power must be a stronger firepower branch.")
assertContract(!rosterSource.includes("basePower: 14"), "General base power must not remain at the excessive 14 value.")
assertContract(rosterSource.includes("basePower: 1") && rosterSource.includes("basePower: 1.5"), "Pangyo and branch units need the requested power bands.")

assertContract(squadSource.includes("chooseCareer"), "SquadSystem must expose a career choice operation.")
assertContract(squadSource.includes("getCareerChoiceState"), "SquadSystem must expose career-choice HUD state.")
assertContract(squadSource.includes("CAREER_CHOICE_PANGYO_COST = 3"), "Career choice must require three Pangyo.")
assertContract(squadSource.includes("OFFICER_SPAWN_BASE_SECONDS = 25"), "Officer soldier-generation base cadence must be 25 seconds.")
assertContract(squadSource.includes("OFFICER_SPAWN_STEP_SECONDS = 5"), "Officer generation cadence must accelerate by five seconds per officer.")
assertContract(squadSource.includes("UNEMPLOYED_EVENT_SECONDS = 10"), "Unemployed random event must tick every ten seconds.")
assertContract(squadSource.includes("UNEMPLOYED_EVENT_MIN_COUNT = 2"), "Unemployed random event must require at least two unemployed units.")
assertContract(squadSource.includes("CEO_BONUS_BASE_CHANCE = 0.3"), "CEO bonus appearance chance must start at 30%.")
assertContract(squadSource.includes("SENIOR_DEVELOPER_ATTACK_BONUS = 0.2"), "Senior developer attack bonus must be 20%.")
assertContract(squadSource.includes("getDeveloperSlowMultiplier"), "Developer slowdown effect must be modeled.")
assertContract(squadSource.includes("getSquadRushMultiplier"), "Squad-size rush speed penalty must be modeled.")

assertContract(inputSource.includes("consumeCareerChoice"), "InputController must expose one-shot J/K/L career choices.")
assertContract(inputSource.includes('event.code === "KeyJ"'), "J key must select military enlistment.")
assertContract(inputSource.includes('event.code === "KeyK"'), "K key must select overtime developer path.")
assertContract(inputSource.includes('event.code === "KeyL"'), "L key must select fired unemployed path.")

assertContract(hudSource.includes("career-choice-panel"), "HUD must render a career-choice panel.")
assertContract(hudSource.includes("군입대") && hudSource.includes("야근") && hudSource.includes("해고"), "HUD career choices must be labeled.")
assertContract(gameSource.includes("consumeCareerChoice"), "Game loop must consume career-choice input.")
assertContract(gameSource.includes("chooseCareer"), "Game loop must apply career-choice input to the squad.")
assertContract(designSource.includes("엔진 빌딩 설계"), "DESIGN.md must document the refined engine-building design.")
assertContract(designSource.includes("보완 코멘트"), "DESIGN.md must separate improvement comments.")

const militaryCounts = createEmptyUnitCounts()
militaryCounts[UNIT_TYPES.soldier] = 25
const militaryResult = resolvePromotionChain(militaryCounts).counts
assertContract(militaryResult[UNIT_TYPES.soldier] === 0, "Twenty-five soldiers must be fully consumed by chained military promotions.")
assertContract(militaryResult[UNIT_TYPES.officer] === 0, "Five generated officers must chain-promote into a general immediately.")
assertContract(militaryResult[UNIT_TYPES.general] === 1, "Twenty-five soldiers must resolve to one general.")

const developerCounts = createEmptyUnitCounts()
developerCounts[UNIT_TYPES.developer] = 3
const developerResult = resolvePromotionChain(developerCounts).counts
assertContract(developerResult[UNIT_TYPES.developer] === 0, "Three developers must be consumed by senior promotion.")
assertContract(developerResult[UNIT_TYPES.seniorDeveloper] === 1, "Three developers must resolve to one senior developer.")

const seniorCounts = createEmptyUnitCounts()
seniorCounts[UNIT_TYPES.seniorDeveloper] = 1
seniorCounts[UNIT_TYPES.soldier] = 4
const seniorResult = resolvePromotionChain(seniorCounts).counts
assertContract(seniorResult[UNIT_TYPES.officer] === 1, "A senior developer must reduce soldier-to-officer requirement from five to four.")

const ceoCounts = createEmptyUnitCounts()
ceoCounts[UNIT_TYPES.unemployed] = 5
const ceoResult = resolvePromotionChain(ceoCounts, () => 0.79).counts
assertContract(ceoResult[UNIT_TYPES.unemployed] === 0, "Five unemployed must be consumed by unemployed branch promotion.")
assertContract(ceoResult[UNIT_TYPES.ceo] === 1, "Low branch roll must resolve five unemployed to one CEO.")
assertContract(ceoResult[UNIT_TYPES.gamer] === 0, "Low branch roll must not also grant a gamer.")

const gamerCounts = createEmptyUnitCounts()
gamerCounts[UNIT_TYPES.unemployed] = 5
const gamerResult = resolvePromotionChain(gamerCounts, () => 0.81).counts
assertContract(gamerResult[UNIT_TYPES.unemployed] === 0, "Five unemployed must be consumed by gamer branch promotion.")
assertContract(gamerResult[UNIT_TYPES.ceo] === 0, "High branch roll must not also grant a CEO.")
assertContract(gamerResult[UNIT_TYPES.gamer] === 1, "High branch roll must resolve five unemployed to one gamer.")

console.info("Engine-building contract OK")

async function loadPromotionEngine() {
  const workDir = await mkdtemp(join(tmpdir(), "engine-building-contract-"))
  const dataDir = join(workDir, "src/game/data")
  const systemDir = join(workDir, "src/game/systems")
  await mkdir(dataDir, { recursive: true })
  await mkdir(systemDir, { recursive: true })
  await writeFile(
    join(dataDir, "squadRosterData.mjs"),
    transpile(await readFile("src/game/data/squadRosterData.ts", "utf8")),
  )
  await writeFile(
    join(systemDir, "SquadPromotionEngine.mjs"),
    transpile(await readFile("src/game/systems/SquadPromotionEngine.ts", "utf8"))
      .replace("../data/squadRosterData", "../data/squadRosterData.mjs"),
  )
  const dataModule = await import(`file://${join(dataDir, "squadRosterData.mjs")}`)
  const engineModule = await import(`file://${join(systemDir, "SquadPromotionEngine.mjs")}`)
  return {
    UNIT_TYPES: dataModule.UNIT_TYPES,
    createEmptyUnitCounts: dataModule.createEmptyUnitCounts,
    resolvePromotionChain: engineModule.resolvePromotionChain,
  }
}

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      verbatimModuleSyntax: true,
    },
  }).outputText
}
