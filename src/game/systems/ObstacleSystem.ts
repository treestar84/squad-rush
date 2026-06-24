import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import type { FXSystem } from "./FXSystem"
import type { SquadSystem } from "./SquadSystem"

type ObstacleSpawn = {
  readonly z: number
  readonly x: number
  readonly width: number
  readonly label: string
}

type Obstacle = {
  readonly root: Mesh
  readonly warning: Mesh
  readonly beacon: Mesh
  readonly radius: number
  readonly damage: number
  triggered: boolean
}

const OBSTACLE_SPAWNS: readonly ObstacleSpawn[] = [
  { z: 82, x: 3.6, width: 2.1, label: "RIGHT" },
  { z: 132, x: -3.7, width: 2.3, label: "LEFT" },
  { z: 254, x: 0, width: 2.6, label: "CENTER" },
  { z: 332, x: 3.5, width: 2.2, label: "RIGHT" },
] as const

const OBSTACLE_LOOKAHEAD = 78
const OBSTACLE_DESPAWN_DISTANCE = 18
const OBSTACLE_HIT_RADIUS_PADDING = 0.72
const OBSTACLE_BASE_DAMAGE = 1

export class ObstacleSystem {
  private readonly obstacles: Obstacle[] = []
  private readonly tmpPos = new Vector3(0, 0, 0)
  private spawnIndex = 0
  private hitCount = 0

  constructor(
    private readonly scene: Scene,
    private readonly squad: SquadSystem,
    private readonly fx: FXSystem,
  ) {}

  update(dt: number): void {
    this.spawnAhead()
    for (const obstacle of this.obstacles) {
      if (obstacle.triggered) {
        continue
      }
      const pulse = 0.9 + Math.sin(this.squad.squadZ * 1.6 + obstacle.root.position.z) * 0.08
      obstacle.warning.scaling.set(pulse, 1, pulse)
      obstacle.beacon.rotation.y += dt * 2.2
      if (this.isHit(obstacle)) {
        this.trigger(obstacle)
      } else if (obstacle.root.position.z < this.squad.squadZ - OBSTACLE_DESPAWN_DISTANCE) {
        obstacle.triggered = true
        obstacle.root.setEnabled(false)
      }
    }
  }

  get activeCount(): number {
    return this.obstacles.filter((obstacle) => !obstacle.triggered).length
  }

  get collisions(): number {
    return this.hitCount
  }

  private spawnAhead(): void {
    let next = OBSTACLE_SPAWNS[this.spawnIndex]
    while (next !== undefined && this.squad.squadZ + OBSTACLE_LOOKAHEAD >= next.z) {
      this.obstacles.push(this.createObstacle(next))
      this.spawnIndex += 1
      next = OBSTACLE_SPAWNS[this.spawnIndex]
    }
  }

  private createObstacle(spawn: ObstacleSpawn): Obstacle {
    const root = new Mesh(`lane_obstacle_${spawn.label.toLowerCase()}_${spawn.z}`, this.scene)
    root.position.set(spawn.x, 0, spawn.z)

    const hazardMat = new StandardMaterial(`obstacleHazardMat_${spawn.z}`, this.scene)
    hazardMat.diffuseColor = new Color3(0.92, 0.34, 0.08)
    hazardMat.emissiveColor = new Color3(0.3, 0.08, 0.01)
    hazardMat.specularColor = new Color3(0.45, 0.28, 0.08)

    const darkMat = new StandardMaterial(`obstacleDarkMat_${spawn.z}`, this.scene)
    darkMat.diffuseColor = new Color3(0.08, 0.09, 0.1)
    darkMat.emissiveColor = new Color3(0.012, 0.012, 0.014)

    const warningMat = new StandardMaterial(`obstacleWarningMat_${spawn.z}`, this.scene)
    warningMat.diffuseColor = new Color3(1, 0.72, 0.12)
    warningMat.emissiveColor = new Color3(0.62, 0.24, 0.02)
    warningMat.alpha = 0.62

    const body = MeshBuilder.CreateBox(`lane_obstacle_body_${spawn.z}`, { width: spawn.width, height: 0.86, depth: 1.12 }, this.scene)
    body.parent = root
    body.material = hazardMat
    body.position.y = 0.42

    for (const side of [-1, 1]) {
      const brace = MeshBuilder.CreateBox(`lane_obstacle_brace_${spawn.z}_${side}`, { width: 0.18, height: 1.06, depth: 1.36 }, this.scene)
      brace.parent = root
      brace.material = darkMat
      brace.position.set(side * spawn.width * 0.42, 0.5, 0)
      brace.rotation.z = side * 0.12
    }

    const warning = MeshBuilder.CreateCylinder(`lane_obstacle_warning_disc_${spawn.z}`, { height: 0.025, diameter: spawn.width + 1.2, tessellation: 32 }, this.scene)
    warning.parent = root
    warning.material = warningMat
    warning.position.y = 0.04

    const beacon = MeshBuilder.CreateTorus(`lane_obstacle_beacon_ring_${spawn.z}`, { diameter: spawn.width + 0.8, thickness: 0.055, tessellation: 36 }, this.scene)
    beacon.parent = root
    beacon.material = warningMat
    beacon.position.y = 1.05
    beacon.rotation.x = Math.PI * 0.5

    return {
      root,
      warning,
      beacon,
      radius: spawn.width * 0.5 + OBSTACLE_HIT_RADIUS_PADDING,
      damage: OBSTACLE_BASE_DAMAGE,
      triggered: false,
    }
  }

  private isHit(obstacle: Obstacle): boolean {
    const dx = obstacle.root.position.x - this.squad.squadX
    const dz = obstacle.root.position.z - this.squad.squadZ
    return Math.abs(dz) < 1.05 && Math.abs(dx) < obstacle.radius
  }

  private trigger(obstacle: Obstacle): void {
    obstacle.triggered = true
    this.hitCount += 1
    this.squad.removeSoldiers(obstacle.damage)
    this.tmpPos.copyFrom(obstacle.root.position)
    this.tmpPos.y = 0.36
    this.fx.playExplosion(this.tmpPos, 0.72)
    obstacle.root.setEnabled(false)
  }
}
