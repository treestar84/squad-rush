import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import type { GateConfig } from "../data/gateData"
import { GATE_CONFIGS, GATE_TYPES } from "../data/gateData"
import type { GltfAsset } from "../utils/assetLoader"
import type { FXSystem } from "./FXSystem"
import type { GateSystem } from "./GateSystem"
import { createPickupSoldierVisual } from "./PickupSoldierVisual"
import type { SquadSystem } from "./SquadSystem"

type BonusPickupSpawn = {
  readonly z: number
  readonly x: number
  readonly gateId: string
}

type BonusPickup = {
  readonly config: GateConfig
  readonly mesh: Mesh
  readonly beacon: Mesh
  readonly beam: Mesh
  readonly ring: Mesh
  collected: boolean
}

type PickupDebugState = {
  readonly active: number
  readonly childNames: readonly string[]
  readonly nearestDistance: number
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
const PICKUP_LOOKAHEAD_DISTANCE = 36

const PICKUP_SPAWNS: readonly BonusPickupSpawn[] = [
  { z: 52, x: 0.95, gateId: "gate_add1" },
  { z: 70, x: -1.05, gateId: "gate_add1" },
  { z: 88, x: 1.25, gateId: "gate_add1" },
  { z: 98, x: -1.25, gateId: "gate_add2" },
  { z: 122, x: -1.45, gateId: "gate_add2" },
  { z: 142, x: 1.6, gateId: "gate_upgrade" },
  { z: 164, x: -1.65, gateId: "gate_add1" },
  { z: 188, x: 1.7, gateId: "gate_add2" },
  { z: 214, x: -1.75, gateId: "gate_add2" },
  { z: 238, x: -1.55, gateId: "gate_upgrade" },
  { z: 266, x: 1.75, gateId: "gate_add3" },
  { z: 318, x: 1.7, gateId: "gate_add3" },
  { z: 344, x: -1.65, gateId: "gate_add3" },
] as const

export class BonusPickupSystem {
  private readonly pickups: BonusPickup[] = []
  private readonly pickupPos = new Vector3(0, 0, 0)
  private spawnIndex = 0
  onCollect?: (cfg: GateConfig, position: Vector3) => void

  constructor(
    private readonly scene: Scene,
    private readonly squad: SquadSystem,
    private readonly gates: GateSystem,
    private readonly fx: FXSystem,
    private readonly soldierAsset: GltfAsset | null,
  ) {}

  update(dt: number): void {
    this.spawnAhead()
    for (const pickup of this.pickups) {
      if (pickup.collected) {
        continue
      }
      const floatWave = Math.sin(this.squad.squadZ * 0.5 + pickup.mesh.position.z)
      pickup.mesh.rotation.y += dt * PICKUP_ROTATION_SPEED
      pickup.mesh.position.y = PICKUP_FLOAT_BASE_Y + floatWave * PICKUP_FLOAT_AMPLITUDE
      pickup.beacon.scaling.y = 0.82 + floatWave * 0.08
      pickup.beam.scaling.y = 0.92 + floatWave * 0.1
      pickup.ring.rotation.z -= dt * 3.2
      if (this.isCollected(pickup)) {
        this.collect(pickup)
      } else if (pickup.mesh.position.z < this.squad.squadZ - 16) {
        pickup.collected = true
        pickup.mesh.setEnabled(false)
      }
    }
    this.updateDebugState()
  }

  private updateDebugState(): void {
    if (!window.location.search.includes("qa=pickups")) {
      return
    }
    const activePickups = this.pickups.filter((pickup) => !pickup.collected)
    window.__squadRushPickupDebug = {
      active: activePickups.length,
      childNames: activePickups.flatMap((pickup) => pickup.mesh.getChildMeshes(false).map((mesh) => mesh.name)),
      nearestDistance: activePickups.reduce((nearest, pickup) => Math.min(nearest, Math.abs(pickup.mesh.position.z - this.squad.squadZ)), Number.POSITIVE_INFINITY),
    }
  }

  private spawnAhead(): void {
    let next = PICKUP_SPAWNS[this.spawnIndex]
    while (next !== undefined && this.squad.squadZ + PICKUP_LOOKAHEAD_DISTANCE >= next.z) {
      const config = GATE_CONFIGS[next.gateId]
      if (config !== undefined) {
        const mesh = this.createPickup(config, next.x, next.z)
        this.pickups.push({
          config,
          mesh,
          beacon: this.mustFindChild(mesh, "pickup_beacon"),
          beam: this.mustFindChild(mesh, "pickup_reward_beam"),
          ring: this.mustFindChild(mesh, "pickup_ring"),
          collected: false,
        })
      }
      this.spawnIndex += 1
      next = PICKUP_SPAWNS[this.spawnIndex]
    }
  }

  private createPickup(config: GateConfig, x: number, z: number): Mesh {
    const root = new Mesh(`pickup_${config.id}_${z}`, this.scene)
    root.position.set(x, PICKUP_FLOAT_BASE_Y, z)

    const color = Color3.FromHexString(config.cssColor)
    const shellMat = new StandardMaterial(`pickupSupplyShellMat_${config.id}_${z}`, this.scene)
    shellMat.diffuseColor = new Color3(0.04, 0.34, 0.42)
    shellMat.emissiveColor = new Color3(0.01, 0.12, 0.16)
    shellMat.specularColor = new Color3(0.22, 0.76, 0.9)

    const coreMat = new StandardMaterial(`pickupCoreMat_${config.id}_${z}`, this.scene)
    coreMat.diffuseColor = color
    coreMat.emissiveColor = color.scale(0.72)
    coreMat.alpha = 0.94

    const rimMat = new StandardMaterial(`pickupAmberRimMat_${config.id}_${z}`, this.scene)
    rimMat.diffuseColor = new Color3(1, 0.68, 0.16)
    rimMat.emissiveColor = new Color3(0.55, 0.24, 0.02)
    rimMat.specularColor = new Color3(1, 0.86, 0.38)

    const beaconMat = new StandardMaterial(`pickupBeaconMat_${config.id}_${z}`, this.scene)
    beaconMat.diffuseColor = color
    beaconMat.emissiveColor = color.scale(0.86)
    beaconMat.alpha = 0.36

    const labelBackMat = new StandardMaterial(`pickupLabelBackMat_${config.id}_${z}`, this.scene)
    labelBackMat.diffuseColor = new Color3(0.02, 0.025, 0.032)
    labelBackMat.emissiveColor = color.scale(0.2)
    labelBackMat.alpha = 0.28

    const shadowMat = new StandardMaterial(`pickupShadowMat_${config.id}_${z}`, this.scene)
    shadowMat.diffuseColor = new Color3(0.04, 0.05, 0.05)
    shadowMat.emissiveColor = new Color3(0.01, 0.01, 0.01)
    shadowMat.alpha = 0.38

    if (config.type === GATE_TYPES.addSoldier) {
      const soldier = createPickupSoldierVisual(this.scene, this.soldierAsset, `pickup_soldier_reward_${config.id}_${z}`)
      soldier.parent = root
    } else {
      const crate = MeshBuilder.CreateBox(`pickup_crate_${config.id}_${z}`, { width: 1.72, height: 1.02, depth: 1.72 }, this.scene)
      crate.material = shellMat
      crate.parent = root

      const core = MeshBuilder.CreateBox(`pickup_reward_gem_${config.id}_${z}`, { width: 0.72, height: 0.72, depth: 0.72 }, this.scene)
      core.material = coreMat
      core.parent = root
      core.position.y = 0.08
      core.rotation.set(Math.PI * 0.22, Math.PI * 0.25, Math.PI * 0.18)

      for (const side of [-1, 1]) {
        const band = MeshBuilder.CreateBox(`pickup_supply_band_${config.id}_${z}_${side}`, { width: 0.12, height: 1.16, depth: 1.9 }, this.scene)
        band.material = rimMat
        band.parent = root
        band.position.x = side * 0.58
        band.rotation.z = side * 0.2
      }
    }

    const orbShell = MeshBuilder.CreateTorus(`pickup_orb_shell_${config.id}_${z}`, { diameter: 1.58, thickness: 0.08, tessellation: 32 }, this.scene)
    orbShell.material = rimMat
    orbShell.parent = root
    orbShell.rotation.x = Math.PI * 0.5

    const beacon = MeshBuilder.CreateCylinder(`pickup_beacon_${config.id}_${z}`, { height: 3.4, diameter: 0.48, tessellation: 16 }, this.scene)
    beacon.material = beaconMat
    beacon.parent = root
    beacon.position.y = 1.48

    const beam = MeshBuilder.CreateCylinder(`pickup_reward_beam_${config.id}_${z}`, { height: 5.2, diameter: 0.28, tessellation: 16 }, this.scene)
    beam.material = beaconMat
    beam.parent = root
    beam.position.y = 1.68

    const ring = MeshBuilder.CreateTorus(`pickup_ring_${config.id}_${z}`, { diameter: 2.62, thickness: 0.12, tessellation: 28 }, this.scene)
    ring.material = rimMat
    ring.parent = root
    ring.rotation.x = Math.PI * 0.5

    const shadow = MeshBuilder.CreateCylinder(`pickup_shadow_${config.id}_${z}`, { height: 0.02, diameter: 2.76, tessellation: 28 }, this.scene)
    shadow.material = shadowMat
    shadow.parent = root
    shadow.position.y = -1.28

    for (const side of [-1, 1]) {
      const chevron = MeshBuilder.CreateBox(`pickup_chevron_${config.id}_${z}_${side}`, { width: 0.14, height: 0.62, depth: 1.02 }, this.scene)
      chevron.material = rimMat
      chevron.parent = root
      chevron.position.x = side * 0.92
      chevron.rotation.z = side * 0.18
    }

    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2
      const spark = MeshBuilder.CreateSphere(`pickup_orbit_spark_${config.id}_${z}_${index}`, { diameter: 0.16, segments: 10 }, this.scene)
      spark.material = coreMat
      spark.parent = root
      spark.position.set(Math.cos(angle) * 1.26, 0.54, Math.sin(angle) * 1.26)
    }

    const labelBackplate = MeshBuilder.CreatePlane(`pickup_compact_label_backplate_${config.id}_${z}`, { width: 1.36, height: 0.54 }, this.scene)
    labelBackplate.material = labelBackMat
    labelBackplate.parent = root
    labelBackplate.position.set(0, 2.08, -0.03)
    labelBackplate.billboardMode = Mesh.BILLBOARDMODE_ALL

    const label = this.createLabel(config, z)
    label.parent = root
    label.position.set(0, 2.08, 0)
    return root
  }

  private createLabel(config: GateConfig, z: number): Mesh {
    const tex = new DynamicTexture(`pickupLabel_${config.id}_${z}`, { width: 256, height: 128 }, this.scene)
    tex.drawText(config.displayText, null, 74, "900 44px Arial", "#FFFFFF", "transparent", true, true)
    tex.update()

    const label = MeshBuilder.CreatePlane(`pickup_compact_label_${config.id}_${z}`, { width: 1.22, height: 0.52 }, this.scene)
    const labelMat = new StandardMaterial(`pickupLabelMat_${config.id}_${z}`, this.scene)
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
    return dx * dx + dz * dz < PICKUP_COLLECT_RADIUS_SQUARED
  }

  private collect(pickup: BonusPickup): void {
    pickup.collected = true
    pickup.mesh.setEnabled(false)
    this.gates.applyBonus(pickup.config)
    this.pickupPos.copyFrom(pickup.mesh.position)
    this.fx.playGateEffect(this.pickupPos)
    this.onCollect?.(pickup.config, this.pickupPos)
  }

  private mustFindChild(root: Mesh, namePart: string): Mesh {
    const child = root.getChildMeshes(false).find((mesh) => mesh.name.includes(namePart))
    if (child instanceof Mesh) {
      return child
    }
    throw new Error(`Pickup visual child missing: ${namePart}`)
  }
}
