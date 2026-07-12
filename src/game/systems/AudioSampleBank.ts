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
  | "enemyFlurry"
  | "finalPop"
  | "uiReveal"
  | "weaponSpin"
  | "alliedGunfire"
  | "bossAttack"
  | "bossWarning"
  | "bossDown"
  | "resultVictory"
  | "resultDefeat"

type AudioLoop =
  | "bgmRun"
  | "runFootsteps"

type CueConfig = {
  readonly tracks: readonly [CueTrackConfig, ...CueTrackConfig[]]
  readonly volume: number
  readonly pool: number
  readonly rateJitter: number
}

type CueTrackConfig = {
  readonly files: readonly [string, string]
}

type LoopConfig = {
  readonly tracks: readonly [LoopTrackConfig, ...LoopTrackConfig[]]
  readonly volume: number
}

type LoopTrackConfig = {
  readonly files: readonly [string, string]
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
  "enemyFlurry",
  "finalPop",
  "uiReveal",
  "weaponSpin",
  "alliedGunfire",
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
  shot: { tracks: [{ files: ["shot.mp3", "shot.ogg"] }], volume: 0.3, pool: 18, rateJitter: 0.08 },
  hit: { tracks: [{ files: ["hit.mp3", "hit.ogg"] }], volume: 0.32, pool: 14, rateJitter: 0.06 },
  gate: { tracks: [{ files: ["gate.mp3", "gate.ogg"] }], volume: 0.42, pool: 4, rateJitter: 0.05 },
  pickup: { tracks: [{ files: ["pickup.mp3", "pickup.ogg"] }], volume: 0.36, pool: 8, rateJitter: 0.08 },
  squadAdd: { tracks: [{ files: ["squad-add.mp3", "squad-add.ogg"] }], volume: 0.36, pool: 6, rateJitter: 0.07 },
  startJingle: { tracks: [{ files: ["start-jingle.mp3", "start-jingle.ogg"] }], volume: 0.42, pool: 2, rateJitter: 0.01 },
  countdownLow: { tracks: [{ files: ["countdown-low.mp3", "countdown-low.ogg"] }], volume: 0.32, pool: 2, rateJitter: 0.01 },
  countdownMid: { tracks: [{ files: ["countdown-mid.mp3", "countdown-mid.ogg"] }], volume: 0.34, pool: 3, rateJitter: 0.01 },
  countdownHigh: { tracks: [{ files: ["countdown-high.mp3", "countdown-high.ogg"] }], volume: 0.4, pool: 2, rateJitter: 0.01 },
  chainKill: {
    tracks: [
      { files: ["chain-kill.mp3", "chain-kill.ogg"] },
      { files: ["chain-kill-1.mp3", "chain-kill-1.ogg"] },
      { files: ["chain-kill-2.mp3", "chain-kill-2.ogg"] },
      { files: ["chain-kill-3.mp3", "chain-kill-3.ogg"] },
      { files: ["chain-kill-4.mp3", "chain-kill-4.ogg"] },
    ],
    volume: 0.36,
    pool: 6,
    rateJitter: 0.04,
  },
  enemyFlurry: {
    tracks: [
      { files: ["enemy-flurry-1.mp3", "enemy-flurry-1.ogg"] },
      { files: ["enemy-flurry-2.mp3", "enemy-flurry-2.ogg"] },
      { files: ["enemy-flurry-3.mp3", "enemy-flurry-3.ogg"] },
      { files: ["enemy-flurry-4.mp3", "enemy-flurry-4.ogg"] },
    ],
    volume: 0.26,
    pool: 4,
    rateJitter: 0.04,
  },
  finalPop: { tracks: [{ files: ["final-pop.mp3", "final-pop.ogg"] }], volume: 0.38, pool: 3, rateJitter: 0.03 },
  uiReveal: { tracks: [{ files: ["ui-reveal.mp3", "ui-reveal.ogg"] }], volume: 0.35, pool: 4, rateJitter: 0.02 },
  weaponSpin: { tracks: [{ files: ["weapon-spin.mp3", "weapon-spin.ogg"] }], volume: 0.28, pool: 2, rateJitter: 0.02 },
  alliedGunfire: { tracks: [{ files: ["allied-gunfire.mp3", "allied-gunfire.ogg"] }], volume: 0.24, pool: 3, rateJitter: 0.04 },
  bossAttack: { tracks: [{ files: ["boss-attack.mp3", "boss-attack.ogg"] }], volume: 0.38, pool: 4, rateJitter: 0.03 },
  bossWarning: { tracks: [{ files: ["boss-warning.mp3", "boss-warning.ogg"] }], volume: 0.38, pool: 3, rateJitter: 0.02 },
  bossDown: { tracks: [{ files: ["boss-down.mp3", "boss-down.ogg"] }], volume: 0.42, pool: 3, rateJitter: 0.03 },
  resultVictory: { tracks: [{ files: ["result-victory.mp3", "result-victory.ogg"] }], volume: 0.42, pool: 2, rateJitter: 0.02 },
  resultDefeat: { tracks: [{ files: ["result-defeat.mp3", "result-defeat.ogg"] }], volume: 0.4, pool: 2, rateJitter: 0.02 },
} as const

const LOOP_CONFIGS: Record<AudioLoop, LoopConfig> = {
  bgmRun: {
    tracks: [
      { files: ["bgm-run-1.mp3", "bgm-run-1.ogg"] },
      { files: ["bgm-run-2.mp3", "bgm-run-2.ogg"] },
      { files: ["bgm-run-3.mp3", "bgm-run-3.ogg"] },
      { files: ["bgm-run-4.mp3", "bgm-run-4.ogg"] },
      { files: ["bgm-run-5.mp3", "bgm-run-5.ogg"] },
    ],
    volume: 0.24,
  },
  runFootsteps: { tracks: [{ files: ["run-footsteps.mp3", "run-footsteps.ogg"] }], volume: 0.1 },
} as const

export class AudioSampleBank {
  private readonly samples = new Map<AudioCue, readonly Howl[]>()
  private readonly loops = new Map<AudioLoop, readonly Howl[]>()
  private readonly activeLoops = new Map<AudioLoop, Howl>()

  constructor() {
    for (const cue of AUDIO_CUES) {
      const config = CUE_CONFIGS[cue]
      this.samples.set(cue, config.tracks.map((track) => new Howl({
          src: track.files.map((file) => `/assets/audio/${file}`),
          volume: config.volume,
          pool: config.pool,
          preload: false,
        }),
      ))
    }
    for (const loop of AUDIO_LOOPS) {
      const config = LOOP_CONFIGS[loop]
      this.loops.set(loop, config.tracks.map((track) => new Howl({
        src: track.files.map((file) => `/assets/audio/${file}`),
        volume: config.volume,
        loop: true,
        preload: false,
      })))
    }
  }

  play(cue: AudioCue, options: PlayOptions = {}): void {
    const sample = this.pickCueSample(cue)
    if (sample === null) {
      return
    }
    const config = CUE_CONFIGS[cue]
    this.loadSample(sample)
    const soundId = sample.play()
    const rate = Math.max(0.72, 1 + (options.rateOffset ?? 0) + this.centeredRandom() * config.rateJitter)
    sample.rate(rate, soundId)
    sample.volume(config.volume * (options.volumeScale ?? 1), soundId)
  }

  playLoop(loop: AudioLoop): void {
    const active = this.activeLoops.get(loop)
    if (active?.playing() === true) {
      return
    }
    const sample = this.pickLoopSample(loop)
    if (sample === null) {
      return
    }
    this.activeLoops.set(loop, sample)
    sample.volume(LOOP_CONFIGS[loop].volume)
    this.loadSample(sample)
    sample.play()
  }

  setLoopVolume(loop: AudioLoop, volumeScale: number): void {
    const sample = this.activeLoops.get(loop)
    if (sample === undefined) {
      return
    }
    sample.volume(LOOP_CONFIGS[loop].volume * volumeScale)
  }

  stopLoop(loop: AudioLoop): void {
    const samples = this.loops.get(loop)
    if (samples === undefined) {
      return
    }
    for (const sample of samples) {
      sample.stop()
      sample.volume(LOOP_CONFIGS[loop].volume)
    }
    this.activeLoops.delete(loop)
  }

  dispose(): void {
    for (const samples of this.samples.values()) {
      for (const sample of samples) {
        sample.unload()
      }
    }
    for (const samples of this.loops.values()) {
      for (const sample of samples) {
        sample.unload()
      }
    }
    this.samples.clear()
    this.loops.clear()
    this.activeLoops.clear()
  }

  private pickCueSample(cue: AudioCue): Howl | null {
    const samples = this.samples.get(cue)
    if (samples === undefined || samples.length === 0) {
      return null
    }
    const index = Math.floor(Math.random() * samples.length)
    return samples[index] ?? samples[0] ?? null
  }

  private pickLoopSample(loop: AudioLoop): Howl | null {
    const samples = this.loops.get(loop)
    if (samples === undefined || samples.length === 0) {
      return null
    }
    if (samples.length === 1) {
      return samples[0] ?? null
    }
    const previous = this.activeLoops.get(loop)
    const candidates = samples.filter((sample) => sample !== previous)
    const index = Math.floor(Math.random() * candidates.length)
    return candidates[index] ?? samples[0] ?? null
  }

  private centeredRandom(): number {
    return Math.random() * 2 - 1
  }

  private loadSample(sample: Howl): void {
    if (sample.state() === "unloaded") {
      sample.load()
    }
  }
}
