import { readFile } from "node:fs/promises"

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const waveText = await readFile("src/game/systems/MonsterWaveSystem.ts", "utf8")
const poolText = await readFile("src/game/pools/MonsterPool.ts", "utf8")
const gameModeText = await readFile("src/game/data/gameModeData.ts", "utf8")
const monsterDataText = await readFile("src/game/data/monsterData.ts", "utf8")
const difficultyText = await readFile("src/game/data/difficultyData.ts", "utf8")
const qualityText = await readFile("src/game/systems/QualitySystem.ts", "utf8")
const designText = await readFile("DESIGN.md", "utf8")

assertQa(waveText.includes("MEDIUM_LOD_DISTANCE = 24"), "medium monster LOD threshold is missing.")
assertQa(waveText.includes("FAR_LOD_DISTANCE = 42"), "far monster LOD threshold is missing.")
assertQa(waveText.includes("FAR_LOD_EXTRA_SKIP = 3"), "far monster LOD skip factor is missing.")
assertQa(waveText.includes("frameOrdinal"), "monster LOD frame ordinal is missing.")
assertQa(waveText.includes("shouldAnimateMonster"), "monster LOD animation gate is missing.")
assertQa(waveText.includes("getLodSkipRate"), "monster LOD skip-rate calculation is missing.")
assertQa(waveText.includes("this.quality.animationSkipRate + distanceSkip"), "quality animationSkipRate is not applied to monster LOD.")
assertQa(poolText.includes("visual: null"), "monster pool must not pre-instantiate unused monster visuals.")
assertQa(!poolText.includes("AUTHORED_HORDE_VISUAL_BUDGET"), "monster pool must not cap Doguri authored visuals with a horde budget.")
assertQa(poolText.includes("usesAuthoredMonsterVisual(this.assets, behavior)"), "monster pool must use authored Doguri visuals whenever the asset is available.")
assertQa(!poolText.includes("this.visualIndex(inst) <"), "monster pool must not route later horde members to procedural fallback by active index.")
assertQa(waveText.includes("authoredVisuals") && waveText.includes("proceduralFallbackVisuals"), "monster debug state must expose authored and fallback visual counts.")
assertQa(waveText.includes("monster.mesh.position.z += (monster.velocityZ - incomingScrollSpeed) * dt"), "monster forward movement must stay every-frame.")
assertQa(waveText.indexOf("monster.mesh.position.z += (monster.velocityZ - incomingScrollSpeed) * dt") > waveText.indexOf("shouldAnimateMonster"), "monster movement should remain outside the LOD animation gate.")
assertQa(waveText.includes("config?.behavior === MONSTER_CONFIGS.tank.behavior"), "tank monsters must keep full animation fidelity.")
assertQa(!waveText.includes("CENTER_LINE") && !waveText.includes("CENTER_BLOCK"), "opening monsters must not use center-only spawn patterns.")
assertQa(waveText.includes("getCenterPull") && waveText.includes("monster.originX * centerPull"), "attack monsters must keep accelerated center convergence.")
assertQa(gameModeText.includes("ATTACK_PROGRESS_SPEED_MULTIPLIER = 1.2"), "attack mode must increase total progression speed by 20%.")
assertQa(gameModeText.includes("squadForwardMultiplier: ATTACK_FORWARD_MULTIPLIER * ATTACK_PROGRESS_SPEED_MULTIPLIER"), "attack squad movement must receive the shared 20% progression boost.")
assertQa(gameModeText.includes("contentScrollSpeed: LEVEL_1.forwardSpeed * (1 - ATTACK_FORWARD_MULTIPLIER) * ATTACK_PROGRESS_SPEED_MULTIPLIER"), "attack content scroll must receive the same 20% progression boost.")
assertQa(gameModeText.includes("DEFENSE_CONTENT_SCROLL_SPEED = 1.6"), "defense mode content scroll speed must keep the incoming carpet deliberately slow.")
assertQa(gameModeText.includes("monsterCenterConvergeMultiplier: 2"), "attack mode center convergence must be doubled.")
assertQa(gameModeText.includes("monsterCenterConvergeMultiplier: 0"), "defense mode must preserve straight lane travel.")
assertQa(!waveText.includes("HORDE_STAGGER_DEPTH"), "horde rows must not use diagonal stagger depth.")
assertQa(!waveText.includes("Math.abs(index - (count - 1) / 2)"), "monster waves must not spawn in V-shaped diagonal rows.")
assertQa(monsterDataText.includes("speed: 0.36"), "basic monster speed should be 1.5x faster at 0.36.")
assertQa(monsterDataText.includes("speed: 0.54"), "fast monster speed should be 1.5x faster at 0.54.")
assertQa(difficultyText.includes("spawnMultiplier: 1.08"), "easy difficulty must increase monster spawn density.")
assertQa(difficultyText.includes("pressureMultiplier: 1"), "easy difficulty must preserve a bounded active monster pressure cap.")

assertQa(qualityText.includes("animationSkipRate: 3"), "low quality animation skip setting is missing.")
assertQa(qualityText.includes("animationSkipRate: 2"), "medium quality animation skip setting is missing.")
assertQa(qualityText.includes("animationSkipRate: 0"), "high quality animation skip setting is missing.")
assertQa(designText.includes("Monster LOD QA"), "DESIGN.md monster LOD QA policy is missing.")
assertQa(designText.includes("movement and collision stay every-frame"), "DESIGN.md must state gameplay movement is not skipped.")

console.info(JSON.stringify({ monsterLod: "ok" }, null, 2))
