import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import { UNIT_TYPES, getUnitDefinition, type UnitType } from "../data/squadRosterData"
import type { GltfAsset } from "../utils/assetLoader"
import type { FXSystem } from "./FXSystem"
import {
  PICKUP_REWARD_UNIT_RATIO,
  PICKUP_SPAWNS,
  createDefenseReinforcementSpawns,
} from "./BonusPickupSchedule"
import { createPickupUnitVisual } from "./PickupSoldierVisual"
import { getStageContentLength, projectBaseStageZ } from "./StageContentSchedule"
import type { SquadSystem } from "./SquadSystem"
import type { DifficultyProfile } from "../data/difficultyData"
import { GAME_MODE_IDS } from "../data/gameModeData"
import type { GameModeProfile } from "../data/gameModeData"
import type { BonusPickupSpawn } from "./BonusPickupSchedule"

type BonusPickupPresentation = "orb" | "defenseGate"

type BonusPickup = {
  readonly unit: UnitType
  readonly count: number
  readonly presentation: BonusPickupPresentation
  readonly mesh: Mesh
  readonly beacon: Mesh | null
  readonly beam: Mesh | null
  readonly ring: Mesh | null
  collected: boolean
}

type DefenseGateMaterials = {
  readonly panel: StandardMaterial
}

type ScheduledBonusPickupSpawn = BonusPickupSpawn & {
  readonly authoredZ: number
}

type PickupDebugState = {
  readonly active: number
  readonly childNames: readonly string[]
  readonly nearestDistance: number
  readonly stageLength: number
  readonly scheduledCount: number
  readonly lastScheduledZ: number
  readonly rewardRatio: typeof PICKUP_REWARD_UNIT_RATIO
  readonly defenseTrack: boolean
  readonly defenseGateUpright: boolean
  readonly activeRenderMeshes: number
}

export type BonusPickupCollectResult = {
  readonly unit: UnitType
  readonly count: number
  readonly label: string
  readonly color: string
  readonly portraitSrc: string
  readonly compact: boolean
}

declare global {
  interface Window {
    __squadRushPickupDebug?: PickupDebugState
  }
}

const PICKUP_FLOAT_BASE_Y = 1.42
const PICKUP_FLOAT_AMPLITUDE = 0.2
const PICKUP_ROTATION_SPEED = 2.1
const PICKUP_COLLECT_RADIUS_SQUARED = 3.2
const DEFENSE_GATE_COLLECT_HALF_WIDTH = 1.25
const DEFENSE_GATE_COLLECT_HALF_DEPTH = 1.5
const DEFENSE_GATE_DESPAWN_BACK_DISTANCE = 8
const PICKUP_LOOKAHEAD_DISTANCE = 36

export class BonusPickupSystem {
  private readonly pickups: BonusPickup[] = []
  private readonly scheduledSpawns: readonly ScheduledBonusPickupSpawn[]
  private readonly stageLength: number
  private readonly collectRadiusSquared: number
  private readonly defenseTrackEnabled: boolean
  private readonly debugEnabled = window.location.search.includes("qa=pickups")
  private debugPublishCooldown = 0
  private readonly pickupPos = new Vector3(0, 0, 0)
  private defenseGateMaterials: DefenseGateMaterials | null = null
  private spawnIndex = 0
  onCollect?: (result: BonusPickupCollectResult, position: Vector3) => void

  constructor(
    private readonly scene: Scene,
    private readonly squad: SquadSystem,
    private readonly fx: FXSystem,
    private readonly soldierAsset: GltfAsset | null,
    private readonly pangyoPickupAsset: GltfAsset | null,
    difficulty: DifficultyProfile,
    mode: GameModeProfile,
  ) {
    this.stageLength = getStageContentLength(difficulty)
    this.defenseTrackEnabled = mode.id === GAME_MODE_IDS.defense
    this.collectRadiusSquared = PICKUP_COLLECT_RADIUS_SQUARED
    const sourceSpawns = this.defenseTrackEnabled ? createDefenseReinforcementSpawns() : PICKUP_SPAWNS
    this.scheduledSpawns = sourceSpawns.map((spawn) => ({
      ...spawn,
      authoredZ: spawn.z,
      z: projectBaseStageZ(spawn.z, this.stageLength, mode, difficulty),
      count: spawn.count,
    }))
  }

  update(dt: number, spawnProgressZ = this.squad.squadZ, scrollSpeed = 0): void {
    this.spawnAhead(spawnProgressZ)
    for (const pickup of this.pickups) {
      if (pickup.collected) {
        continue
      }
      if (scrollSpeed > 0) {
        pickup.mesh.position.z -= scrollSpeed * dt
      }
      if (pickup.presentation === "defenseGate") {
        const pulse = 1 + Math.sin(performance.now() * 0.004 + pickup.mesh.position.z) * 0.08
        pickup.ring?.scaling.set(pulse, pulse, 1)
        if (this.isCollected(pickup)) {
          this.collect(pickup)
        } else if (pickup.mesh.position.z < this.squad.squadZ - DEFENSE_GATE_DESPAWN_BACK_DISTANCE) {
          pickup.collected = true
          pickup.mesh.setEnabled(false)
        }
        continue
      }
      const floatWave = Math.sin(this.squad.squadZ * 0.5 + pickup.mesh.position.z)
      pickup.mesh.rotation.y += dt * PICKUP_ROTATION_SPEED
      pickup.mesh.position.y = PICKUP_FLOAT_BASE_Y + floatWave * PICKUP_FLOAT_AMPLITUDE
      pickup.beacon?.scaling.set(pickup.beacon.scaling.x, 0.82 + floatWave * 0.08, pickup.beacon.scaling.z)
      pickup.beam?.scaling.set(pickup.beam.scaling.x, 0.92 + floatWave * 0.1, pickup.beam.scaling.z)
      if (pickup.ring !== null) {
        pickup.ring.rotation.z -= dt * 3.2
      }
      if (this.isCollected(pickup)) {
        this.collect(pickup)
      } else if (pickup.mesh.position.z < this.squad.squadZ - 16) {
        pickup.collected = true
        pickup.mesh.setEnabled(false)
      }
    }
    this.updateDebugState(dt)
  }

  private updateDebugState(dt: number): void {
    if (!this.debugEnabled) {
      return
    }
    this.debugPublishCooldown -= dt
    if (this.debugPublishCooldown > 0) {
      return
    }
    this.debugPublishCooldown = 0.1
    const activePickups = this.pickups.filter((pickup) => !pickup.collected)
    window.__squadRushPickupDebug = {
      active: activePickups.length,
      childNames: activePickups.flatMap((pickup) => pickup.mesh.getChildMeshes(false).map((mesh) => mesh.name)),
      nearestDistance: activePickups.reduce((nearest, pickup) => Math.min(nearest, Math.abs(pickup.mesh.position.z - this.squad.squadZ)), Number.POSITIVE_INFINITY),
      stageLength: this.stageLength,
      scheduledCount: this.scheduledSpawns.length,
      lastScheduledZ: this.scheduledSpawns[this.scheduledSpawns.length - 1]?.z ?? 0,
      rewardRatio: PICKUP_REWARD_UNIT_RATIO,
      defenseTrack: this.defenseTrackEnabled,
      defenseGateUpright: activePickups.some((pickup) => (
        pickup.presentation === "defenseGate"
        && pickup.mesh.getChildMeshes(false).some((mesh) => (
          mesh.name.includes("defense_track_gate_panel")
          && mesh.position.y > 1
          && Math.abs(mesh.rotation.x) < 0.001
        ))
      )),
      activeRenderMeshes: activePickups.reduce(
        (total, pickup) => total + pickup.mesh.getChildMeshes(false).length,
        0,
      ),
    }
  }

  private spawnAhead(spawnProgressZ: number): void {
    let next = this.scheduledSpawns[this.spawnIndex]
    while (next !== undefined && spawnProgressZ + PICKUP_LOOKAHEAD_DISTANCE >= next.z) {
      const spawnWorldZ = this.squad.squadZ + next.z - spawnProgressZ
      if (spawnWorldZ < this.squad.squadZ - DEFENSE_GATE_DESPAWN_BACK_DISTANCE) {
        this.spawnIndex += 1
        next = this.scheduledSpawns[this.spawnIndex]
        continue
      }
      const mesh = this.createPickup(next.unit, next.count, next.x, spawnWorldZ)
      const presentation: BonusPickupPresentation = this.defenseTrackEnabled ? "defenseGate" : "orb"
      this.pickups.push({
        unit: next.unit,
        count: next.count,
        presentation,
        mesh,
        beacon: presentation === "orb" ? this.mustFindChild(mesh, "pickup_beacon") : null,
        beam: presentation === "orb" ? this.mustFindChild(mesh, "pickup_reward_beam") : null,
        ring: presentation === "orb"
          ? this.mustFindChild(mesh, "pickup_ring")
          : this.mustFindChild(mesh, "defense_track_gate_panel"),
        collected: false,
      })
      this.spawnIndex += 1
      next = this.scheduledSpawns[this.spawnIndex]
    }
  }

  private createPickup(unit: UnitType, count: number, x: number, z: number): Mesh {
    if (this.defenseTrackEnabled) {
      return this.createDefenseBoostGate(x, z)
    }
    const definition = getUnitDefinition(unit)
    const root = new Mesh(`pickup_${unit}_${z}`, this.scene)
    root.position.set(x, PICKUP_FLOAT_BASE_Y, z)

    const color = Color3.FromHexString(definition.color)
    const coreMat = new StandardMaterial(`pickupCoreMat_${unit}_${z}`, this.scene)
    coreMat.diffuseColor = color
    coreMat.emissiveColor = color.scale(0.72)
    coreMat.alpha = 0.94

    const rimMat = new StandardMaterial(`pickupAmberRimMat_${unit}_${z}`, this.scene)
    rimMat.diffuseColor = new Color3(1, 0.68, 0.16)
    rimMat.emissiveColor = new Color3(0.55, 0.24, 0.02)
    rimMat.specularColor = new Color3(1, 0.86, 0.38)

    const beaconMat = new StandardMaterial(`pickupBeaconMat_${unit}_${z}`, this.scene)
    beaconMat.diffuseColor = color
    beaconMat.emissiveColor = color.scale(0.86)
    beaconMat.alpha = 0.36

    const labelBackMat = new StandardMaterial(`pickupLabelBackMat_${unit}_${z}`, this.scene)
    labelBackMat.diffuseColor = new Color3(0.02, 0.025, 0.032)
    labelBackMat.emissiveColor = color.scale(0.2)
    labelBackMat.alpha = 0.28

    const shadowMat = new StandardMaterial(`pickupShadowMat_${unit}_${z}`, this.scene)
    shadowMat.diffuseColor = new Color3(0.04, 0.05, 0.05)
    shadowMat.emissiveColor = new Color3(0.01, 0.01, 0.01)
    shadowMat.alpha = 0.38

    const unitVisual = createPickupUnitVisual({
      scene: this.scene,
      asset: this.soldierAsset,
      pangyoAsset: this.pangyoPickupAsset,
      name: `pickup_unit_reward_${unit}_${z}`,
      unit,
      cssColor: definition.color,
    })
    unitVisual.parent = root

    const orbShell = MeshBuilder.CreateTorus(`pickup_orb_shell_${unit}_${z}`, { diameter: 1.58, thickness: 0.08, tessellation: 32 }, this.scene)
    orbShell.material = rimMat
    orbShell.parent = root
    orbShell.rotation.x = Math.PI * 0.5

    const beacon = MeshBuilder.CreateCylinder(`pickup_beacon_${unit}_${z}`, { height: 3.4, diameter: 0.48, tessellation: 16 }, this.scene)
    beacon.material = beaconMat
    beacon.parent = root
    beacon.position.y = 1.48

    const beam = MeshBuilder.CreateCylinder(`pickup_reward_beam_${unit}_${z}`, { height: 5.2, diameter: 0.28, tessellation: 16 }, this.scene)
    beam.material = beaconMat
    beam.parent = root
    beam.position.y = 1.68

    const ring = MeshBuilder.CreateTorus(`pickup_ring_${unit}_${z}`, { diameter: 2.62, thickness: 0.12, tessellation: 28 }, this.scene)
    ring.material = rimMat
    ring.parent = root
    ring.rotation.x = Math.PI * 0.5

    const shadow = MeshBuilder.CreateCylinder(`pickup_shadow_${unit}_${z}`, { height: 0.02, diameter: 2.76, tessellation: 28 }, this.scene)
    shadow.material = shadowMat
    shadow.parent = root
    shadow.position.y = -1.28

    for (const side of [-1, 1]) {
      const chevron = MeshBuilder.CreateBox(`pickup_chevron_${unit}_${z}_${side}`, { width: 0.14, height: 0.62, depth: 1.02 }, this.scene)
      chevron.material = rimMat
      chevron.parent = root
      chevron.position.x = side * 0.92
      chevron.rotation.z = side * 0.18
    }

    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2
      const spark = MeshBuilder.CreateSphere(`pickup_orbit_spark_${unit}_${z}_${index}`, { diameter: 0.16, segments: 10 }, this.scene)
      spark.material = coreMat
      spark.parent = root
      spark.position.set(Math.cos(angle) * 1.26, 0.54, Math.sin(angle) * 1.26)
    }

    const labelBackplate = MeshBuilder.CreatePlane(`pickup_compact_label_backplate_${unit}_${z}`, { width: 1.68, height: 0.54 }, this.scene)
    labelBackplate.material = labelBackMat
    labelBackplate.parent = root
    labelBackplate.position.set(0, 2.08, -0.03)
    labelBackplate.billboardMode = Mesh.BILLBOARDMODE_ALL

    const label = this.createLabel(unit, `${definition.label}+${count}`, z)
    label.parent = root
    label.position.set(0, 2.08, 0)
    return root
  }

  private createDefenseBoostGate(x: number, z: number): Mesh {
    const materials = this.getDefenseGateMaterials()
    const root = new Mesh(`defense_reinforcement_gate_${z}`, this.scene)
    root.position.set(x, 0, z)

    const panel = MeshBuilder.CreatePlane(
      `defense_track_gate_panel_label_${z}`,
      { width: 1.74, height: 2.42 },
      this.scene,
    )
    panel.parent = root
    panel.position.set(0, 1.21, 0)
    panel.material = materials.panel
    return root
  }

  private getDefenseGateMaterials(): DefenseGateMaterials {
    if (this.defenseGateMaterials !== null) {
      return this.defenseGateMaterials
    }
    const texture = new DynamicTexture("defenseReinforcementGateTexture", { width: 256, height: 384 }, this.scene)
    texture.hasAlpha = true
    const context = texture.getContext()
    context.clearRect(0, 0, 256, 384)
    context.fillStyle = "rgba(8, 126, 204, 0.34)"
    context.fillRect(12, 12, 232, 360)
    context.strokeStyle = "#2DE8FF"
    context.lineWidth = 16
    context.strokeRect(12, 12, 232, 360)
    texture.update()
    texture.drawText("+1", null, 238, "900 112px Arial", "#FFFFFF", null, true, true)
    const panel = new StandardMaterial("defenseReinforcementGateMat", this.scene)
    panel.diffuseTexture = texture
    panel.emissiveTexture = texture
    panel.useAlphaFromDiffuseTexture = true
    panel.backFaceCulling = false
    panel.disableLighting = true
    this.defenseGateMaterials = { panel }
    return this.defenseGateMaterials
  }

  private createLabel(unit: UnitType, text: string, z: number): Mesh {
    const tex = new DynamicTexture(`pickupLabel_${unit}_${z}`, { width: 384, height: 128 }, this.scene)
    tex.drawText(text, null, 72, "900 38px Arial", "#FFFFFF", "transparent", true, true)
    tex.update()

    const label = MeshBuilder.CreatePlane(`pickup_compact_label_${unit}_${z}`, { width: 1.54, height: 0.52 }, this.scene)
    const labelMat = new StandardMaterial(`pickupLabelMat_${unit}_${z}`, this.scene)
    labelMat.diffuseTexture = tex
    labelMat.emissiveTexture = tex
    labelMat.useAlphaFromDiffuseTexture = true
    labelMat.backFaceCulling = false
    label.material = labelMat
    label.billboardMode = Mesh.BILLBOARDMODE_ALL
    return label
  }

  private isCollected(pickup: BonusPickup): boolean {
    const dx = pickup.mesh.position.x - this.squad.squadX
    const dz = pickup.mesh.position.z - this.squad.squadZ
    if (pickup.presentation === "defenseGate") {
      const sameOuterLane = Math.sign(pickup.mesh.position.x) === Math.sign(this.squad.squadX)
        && Math.abs(this.squad.squadX) >= Math.abs(pickup.mesh.position.x) - DEFENSE_GATE_COLLECT_HALF_WIDTH
      return sameOuterLane && Math.abs(dz) < DEFENSE_GATE_COLLECT_HALF_DEPTH
    }
    return dx * dx + dz * dz < this.collectRadiusSquared
  }

  private collect(pickup: BonusPickup): void {
    pickup.collected = true
    pickup.mesh.setEnabled(false)
    let feedbackUnit = pickup.unit
    let addedCount: number
    let feedbackLabel: string
    if (this.defenseTrackEnabled) {
      const reinforcement = this.squad.addDefenseReinforcements(pickup.count)
      if (reinforcement.activeSoldiersAdded > 0) {
        feedbackUnit = UNIT_TYPES.soldier
        addedCount = reinforcement.activeSoldiersAdded
        feedbackLabel = `병사 +${addedCount}`
      } else {
        feedbackUnit = UNIT_TYPES.unemployed
        addedCount = reinforcement.reserveAdded
        feedbackLabel = `백수 +${addedCount}`
      }
    } else {
      addedCount = this.squad.addUnits(pickup.unit, pickup.count)
      feedbackLabel = `${getUnitDefinition(pickup.unit).label}+${addedCount}`
    }
    this.pickupPos.copyFrom(pickup.mesh.position)
    this.fx.playGateEffect(this.pickupPos)
    const definition = getUnitDefinition(feedbackUnit)
    this.onCollect?.({
      unit: feedbackUnit,
      count: addedCount,
      label: feedbackLabel,
      color: definition.color,
      portraitSrc: definition.portraitSrc,
      compact: pickup.presentation === "defenseGate",
    }, this.pickupPos)
  }

  private mustFindChild(root: Mesh, namePart: string): Mesh {
    const child = root.getChildMeshes(false).find((mesh) => mesh.name.includes(namePart))
    if (child instanceof Mesh) {
      return child
    }
    throw new Error(`Pickup visual child missing: ${namePart}`)
  }
}
