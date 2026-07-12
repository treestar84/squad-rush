import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core"

const SOLDIER_ROLE_NAMES = ["rifle", "heavy", "scout"] as const
const SOLDIER_HEAD_STYLES = ["blackHair", "greenHelmet", "purpleHelmet", "redHelmet"] as const
const SOLDIER_HEAD_MARKER_PREFIX = "squad_unit_head_marker_"

export type SoldierRoleName = (typeof SOLDIER_ROLE_NAMES)[number]
export type SoldierHeadStyle = (typeof SOLDIER_HEAD_STYLES)[number]

export function getSoldierRoleName(index: number): SoldierRoleName {
  return SOLDIER_ROLE_NAMES[index % SOLDIER_ROLE_NAMES.length] ?? "rifle"
}

export function attachSoldierRoleKit(mesh: Mesh, index: number, scene: Scene): void {
  const role = getSoldierRoleName(index)
  const kitMat = createRoleMaterial(role, index, scene)
  const glowMat = createGlowMaterial(role, index, scene)
  attachChestPlate(mesh, index, kitMat, scene)
  attachRoleWeapon(mesh, index, role, kitMat, glowMat, scene)
  if (role === "heavy") {
    attachHeavyPack(mesh, index, kitMat, glowMat, scene)
  }
  if (role === "scout") {
    attachScoutAntenna(mesh, index, glowMat, scene)
  }
}

export function attachSoldierHeadMarkers(mesh: Mesh, index: number, scene: Scene): void {
  for (const style of SOLDIER_HEAD_STYLES) {
    const marker = MeshBuilder.CreateSphere(
      `${SOLDIER_HEAD_MARKER_PREFIX}${style}_${index}`,
      { diameterX: style === "blackHair" ? 0.72 : 0.42, diameterY: style === "blackHair" ? 0.22 : 0.34, diameterZ: style === "blackHair" ? 0.62 : 0.46, segments: 12 },
      scene,
    )
    marker.material = createHeadMaterial(style, index, scene)
    marker.parent = mesh
    marker.position.set(0, style === "blackHair" ? 0.96 : 1.1, style === "blackHair" ? 0.03 : 0.07)
    marker.isPickable = false
    marker.setEnabled(false)
    if (style === "blackHair") {
      const bang = MeshBuilder.CreateBox(
        `${SOLDIER_HEAD_MARKER_PREFIX}${style}_bang_${index}`,
        { width: 0.58, height: 0.18, depth: 0.26 },
        scene,
      )
      bang.material = marker.material
      bang.parent = mesh
      bang.position.set(0, 0.98, 0.28)
      bang.isPickable = false
      bang.setEnabled(false)
    }
  }
}

export function applySoldierHeadStyle(mesh: Mesh, style: SoldierHeadStyle): void {
  for (const child of mesh.getChildMeshes(false)) {
    if (child.name.includes(SOLDIER_HEAD_MARKER_PREFIX)) {
      child.setEnabled(child.name.includes(`${SOLDIER_HEAD_MARKER_PREFIX}${style}_`))
    }
  }
}

function createRoleMaterial(role: SoldierRoleName, index: number, scene: Scene): StandardMaterial {
  const mat = new StandardMaterial(`soldierRoleMat_${role}_${index}`, scene)
  if (role === "heavy") {
    mat.diffuseColor = new Color3(0.16, 0.2, 0.22)
    mat.specularColor = new Color3(0.62, 0.66, 0.7)
    return mat
  }
  if (role === "scout") {
    mat.diffuseColor = new Color3(0.04, 0.34, 0.46)
    mat.specularColor = new Color3(0.25, 0.62, 0.78)
    return mat
  }
  mat.diffuseColor = new Color3(0.08, 0.1, 0.08)
  mat.specularColor = new Color3(0.35, 0.35, 0.26)
  return mat
}

function createGlowMaterial(role: SoldierRoleName, index: number, scene: Scene): StandardMaterial {
  const mat = new StandardMaterial(`soldierRoleGlowMat_${role}_${index}`, scene)
  const color = role === "scout" ? new Color3(0.12, 0.74, 1) : role === "heavy" ? new Color3(1, 0.66, 0.16) : new Color3(0.18, 0.78, 1)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(0.62)
  return mat
}

function createHeadMaterial(style: SoldierHeadStyle, index: number, scene: Scene): StandardMaterial {
  const mat = new StandardMaterial(`soldierHeadMarkerMat_${style}_${index}`, scene)
  switch (style) {
    case "blackHair":
      mat.diffuseColor = new Color3(0.005, 0.004, 0.004)
      mat.emissiveColor = new Color3(0.018, 0.014, 0.012)
      mat.specularColor = Color3.Black()
      return mat
    case "greenHelmet":
      mat.diffuseColor = new Color3(0.08, 0.34, 0.13)
      mat.specularColor = new Color3(0.3, 0.52, 0.28)
      return mat
    case "purpleHelmet":
      mat.diffuseColor = new Color3(0.34, 0.14, 0.62)
      mat.specularColor = new Color3(0.58, 0.36, 0.86)
      return mat
    case "redHelmet":
      mat.diffuseColor = new Color3(0.72, 0.06, 0.08)
      mat.specularColor = new Color3(0.95, 0.24, 0.2)
      return mat
  }
}

function attachChestPlate(mesh: Mesh, index: number, material: StandardMaterial, scene: Scene): void {
  const chest = MeshBuilder.CreateBox(`soldier_role_chest_${index}`, { width: 0.34, height: 0.24, depth: 0.08 }, scene)
  chest.material = material
  chest.parent = mesh
  chest.position.set(0, 0.62, 0.31)
}

function attachRoleWeapon(mesh: Mesh, index: number, role: SoldierRoleName, material: StandardMaterial, glowMat: StandardMaterial, scene: Scene): void {
  const width = role === "heavy" ? 0.18 : 0.1
  const depth = role === "scout" ? 0.92 : role === "heavy" ? 0.72 : 0.78
  const weapon = MeshBuilder.CreateBox(`soldier_role_weapon_${role}_${index}`, { width, height: 0.12, depth }, scene)
  weapon.material = material
  weapon.parent = mesh
  weapon.position.set(0.34, 0.58, 0.34)

  const muzzle = MeshBuilder.CreateSphere(`soldier_role_muzzle_${role}_${index}`, { diameter: role === "heavy" ? 0.16 : 0.11, segments: 8 }, scene)
  muzzle.material = glowMat
  muzzle.parent = mesh
  muzzle.position.set(0.34, 0.58, 0.78)
}

function attachHeavyPack(mesh: Mesh, index: number, material: StandardMaterial, glowMat: StandardMaterial, scene: Scene): void {
  const pack = MeshBuilder.CreateBox(`soldier_role_heavy_pack_${index}`, { width: 0.42, height: 0.42, depth: 0.16 }, scene)
  pack.material = material
  pack.parent = mesh
  pack.position.set(0, 0.58, -0.22)

  const core = MeshBuilder.CreateSphere(`soldier_role_heavy_core_${index}`, { diameter: 0.12, segments: 8 }, scene)
  core.material = glowMat
  core.parent = mesh
  core.position.set(0, 0.66, -0.32)
}

function attachScoutAntenna(mesh: Mesh, index: number, material: StandardMaterial, scene: Scene): void {
  const antenna = MeshBuilder.CreateBox(`soldier_role_scout_antenna_${index}`, { width: 0.04, height: 0.44, depth: 0.04 }, scene)
  antenna.material = material
  antenna.parent = mesh
  antenna.position.set(0.18, 1.2, -0.08)
}
