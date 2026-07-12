import { readFile } from "node:fs/promises"

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const waveSource = await readFile("src/game/systems/MonsterWaveSystem.ts", "utf8")
const squadSource = await readFile("src/game/systems/SquadSystem.ts", "utf8")
const defenseProgressionSource = await readFile("src/game/systems/DefenseSquadProgression.ts", "utf8")
const damageSource = await readFile("src/game/GameDamageSystem.ts", "utf8")
const hudSource = await readFile("src/ui/Hud.ts", "utf8")

assertContract(
  waveSource.includes("registerEscapedMonster(monster)"),
  "Every monster that crosses the squad line must register escaped damage.",
)
assertContract(
  !waveSource.includes("this.mode.squadForwardMultiplier === 0 && incomingScrollSpeed > 0 && monster.mesh.position.z < squadZ - ESCAPE_DAMAGE_DISTANCE"),
  "Escaped monster damage must not be limited to defense mode.",
)

const casualtyOrderStart = squadSource.indexOf("const damageOrder: readonly UnitType[]")
const casualtyOrderEnd = squadSource.indexOf("for (const unit of damageOrder)", casualtyOrderStart)
assertContract(casualtyOrderStart >= 0 && casualtyOrderEnd > casualtyOrderStart, "Squad casualty order is missing.")

const casualtyOrderSource = squadSource.slice(casualtyOrderStart, casualtyOrderEnd)
const pangyoIndex = casualtyOrderSource.indexOf("UNIT_TYPES.pangyo")
const soldierIndex = casualtyOrderSource.indexOf("UNIT_TYPES.soldier")
assertContract(pangyoIndex >= 0 && soldierIndex >= 0, "Casualty order must include Pangyo and soldier units.")
assertContract(
  pangyoIndex < soldierIndex,
  "Gate Attack line breaches must consume weak Pangyo units before soldiers.",
)
assertContract(casualtyOrderSource.includes("DEFENSE_DISPLACEMENT_ORDER"), "Wave Defence must use its power-ordered casualty contract.")
const defenseOrderStart = defenseProgressionSource.indexOf("export const DEFENSE_DISPLACEMENT_ORDER")
const defenseOrderEnd = defenseProgressionSource.indexOf("] as const satisfies readonly UnitType[]", defenseOrderStart)
const defenseOrderSource = defenseProgressionSource.slice(defenseOrderStart, defenseOrderEnd)
assertContract(
  defenseOrderSource.indexOf("UNIT_TYPES.soldier") < defenseOrderSource.indexOf("UNIT_TYPES.pangyo"),
  "Wave Defence line breaches must consume lower-power soldiers before promoted specialists.",
)
assertContract(
  damageSource.includes("MONSTER_BREACH_CASUALTIES = 1"),
  "Each breaching monster must consume one squad life.",
)
assertContract(squadSource.includes("export type SquadUnitDelta"), "Squad casualties must report removed unit type/count.")
assertContract(damageSource.includes("showCasualties"), "Monster breach casualties must surface red portrait feedback in the HUD.")
assertContract(hudSource.includes("hud-casualty-badge"), "HUD must render a casualty portrait badge.")
assertContract(hudSource.includes("hud-headline--elite"), "Tier-one acquisitions must use the stronger elite headline.")
assertContract(
  damageSource.includes("if (!canDamageSquad) {\n        continue\n      }"),
  "Contact recovery must not delete monsters before they can become line-breach damage.",
)
const cooldownGuardIndex = damageSource.indexOf("if (!canDamageSquad)")
const contactKillIndex = damageSource.indexOf("this.deps.waves.kill(monster, MONSTER_KILL_REASONS.contact)", cooldownGuardIndex)
assertContract(
  cooldownGuardIndex >= 0 && contactKillIndex > cooldownGuardIndex,
  "Contact kills must stay behind the cooldown guard and use the non-splitting contact reason.",
)

console.info("Breach casualty contract OK")
