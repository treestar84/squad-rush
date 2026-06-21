export const SEGMENT_TYPES = {
  intro: "INTRO",
  gate: "GATE",
  wave: "WAVE",
  boss: "BOSS",
} as const

export type SegmentType = (typeof SEGMENT_TYPES)[keyof typeof SEGMENT_TYPES]

export type LevelSegment = {
  readonly type: SegmentType
  readonly startZ: number
  readonly endZ: number
  readonly configId?: string
}

export type LevelData = {
  readonly id: string
  readonly startSoldiers: number
  readonly trackWidth: number
  readonly forwardSpeed: number
  readonly totalLength: number
  readonly segments: readonly LevelSegment[]
}

export const LEVEL_1: LevelData = {
  id: "level_1",
  startSoldiers: 20,
  trackWidth: 14,
  forwardSpeed: 8,
  totalLength: 205,
  segments: [
    { type: SEGMENT_TYPES.intro, startZ: 0, endZ: 20 },
    { type: SEGMENT_TYPES.gate, startZ: 20, endZ: 40, configId: "gate_pair_1" },
    { type: SEGMENT_TYPES.wave, startZ: 40, endZ: 90, configId: "wave_1" },
    { type: SEGMENT_TYPES.gate, startZ: 90, endZ: 110, configId: "gate_pair_2" },
    { type: SEGMENT_TYPES.wave, startZ: 110, endZ: 160, configId: "wave_2" },
    { type: SEGMENT_TYPES.boss, startZ: 160, endZ: 205, configId: "boss_titan" },
  ],
} as const
