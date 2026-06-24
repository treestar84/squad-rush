import { readFile } from "node:fs/promises"

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const waveText = await readFile("src/game/systems/MonsterWaveSystem.ts", "utf8")
const monsterDataText = await readFile("src/game/data/monsterData.ts", "utf8")
const qualityText = await readFile("src/game/systems/QualitySystem.ts", "utf8")
const designText = await readFile("DESIGN.md", "utf8")
const prdText = await readFile("prd.md", "utf8")

assertQa(waveText.includes("MEDIUM_LOD_DISTANCE = 24"), "medium monster LOD threshold is missing.")
assertQa(waveText.includes("FAR_LOD_DISTANCE = 42"), "far monster LOD threshold is missing.")
assertQa(waveText.includes("FAR_LOD_EXTRA_SKIP = 3"), "far monster LOD skip factor is missing.")
assertQa(waveText.includes("frameOrdinal"), "monster LOD frame ordinal is missing.")
assertQa(waveText.includes("shouldAnimateMonster"), "monster LOD animation gate is missing.")
assertQa(waveText.includes("getLodSkipRate"), "monster LOD skip-rate calculation is missing.")
assertQa(waveText.includes("this.quality.animationSkipRate + distanceSkip"), "quality animationSkipRate is not applied to monster LOD.")
assertQa(waveText.includes("monster.mesh.position.z += monster.velocityZ * dt"), "monster forward movement must stay every-frame.")
assertQa(waveText.indexOf("monster.mesh.position.z += monster.velocityZ * dt") > waveText.indexOf("shouldAnimateMonster"), "monster movement should remain outside the LOD animation gate.")
assertQa(waveText.includes("config?.behavior === MONSTER_CONFIGS.tank.behavior"), "tank monsters must keep full animation fidelity.")
assertQa(!waveText.includes("CENTER_LINE") && !waveText.includes("CENTER_BLOCK"), "opening monsters must not use center-only spawn patterns.")
assertQa(waveText.includes("CENTER_CONVERGE_DISTANCE") && waveText.includes("centerPull"), "all monster sections must keep gradual center convergence.")
assertQa(monsterDataText.includes("speed: 0.24"), "basic monster speed should be doubled to 0.24.")
assertQa(monsterDataText.includes("speed: 0.36"), "fast monster speed should be doubled to 0.36.")

assertQa(qualityText.includes("animationSkipRate: 3"), "low quality animation skip setting is missing.")
assertQa(qualityText.includes("animationSkipRate: 2"), "medium quality animation skip setting is missing.")
assertQa(qualityText.includes("animationSkipRate: 0"), "high quality animation skip setting is missing.")
assertQa(prdText.includes("멀리 있는 몬스터 애니메이션 생략"), "PRD monster animation LOD requirement is missing.")
assertQa(designText.includes("Monster LOD QA"), "DESIGN.md monster LOD QA policy is missing.")
assertQa(designText.includes("movement and collision stay every-frame"), "DESIGN.md must state gameplay movement is not skipped.")

console.info(JSON.stringify({ monsterLod: "ok" }, null, 2))
