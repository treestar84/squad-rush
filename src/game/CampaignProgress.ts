import { DIFFICULTY_IDS, type DifficultyId } from "./data/difficultyData"
import { GAME_MODE_IDS, type GameModeId } from "./data/gameModeData"

export const CAMPAIGN_STORAGE_KEY = "squad-rush-campaign-progress-v2"
export const LEGACY_CAMPAIGN_STORAGE_KEY = "squad-rush-campaign-progress-v1"
export const CAMPAIGN_MAX_FACILITY_LEVEL = 10

const LEGACY_CAMPAIGN_MAX_FACILITY_LEVEL = 5

export const CAMPAIGN_FACILITY_IDS = {
  training: "training",
  armory: "armory",
  fortification: "fortification",
} as const

export type CampaignFacilityId = (typeof CAMPAIGN_FACILITY_IDS)[keyof typeof CAMPAIGN_FACILITY_IDS]

export type CampaignResources = {
  readonly intel: number
  readonly alloy: number
}

export type CampaignFacilities = Record<CampaignFacilityId, number>

export type CampaignProgress = {
  readonly version: 2
  readonly resources: CampaignResources
  readonly facilities: CampaignFacilities
  readonly runsCompleted: Record<GameModeId, number>
  readonly victories: Record<GameModeId, number>
}

export type CampaignBonuses = {
  readonly bonusStartingUnits: number
  readonly attackMultiplier: number
  readonly startingShield: number
}

export type CampaignFacilityDefinition = {
  readonly id: CampaignFacilityId
  readonly label: string
  readonly shortLabel: string
  readonly description: string
  readonly effectPerLevel: string
  readonly imageSrc: string
  readonly imageAlt: string
  readonly baseIntelCost: number
  readonly baseAlloyCost: number
  readonly intelCostStep: number
  readonly alloyCostStep: number
}

export type CampaignFacilityEffectSummary = {
  readonly currentLabel: string
  readonly cadenceLabel: string
}

export type CampaignFacilityState = {
  readonly definition: CampaignFacilityDefinition
  readonly level: number
  readonly maxed: boolean
  readonly nextCost: CampaignResources | null
  readonly affordable: boolean
}

export type CampaignRunReward = CampaignResources & {
  readonly mode: GameModeId
  readonly primaryLabel: string
}

export type CampaignRewardGrant = {
  readonly reward: CampaignRunReward
  readonly progress: CampaignProgress
}

export type CampaignPurchaseResult = {
  readonly applied: boolean
  readonly reason: "purchased" | "max-level" | "insufficient-resources"
  readonly facility: CampaignFacilityState
  readonly progress: CampaignProgress
}

declare global {
  interface Window {
    __squadRushCampaignDebug?: {
      readonly progress: CampaignProgress
      readonly bonuses: CampaignBonuses
    }
  }
}

export const CAMPAIGN_FACILITY_ORDER = [
  CAMPAIGN_FACILITY_IDS.training,
  CAMPAIGN_FACILITY_IDS.armory,
  CAMPAIGN_FACILITY_IDS.fortification,
] as const

export const CAMPAIGN_FACILITY_DEFINITIONS: Record<CampaignFacilityId, CampaignFacilityDefinition> = {
  [CAMPAIGN_FACILITY_IDS.training]: {
    id: CAMPAIGN_FACILITY_IDS.training,
    label: "훈련소",
    shortLabel: "TRAINING",
    description: "증원 병력을 단계적으로 확보합니다.",
    effectPerLevel: "2단계마다 시작 인원 +1",
    imageSrc: "/assets/ui/command-center/training-facility.webp",
    imageAlt: "세 명의 선두 병사 뒤로 대열이 밀집한 요새 훈련소",
    baseIntelCost: 8,
    baseAlloyCost: 3,
    intelCostStep: 4,
    alloyCostStep: 2,
  },
  [CAMPAIGN_FACILITY_IDS.armory]: {
    id: CAMPAIGN_FACILITY_IDS.armory,
    label: "무기고",
    shortLabel: "ARMORY",
    description: "전 모드의 화력을 정밀 강화합니다.",
    effectPerLevel: "단계마다 전체 화력 +3%",
    imageSrc: "/assets/ui/command-center/armory.webp",
    imageAlt: "대형 전술 소총을 정비하는 검은 강철 무기고",
    baseIntelCost: 6,
    baseAlloyCost: 6,
    intelCostStep: 3,
    alloyCostStep: 3,
  },
  [CAMPAIGN_FACILITY_IDS.fortification]: {
    id: CAMPAIGN_FACILITY_IDS.fortification,
    label: "방벽 공방",
    shortLabel: "FORTIFY",
    description: "작전 시작 피해를 흡수합니다.",
    effectPerLevel: "단계마다 시작 방어막 +1",
    imageSrc: "/assets/ui/command-center/fortification-workshop.webp",
    imageAlt: "푸른 에너지 방벽을 전개한 요새 방벽 공방",
    baseIntelCost: 3,
    baseAlloyCost: 8,
    intelCostStep: 2,
    alloyCostStep: 4,
  },
}

const EMPTY_PROGRESS: CampaignProgress = {
  version: 2,
  resources: { intel: 0, alloy: 0 },
  facilities: { training: 0, armory: 0, fortification: 0 },
  runsCompleted: { run: 0, defense: 0 },
  victories: { run: 0, defense: 0 },
}

export function readCampaignProgress(): CampaignProgress {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_STORAGE_KEY)
    if (raw !== null) {
      const progress = normalizeCampaignProgress(JSON.parse(raw) as unknown)
      publishCampaignDebug(progress)
      return progress
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_CAMPAIGN_STORAGE_KEY)
    if (legacyRaw !== null) {
      const legacy = normalizeCampaignProgress(
        JSON.parse(legacyRaw) as unknown,
        LEGACY_CAMPAIGN_MAX_FACILITY_LEVEL,
      )
      const migrated = migrateLegacyCampaignProgress(legacy)
      writeCampaignProgress(migrated)
      publishCampaignDebug(migrated)
      return migrated
    }
    const empty = cloneProgress(EMPTY_PROGRESS)
    publishCampaignDebug(empty)
    return empty
  } catch (error) {
    if (error instanceof DOMException || error instanceof SyntaxError) {
      const empty = cloneProgress(EMPTY_PROGRESS)
      publishCampaignDebug(empty)
      return empty
    }
    throw error
  }
}

export function getCampaignBonuses(progress = readCampaignProgress()): CampaignBonuses {
  return {
    bonusStartingUnits: Math.floor(progress.facilities.training / 2),
    attackMultiplier: 1 + progress.facilities.armory * 0.03,
    startingShield: progress.facilities.fortification,
  }
}

export function getCampaignFacilityEffectSummary(
  facilityId: CampaignFacilityId,
  currentLevel: number,
): CampaignFacilityEffectSummary {
  const level = clampInteger(currentLevel, 0, CAMPAIGN_MAX_FACILITY_LEVEL)
  const maxed = level >= CAMPAIGN_MAX_FACILITY_LEVEL
  switch (facilityId) {
    case CAMPAIGN_FACILITY_IDS.training:
      return {
        currentLabel: `시작 인원 +${Math.floor(level / 2)}`,
        cadenceLabel: maxed ? "최대 훈련 완료" : `증원 준비 ${level % 2}/2`,
      }
    case CAMPAIGN_FACILITY_IDS.armory:
      return {
        currentLabel: `전체 화력 +${level * 3}%`,
        cadenceLabel: maxed ? "최대 화력 도달" : "다음 단계 +3%",
      }
    case CAMPAIGN_FACILITY_IDS.fortification:
      return {
        currentLabel: `시작 방어막 +${level}`,
        cadenceLabel: maxed ? "최대 방벽 완성" : "다음 단계 +1",
      }
  }
}

export function getCampaignFacilityState(
  facilityId: CampaignFacilityId,
  progress = readCampaignProgress(),
): CampaignFacilityState {
  const definition = CAMPAIGN_FACILITY_DEFINITIONS[facilityId]
  const level = progress.facilities[facilityId]
  const maxed = level >= CAMPAIGN_MAX_FACILITY_LEVEL
  const nextCost = maxed ? null : getCampaignFacilityCost(facilityId, level)
  return {
    definition,
    level,
    maxed,
    nextCost,
    affordable: nextCost !== null
      && progress.resources.intel >= nextCost.intel
      && progress.resources.alloy >= nextCost.alloy,
  }
}

export function getCampaignFacilityCost(facilityId: CampaignFacilityId, currentLevel: number): CampaignResources {
  const definition = CAMPAIGN_FACILITY_DEFINITIONS[facilityId]
  const level = clampInteger(currentLevel, 0, CAMPAIGN_MAX_FACILITY_LEVEL)
  return {
    intel: definition.baseIntelCost + definition.intelCostStep * level,
    alloy: definition.baseAlloyCost + definition.alloyCostStep * level,
  }
}

export function purchaseCampaignFacility(facilityId: CampaignFacilityId): CampaignPurchaseResult {
  const current = readCampaignProgress()
  const facility = getCampaignFacilityState(facilityId, current)
  if (facility.maxed || facility.nextCost === null) {
    return { applied: false, reason: "max-level", facility, progress: current }
  }
  if (!facility.affordable) {
    return { applied: false, reason: "insufficient-resources", facility, progress: current }
  }
  const next: CampaignProgress = {
    ...current,
    resources: {
      intel: current.resources.intel - facility.nextCost.intel,
      alloy: current.resources.alloy - facility.nextCost.alloy,
    },
    facilities: {
      ...current.facilities,
      [facilityId]: current.facilities[facilityId] + 1,
    },
  }
  writeCampaignProgress(next)
  return {
    applied: true,
    reason: "purchased",
    facility: getCampaignFacilityState(facilityId, next),
    progress: next,
  }
}

export function grantCampaignRunReward(input: {
  readonly mode: GameModeId
  readonly difficulty: DifficultyId
  readonly victory: boolean
  readonly monstersKilled: number
  readonly progressRatio: number
}): CampaignRewardGrant {
  const reward = calculateCampaignRunReward(input)
  const current = readCampaignProgress()
  const next: CampaignProgress = {
    ...current,
    resources: {
      intel: current.resources.intel + reward.intel,
      alloy: current.resources.alloy + reward.alloy,
    },
    runsCompleted: {
      ...current.runsCompleted,
      [input.mode]: current.runsCompleted[input.mode] + 1,
    },
    victories: {
      ...current.victories,
      [input.mode]: current.victories[input.mode] + (input.victory ? 1 : 0),
    },
  }
  writeCampaignProgress(next)
  return { reward, progress: next }
}

export function calculateCampaignRunReward(input: {
  readonly mode: GameModeId
  readonly difficulty: DifficultyId
  readonly victory: boolean
  readonly monstersKilled: number
  readonly progressRatio: number
}): CampaignRunReward {
  const difficultyMultiplier = getRewardDifficultyMultiplier(input.difficulty)
  const kills = Math.max(0, Math.floor(input.monstersKilled))
  const progress = Math.max(0, Math.min(1, input.progressRatio))
  const primaryBase = 4
    + Math.floor(kills / 20)
    + Math.round(progress * 8)
    + (input.victory ? 8 : 0)
  const primary = Math.max(1, Math.floor(primaryBase * difficultyMultiplier))
  const secondary = Math.max(input.victory ? 2 : 1, Math.floor(primary * 0.25))
  if (input.mode === GAME_MODE_IDS.defense) {
    return { mode: input.mode, primaryLabel: "방어 합금", intel: secondary, alloy: primary }
  }
  return { mode: input.mode, primaryLabel: "작전 정보", intel: primary, alloy: secondary }
}

function getRewardDifficultyMultiplier(difficulty: DifficultyId): number {
  switch (difficulty) {
    case DIFFICULTY_IDS.medium:
      return 1.2
    case DIFFICULTY_IDS.hard:
      return 1.5
    case DIFFICULTY_IDS.infinite:
      return 1.75
    case DIFFICULTY_IDS.easy:
      return 1
  }
}

function writeCampaignProgress(progress: CampaignProgress): void {
  try {
    window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(progress))
    publishCampaignDebug(progress)
  } catch (error) {
    if (error instanceof DOMException) {
      return
    }
    throw error
  }
}

function publishCampaignDebug(progress: CampaignProgress): void {
  if (!window.location.search.includes("qa=campaign")) {
    return
  }
  window.__squadRushCampaignDebug = {
    progress: cloneProgress(progress),
    bonuses: getCampaignBonuses(progress),
  }
}

function normalizeCampaignProgress(
  value: unknown,
  facilityMaxLevel = CAMPAIGN_MAX_FACILITY_LEVEL,
): CampaignProgress {
  if (!isPlainRecord(value)) {
    return cloneProgress(EMPTY_PROGRESS)
  }
  const resources = isPlainRecord(value["resources"]) ? value["resources"] : {}
  const facilities = isPlainRecord(value["facilities"]) ? value["facilities"] : {}
  const runsCompleted = isPlainRecord(value["runsCompleted"]) ? value["runsCompleted"] : {}
  const victories = isPlainRecord(value["victories"]) ? value["victories"] : {}
  return {
    version: 2,
    resources: {
      intel: readStoredInteger(resources["intel"], 0, 999_999),
      alloy: readStoredInteger(resources["alloy"], 0, 999_999),
    },
    facilities: {
      training: readStoredInteger(facilities["training"], 0, facilityMaxLevel),
      armory: readStoredInteger(facilities["armory"], 0, facilityMaxLevel),
      fortification: readStoredInteger(facilities["fortification"], 0, facilityMaxLevel),
    },
    runsCompleted: {
      run: readStoredInteger(runsCompleted[GAME_MODE_IDS.run], 0, 999_999),
      defense: readStoredInteger(runsCompleted[GAME_MODE_IDS.defense], 0, 999_999),
    },
    victories: {
      run: readStoredInteger(victories[GAME_MODE_IDS.run], 0, 999_999),
      defense: readStoredInteger(victories[GAME_MODE_IDS.defense], 0, 999_999),
    },
  }
}

function migrateLegacyCampaignProgress(legacy: CampaignProgress): CampaignProgress {
  return {
    ...cloneProgress(legacy),
    version: 2,
    facilities: {
      training: legacy.facilities.training * 2,
      armory: legacy.facilities.armory * 2,
      fortification: legacy.facilities.fortification * 2,
    },
  }
}

function cloneProgress(progress: CampaignProgress): CampaignProgress {
  return {
    ...progress,
    resources: { ...progress.resources },
    facilities: { ...progress.facilities },
    runsCompleted: { ...progress.runsCompleted },
    victories: { ...progress.victories },
  }
}

function readStoredInteger(value: unknown, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clampInteger(value, min, max)
    : min
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null
}
