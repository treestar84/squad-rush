import { Howl } from "howler"

type AudioCue =
  | "shot"
  | "hit"
  | "gate"
  | "pickup"
  | "squadAdd"
  | "startJingle"
  | "countdownLow"
  | "countdownMid"
  | "countdownHigh"
  | "chainKill"
  | "bossAttack"
  | "bossWarning"
  | "bossDown"
  | "resultVictory"
  | "resultDefeat"

type AudioLoop =
  | "bgmRun"
  | "runFootsteps"

type CueConfig = {
  readonly files: readonly [string, string]
  readonly volume: number
  readonly pool: number
  readonly rateJitter: number
}

type LoopConfig = {
  readonly files: readonly [string, string]
  readonly volume: number
}

type PlayOptions = {
  readonly volumeScale?: number
  readonly rateOffset?: number
}

const AUDIO_CUES = [
  "shot",
  "hit",
  "gate",
  "pickup",
  "squadAdd",
  "startJingle",
  "countdownLow",
  "countdownMid",
  "countdownHigh",
  "chainKill",
  "bossAttack",
  "bossWarning",
  "bossDown",
  "resultVictory",
  "resultDefeat",
] as const satisfies readonly AudioCue[]

const AUDIO_LOOPS = [
  "bgmRun",
  "runFootsteps",
] as const satisfies readonly AudioLoop[]

const CUE_CONFIGS: Record<AudioCue, CueConfig> = {
  shot: { files: ["shot.mp3", "shot.ogg"], volume: 0.3, pool: 18, rateJitter: 0.08 },
  hit: { files: ["hit.mp3", "hit.ogg"], volume: 0.32, pool: 14, rateJitter: 0.06 },
  gate: { files: ["gate.mp3", "gate.ogg"], volume: 0.42, pool: 4, rateJitter: 0.05 },
  pickup: { files: ["pickup.mp3", "pickup.ogg"], volume: 0.36, pool: 8, rateJitter: 0.08 },
  squadAdd: { files: ["squad-add.mp3", "squad-add.ogg"], volume: 0.36, pool: 6, rateJitter: 0.07 },
  startJingle: { files: ["start-jingle.mp3", "start-jingle.ogg"], volume: 0.42, pool: 2, rateJitter: 0.01 },
  countdownLow: { files: ["countdown-low.mp3", "countdown-low.ogg"], volume: 0.32, pool: 2, rateJitter: 0.01 },
  countdownMid: { files: ["countdown-mid.mp3", "countdown-mid.ogg"], volume: 0.34, pool: 3, rateJitter: 0.01 },
  countdownHigh: { files: ["countdown-high.mp3", "countdown-high.ogg"], volume: 0.4, pool: 2, rateJitter: 0.01 },
  chainKill: { files: ["chain-kill.mp3", "chain-kill.ogg"], volume: 0.36, pool: 4, rateJitter: 0.04 },
  bossAttack: { files: ["boss-attack.mp3", "boss-attack.ogg"], volume: 0.38, pool: 4, rateJitter: 0.03 },
  bossWarning: { files: ["boss-warning.mp3", "boss-warning.ogg"], volume: 0.38, pool: 3, rateJitter: 0.02 },
  bossDown: { files: ["boss-down.mp3", "boss-down.ogg"], volume: 0.42, pool: 3, rateJitter: 0.03 },
  resultVictory: { files: ["result-victory.mp3", "result-victory.ogg"], volume: 0.42, pool: 2, rateJitter: 0.02 },
  resultDefeat: { files: ["result-defeat.mp3", "result-defeat.ogg"], volume: 0.4, pool: 2, rateJitter: 0.02 },
} as const

const LOOP_CONFIGS: Record<AudioLoop, LoopConfig> = {
  bgmRun: { files: ["bgm-run.mp3", "bgm-run.ogg"], volume: 0.24 },
  runFootsteps: { files: ["run-footsteps.mp3", "run-footsteps.ogg"], volume: 0.1 },
} as const

export class AudioSampleBank {
  private readonly samples = new Map<AudioCue, Howl>()
  private readonly loops = new Map<AudioLoop, Howl>()

  constructor() {
    for (const cue of AUDIO_CUES) {
      const config = CUE_CONFIGS[cue]
      this.samples.set(cue, new Howl({
        src: config.files.map((file) => `/assets/audio/${file}`),
        volume: config.volume,
        pool: config.pool,
        preload: true,
      }))
    }
    for (const loop of AUDIO_LOOPS) {
      const config = LOOP_CONFIGS[loop]
      this.loops.set(loop, new Howl({
        src: config.files.map((file) => `/assets/audio/${file}`),
        volume: config.volume,
        loop: true,
        preload: true,
      }))
    }
  }

  play(cue: AudioCue, options: PlayOptions = {}): void {
    const sample = this.samples.get(cue)
    if (sample === undefined) {
      return
    }
    const config = CUE_CONFIGS[cue]
    const soundId = sample.play()
    const rate = Math.max(0.72, 1 + (options.rateOffset ?? 0) + this.centeredRandom() * config.rateJitter)
    sample.rate(rate, soundId)
    sample.volume(config.volume * (options.volumeScale ?? 1), soundId)
  }

  playLoop(loop: AudioLoop): void {
    const sample = this.loops.get(loop)
    if (sample === undefined || sample.playing()) {
      return
    }
    sample.volume(LOOP_CONFIGS[loop].volume)
    sample.play()
  }

  setLoopVolume(loop: AudioLoop, volumeScale: number): void {
    const sample = this.loops.get(loop)
    if (sample === undefined) {
      return
    }
    sample.volume(LOOP_CONFIGS[loop].volume * volumeScale)
  }

  stopLoop(loop: AudioLoop): void {
    const sample = this.loops.get(loop)
    if (sample === undefined) {
      return
    }
    sample.stop()
    sample.volume(LOOP_CONFIGS[loop].volume)
  }

  dispose(): void {
    for (const sample of this.samples.values()) {
      sample.unload()
    }
    for (const sample of this.loops.values()) {
      sample.unload()
    }
    this.samples.clear()
    this.loops.clear()
  }

  private centeredRandom(): number {
    return Math.random() * 2 - 1
  }
}
