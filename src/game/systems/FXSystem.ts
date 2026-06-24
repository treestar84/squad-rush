import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core"
import { ObjectPool } from "../pools/ObjectPool"

type FXKind = "hit" | "smoke" | "gate" | "death" | "deathSquash" | "collapse" | "chain" | "reinforce"

const DEATH_SMOKE_PARTICLE_COUNT = 3
const DEATH_SMOKE_DURATION = 0.3
const DEATH_SMOKE_BASE_SCALE = 0.082
const DEATH_SMOKE_SCALE_STEP = 0.012
const DEATH_SMOKE_DRIFT_Y = 0.14
const DEATH_SQUASH_DURATION = 0.16
const DEATH_SQUASH_BASE_SCALE = 0.24
const DEATH_SQUASH_LIFT = 0.06
const GATE_BURST_PARTICLE_COUNT = 64
const GATE_RING_PARTICLE_COUNT = 18
const GATE_BURST_BASE_SCALE = 0.1
const GATE_BURST_SCALE_STEP = 0.032
const GATE_RING_BASE_SCALE = 0.18
const GATE_RING_SCALE_STEP = 0.024
const GATE_PARTICLE_ALPHA = 0.58
const GATE_SPARKLE_LIFT = 0.95
const GATE_RING_RADIUS = 1.48

declare global {
  interface Window {
    __squadRushFxDebug?: {
      readonly lastGateBurstCount: number
      readonly lastGateBurstScale: number
      readonly lastGateParticleAlpha: number
      readonly lastGateParticleMaxScale: number
    }
  }
}

type FXInstance = {
  readonly mesh: Mesh
  baseScale: number
  kind: FXKind
  life: number
  duration: number
  velocityY: number
  baseAlpha: number
}

export class FXSystem {
  private readonly pool: ObjectPool<FXInstance>

  constructor(private readonly scene: Scene, capacity: number) {
    this.pool = new ObjectPool<FXInstance>(
      (index) => this.createFX(index),
      (fx) => {
        fx.mesh.setEnabled(false)
        fx.life = 0
      },
      capacity,
    )
  }

  playHitSpark(pos: Vector3): void {
    for (let index = 0; index < 5; index += 1) {
      const angle = index * 2.399963
      const sparkPos = new Vector3(
        pos.x + Math.cos(angle) * 0.12,
        pos.y + 0.18 + (index % 2) * 0.08,
        pos.z + Math.sin(angle) * 0.12,
      )
      this.play("hit", sparkPos, 0.22, 0.16 + (index % 3) * 0.05)
    }
  }

  playExplosion(pos: Vector3, scale = 1): void {
    for (let index = 0; index < 6; index += 1) {
      const angle = index * 2.399963
      const radius = 0.1 + (index % 3) * 0.08
      const smokePos = new Vector3(
        pos.x + Math.cos(angle) * radius,
        pos.y + 0.18 + (index % 2) * 0.08,
        pos.z + Math.sin(angle) * radius,
      )
      this.play("smoke", smokePos, 0.65, (0.22 + (index % 3) * 0.05) * scale)
    }
    if (scale >= 1.2) {
      this.playCollapseAfterimage(pos, scale * 0.35)
    }
  }

  playDeathBurst(pos: Vector3, scale = 1): void {
    this.playDeathSquash(pos, scale)
    for (let index = 0; index < DEATH_SMOKE_PARTICLE_COUNT; index += 1) {
      const angle = index * 2.399963
      const smokePos = new Vector3(
        pos.x + Math.cos(angle) * (0.08 + (index % 3) * 0.035),
        pos.y + 0.1 + (index % 2) * 0.04,
        pos.z + Math.sin(angle) * (0.07 + (index % 2) * 0.035),
      )
      this.play("death", smokePos, DEATH_SMOKE_DURATION, (DEATH_SMOKE_BASE_SCALE + (index % 3) * DEATH_SMOKE_SCALE_STEP) * scale)
    }
  }

  playChainPop(pos: Vector3): void {
    this.play("chain", new Vector3(pos.x, pos.y + 0.38, pos.z), 0.34, 0.62)
    for (let index = 0; index < 5; index += 1) {
      const angle = index * 2.399963
      const sparkPos = new Vector3(pos.x + Math.cos(angle) * 0.22, pos.y + 0.46, pos.z + Math.sin(angle) * 0.22)
      this.play("hit", sparkPos, 0.18, 0.13 + index * 0.012)
    }
  }

  playGateEffect(pos: Vector3): void {
    const colors = [
      new Color3(1, 0.74, 0.16),
      new Color3(0.2, 0.95, 0.42),
      new Color3(1, 1, 0.92),
    ] as const
    for (let index = 0; index < GATE_BURST_PARTICLE_COUNT; index += 1) {
      const angle = index * 2.399963
      const radius = 0.42 + (index % 8) * 0.18
      const y = 0.18 + (index % 6) * 0.11
      const particlePos = new Vector3(
        pos.x + Math.cos(angle) * radius,
        pos.y + y,
        pos.z + Math.sin(angle) * radius * 0.55,
      )
      const scale = GATE_BURST_BASE_SCALE + (index % 6) * GATE_BURST_SCALE_STEP
      this.play("gate", particlePos, 0.78, scale, colors[index % colors.length])
    }
    for (let index = 0; index < GATE_RING_PARTICLE_COUNT; index += 1) {
      const angle = (Math.PI * 2 * index) / GATE_RING_PARTICLE_COUNT
      const ringPos = new Vector3(
        pos.x + Math.cos(angle) * GATE_RING_RADIUS,
        pos.y + GATE_SPARKLE_LIFT + Math.sin(index * 1.7) * 0.12,
        pos.z + Math.sin(angle) * GATE_RING_RADIUS * 0.46,
      )
      this.play("gate", ringPos, 0.92, GATE_RING_BASE_SCALE + (index % 3) * GATE_RING_SCALE_STEP, colors[(index + 1) % colors.length])
    }
    window.__squadRushFxDebug = {
      lastGateBurstCount: GATE_BURST_PARTICLE_COUNT + GATE_RING_PARTICLE_COUNT,
      lastGateBurstScale: GATE_RING_RADIUS,
      lastGateParticleAlpha: GATE_PARTICLE_ALPHA,
      lastGateParticleMaxScale: Math.max(
        GATE_BURST_BASE_SCALE + 5 * GATE_BURST_SCALE_STEP,
        GATE_RING_BASE_SCALE + 2 * GATE_RING_SCALE_STEP,
      ),
    }
  }

  playReinforcementBurst(positions: readonly Vector3[]): void {
    const count = Math.min(positions.length, 8)
    for (let index = 0; index < count; index += 1) {
      const pos = positions[index]
      if (pos === undefined) {
        continue
      }
      this.play("reinforce", new Vector3(pos.x, pos.y + 0.18, pos.z), 0.68, 0.5 + (index % 3) * 0.04)
    }
  }

  private playCollapseAfterimage(pos: Vector3, scale: number): void {
    const bodyPos = new Vector3(pos.x, pos.y + 0.2, pos.z)
    this.play("collapse", bodyPos, 0.36, 0.48 * scale)
    for (let index = 0; index < 3; index += 1) {
      const angle = index * 2.399963
      const sparkPos = new Vector3(
        pos.x + Math.cos(angle) * 0.18,
        pos.y + 0.32,
        pos.z + Math.sin(angle) * 0.18,
      )
      this.play("hit", sparkPos, 0.18, (0.1 + index * 0.025) * scale)
    }
  }

  private playDeathSquash(pos: Vector3, scale: number): void {
    this.play(
      "deathSquash",
      new Vector3(pos.x, pos.y + DEATH_SQUASH_LIFT, pos.z),
      DEATH_SQUASH_DURATION,
      DEATH_SQUASH_BASE_SCALE * scale,
    )
  }

  update(dt: number): void {
    for (const fx of this.pool.getActive()) {
      fx.life -= dt
      const age = 1 - Math.max(0, fx.life / fx.duration)
      fx.mesh.position.y += fx.velocityY * dt
      if (fx.kind === "collapse") {
        fx.mesh.scaling.set(
          fx.baseScale * (1.2 + age * 0.45),
          fx.baseScale * Math.max(0.1, 0.86 - age * 0.72),
          fx.baseScale * (1.2 + age * 0.45),
        )
      } else if (fx.kind === "deathSquash") {
        fx.mesh.scaling.set(
          fx.baseScale * (1.1 + age * 1.9),
          fx.baseScale * Math.max(0.05, 0.44 - age * 0.36),
          fx.baseScale * (0.92 + age * 1.45),
        )
      } else if (fx.kind === "reinforce") {
        fx.mesh.scaling.set(fx.baseScale * (1.2 + age * 1.1), fx.baseScale * (1.8 + age * 4.2), fx.baseScale * (1.2 + age * 1.1))
      } else {
        const expansion = fx.kind === "gate" ? 2.2 : fx.kind === "chain" ? 2.8 : fx.kind === "death" ? 0.42 : fx.kind === "smoke" ? 1.05 : 1.4
        fx.mesh.scaling.setAll(fx.baseScale * (0.45 + age * expansion))
      }
      const material = fx.mesh.material
      if (material instanceof StandardMaterial) {
        material.alpha = Math.max(0, fx.baseAlpha * (1 - age))
      }
      if (fx.life <= 0) {
        this.pool.release(fx)
      }
    }
  }

  private play(kind: FXKind, pos: Vector3, duration: number, scale: number, color?: Color3): void {
    const fx = this.pool.get()
    if (fx === null) {
      return
    }
    fx.kind = kind
    fx.duration = duration
    fx.life = duration
    fx.mesh.position.copyFrom(pos)
    fx.velocityY = kind === "death" ? DEATH_SMOKE_DRIFT_Y : kind === "smoke" ? 0.42 : kind === "collapse" ? 0.08 : kind === "deathSquash" ? 0.03 : kind === "reinforce" ? 0.2 : 0
    fx.baseScale = scale
    fx.mesh.scaling.setAll(scale)
    fx.baseAlpha = this.colorize(fx, kind, color)
    fx.mesh.setEnabled(true)
  }

  private colorize(fx: FXInstance, kind: FXKind, color?: Color3): number {
    const material = fx.mesh.material
    if (!(material instanceof StandardMaterial)) {
      return 1
    }
    let baseAlpha = 0.86
    if (kind === "hit") {
      material.diffuseColor = new Color3(1, 0.7, 0.15)
      material.emissiveColor = new Color3(0.6, 0.18, 0.04)
    } else if (kind === "gate") {
      const gateColor = color ?? new Color3(0.15, 0.9, 0.35)
      material.diffuseColor = gateColor
      material.emissiveColor = gateColor.scale(0.72)
      baseAlpha = GATE_PARTICLE_ALPHA
    } else if (kind === "chain") {
      material.diffuseColor = new Color3(1, 0.78, 0.16)
      material.emissiveColor = new Color3(0.72, 0.32, 0.02)
      material.specularColor = new Color3(0.65, 0.42, 0.1)
      baseAlpha = 0.72
    } else if (kind === "reinforce") {
      material.diffuseColor = new Color3(0.2, 0.78, 1)
      material.emissiveColor = new Color3(0.05, 0.36, 0.62)
      material.specularColor = new Color3(0.24, 0.72, 0.9)
      baseAlpha = 0.48
    } else if (kind === "deathSquash") {
      material.diffuseColor = new Color3(0.38, 0.38, 0.36)
      material.emissiveColor = new Color3(0.014, 0.013, 0.012)
      material.specularColor = new Color3(0.025, 0.025, 0.023)
      baseAlpha = 0.28
    } else if (kind === "collapse") {
      material.diffuseColor = new Color3(0.5, 0.5, 0.48)
      material.emissiveColor = new Color3(0.08, 0.07, 0.06)
      material.specularColor = new Color3(0.03, 0.03, 0.03)
      baseAlpha = 0.45
    } else {
      const tone = kind === "death" ? 0.34 : 0.42
      material.diffuseColor = new Color3(tone, tone, tone)
      material.emissiveColor = kind === "death" ? new Color3(0.006, 0.006, 0.006) : new Color3(0.02, 0.02, 0.02)
      material.specularColor = new Color3(0.04, 0.04, 0.04)
      baseAlpha = kind === "death" ? 0.22 : 0.38
    }
    material.alpha = baseAlpha
    return baseAlpha
  }

  private createFX(index: number): FXInstance {
    const mesh = MeshBuilder.CreateSphere(`fx_${index}`, { diameter: 1, segments: 8 }, this.scene)
    const mat = new StandardMaterial(`fxMat_${index}`, this.scene)
    mat.diffuseColor = new Color3(1, 0.7, 0.15)
    mat.emissiveColor = new Color3(0.5, 0.2, 0.02)
    mat.alpha = 0
    mesh.material = mat
    mesh.setEnabled(false)
    return { mesh, baseScale: 1, kind: "hit", life: 0, duration: 0, velocityY: 0, baseAlpha: 0 }
  }
}
