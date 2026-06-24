import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import type { SquadSystem } from "./SquadSystem"
import type { FXSystem } from "./FXSystem"
import type { GltfAsset } from "../utils/assetLoader"
import { cloneGltfVisual } from "../utils/assetLoader"

const BOSS_DAMAGE_FX_INTERVAL = 0.18
const BOSS_HIT_PULSE_DURATION = 0.22
const BOSS_HIT_PULSE_SCALE = 0.075
const AUTHORED_BOSS_SCALE = 2.2

export class BossSystem {
  private bossMesh: Mesh | null = null
  private readonly arenaMeshes: Mesh[] = []
  private hp = 0
  private readonly maxHp = 620
  private spawned = false
  private attackTimer = 0
  private readonly attackInterval = 4.4
  private readonly spawnZ = 210
  private readonly spawnPos = new Vector3(0, 0.28, this.spawnZ + 16)
  private arenaPhase = 0
  private damageFxTimer = 0
  private hitPulse = 0
  private bossBaseScale = 1
  onSpawn?: () => void
  onDeath?: () => void
  onDamageSoldiers?: (n: number) => void

  constructor(
    private readonly scene: Scene,
    private readonly squad: SquadSystem,
    private readonly fx: FXSystem,
    private readonly yetiAsset: GltfAsset | null,
  ) {}

  update(dt: number, squadAttack: number): void {
    if (!this.spawned && this.squad.squadZ >= this.spawnZ - 54) {
      this.spawn()
    }
    if (this.bossMesh === null || this.hp <= 0) {
      return
    }
    if (this.squad.squadZ > this.spawnZ + 42) {
      this.despawn()
      return
    }

    this.attackTimer -= dt
    this.animateArena(dt)
    this.animateBossHitPulse(dt)
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackInterval
      this.doAttack()
    }

    if (this.squad.squadZ >= this.spawnZ - 16) {
      const dps = squadAttack * Math.max(1, this.squad.soldierCount) * 0.34
      this.hp -= dps * dt
      this.bossMesh.rotation.y += dt
      this.playDamageFeedback(dt)
      if (this.hp <= 0) {
        this.die()
      }
    }
  }

  getHpRatio(): number {
    return this.bossMesh !== null && this.hp > 0 ? Math.max(0, this.hp / this.maxHp) : -1
  }

  isAlive(): boolean {
    return this.bossMesh !== null && this.hp > 0
  }

  private spawn(): void {
    this.spawned = true
    this.hp = this.maxHp
    this.attackTimer = 1.4
    let mesh: Mesh
    if (this.yetiAsset?.isReal === true) {
      mesh = cloneGltfVisual(this.yetiAsset, "boss_runtime", this.scene)
      mesh.scaling.setAll(AUTHORED_BOSS_SCALE)
      this.decorateBoss(mesh)
    } else {
      mesh = this.createFallbackBoss()
      this.decorateBoss(mesh)
    }
    mesh.position.copyFrom(this.spawnPos)
    mesh.setEnabled(true)
    this.bossMesh = mesh
    this.bossBaseScale = mesh.scaling.x
    this.damageFxTimer = 0
    this.hitPulse = 0
    this.createArena()
    this.fx.playGateEffect(this.spawnPos)
    this.onSpawn?.()
  }

  private createFallbackBoss(): Mesh {
    const mesh = MeshBuilder.CreateCylinder("boss", { height: 5, diameter: 4, tessellation: 12 }, this.scene)
    const mat = new StandardMaterial("bossMat", this.scene)
    mat.diffuseColor = new Color3(0.48, 0.12, 0.72)
    mat.emissiveColor = new Color3(0.08, 0.01, 0.13)
    mesh.material = mat
    return mesh
  }

  private decorateBoss(mesh: Mesh): void {
    const armorMat = new StandardMaterial("bossArmorMat", this.scene)
    armorMat.diffuseColor = new Color3(0.12, 0.04, 0.2)
    armorMat.emissiveColor = new Color3(0.08, 0.01, 0.14)
    const coreMat = new StandardMaterial("bossCoreMat", this.scene)
    coreMat.diffuseColor = new Color3(1, 0.16, 0.38)
    coreMat.emissiveColor = new Color3(0.85, 0.02, 0.16)

    const crown = MeshBuilder.CreateCylinder("boss_crown", { height: 0.24, diameterTop: 0.46, diameterBottom: 0.84, tessellation: 6 }, this.scene)
    crown.material = armorMat
    crown.parent = mesh
    crown.position.set(0, 1.28, 0)

    const core = MeshBuilder.CreateSphere("boss_core", { diameter: 0.38, segments: 16 }, this.scene)
    core.material = coreMat
    core.parent = mesh
    core.position.set(0, 0.7, 0.66)

    for (const x of [-0.72, 0.72]) {
      const shoulder = MeshBuilder.CreateBox(`boss_shoulder_${x}`, { width: 0.22, height: 0.24, depth: 0.24 }, this.scene)
      shoulder.material = armorMat
      shoulder.parent = mesh
      shoulder.position.set(x, 0.86, 0)
    }
  }

  private doAttack(): void {
    if (this.bossMesh === null) {
      return
    }
    const removed = Math.max(1, Math.floor(this.squad.soldierCount * 0.06))
    this.squad.removeSoldiers(removed)
    this.onDamageSoldiers?.(removed)
    this.fx.playExplosion(this.bossMesh.position, 1.3)
  }

  private createArena(): void {
    this.clearArena()
    const hazardMat = new StandardMaterial("bossArenaHazardMat", this.scene)
    hazardMat.diffuseColor = new Color3(1, 0.14, 0.26)
    hazardMat.emissiveColor = new Color3(0.82, 0.04, 0.12)
    hazardMat.alpha = 0.72

    const padMat = new StandardMaterial("bossArenaPadMat", this.scene)
    padMat.diffuseColor = new Color3(0.16, 0.04, 0.24)
    padMat.emissiveColor = new Color3(0.16, 0.02, 0.28)
    padMat.alpha = 0.72

    const pad = MeshBuilder.CreateBox("boss_arena_pad", { width: 12.6, height: 0.08, depth: 16 }, this.scene)
    pad.material = padMat
    pad.position.set(0, 0.08, this.spawnZ + 13.2)
    this.arenaMeshes.push(pad)

    const ring = MeshBuilder.CreateTorus("boss_warning_ring", { diameter: 8.2, thickness: 0.08, tessellation: 48 }, this.scene)
    ring.material = hazardMat
    ring.position.set(0, 0.22, this.spawnZ + 14.8)
    ring.rotation.x = Math.PI * 0.5
    this.arenaMeshes.push(ring)

    const shadow = MeshBuilder.CreateCylinder("boss_visible_shadow", { height: 0.04, diameter: 5.8, tessellation: 48 }, this.scene)
    shadow.material = padMat
    shadow.position.set(0, 0.12, this.spawnZ + 16)
    shadow.scaling.z = 0.58
    this.arenaMeshes.push(shadow)

    const beacon = MeshBuilder.CreateCylinder("boss_elite_beacon", { height: 5.2, diameter: 0.18, tessellation: 12 }, this.scene)
    beacon.material = hazardMat
    beacon.position.set(0, 2.6, this.spawnZ + 16)
    this.arenaMeshes.push(beacon)

    for (const x of [-5.8, -3.1, 3.1, 5.8]) {
      const stripe = MeshBuilder.CreateBox(`boss_hazard_stripe_${x}`, { width: 0.28, height: 0.09, depth: 13.5 }, this.scene)
      stripe.material = hazardMat
      stripe.position.set(x, 0.18, this.spawnZ + 13.2)
      stripe.rotation.y = x < 0 ? -0.18 : 0.18
      this.arenaMeshes.push(stripe)
    }

    for (const x of [-6.35, 6.35]) {
      const pylon = MeshBuilder.CreateBox(`boss_warning_pylon_${x}`, { width: 0.42, height: 1.7, depth: 0.42 }, this.scene)
      pylon.material = hazardMat
      pylon.position.set(x, 0.82, this.spawnZ + 12.2)
      this.arenaMeshes.push(pylon)
    }
  }

  private animateArena(dt: number): void {
    this.arenaPhase += dt * 3.2
    const pulse = 1 + Math.sin(this.arenaPhase) * 0.05
    for (const mesh of this.arenaMeshes) {
      if (mesh.name.includes("boss_warning_ring")) {
        mesh.rotation.z += dt * 1.1
        mesh.scaling.set(pulse, pulse, 1)
      } else if (mesh.name.includes("boss_visible_shadow")) {
        mesh.scaling.x = 1.08 + Math.sin(this.arenaPhase) * 0.08
        mesh.scaling.z = 0.58 + Math.cos(this.arenaPhase) * 0.05
      } else if (mesh.name.includes("boss_elite_beacon")) {
        mesh.scaling.y = 1 + Math.sin(this.arenaPhase * 1.4) * 0.16
      } else if (mesh.name.includes("boss_warning_pylon")) {
        mesh.scaling.y = 1 + Math.sin(this.arenaPhase + mesh.position.x) * 0.08
      }
    }
  }

  private animateBossHitPulse(dt: number): void {
    if (this.bossMesh === null || this.hitPulse <= 0) {
      return
    }
    this.hitPulse = Math.max(0, this.hitPulse - dt)
    const t = this.hitPulse / BOSS_HIT_PULSE_DURATION
    const pulseScale = this.bossBaseScale * (1 + Math.sin(t * Math.PI) * BOSS_HIT_PULSE_SCALE)
    this.bossMesh.scaling.setAll(pulseScale)
  }

  private playDamageFeedback(dt: number): void {
    if (this.bossMesh === null) {
      return
    }
    this.damageFxTimer -= dt
    if (this.damageFxTimer > 0) {
      return
    }
    this.damageFxTimer = BOSS_DAMAGE_FX_INTERVAL
    this.hitPulse = BOSS_HIT_PULSE_DURATION
    const sparkPos = this.bossMesh.position.add(new Vector3(0, 1.45, -0.75))
    this.fx.playHitSpark(sparkPos)
  }

  private die(): void {
    if (this.bossMesh !== null) {
      this.fx.playExplosion(this.bossMesh.position, 3)
      this.bossMesh.setEnabled(false)
      this.bossMesh = null
    }
    this.clearArena()
    this.onDeath?.()
  }

  private despawn(): void {
    if (this.bossMesh !== null) {
      this.bossMesh.setEnabled(false)
      this.bossMesh = null
    }
    this.clearArena()
  }

  private clearArena(): void {
    for (const mesh of this.arenaMeshes) {
      mesh.dispose()
    }
    this.arenaMeshes.length = 0
  }
}
