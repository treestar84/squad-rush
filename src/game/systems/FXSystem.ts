import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import { ObjectPool } from "../pools/ObjectPool"

type FXKind = "hit" | "explosion" | "gate"

type FXInstance = {
  readonly mesh: Mesh
  baseScale: number
  kind: FXKind
  life: number
  duration: number
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
    this.play("hit", pos, 0.22, 0.35)
  }

  playExplosion(pos: Vector3, scale = 1): void {
    this.play("explosion", pos, 0.82, 1.5 * scale)
  }

  playGateEffect(pos: Vector3): void {
    const colors = [
      new Color3(1, 0.74, 0.16),
      new Color3(0.2, 0.95, 0.42),
      new Color3(1, 1, 0.92),
    ] as const
    for (let index = 0; index < 100; index += 1) {
      const angle = index * 2.399963
      const radius = 0.35 + (index % 9) * 0.22
      const y = 0.25 + (index % 7) * 0.12
      const particlePos = new Vector3(
        pos.x + Math.cos(angle) * radius,
        pos.y + y,
        pos.z + Math.sin(angle) * radius * 0.55,
      )
      const scale = 0.2 + (index % 6) * 0.12
      this.play("gate", particlePos, 1.2, scale, colors[index % colors.length])
    }
  }

  update(dt: number): void {
    for (const fx of this.pool.getActive()) {
      fx.life -= dt
      const age = 1 - Math.max(0, fx.life / fx.duration)
      const expansion = fx.kind === "gate" ? 2.2 : 1.4
      fx.mesh.scaling.setAll(fx.baseScale * (0.45 + age * expansion) * (fx.kind === "explosion" ? 1.4 : 1))
      const material = fx.mesh.material
      if (material instanceof StandardMaterial) {
        material.alpha = Math.max(0, 1 - age)
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
    fx.baseScale = scale
    fx.mesh.scaling.setAll(scale)
    this.colorize(fx, kind, color)
    fx.mesh.setEnabled(true)
  }

  private colorize(fx: FXInstance, kind: FXKind, color?: Color3): void {
    const material = fx.mesh.material
    if (!(material instanceof StandardMaterial)) {
      return
    }
    if (kind === "hit") {
      material.diffuseColor = new Color3(1, 0.7, 0.15)
      material.emissiveColor = new Color3(0.6, 0.18, 0.04)
    } else if (kind === "gate") {
      const gateColor = color ?? new Color3(0.15, 0.9, 0.35)
      material.diffuseColor = gateColor
      material.emissiveColor = gateColor.scale(0.55)
    } else {
      material.diffuseColor = new Color3(1, 0.32, 0.08)
      material.emissiveColor = new Color3(0.6, 0.08, 0.01)
    }
    material.alpha = 1
  }

  private createFX(index: number): FXInstance {
    const mesh = MeshBuilder.CreateSphere(`fx_${index}`, { diameter: 1, segments: 8 }, this.scene)
    const mat = new StandardMaterial(`fxMat_${index}`, this.scene)
    mat.diffuseColor = new Color3(1, 0.7, 0.15)
    mat.emissiveColor = new Color3(0.5, 0.2, 0.02)
    mat.alpha = 0
    mesh.material = mat
    mesh.setEnabled(false)
    return { mesh, baseScale: 1, kind: "hit", life: 0, duration: 0 }
  }
}
