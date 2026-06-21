import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import { GATE_CONFIGS, GATE_SPAWNS, GATE_TYPES, type GateConfig, type SquadBuffs } from "../data/gateData"
import type { SquadSystem } from "./SquadSystem"

type GatePair = {
  readonly z: number
  readonly left: GateConfig
  readonly right: GateConfig
  readonly meshes: readonly Mesh[]
  passed: boolean
}

export class GateSystem {
  private readonly gates: GatePair[] = []
  private readonly onPassCallbacks: Array<(cfg: GateConfig, position: Vector3) => void> = []
  private readonly squadStats: SquadBuffs = {
    attackMultiplier: 1,
    fireRateMultiplier: 1,
    rangeMultiplier: 1,
  }
  private spawnIndex = 0

  constructor(private readonly scene: Scene, private readonly squad: SquadSystem) {}

  onPass(cb: (cfg: GateConfig, position: Vector3) => void): void {
    this.onPassCallbacks.push(cb)
  }

  getStats(): SquadBuffs {
    return this.squadStats
  }

  update(_dt: number): void {
    let nextSpawn = GATE_SPAWNS[this.spawnIndex]
    while (nextSpawn !== undefined && this.squad.squadZ >= nextSpawn.z - 45) {
      const spawn = GATE_SPAWNS[this.spawnIndex]
      if (spawn !== undefined) {
        this.spawnGatePair(spawn.z, spawn.leftGateId, spawn.rightGateId)
      }
      this.spawnIndex += 1
      nextSpawn = GATE_SPAWNS[this.spawnIndex]
    }

    for (const gate of this.gates) {
      if (gate.passed || Math.abs(this.squad.squadZ - gate.z) > 2.4) {
        continue
      }
      gate.passed = true
      const picked = this.squad.squadX < 0 ? gate.left : gate.right
      this.applyGate(picked)
      const effectPos = new Vector3(this.squad.squadX, 2, gate.z)
      for (const mesh of gate.meshes) {
        mesh.setEnabled(false)
      }
      for (const cb of this.onPassCallbacks) {
        cb(picked, effectPos)
      }
    }
  }

  private spawnGatePair(spawnZ: number, leftId: string, rightId: string): void {
    const left = GATE_CONFIGS[leftId]
    const right = GATE_CONFIGS[rightId]
    if (left === undefined || right === undefined) {
      return
    }
    const meshes = [
      ...this.createGateVisual(left, -3.6, spawnZ),
      ...this.createGateVisual(right, 3.6, spawnZ),
    ]
    this.gates.push({ z: spawnZ, left, right, meshes, passed: false })
  }

  private createGateVisual(config: GateConfig, x: number, z: number): readonly Mesh[] {
    const color = Color3.FromHexString(config.cssColor)
    const mat = new StandardMaterial(`gateMat_${config.id}_${x}`, this.scene)
    mat.diffuseColor = color
    mat.emissiveColor = color.scale(0.46)
    mat.alpha = 0.42

    const frameMat = new StandardMaterial(`gateFrameMat_${config.id}_${x}`, this.scene)
    frameMat.diffuseColor = new Color3(0.02, 0.03, 0.04)
    frameMat.emissiveColor = color.scale(0.12)

    const panel = MeshBuilder.CreatePlane(`gate_panel_${config.id}_${x}`, { width: 3.6, height: 4.4 }, this.scene)
    panel.material = mat
    panel.position.set(x, 2.25, z - 0.18)

    const leftFrame = MeshBuilder.CreateBox(`gate_frame_l_${config.id}_${x}`, { width: 0.18, height: 4.8, depth: 0.28 }, this.scene)
    leftFrame.material = frameMat
    leftFrame.position.set(x - 1.9, 2.4, z - 0.22)

    const rightFrame = MeshBuilder.CreateBox(`gate_frame_r_${config.id}_${x}`, { width: 0.18, height: 4.8, depth: 0.28 }, this.scene)
    rightFrame.material = frameMat
    rightFrame.position.set(x + 1.9, 2.4, z - 0.22)

    const topFrame = MeshBuilder.CreateBox(`gate_frame_t_${config.id}_${x}`, { width: 4, height: 0.22, depth: 0.28 }, this.scene)
    topFrame.material = frameMat
    topFrame.position.set(x, 4.78, z - 0.22)

    const tex = new DynamicTexture(`gateLabel_${config.id}_${x}`, { width: 512, height: 256 }, this.scene)
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, 512, 256)
    tex.drawText(config.displayText, null, 150, "900 76px Arial", "#FFFFFF", "transparent", true, true)
    tex.update()

    const label = MeshBuilder.CreatePlane(`gate_label_${config.id}_${x}`, { width: 3.8, height: 1.25 }, this.scene)
    const labelMat = new StandardMaterial(`gateLabelMat_${config.id}_${x}`, this.scene)
    labelMat.diffuseTexture = tex
    labelMat.emissiveTexture = tex
    labelMat.useAlphaFromDiffuseTexture = true
    labelMat.backFaceCulling = false
    label.material = labelMat
    label.position.set(x, 3.05, z - 0.3)
    return [panel, leftFrame, rightFrame, topFrame, label]
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
        this.squadStats.attackMultiplier *= 1 + cfg.value
        break
      case GATE_TYPES.fireRateUp:
        this.squadStats.fireRateMultiplier *= 1 + cfg.value
        break
      case GATE_TYPES.rangeUp:
        this.squadStats.rangeMultiplier *= 1 + cfg.value
        break
    }
  }
}
