export const DEFAULT_VIEWPORT = { width: 390, height: 844 }

export const DEFAULT_SAMPLE_TIMES_MS = [12000, 24000, 36000]

export const DEFENSE_WINDOWS = {
  onboarding_crowd: { sampleTimesMs: [12000, 24000, 36000], query: {} },
  contested_pickup: { sampleTimesMs: [7000, 14000, 21000], query: { qaStartZ: "115", qaSpeed: "1.5" } },
  boss_jam: { sampleTimesMs: [7000, 14000, 21000], query: { qaStartZ: "205", qaSpeed: "1.5" } },
  recovery_burst: { sampleTimesMs: [7000, 14000, 21000], query: { qaStartZ: "285", qaSpeed: "1.5" } },
  final_squeeze: { sampleTimesMs: [7000, 14000, 21000], query: { qaStartZ: "360", qaSpeed: "1.25" } },
}

export const DEFENSE_ROUTES = {
  default: { query: {}, status: "supported" },
  "military-heavy": { query: { qa: "defense-routes", qaSoldiers: "8" }, status: "supported" },
  "developer-heavy": { query: { qa: "defense-routes", qaSoldiers: "6" }, status: "supported" },
  "unemployed-volatile": { query: { qa: "defense-routes", qaSoldiers: "3" }, status: "supported" },
  "high-squad-stress": { query: { qaSoldiers: "15", qaPangyo: "8" }, status: "supported" },
}

export const DEFAULT_CASES = [
  {
    mode: "run",
    difficulty: "easy",
    trials: 3,
    query: { quality: "high", qa: "monsters", qaNoDamage: "1" },
    targets: {
      activeMin: 260,
      activeMax: 360,
      killMin: 80,
      killMax: 420,
      nearestMax: 28,
      survivorMin: 4,
      growthMin: 1,
      visibleCoverageMin: 0.45,
    },
  },
  {
    mode: "run",
    difficulty: "medium",
    trials: 3,
    query: { quality: "high", qa: "monsters", qaNoDamage: "1" },
    targets: {
      activeMin: 230,
      activeMax: 360,
      killMin: 52,
      killMax: 440,
      nearestMax: 32,
      survivorMin: 3,
      growthMin: 1,
      visibleCoverageMin: 0.45,
    },
  },
  {
    mode: "run",
    difficulty: "hard",
    trials: 3,
    query: { quality: "high", qa: "monsters", qaNoDamage: "1" },
    targets: {
      activeMin: 130,
      activeMax: 300,
      killMin: 32,
      killMax: 460,
      nearestMax: 36,
      survivorMin: 2,
      growthMin: 1,
      visibleCoverageMin: 0.4,
    },
  },
  {
    mode: "defense",
    difficulty: "easy",
    trials: 3,
    query: { quality: "high", qa: "monsters", qaNoDamage: "1" },
    targets: {
      activeMin: 120,
      activeMax: 360,
      killMin: 50,
      killMax: 150,
      nearestMax: 8,
      survivorMin: 4,
      growthMin: 1,
      visibleCoverageMin: 0.65,
    },
  },
  {
    mode: "defense",
    difficulty: "medium",
    trials: 3,
    query: { quality: "high", qa: "monsters", qaNoDamage: "1" },
    targets: {
      activeMin: 90,
      activeMax: 360,
      killMin: 32,
      killMax: 220,
      nearestMax: 10,
      survivorMin: 2,
      growthMin: 1,
      visibleCoverageMin: 0.65,
      openingActiveMax: 120,
    },
  },
  {
    mode: "defense",
    difficulty: "hard",
    trials: 3,
    query: { quality: "high", qa: "monsters", qaNoDamage: "1" },
    targets: {
      activeMin: 90,
      activeMax: 360,
      killMin: 20,
      killMax: 180,
      nearestMax: 12,
      survivorMin: 1,
      growthMin: 1,
      visibleCoverageMin: 0.65,
      openingActiveMax: 130,
    },
  },
]

export const DEFAULT_STRATEGY = {
  pressureKnobs: [
    "src/game/data/difficultyData.ts: spawnMultiplier, regularSpawnMultiplier, pressureMultiplier",
    "src/game/data/gameModeData.ts: monsterSpawnMultiplier, monsterPressureMultiplier",
    "src/game/systems/DefenseWaveTuning.ts: DEFENSE_*_SPAWN_DENSITY, DEFENSE_*_PRESSURE, visible targets",
  ],
  growthKnobs: [
    "src/game/systems/BonusPickupSchedule.ts: pickup timing and reward counts",
    "src/game/data/squadRosterData.ts: unit power and promotion pacing",
    "src/game/systems/SquadPromotionEngine.ts: promotion weights and chain outcomes",
  ],
}
