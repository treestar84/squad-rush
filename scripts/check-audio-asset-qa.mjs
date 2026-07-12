import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"

const cues = [
  "shot",
  "hit",
  "gate",
  "pickup",
  "squad-add",
  "start-jingle",
  "countdown-low",
  "countdown-mid",
  "countdown-high",
  "chain-kill",
  "chain-kill-1",
  "chain-kill-2",
  "chain-kill-3",
  "chain-kill-4",
  "enemy-flurry-1",
  "enemy-flurry-2",
  "enemy-flurry-3",
  "enemy-flurry-4",
  "final-pop",
  "ui-reveal",
  "weapon-spin",
  "allied-gunfire",
  "boss-attack",
  "boss-warning",
  "boss-down",
  "result-victory",
  "result-defeat",
  "bgm-run-1",
  "bgm-run-2",
  "bgm-run-3",
  "bgm-run-4",
  "bgm-run-5",
  "run-footsteps",
]
const minBytes = 1000

function assertQa(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertAudioFile(path, signature) {
  const file = await stat(path)
  assertQa(file.size >= minBytes, `Audio asset is too small: ${path}`)
  const bytes = await readFile(path)
  if (signature === "ogg") {
    assertQa(bytes.subarray(0, 4).toString("ascii") === "OggS", `Audio asset is not an OGG file: ${path}`)
    return
  }
  const hasId3 = bytes.subarray(0, 3).toString("ascii") === "ID3"
  const hasFrameSync = bytes[0] === 0xff && bytes[1] !== undefined && (bytes[1] & 0xe0) === 0xe0
  assertQa(hasId3 || hasFrameSync, `Audio asset is not an MP3 file: ${path}`)
}

for (const cue of cues) {
  await assertAudioFile(resolve(`public/assets/audio/${cue}.mp3`), "mp3")
  await assertAudioFile(resolve(`public/assets/audio/${cue}.ogg`), "ogg")
}

const bankSource = await readFile(resolve("src/game/systems/AudioSampleBank.ts"), "utf8")
const audioSource = await readFile(resolve("src/game/systems/AudioSystem.ts"), "utf8")
const gameSource = await readFile(resolve("src/game/Game.ts"), "utf8")
const presenterSource = await readFile(resolve("src/game/GameHudPresenter.ts"), "utf8")
const pauseSource = await readFile(resolve("src/game/GamePause.ts"), "utf8")
const licenseSource = await readFile(resolve("public/assets/LICENSES.md"), "utf8")
const designSource = await readFile(resolve("DESIGN.md"), "utf8")

assertQa(bankSource.includes("new Howl"), "AudioSampleBank must construct Howl samples.")
assertQa(bankSource.includes("pool:"), "AudioSampleBank must configure sample pools.")
assertQa(bankSource.includes("rate("), "AudioSampleBank must apply pitch/rate variation.")
assertQa(bankSource.includes("/assets/audio/"), "AudioSampleBank must load runtime audio assets.")
assertQa(bankSource.includes("bgm-run-1.mp3") && bankSource.includes("bgm-run-5.mp3"), "AudioSampleBank must load all runtime BGM tracks.")
assertQa(bankSource.includes("pickLoopSample"), "AudioSampleBank must choose a BGM loop track at runtime.")
assertQa(bankSource.includes("enemy-flurry-4.mp3") && bankSource.includes("chain-kill-4.mp3"), "AudioSampleBank must load Arcade_Lane kill variation cues.")
assertQa(audioSource.includes("AudioSampleBank"), "AudioSystem must use the Howler sample bank.")
assertQa(audioSource.includes("samples.play(\"shot\""), "AudioSystem must play the shot sample.")
assertQa(audioSource.includes("samples.play(\"alliedGunfire\""), "AudioSystem must layer allied gunfire under repeated squad shots.")
assertQa(audioSource.includes("playEnemyFlurry") && gameSource.includes("playEnemyFlurry"), "Enemy destruction flurry must be wired to regular monster kills.")
assertQa(!gameSource.includes("onMonsterKilled = (monster) => {\n      this.monstersKilled += 1\n      this.fx.playDeathBurst(monster.mesh.position, 0.65)\n      this.audio.playHit()"), "Regular monster kills must not replay the squishy hit cue on every kill.")
assertQa(gameSource.includes("playFinalPop"), "Final enemy pop must be wired to combo milestones.")
assertQa(gameSource.includes("playWeaponSpin") && presenterSource.includes("playWeaponSpin"), "Weapon spin must be wired to career and timed skill events.")
assertQa(presenterSource.includes("playUiReveal") && pauseSource.includes("playUiReveal"), "Upgrade menu reveal must be wired to promotion and pause panels.")
assertQa(audioSource.includes("samples.playLoop(\"bgmRun\""), "AudioSystem must start the 바로 Go 스쿼드 BGM loop.")
assertQa(audioSource.includes("samples.playLoop(\"runFootsteps\""), "AudioSystem must start the 바로 Go 스쿼드 footstep loop.")
assertQa(audioSource.includes("samples.play(\"countdown"), "AudioSystem must play countdown samples.")
assertQa(audioSource.includes("samples.dispose()"), "AudioSystem must unload samples on dispose.")
assertQa(licenseSource.includes("Runtime Audio Assets"), "License manifest must document runtime audio assets.")
assertQa(licenseSource.includes("docs/Squad_Rush"), "License manifest must document 바로 Go 스쿼드 audio provenance.")
assertQa(licenseSource.includes("docs/Arcade_Lane"), "License manifest must document Arcade_Lane audio provenance.")
assertQa(designSource.includes("Audio asset QA"), "DESIGN.md must document the audio asset QA bar.")

console.info(`Audio asset QA OK: ${cues.length} cues/loops, mp3+ogg formats, random BGM loop selection, Howler pooling, provenance documented.`)
