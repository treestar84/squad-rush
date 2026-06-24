import { Color3, Mesh, PBRMaterial, StandardMaterial } from "@babylonjs/core"

const SOLDIER_UPGRADE_COLORS: readonly Color3[] = [
  new Color3(0.12, 0.74, 0.26),
  new Color3(0.1, 0.52, 1),
  new Color3(0.58, 0.24, 1),
  new Color3(1, 0.86, 0.18),
  new Color3(1, 0.42, 0.08),
] as const

export function applySoldierUpgradeVisual(mesh: Mesh, tier: number): void {
  const color = getSoldierUpgradeColor(tier)
  for (const child of mesh.getChildMeshes(false)) {
    if (child.name.includes("soldier_role") || child.name.includes("soldier_muzzle")) {
      tintMaterial(child.material, color)
    }
  }
}

function getSoldierUpgradeColor(tier: number): Color3 {
  const clampedTier = Math.max(0, Math.min(SOLDIER_UPGRADE_COLORS.length - 1, Math.floor(tier)))
  return SOLDIER_UPGRADE_COLORS[clampedTier] ?? SOLDIER_UPGRADE_COLORS[0] ?? Color3.White()
}

function tintMaterial(material: Mesh["material"], color: Color3): void {
  if (material instanceof StandardMaterial) {
    material.diffuseColor = color
    material.emissiveColor = color.scale(0.56)
    return
  }
  if (material instanceof PBRMaterial) {
    material.albedoColor = color
    material.emissiveColor = color.scale(0.34)
  }
}
