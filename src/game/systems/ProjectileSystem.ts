import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import { ObjectPool } from "../pools/ObjectPool"

type Trail = {
  readonly mesh: Mesh
  life: number
}

export class ProjectileSystem {
  private readonly pool: ObjectPool<Trail>
  private readonly tempMid = new Vector3(0, 0, 0)

  constructor(private readonly scene: Scene, capacity: number) {
    this.pool = new ObjectPool<Trail>(
      (index) => this.createTrail(index),
      (trail) => {
        trail.mesh.setEnabled(false)
        trail.life = 0
      },
      capacity,
    )
  }

  addTrail(from: Vector3, to: Vector3): void {
    const trail = this.pool.get()
    if (trail === null) {
      return
    }
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const length = Math.hypot(dx, dy, dz)
    if (length < 0.1) {
      this.pool.release(trail)
      return
    }

    this.tempMid.set((from.x + to.x) * 0.5, (from.y + to.y) * 0.5, (from.z + to.z) * 0.5)
    trail.mesh.position.copyFrom(this.tempMid)
    trail.mesh.scaling.z = length
    trail.mesh.rotation.y = Math.atan2(dx, dz)
    trail.mesh.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz))
    trail.life = 0.07
    trail.mesh.setEnabled(true)
  }

  update(dt: number): void {
    for (const trail of this.pool.getActive()) {
      trail.life -= dt
      if (trail.life <= 0) {
        this.pool.release(trail)
      }
    }
  }

  private createTrail(index: number): Trail {
    const mesh = MeshBuilder.CreateBox(`bullet_trail_${index}`, { width: 0.05, height: 0.05, depth: 1 }, this.scene)
    const mat = new StandardMaterial(`bulletTrailMat_${index}`, this.scene)
    mat.emissiveColor = new Color3(1, 0.78, 0.28)
    mat.diffuseColor = new Color3(1, 0.78, 0.28)
    mesh.material = mat
    mesh.setEnabled(false)
    return { mesh, life: 0 }
  }
}
