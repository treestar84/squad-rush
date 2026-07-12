import {
  PROMOTION_RULES,
  UNIT_ORDER,
  UNIT_TYPES,
  createEmptyUnitCounts,
  type PromotionRule,
  type UnitCounts,
  type UnitRequirement,
  type UnitType,
} from "../data/squadRosterData"

export type PromotionResolution = {
  readonly counts: UnitCounts
  readonly labels: readonly string[]
  readonly events: readonly PromotionResolutionEvent[]
  readonly promotedCount: number
}

export type PromotionResolutionEvent = {
  readonly label: string
  readonly requirements: readonly UnitRequirement[]
  readonly result: UnitType
  readonly resultCount: number
}

type RandomSource = () => number

export function cloneUnitCounts(counts: UnitCounts): UnitCounts {
  const next = createEmptyUnitCounts()
  for (const unit of UNIT_ORDER) {
    next[unit] = counts[unit]
  }
  return next
}

export function resolvePromotionChain(counts: UnitCounts, random: RandomSource = Math.random): PromotionResolution {
  const next = cloneUnitCounts(counts)
  const labels: string[] = []
  const events: PromotionResolutionEvent[] = []
  let promotedCount = 0
  let rule = pickFirstApplicablePromotion(next)
  while (rule !== null) {
    const requirements = getEffectiveRequirements(next, rule)
    consumePromotionRequirements(next, rule)
    const result = pickPromotionResult(rule, random)
    next[result] += rule.resultCount
    labels.push(rule.label)
    events.push({
      label: rule.label,
      requirements,
      result,
      resultCount: rule.resultCount,
    })
    promotedCount += 1
    rule = pickFirstApplicablePromotion(next)
  }
  return { counts: next, labels, events, promotedCount }
}

function pickFirstApplicablePromotion(counts: UnitCounts): PromotionRule | null {
  return PROMOTION_RULES.find((rule) => canApplyPromotion(counts, rule)) ?? null
}

function canApplyPromotion(counts: UnitCounts, rule: PromotionRule): boolean {
  for (const requirement of getEffectiveRequirements(counts, rule)) {
    if (counts[requirement.unit] < requirement.count) {
      return false
    }
  }
  return true
}

function consumePromotionRequirements(counts: UnitCounts, rule: PromotionRule): void {
  for (const requirement of getEffectiveRequirements(counts, rule)) {
    counts[requirement.unit] -= requirement.count
  }
}

function getEffectiveRequirements(counts: UnitCounts, rule: PromotionRule): readonly UnitRequirement[] {
  if (counts[UNIT_TYPES.seniorDeveloper] <= 0) {
    return rule.requirements
  }
  return rule.requirements.map((requirement) => ({
    unit: requirement.unit,
    count: Math.max(1, requirement.count - 1),
  }))
}

function pickPromotionResult(rule: PromotionRule, random: RandomSource): UnitType {
  if (typeof rule.result === "string") {
    return rule.result
  }
  const index = pickWeightedIndex(rule, random)
  return rule.result[index] ?? rule.result[0]
}

function pickWeightedIndex(rule: PromotionRule, random: RandomSource): number {
  if (typeof rule.result === "string") {
    return 0
  }
  const weights = rule.resultWeights
  if (weights === undefined) {
    return Math.min(rule.result.length - 1, Math.floor(random() * rule.result.length))
  }
  const totalWeight = weights.reduce((total, weight) => total + Math.max(0, weight), 0)
  if (totalWeight <= 0) {
    return 0
  }
  let cursor = random() * totalWeight
  for (let index = 0; index < rule.result.length; index += 1) {
    cursor -= Math.max(0, weights[index] ?? 0)
    if (cursor < 0) {
      return index
    }
  }
  return rule.result.length - 1
}
