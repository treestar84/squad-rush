import { AudioSampleBank } from "./AudioSampleBank"

export class AudioSystem {
  private readonly samples = new AudioSampleBank()
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private runOscillator: OscillatorNode | null = null
  private runPulseOscillator: OscillatorNode | null = null
  private runGain: GainNode | null = null
  private lastShotAt = 0
  private lastHitAt = 0

  unlock(): void {
    if (this.context === null) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = 0.18
      this.master.connect(this.context.destination)
    }
    if (this.context.state === "suspended") {
      void this.context.resume()
    }
  }

  playStartJingle(): void {
    this.samples.play("startJingle")
  }

  playCountdown(value: number): void {
    if (value <= 1) {
      this.samples.play("countdownHigh")
      return
    }
    if (value <= 3) {
      this.samples.play("countdownMid")
      return
    }
    this.samples.play("countdownLow")
  }

  updateRunAmbience(soldierCount: number, progressPct: number, bossHpRatio: number): void {
    const context = this.context
    const runGain = this.runGain
    const runOscillator = this.runOscillator
    const runPulseOscillator = this.runPulseOscillator
    if (context === null || runGain === null || runOscillator === null || runPulseOscillator === null) {
      return
    }
    const threat = bossHpRatio >= 0 ? 0.18 : 0
    const intensity = Math.min(1, 0.32 + soldierCount * 0.028 + progressPct * 0.004 + threat)
    const time = context.currentTime
    runGain.gain.setTargetAtTime(0.014 + intensity * 0.032, time, 0.18)
    runOscillator.frequency.setTargetAtTime(54 + intensity * 24, time, 0.22)
    runPulseOscillator.frequency.setTargetAtTime(8 + Math.min(12, soldierCount * 0.48), time, 0.18)
    this.samples.setLoopVolume("bgmRun", 0.72 + intensity * 0.28)
    this.samples.setLoopVolume("runFootsteps", Math.min(1, 0.34 + soldierCount * 0.035 + progressPct * 0.003))
  }

  playShot(power: number): void {
    const now = this.now()
    if (now - this.lastShotAt < 0.028) {
      return
    }
    this.lastShotAt = now
    this.samples.play("shot", { volumeScale: 0.66, rateOffset: Math.min(0.16, power * 0.025) })
    this.playTone(760 + power * 90, 0.045, "square", 0.12)
    this.playNoise(0.035, 0.06, 900)
  }

  playHit(): void {
    const now = this.now()
    if (now - this.lastHitAt < 0.04) {
      return
    }
    this.lastHitAt = now
    this.samples.play("hit", { volumeScale: 0.58 })
    this.playTone(250, 0.055, "triangle", 0.1)
    this.playNoise(0.07, 0.08, 620)
  }

  playChainKill(): void {
    this.samples.play("chainKill", { volumeScale: 0.86, rateOffset: 0.02 })
  }

  playGate(): void {
    this.samples.play("gate", { rateOffset: 0.04 })
    this.playTone(520, 0.11, "sine", 0.12)
    this.playTone(880, 0.16, "triangle", 0.1, 0.04)
    this.playTone(1320, 0.2, "sine", 0.08, 0.08)
  }

  playPickup(): void {
    this.samples.play("pickup", { rateOffset: 0.08 })
    this.playTone(980, 0.09, "sine", 0.1)
    this.playTone(1420, 0.12, "sine", 0.08, 0.045)
  }

  playSquadAdd(count: number): void {
    const gain = Math.min(0.15, 0.07 + count * 0.012)
    this.samples.play("squadAdd", { volumeScale: Math.min(1.15, 0.82 + count * 0.012), rateOffset: 0.03 })
    this.playTone(620, 0.1, "triangle", gain)
    this.playTone(940, 0.14, "sine", gain * 0.72, 0.04)
    this.playNoise(0.08, gain * 0.42, 1040)
  }

  playBossAttack(): void {
    this.samples.play("bossAttack", { volumeScale: 0.85 })
    this.playTone(110, 0.22, "sawtooth", 0.14)
    this.playNoise(0.18, 0.12, 260)
  }

  playBossWarning(): void {
    this.samples.play("bossWarning", { volumeScale: 0.9, rateOffset: -0.04 })
    this.playTone(92, 0.42, "sawtooth", 0.13)
    this.playTone(184, 0.28, "triangle", 0.1, 0.08)
    this.playNoise(0.34, 0.08, 360)
  }

  playBossDown(): void {
    this.samples.play("bossDown", { volumeScale: 0.95, rateOffset: -0.03 })
    this.playTone(180, 0.28, "sawtooth", 0.15)
    this.playTone(420, 0.22, "triangle", 0.12, 0.08)
    this.playGate()
  }

  playResult(victory: boolean): void {
    if (victory) {
      this.samples.play("resultVictory", { volumeScale: 0.9, rateOffset: 0.03 })
      this.playGate()
      this.playTone(1760, 0.26, "sine", 0.08, 0.14)
      return
    }
    this.samples.play("resultDefeat", { volumeScale: 0.9, rateOffset: -0.05 })
    this.playTone(180, 0.26, "sawtooth", 0.13)
    this.playTone(95, 0.34, "triangle", 0.12, 0.12)
  }

  stopRunAmbience(): void {
    this.samples.stopLoop("runFootsteps")
    this.samples.stopLoop("bgmRun")
    this.runOscillator?.stop()
    this.runPulseOscillator?.stop()
    this.runOscillator = null
    this.runPulseOscillator = null
    this.runGain = null
  }

  dispose(): void {
    this.stopRunAmbience()
    this.samples.dispose()
    void this.context?.close()
    this.context = null
    this.master = null
  }

  startRunAmbience(): void {
    const context = this.context
    const master = this.master
    if (context === null || master === null || this.runOscillator !== null) {
      return
    }
    this.samples.playLoop("bgmRun")
    this.samples.playLoop("runFootsteps")
    const runOscillator = context.createOscillator()
    const runPulseOscillator = context.createOscillator()
    const filter = context.createBiquadFilter()
    const runGain = context.createGain()
    runOscillator.type = "triangle"
    runPulseOscillator.type = "square"
    runOscillator.frequency.value = 58
    runPulseOscillator.frequency.value = 9
    filter.type = "lowpass"
    filter.frequency.value = 340
    runGain.gain.value = 0.001
    runOscillator.connect(filter)
    runPulseOscillator.connect(filter)
    filter.connect(runGain)
    runGain.connect(master)
    runOscillator.start()
    runPulseOscillator.start()
    this.runOscillator = runOscillator
    this.runPulseOscillator = runPulseOscillator
    this.runGain = runGain
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
    const context = this.context
    const master = this.master
    if (context === null || master === null) {
      return
    }
    const start = context.currentTime + delay
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.56), start + duration)
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  private playNoise(duration: number, volume: number, cutoff: number): void {
    const context = this.context
    const master = this.master
    if (context === null || master === null) {
      return
    }
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration))
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length)
    }
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = buffer
    filter.type = "lowpass"
    filter.frequency.value = cutoff
    gain.gain.value = volume
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start()
  }

  private now(): number {
    return this.context?.currentTime ?? 0
  }
}
