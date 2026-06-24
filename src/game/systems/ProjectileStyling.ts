import { Color3 } from "@babylonjs/core"
import { colorizeMesh, setMeshAlpha, type MuzzleFlash, type Trail } from "./ProjectileVisuals"
import type { BulletStyle } from "./ProjectileMotion"

export function configureBulletStyle(trail: Trail, style: BulletStyle): void {
  const power = Math.min(2.1, Math.max(1, style.power))
  const caliberScale = 1 + (power - 1) * 0.14

  colorizeMesh(trail.streak, new Color3(1, 0.62 + (power - 1) * 0.04, 0.1))
  colorizeMesh(trail.wakeNear, new Color3(1, 0.52 + (power - 1) * 0.04, 0.08))
  colorizeMesh(trail.wakeFar, new Color3(1, 0.46 + (power - 1) * 0.03, 0.06))
  colorizeMesh(trail.slug, new Color3(1, 0.86 + (power - 1) * 0.03, 0.18))
  colorizeMesh(trail.core, new Color3(1, 0.82 + (power - 1) * 0.03, 0.28))
  colorizeMesh(trail.tip, new Color3(1, 0.94, 0.42))
  colorizeMesh(trail.flash, new Color3(1, 0.52 + (power - 1) * 0.06, 0.08))
  trail.core.scaling.setAll(caliberScale)
  trail.slug.scaling.setAll(1 + (power - 1) * 0.06)
  trail.tip.scaling.setAll(1 + (power - 1) * 0.06)
  trail.flash.scaling.setAll(1 + (power - 1) * 0.08)
  trail.root.scaling.set(1 + (power - 1) * 0.16, 1 + (power - 1) * 0.16, 1)
}

export function configureMuzzleFlash(flash: MuzzleFlash, style: BulletStyle): void {
  const power = Math.min(2.1, Math.max(1, style.power))

  flash.duration = 0.09
  flash.life = flash.duration
  flash.baseScale = 0.28 + (power - 1) * 0.08
  colorizeMesh(flash.mesh, new Color3(1, 0.66 + (power - 1) * 0.04, 0.12))
  setMeshAlpha(flash.mesh, 0.82)
  flash.mesh.scaling.setAll(flash.baseScale)
}
