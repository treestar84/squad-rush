import { readFile, stat } from "node:fs/promises"
import { build } from "esbuild"

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(`Campaign progression contract failed: ${message}`)
  }
}

const [
  campaignSource,
  appSource,
  gameSource,
  squadSource,
  startSource,
  commandCenterSource,
  resultSource,
  styleSource,
] = await Promise.all([
  readFile("src/game/CampaignProgress.ts", "utf8"),
  readFile("src/app/App.ts", "utf8"),
  readFile("src/game/Game.ts", "utf8"),
  readFile("src/game/systems/SquadSystem.ts", "utf8"),
  readFile("src/ui/StartScreen.ts", "utf8"),
  readFile("src/ui/CommandCenter.ts", "utf8"),
  readFile("src/ui/ResultScreen.ts", "utf8"),
  readFile("src/styles/global.css", "utf8"),
])

assertContract(campaignSource.includes("squad-rush-campaign-progress-v2") && campaignSource.includes("LEGACY_CAMPAIGN_STORAGE_KEY"), "versioned storage and legacy migration are required.")
assertContract(campaignSource.includes("training") && campaignSource.includes("armory") && campaignSource.includes("fortification"), "three campaign facilities are required.")
assertContract(campaignSource.includes("CAMPAIGN_MAX_FACILITY_LEVEL = 10"), "the facility horizon must be ten bounded steps.")
assertContract(campaignSource.includes("training-facility.webp") && campaignSource.includes("armory.webp") && campaignSource.includes("fortification-workshop.webp"), "each facility needs dedicated artwork.")
assertContract(campaignSource.includes("primaryLabel: \"작전 정보\"") && campaignSource.includes("primaryLabel: \"방어 합금\""), "mode-specific primary rewards are missing.")
assertContract(campaignSource.includes("grantCampaignRunReward") && campaignSource.includes("purchaseCampaignFacility"), "reward and spending transactions are missing.")
assertContract(campaignSource.includes("normalizeCampaignProgress") && campaignSource.includes("readStoredInteger"), "stored progress must be validated before use.")
assertContract(appSource.includes("campaignBonuses: getCampaignBonuses(readCampaignProgress())"), "fresh campaign bonuses must be injected when a run is prepared.")
assertContract(gameSource.includes("bonusStartingUnits") && gameSource.includes("startingShield"), "run start must consume training and fortification bonuses.")
assertContract(gameSource.includes("multiplyPermanentAttack(deps.campaignBonuses.attackMultiplier)"), "armory power must apply to combat.")
assertContract(gameSource.includes("grantCampaignRunReward"), "game over must grant persistent campaign rewards.")
assertContract(squadSource.includes("grantShield(amount: number)"), "campaign fortification needs a bounded shield grant API.")
assertContract(startSource.includes("new CommandCenter"), "start screen must expose the command center.")
assertContract(commandCenterSource.includes("role\", \"dialog") && commandCenterSource.includes("aria-modal") && commandCenterSource.includes("aria-describedby"), "command center must use accessible dialog semantics.")
assertContract(commandCenterSource.includes("event.key === \"Escape\"") && commandCenterSource.includes("event.key !== \"Tab\""), "command center must provide keyboard escape and focus containment.")
assertContract(commandCenterSource.includes("aria-live=\"polite\""), "upgrade feedback must be announced without stealing focus.")
assertContract(commandCenterSource.includes("loading=\"lazy\"") && commandCenterSource.includes("width=\"960\"") && commandCenterSource.includes("campaign-growth-track"), "facility art needs stable lazy-loaded sizing and visible long-term progress.")
assertContract(commandCenterSource.includes("command-center-overview"), "command center resources and bonuses must share one compact overview region.")
assertContract(resultSource.includes("data-role=\"rewards\"") && resultSource.includes("campaignReward"), "result screen must explain earned resources.")
assertContract(styleSource.includes(".command-center-modal[hidden]") && styleSource.includes("min-height: 48px"), "command center needs progressive disclosure and touch-safe controls.")
const commandCenterPanelCss = styleSource.match(/\.command-center-panel\s*\{([^}]*)\}/)?.[1] ?? ""
const commandCenterModalCss = styleSource.match(/\.command-center-modal\s*\{([^}]*)\}/)?.[1] ?? ""
assertContract(styleSource.includes("touch-action: manipulation"), "command center controls must remain touch-safe.")
assertContract(commandCenterPanelCss.includes("overflow: hidden") && commandCenterModalCss.includes("overflow: hidden"), "command center must fit without panel or backdrop scrolling.")
assertContract(commandCenterPanelCss.includes("rgba(63, 63, 70") && commandCenterPanelCss.includes("rgba(39, 39, 42"), "command center panel needs a neutral gray surface without a blue background glow.")
assertContract(styleSource.includes(".result-rewards"), "result reward layout is missing.")

const facilityArtwork = [
  "public/assets/ui/command-center/training-facility.webp",
  "public/assets/ui/command-center/armory.webp",
  "public/assets/ui/command-center/fortification-workshop.webp",
]
const facilityArtworkBytes = (await Promise.all(facilityArtwork.map(async (path) => (await stat(path)).size)))
  .reduce((total, bytes) => total + bytes, 0)
assertContract(facilityArtworkBytes <= 256 * 1024, `facility artwork exceeds the 256KB bundle budget: ${facilityArtworkBytes}`)

const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null
    },
    setItem(key, value) {
      storage.set(key, String(value))
    },
  },
  location: { search: "?qa=campaign" },
}

const bundle = await build({
  entryPoints: ["src/game/CampaignProgress.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
})
const campaignModuleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
const campaign = await import(campaignModuleUrl)

const initial = campaign.readCampaignProgress()
assertContract(initial.resources.intel === 0 && initial.resources.alloy === 0, "a fresh campaign must start without resources.")

const attackGrant = campaign.grantCampaignRunReward({
  mode: "run",
  difficulty: "easy",
  victory: true,
  monstersKilled: 100,
  progressRatio: 1,
})
const attackVictory = attackGrant.reward
assertContract(attackVictory.intel === 25 && attackVictory.alloy === 6, `attack reward drifted: ${JSON.stringify(attackVictory)}`)
assertContract(attackGrant.progress.runsCompleted.run === 1 && attackGrant.progress.victories.run === 1, "an attack victory must update persistent run counters once.")

const trainingPurchase = campaign.purchaseCampaignFacility("training")
assertContract(trainingPurchase.applied && trainingPurchase.progress.facilities.training === 1, "the first training upgrade should be affordable after a full attack victory.")
assertContract(trainingPurchase.progress.resources.intel === 17 && trainingPurchase.progress.resources.alloy === 3, "training purchase must atomically spend its exact cost.")
assertContract(campaign.getCampaignBonuses(trainingPurchase.progress).bonusStartingUnits === 0, "training must split each starter bonus into two smaller progression steps.")

const defenseGrant = campaign.grantCampaignRunReward({
  mode: "defense",
  difficulty: "hard",
  victory: false,
  monstersKilled: 40,
  progressRatio: 0.5,
})
const defenseDefeat = defenseGrant.reward
assertContract(defenseDefeat.intel === 3 && defenseDefeat.alloy === 15, `defense reward drifted: ${JSON.stringify(defenseDefeat)}`)
assertContract(defenseGrant.progress.resources.intel === 20 && defenseGrant.progress.resources.alloy === 18, "mode rewards must accumulate across runs.")
assertContract(defenseGrant.progress.runsCompleted.defense === 1 && defenseGrant.progress.victories.defense === 0, "a defense defeat must count the run without adding a victory.")

const secondTrainingPurchase = campaign.purchaseCampaignFacility("training")
assertContract(secondTrainingPurchase.applied && secondTrainingPurchase.progress.facilities.training === 2, "the second training step should complete the first reinforcement milestone.")
assertContract(secondTrainingPurchase.progress.resources.intel === 8 && secondTrainingPurchase.progress.resources.alloy === 13, "the second training step must use the smoothed cost curve.")
assertContract(campaign.getCampaignBonuses(secondTrainingPurchase.progress).bonusStartingUnits === 1, "two training steps must add one starter.")

const armoryPurchase = campaign.purchaseCampaignFacility("armory")
assertContract(armoryPurchase.applied && armoryPurchase.progress.facilities.armory === 1, "the first armory upgrade should be affordable after mixed-mode play.")
assertContract(armoryPurchase.progress.resources.intel === 2 && armoryPurchase.progress.resources.alloy === 7, "armory purchase must atomically spend its exact cost.")
const purchasedBonuses = campaign.getCampaignBonuses(armoryPurchase.progress)
assertContract(purchasedBonuses.bonusStartingUnits === 1, "purchased training bonus must persist across later transactions.")
assertContract(Math.abs(purchasedBonuses.attackMultiplier - 1.03) < 0.000001, "armory level one must add a small 3% power step.")

storage.set(campaign.CAMPAIGN_STORAGE_KEY, JSON.stringify({
  resources: { intel: -20, alloy: Number.MAX_SAFE_INTEGER },
  facilities: { training: 99, armory: -2, fortification: 3.9 },
  runsCompleted: { run: -1, defense: 2.8 },
  victories: { run: "invalid", defense: 1 },
}))
const normalized = campaign.readCampaignProgress()
assertContract(normalized.resources.intel === 0 && normalized.resources.alloy === 999_999, "corrupt resource values must be clamped to safe bounds.")
assertContract(normalized.facilities.training === 10 && normalized.facilities.armory === 0 && normalized.facilities.fortification === 3, "corrupt facility levels must be clamped and floored.")
assertContract(normalized.runsCompleted.run === 0 && normalized.runsCompleted.defense === 2, "corrupt run counters must be normalized.")
const normalizedBonuses = campaign.getCampaignBonuses(normalized)
assertContract(normalizedBonuses.bonusStartingUnits === 5, "normalized training levels must feed the runtime bonus calculation.")
assertContract(normalizedBonuses.startingShield === 3, "fortification level three must add three shield in small steps.")
assertContract(globalThis.window.__squadRushCampaignDebug?.bonuses.startingShield === 3, "QA debug output must mirror normalized progress.")

storage.delete(campaign.CAMPAIGN_STORAGE_KEY)
storage.set(campaign.LEGACY_CAMPAIGN_STORAGE_KEY, JSON.stringify({
  version: 1,
  resources: { intel: 41, alloy: 29 },
  facilities: { training: 2, armory: 3, fortification: 4 },
  runsCompleted: { run: 7, defense: 5 },
  victories: { run: 4, defense: 2 },
}))
const migrated = campaign.readCampaignProgress()
assertContract(migrated.version === 2, "legacy progress must migrate to version two.")
assertContract(migrated.facilities.training === 4 && migrated.facilities.armory === 6 && migrated.facilities.fortification === 8, "legacy facility levels must expand into two smaller steps each.")
const migratedBonuses = campaign.getCampaignBonuses(migrated)
assertContract(migratedBonuses.bonusStartingUnits === 2, "migration must preserve the legacy training bonus.")
assertContract(Math.abs(migratedBonuses.attackMultiplier - 1.18) < 0.000001, "migration must preserve the legacy armory bonus.")
assertContract(migratedBonuses.startingShield === 8, "migration must preserve the legacy fortification bonus.")
assertContract(JSON.parse(storage.get(campaign.CAMPAIGN_STORAGE_KEY)).version === 2, "migration must persist the version-two document.")

console.info(JSON.stringify({
  campaignProgression: "passed",
  attackVictory,
  defenseDefeat,
  purchasedBonuses,
  normalizedBonuses,
  migratedBonuses,
  facilityArtworkBytes,
}, null, 2))
