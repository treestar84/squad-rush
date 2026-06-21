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
    this.play("gate", pos, 0.55, 1.2)
  }

  update(dt: number): void {
    for (const fx of this.pool.getActive()) {
      fx.life -= dt
      const age = 1 - Math.max(0, fx.life / fx.duration)
      fx.mesh.scaling.setAll((0.25 + age * 1.4) * (fx.kind === "explosion" ? 1.4 : 1))
      const material = fx.mesh.material
      if (material instanceof StandardMaterial) {
        material.alpha = Math.max(0, 1 - age)
      }
      if (fx.life <= 0) {
        this.pool.release(fx)
      }
    }
  }

  private play(kind: FXKind, pos: Vector3, duration: number, scale: number): void {
    const fx = this.pool.get()
    if (fx === null) {
      return
    }
    fx.kind = kind
    fx.duration = duration
    fx.life = duration
    fx.mesh.position.copyFrom(pos)
    fx.mesh.scaling.setAll(scale)
    this.colorize(fx, kind)
    fx.mesh.setEnabled(true)
  }

  private colorize(fx: FXInstance, kind: FXKind): void {
    const material = fx.mesh.material
    if (!(material instanceof StandardMaterial)) {
      return
    }
    if (kind === "hit") {
      material.diffuseColor = new Color3(1, 0.7, 0.15)
      material.emissiveColor = new Color3(0.6, 0.18, 0.04)
    } else if (kind === "gate") {
      material.diffuseColor = new Color3(0.15, 0.9, 0.35)
      material.emissiveColor = new Color3(0.08, 0.45, 0.18)
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
    return { mesh, kind: "hit", life: 0, duration: 0 }
  }
}
