import { Color3, Mesh, PBRMaterial, StandardMaterial } from "@babylonjs/core"
import { UNIT_TYPES, type UnitType } from "../data/squadRosterData"
import { applySoldierHeadStyle, type SoldierHeadStyle } from "./SoldierVisualKit"

export function applySoldierUnitVisual(mesh: Mesh, unit: UnitType, cssColor: string): void {
  applySoldierHeadStyle(mesh, getHeadStyle(unit))
  applySoldierUnitColor(mesh, Color3.FromHexString(cssColor))
}

function getHeadStyle(unit: UnitType): SoldierHeadStyle {
  switch (unit) {
    case UNIT_TYPES.soldier:
      return "greenHelmet"
    case UNIT_TYPES.officer:
      return "purpleHelmet"
    case UNIT_TYPES.general:
      return "redHelmet"
    case UNIT_TYPES.seniorDeveloper:
    case UNIT_TYPES.gamer:
      return "redHelmet"
    case UNIT_TYPES.pangyo:
    case UNIT_TYPES.unemployed:
    case UNIT_TYPES.developer:
    case UNIT_TYPES.qa:
    case UNIT_TYPES.entrepreneur:
    case UNIT_TYPES.ceo:
    case UNIT_TYPES.ai:
      return "blackHair"
  }
}

function applySoldierUnitColor(mesh: Mesh, color: Color3): void {
  for (const child of mesh.getChildMeshes(false)) {
    if (child.name.includes("soldier_role") || child.name.includes("soldier_muzzle")) {
      tintMaterial(child.material, color)
    }
  }
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
