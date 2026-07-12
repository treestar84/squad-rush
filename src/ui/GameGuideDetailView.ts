import {
  UNIT_DEFINITIONS,
  type UnitRequirement,
  type UnitType,
} from "../game/data/squadRosterData"
import {
  ACTIVE_PROMOTION_RULES,
  GUIDE_UNIT_TIERS,
  findRuleForResult,
  formatGuideRequirements,
  formatGuideRuleResult,
  getGuidePortraitSource,
  type GuideUnit,
} from "./GameGuideData"

export function createGuideDetail(guideUnit: GuideUnit): HTMLElement {
  const definition = UNIT_DEFINITIONS[guideUnit.type]
  const guideTier = GUIDE_UNIT_TIERS[guideUnit.type]
  const detail = document.createElement("article")
  detail.className = `game-guide-detail-card game-guide-detail-card--tier-${guideTier}`

  const header = document.createElement("div")
  header.className = "game-guide-detail-header"
  const portrait = document.createElement("img")
  portrait.src = getGuidePortraitSource(guideUnit.type)
  portrait.alt = `${definition.label} 전술 인사기록 초상화`
  portrait.width = 88
  portrait.height = 88
  portrait.decoding = "async"
  const titleWrap = document.createElement("div")
  const eyebrow = document.createElement("span")
  eyebrow.className = "game-guide-detail-eyebrow"
  eyebrow.textContent = `PERSONNEL FILE // CLASS ${guideTier}`
  const title = document.createElement("h3")
  title.textContent = definition.label
  const meta = document.createElement("span")
  meta.textContent = `FIREPOWER ${definition.basePower} // STATUS ACTIVE`
  titleWrap.append(eyebrow, title, meta)
  header.append(portrait, titleWrap)

  detail.append(
    header,
    createTextBlock("ROLE PROFILE / 특징", guideUnit.detail),
    createTextBlock("COMBAT EFFECT / 효과", guideUnit.effect),
    createRequirementBlock(guideUnit.type),
    createUpgradeBlock(guideUnit.type),
  )
  return detail
}

function createTextBlock(titleText: string, bodyText: string): HTMLElement {
  const section = document.createElement("section")
  section.className = "game-guide-detail-text"
  const title = document.createElement("h4")
  title.textContent = titleText
  const body = document.createElement("p")
  body.textContent = bodyText
  section.append(title, body)
  return section
}

function createRequirementBlock(type: UnitType): HTMLElement {
  const section = document.createElement("section")
  section.className = "game-guide-requirements"
  const title = document.createElement("h4")
  title.textContent = "PROMOTION INPUT / 필요 인원"
  const rule = findRuleForResult(type)
  if (rule === null) {
    const empty = document.createElement("p")
    empty.textContent = "기본 획득 또는 진로 결정으로 확보합니다."
    section.append(title, empty)
    return section
  }
  const summary = document.createElement("p")
  summary.textContent = formatGuideRequirements(rule.requirements)
  section.append(title, summary, createRequirementIcons(rule.requirements))
  return section
}

function createRequirementIcons(requirements: readonly UnitRequirement[]): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "game-guide-requirement-icons"
  for (const requirement of requirements) {
    const definition = UNIT_DEFINITIONS[requirement.unit]
    for (let index = 0; index < requirement.count; index += 1) {
      const icon = document.createElement("img")
      icon.className = "game-guide-requirement-icon"
      icon.src = getGuidePortraitSource(requirement.unit)
      icon.alt = `${definition.label} 승급 필요 인원`
      icon.width = 22
      icon.height = 22
      icon.decoding = "async"
      icon.classList.add(`game-guide-requirement-icon--tier-${GUIDE_UNIT_TIERS[requirement.unit]}`)
      wrap.append(icon)
    }
  }
  return wrap
}

function createUpgradeBlock(type: UnitType): HTMLElement {
  const section = document.createElement("section")
  section.className = "game-guide-upgrade"
  const title = document.createElement("h4")
  title.textContent = "PROMOTION OUTPUT / 상위 결과"
  const rules = ACTIVE_PROMOTION_RULES.filter((rule) => rule.requirements.some((requirement) => requirement.unit === type))
  if (rules.length === 0) {
    const empty = document.createElement("p")
    empty.textContent = "현재 테크트리의 최종 또는 보조 유닛입니다."
    section.append(title, empty)
    return section
  }
  const list = document.createElement("ul")
  list.replaceChildren(...rules.map((rule) => {
    const item = document.createElement("li")
    item.textContent = formatGuideRuleResult(rule)
    return item
  }))
  section.append(title, list)
  return section
}
