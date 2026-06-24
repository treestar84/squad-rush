export const SEGMENT_TYPES = {
  intro: "INTRO",
  gate: "GATE",
  wave: "WAVE",
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
  startSoldiers: 1,
  trackWidth: 14,
  forwardSpeed: 2.27,
  totalLength: 380,
  segments: [
    { type: SEGMENT_TYPES.intro, startZ: 0, endZ: 32 },
    { type: SEGMENT_TYPES.gate, startZ: 32, endZ: 52, configId: "gate_pair_1" },
    { type: SEGMENT_TYPES.wave, startZ: 52, endZ: 176, configId: "continuous_swarm_1" },
    { type: SEGMENT_TYPES.gate, startZ: 176, endZ: 198, configId: "gate_pair_2" },
    { type: SEGMENT_TYPES.wave, startZ: 198, endZ: 356, configId: "continuous_swarm_2" },
    { type: SEGMENT_TYPES.gate, startZ: 356, endZ: 380, configId: "finish_run" },
  ],
} as const
