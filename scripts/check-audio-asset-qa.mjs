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
  "boss-attack",
  "boss-warning",
  "boss-down",
  "result-victory",
  "result-defeat",
  "bgm-run",
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
const licenseSource = await readFile(resolve("public/assets/LICENSES.md"), "utf8")
const designSource = await readFile(resolve("DESIGN.md"), "utf8")

assertQa(bankSource.includes("new Howl"), "AudioSampleBank must construct Howl samples.")
assertQa(bankSource.includes("pool:"), "AudioSampleBank must configure sample pools.")
assertQa(bankSource.includes("rate("), "AudioSampleBank must apply pitch/rate variation.")
assertQa(bankSource.includes("/assets/audio/"), "AudioSampleBank must load runtime audio assets.")
assertQa(audioSource.includes("AudioSampleBank"), "AudioSystem must use the Howler sample bank.")
assertQa(audioSource.includes("samples.play(\"shot\""), "AudioSystem must play the shot sample.")
assertQa(audioSource.includes("samples.playLoop(\"bgmRun\""), "AudioSystem must start the 바로 Go 스쿼드 BGM loop.")
assertQa(audioSource.includes("samples.playLoop(\"runFootsteps\""), "AudioSystem must start the 바로 Go 스쿼드 footstep loop.")
assertQa(audioSource.includes("samples.play(\"countdown"), "AudioSystem must play countdown samples.")
assertQa(audioSource.includes("samples.dispose()"), "AudioSystem must unload samples on dispose.")
assertQa(licenseSource.includes("Runtime Audio Assets"), "License manifest must document runtime audio assets.")
assertQa(licenseSource.includes("docs/Squad_Rush"), "License manifest must document 바로 Go 스쿼드 audio provenance.")
assertQa(designSource.includes("Audio asset QA"), "DESIGN.md must document the audio asset QA bar.")

console.info(`Audio asset QA OK: ${cues.length} cues/loops, mp3+ogg formats, Howler pooling, provenance documented.`)
