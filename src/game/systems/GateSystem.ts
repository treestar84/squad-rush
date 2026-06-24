import {
  Mesh,
  Scene,
  Vector3,
} from "@babylonjs/core"
import {
  GATE_CONFIGS,
  GATE_SPAWNS,
  GATE_TYPES,
  MAX_SOLDIER_UPGRADE_TIER,
  ROUND_1_UPGRADE_LIMIT,
  type GateConfig,
  type SquadBuffs,
} from "../data/gateData"
import {
  createGateVisual,
  GATE_ARROW_BASE_Y,
  GATE_LEFT_X,
  GATE_RIGHT_X,
  GATE_VISUAL_SCALE,
} from "./GateVisualFactory"
import type { SquadSystem } from "./SquadSystem"

const GATE_CAMERA_FOCUS_DISTANCE = 12

type GatePair = {
  readonly z: number
  readonly left: GateConfig
  readonly right: GateConfig
  readonly allMeshes: readonly Mesh[]
  readonly animatedMeshes: readonly Mesh[]
  passed: boolean
}

export type GateDebugState = {
  readonly z: number
  readonly left: string
  readonly right: string
  readonly passed: boolean
}

export class GateSystem {
  private readonly gates: GatePair[] = []
  private readonly onPassCallbacks: Array<(cfg: GateConfig, position: Vector3) => void> = []
  private readonly squadStats: SquadBuffs = {
    attackMultiplier: 1,
    soldierUpgradeTier: 0,
  }
  private spawnIndex = 0
  private previousSquadZ = 0

  constructor(private readonly scene: Scene, private readonly squad: SquadSystem) {
    this.previousSquadZ = squad.squadZ
  }

  onPass(cb: (cfg: GateConfig, position: Vector3) => void): void {
    this.onPassCallbacks.push(cb)
  }

  getStats(): SquadBuffs {
    return this.squadStats
  }

  getDebugState(): readonly GateDebugState[] {
    return this.gates.map((gate) => ({
      z: gate.z,
      left: gate.left.displayText,
      right: gate.right.displayText,
      passed: gate.passed,
    }))
  }

  applyBonus(cfg: GateConfig): void {
    this.applyGate(cfg)
  }

  getApproachFocus(squadZ: number): number {
    for (const gate of this.gates) {
      const distance = gate.z - squadZ
      if (gate.passed || distance < 0 || distance > GATE_CAMERA_FOCUS_DISTANCE) {
        continue
      }
      return Math.sin((1 - distance / GATE_CAMERA_FOCUS_DISTANCE) * Math.PI)
    }
    return 0
  }

  update(dt: number): void {
    const currentSquadZ = this.squad.squadZ
    let nextSpawn = GATE_SPAWNS[this.spawnIndex]
    while (nextSpawn !== undefined && currentSquadZ >= nextSpawn.z - 45) {
      const spawn = GATE_SPAWNS[this.spawnIndex]
      if (spawn !== undefined) {
        this.spawnGatePair(spawn.z, spawn.leftGateId, spawn.rightGateId)
      }
      this.spawnIndex += 1
      nextSpawn = GATE_SPAWNS[this.spawnIndex]
    }

    for (const gate of this.gates) {
      if (!gate.passed) {
        this.animateGate(gate, dt)
      }
      const crossedGate = this.previousSquadZ <= gate.z && currentSquadZ >= gate.z
      const nearGate = Math.abs(currentSquadZ - gate.z) <= 2.4
      if (gate.passed || (!crossedGate && !nearGate)) {
        continue
      }
      gate.passed = true
      const picked = this.squad.squadX < 0 ? gate.left : gate.right
      this.applyGate(picked)
      const effectPos = new Vector3(this.squad.squadX, 2, gate.z)
      for (const mesh of gate.allMeshes) {
        mesh.setEnabled(false)
      }
      for (const cb of this.onPassCallbacks) {
        cb(picked, effectPos)
      }
    }
    this.previousSquadZ = currentSquadZ
  }

  private spawnGatePair(spawnZ: number, leftId: string, rightId: string): void {
    const left = GATE_CONFIGS[leftId]
    const right = GATE_CONFIGS[rightId]
    if (left === undefined || right === undefined) {
      return
    }
    const leftVisual = createGateVisual(this.scene, left, { x: GATE_LEFT_X, z: spawnZ })
    const rightVisual = createGateVisual(this.scene, right, { x: GATE_RIGHT_X, z: spawnZ })
    this.gates.push({
      z: spawnZ,
      left,
      right,
      allMeshes: [...leftVisual.allMeshes, ...rightVisual.allMeshes],
      animatedMeshes: [...leftVisual.animatedMeshes, ...rightVisual.animatedMeshes],
      passed: false,
    })
  }

  private animateGate(gate: GatePair, dt: number): void {
    const phase = this.squad.squadZ * 0.35 + gate.z * 0.11
    const pulse = 1 + Math.sin(phase) * 0.045
    for (const mesh of gate.animatedMeshes) {
      if (mesh.name.includes("gate_energy_ring")) {
        mesh.rotation.z += dt * 1.4
        mesh.scaling.set(pulse, pulse, 1)
      } else if (mesh.name.includes("gate_choice_arrow")) {
        mesh.position.y = GATE_ARROW_BASE_Y + Math.sin(phase + mesh.position.x) * 0.035 * GATE_VISUAL_SCALE
      } else {
        mesh.scaling.y = 1 + Math.sin(phase + mesh.position.x) * 0.05
      }
    }
  }

  private applyGate(cfg: GateConfig): void {
    switch (cfg.type) {
      case GATE_TYPES.addSoldier:
        this.squad.addSoldiers(cfg.value)
        break
      case GATE_TYPES.multiplySoldier:
        this.squad.addSoldiers(Math.floor(this.squad.soldierCount * (cfg.value - 1)))
        break
      case GATE_TYPES.attackUp:
        if (this.squadStats.soldierUpgradeTier < ROUND_1_UPGRADE_LIMIT) {
          this.squadStats.attackMultiplier *= 1 + cfg.value
          this.squadStats.soldierUpgradeTier = Math.min(MAX_SOLDIER_UPGRADE_TIER, this.squadStats.soldierUpgradeTier + 1)
          this.squad.setUpgradeTier(this.squadStats.soldierUpgradeTier)
        }
        break
    }
  }
}
