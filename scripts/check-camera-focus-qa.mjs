import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const cameraSource = readFileSync(resolve("src/game/CameraController.ts"), "utf8")
const gameSource = readFileSync(resolve("src/game/Game.ts"), "utf8")
const gateSource = readFileSync(resolve("src/game/systems/GateSystem.ts"), "utf8")
const designSource = readFileSync(resolve("DESIGN.md"), "utf8")

function assertQa(condition, message) {
  if (!condition) {
    console.error(`Camera focus QA failed: ${message}`)
    process.exit(1)
  }
}

function readNumber(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))
  if (match?.[1] === undefined) {
    console.error(`Camera focus QA failed: missing numeric token ${name}.`)
    process.exit(1)
  }
  return Number.parseFloat(match[1])
}

const gateDistance = readNumber(gateSource, "GATE_CAMERA_FOCUS_DISTANCE")
const closeReleaseDistance = readNumber(gateSource, "GATE_CAMERA_CLOSE_RELEASE_DISTANCE")
const heightDrop = readNumber(cameraSource, "GATE_FOCUS_HEIGHT_DROP")
const backPull = readNumber(cameraSource, "GATE_FOCUS_BACK_PULL")
const lookahead = readNumber(cameraSource, "GATE_FOCUS_LOOKAHEAD")
const fovReduction = readNumber(cameraSource, "GATE_FOCUS_FOV_REDUCTION")
const combatLookahead = readNumber(cameraSource, "COMBAT_FOCUS_LOOKAHEAD")
const combatBackPull = readNumber(cameraSource, "COMBAT_FOCUS_BACK_PULL")

assertQa(gateSource.includes("getApproachFocus"), "GateSystem must expose gate approach focus.")
assertQa(gateSource.includes("Math.sin((1 - distance / GATE_CAMERA_FOCUS_DISTANCE) * Math.PI)"), "Gate focus must ease in and out around the gate.")
assertQa(gateSource.includes("approachFocus * closeRelease"), "Gate focus must release near the crossing line so the squad stays framed.")
assertQa(cameraSource.includes("export type CameraFollowTarget"), "Camera follow inputs must be a typed focus object.")
assertQa(cameraSource.includes("__squadRushCameraDebug"), "Camera QA must expose projected squad framing state.")
assertQa(cameraSource.includes("gateFocus") && cameraSource.includes("combatFocus") && cameraSource.includes("bossFocus"), "Camera follow input must keep bossFocus typed for compatibility.")
assertQa(cameraSource.includes("targetFov"), "Camera must keep an explicit target FOV.")
assertQa(gameSource.includes("this.gates.getApproachFocus(this.squad.squadZ)"), "Game must feed gate approach focus into the camera.")
assertQa(gameSource.includes("this.waves.aliveCount() / 220"), "Game must feed combat density into the camera.")
assertQa(gameSource.includes("bossFocus: 0"), "Game must preserve the opening camera angle during boss encounters.")
assertQa(!cameraSource.includes("BOSS_FOCUS_HEIGHT_LIFT"), "Boss encounters must not lift the camera into a top-down angle.")
assertQa(designSource.includes("preserve the opening chase camera angle"), "DESIGN.md must document stable boss camera behavior.")
assertQa(designSource.includes("Camera focus QA"), "DESIGN.md must document camera focus QA.")

assertQa(gateDistance >= 8 && gateDistance <= 14, `gate focus distance ${gateDistance} must stay in the 8-14m ad-game choice window.`)
assertQa(closeReleaseDistance >= 6 && closeReleaseDistance <= 8, `close release distance ${closeReleaseDistance} must fade focus before the squad crosses a gate.`)
assertQa(heightDrop === 0, `gate focus must not change camera height: ${heightDrop}`)
assertQa(backPull === 0, `gate focus must not pull the camera forward: ${backPull}`)
assertQa(lookahead === 0, `gate focus must not push the target lookahead: ${lookahead}`)
assertQa(fovReduction === 0, `gate focus must not reduce FOV or create zoom: ${fovReduction}`)
assertQa(combatLookahead >= 0.6 && combatLookahead <= 1.2, `combat lookahead ${combatLookahead} must keep the horde framed.`)
assertQa(combatBackPull >= 0.25 && combatBackPull <= 0.7, `combat back pull ${combatBackPull} must be restrained.`)

console.log(
  `Camera focus QA OK: gateDistance=${gateDistance}, closeReleaseDistance=${closeReleaseDistance}, heightDrop=${heightDrop}, backPull=${backPull}, lookahead=${lookahead}, fovReduction=${fovReduction}, combatLookahead=${combatLookahead}, combatBackPull=${combatBackPull}, bossCamera=opening-angle`,
)
