#!/usr/bin/env bash
# verify-gates.sh — 바로 Go 스쿼드 품질 게이트 자동 검증
# 모든 게이트 PASS 시 exit 0, 하나라도 FAIL 시 exit 1

set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
RESULTS=()

gate() {
  local id="$1"
  local desc="$2"
  local result="$3"  # PASS or FAIL
  local detail="${4:-}"

  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    RESULTS+=("  ✅ $id — $desc${detail:+ ($detail)}")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("  ❌ $id — $desc${detail:+ → $detail}")
  fi
}

echo ""
echo "══════════════════════════════════════════════════════"
echo "  바로 Go 스쿼드 — 품질 게이트 검증"
echo "══════════════════════════════════════════════════════"
echo ""

# G1 — 빌드 성공
if npm run build --silent 2>&1 | tail -5 | grep -q "error\|Error"; then
  gate "G1" "빌드 성공" "FAIL" "build error"
elif npm run build --silent 2>/dev/null; then
  gate "G1" "빌드 성공" "PASS"
else
  gate "G1" "빌드 성공" "FAIL" "build failed"
fi

# G2 — 번들 크기 40MB 이하
if [ -d "dist" ]; then
  BUILD_SIZE=$(du -sm dist/ 2>/dev/null | cut -f1)
  if [ "$BUILD_SIZE" -lt 40 ]; then
    gate "G2" "번들 크기 40MB 이하" "PASS" "${BUILD_SIZE}MB"
  else
    gate "G2" "번들 크기 40MB 이하" "FAIL" "${BUILD_SIZE}MB > 40MB"
  fi
else
  gate "G2" "번들 크기 40MB 이하" "FAIL" "dist/ 없음"
fi

# G3 — TypeScript 타입 오류 0
if [ ! -f "tsconfig.json" ]; then
  gate "G3" "TypeScript 타입 오류 0" "FAIL" "tsconfig.json 없음"
else
  TS_OUT=$(npx tsc --noEmit 2>&1 || true)
  if echo "$TS_OUT" | grep -q "error TS"; then
    TS_ERRORS=$(echo "$TS_OUT" | grep -c "error TS")
  else
    TS_ERRORS=0
  fi
  if [ "$TS_ERRORS" = "0" ]; then
    gate "G3" "TypeScript 타입 오류 0" "PASS"
  else
    gate "G3" "TypeScript 타입 오류 0" "FAIL" "${TS_ERRORS}개 오류"
  fi
fi

# G4 — 핵심 시스템 파일 존재
REQUIRED_FILES=(
  "src/game/Game.ts"
  "src/game/GameLoop.ts"
  "src/game/SceneBootstrap.ts"
  "src/game/RendererFactory.ts"
  "src/game/InputController.ts"
  "src/game/CameraController.ts"
  "src/game/systems/SquadSystem.ts"
  "src/game/systems/GateSystem.ts"
  "src/game/systems/ShootingSystem.ts"
  "src/game/systems/MonsterWaveSystem.ts"
  "src/game/systems/CollisionSystem.ts"
  "src/game/systems/BossSystem.ts"
  "src/game/systems/ObstacleSystem.ts"
  "src/game/systems/SoldierVisualKit.ts"
  "src/game/systems/FXSystem.ts"
  "src/game/systems/AudioSystem.ts"
  "src/game/systems/QualitySystem.ts"
  "src/game/pools/ObjectPool.ts"
  "src/game/pools/MonsterPool.ts"
  "src/game/data/levelData.ts"
  "src/game/data/gateData.ts"
  "src/game/data/monsterData.ts"
  "src/game/data/soldierData.ts"
  "src/ui/LoadingScreen.ts"
  "src/ui/StartScreen.ts"
  "src/ui/Hud.ts"
  "src/ui/ResultScreen.ts"
  "src/app/App.ts"
  "vercel.json"
)
G4_FAIL=0
G4_MISSING=()
for f in "${REQUIRED_FILES[@]}"; do
  [ -f "$f" ] || { G4_FAIL=1; G4_MISSING+=("$f"); }
done
if [ "$G4_FAIL" = "0" ]; then
  gate "G4" "핵심 시스템 파일 존재 (${#REQUIRED_FILES[@]}개)" "PASS"
else
  gate "G4" "핵심 시스템 파일 존재" "FAIL" "${#G4_MISSING[@]}개 누락: ${G4_MISSING[*]}"
fi

# G5 — SquadSystem 인터페이스
if [ -f "src/game/systems/SquadSystem.ts" ]; then
  if grep -q "addSoldiers" src/game/systems/SquadSystem.ts && \
     grep -q "removeSoldiers" src/game/systems/SquadSystem.ts && \
     grep -q "soldierCount" src/game/systems/SquadSystem.ts && \
     grep -q "squadX" src/game/systems/SquadSystem.ts && \
     grep -q "squadZ" src/game/systems/SquadSystem.ts; then
    gate "G5" "SquadSystem 인터페이스 완비" "PASS"
  else
    gate "G5" "SquadSystem 인터페이스 완비" "FAIL" "addSoldiers/removeSoldiers/soldierCount/squadX/squadZ 중 누락"
  fi
else
  gate "G5" "SquadSystem 인터페이스 완비" "FAIL" "파일 없음"
fi

if [ -f "src/game/data/gateData.ts" ]; then
  if grep -q "ADD_SOLDIER" src/game/data/gateData.ts && \
     grep -q "MULTIPLY_SOLDIER" src/game/data/gateData.ts && \
     grep -q "ATTACK_UP" src/game/data/gateData.ts && \
     grep -q "UNUSED_GATE_CONFIGS" src/game/data/gateData.ts && \
     ! grep -q "FIRE_RATE_UP" src/game/data/gateData.ts && \
     ! grep -q "RANGE_UP" src/game/data/gateData.ts && \
     ! grep -q "EXPLOSION_UP" src/game/data/gateData.ts && \
     ! grep -q "PIERCE_UP" src/game/data/gateData.ts; then
    gate "G6" "GateSystem 성장 게이트 타입" "PASS"
  else
    gate "G6" "GateSystem 성장 게이트 타입" "FAIL" "ADD/MULTIPLY/UPGRADE 활성화 또는 FIRE/RANGE/EXPLOSION/PIERCE 비활성 처리 누락"
  fi
else
  gate "G6" "GateSystem 성장 게이트 타입" "FAIL" "파일 없음"
fi

if [ -f "scripts/check-first-gate-choice-qa.mjs" ] && \
   grep -q '{ z: 38, leftGateId: "gate_add1", rightGateId: "gate_upgrade" }' src/game/data/gateData.ts && \
   grep -q "First gate" DESIGN.md && \
   grep -q "first-gate-upgrade-feedback-mobile.png" scripts/check-first-gate-choice-qa.mjs && \
   npm run test:first-gate --silent >/dev/null; then
  gate "G52" "첫 게이트 즉시 체감 보상 QA" "PASS"
else
  gate "G52" "첫 게이트 즉시 체감 보상 QA" "FAIL" "first gate +1/UPGRADE, HUD popup/stat feedback real-browser QA 실패"
fi

if [ -f "scripts/check-advanced-gate-qa.mjs" ] && \
   grep -q "UNUSED_GATE_CONFIGS" src/game/data/gateData.ts && \
   grep -q "FIRE +20%" src/game/data/gateData.ts && \
   grep -q "RANGE +20%" src/game/data/gateData.ts && \
   grep -q "EXPLOSION" src/game/data/gateData.ts && \
   grep -q "PIERCE" src/game/data/gateData.ts && \
   ! grep -q "applyPierceDamage" src/game/systems/ShootingSystem.ts && \
   ! grep -q "applyExplosionDamage" src/game/systems/ShootingSystem.ts && \
   ! grep -q "explosionGlow" src/game/systems/ProjectileStyling.ts && \
   grep -q "Advanced gates" DESIGN.md && \
   npm run test:advanced-gates --silent >/dev/null; then
  gate "G54" "고급 발사 효과 비활성/업그레이드 전투 QA" "PASS"
else
  gate "G54" "고급 발사 효과 비활성/업그레이드 전투 QA" "FAIL" "FIRE/RANGE/EXPLOSION/PIERCE 미사용 처리 또는 upgrade browser QA 실패"
fi

# G7 — MonsterWaveSystem ObjectPool
if [ -f "src/game/systems/MonsterWaveSystem.ts" ]; then
  if grep -qE "ObjectPool|MonsterPool" src/game/systems/MonsterWaveSystem.ts && \
     grep -qE "getAlive|aliveCount" src/game/systems/MonsterWaveSystem.ts; then
    gate "G7" "MonsterWaveSystem ObjectPool 사용" "PASS"
  else
    gate "G7" "MonsterWaveSystem ObjectPool 사용" "FAIL" "ObjectPool/getAlive 미사용"
  fi
else
  gate "G7" "MonsterWaveSystem ObjectPool 사용" "FAIL" "파일 없음"
fi

if [ -f "src/game/systems/MonsterWaveSystem.ts" ]; then
  if grep -q "MID_BOSS_SPAWN_Z = \\[104, 154, 204, 258, 318\\]" src/game/systems/MonsterWaveSystem.ts && \
     grep -q "isMidBossSpawn" src/game/systems/MonsterWaveSystem.ts && \
     grep -q "MONSTER_CONFIGS.tank" src/game/systems/MonsterWaveSystem.ts && \
     grep -q "speed: 0.12" src/game/data/monsterData.ts && \
     ! grep -q "SEGMENT_TYPES.boss" src/game/data/levelData.ts; then
    gate "G8" "일반 웨이브 내 중간보스 5회 등장" "PASS"
  else
    gate "G8" "일반 웨이브 내 중간보스 5회 등장" "FAIL" "25% 이후 5회 tank wave spawn 또는 boss segment 제거 누락"
  fi
else
  gate "G8" "일반 웨이브 내 중간보스 5회 등장" "FAIL" "파일 없음"
fi

# G9 — FXSystem 파티클 3종
if [ -f "src/game/systems/FXSystem.ts" ]; then
  if grep -q "playHitSpark" src/game/systems/FXSystem.ts && \
     grep -q "playExplosion" src/game/systems/FXSystem.ts && \
     grep -q "playGateEffect" src/game/systems/FXSystem.ts; then
    gate "G9" "FXSystem 파티클 3종 구현" "PASS"
  else
    gate "G9" "FXSystem 파티클 3종 구현" "FAIL" "playHitSpark/playExplosion/playGateEffect 중 누락"
  fi
else
  gate "G9" "FXSystem 파티클 3종 구현" "FAIL" "파일 없음"
fi

# G10 — QualitySystem FPS 자동 감지
if [ -f "src/game/systems/QualitySystem.ts" ]; then
  if grep -qE "autoDetect|measureFPS" src/game/systems/QualitySystem.ts && \
     grep -q "renderScale" src/game/systems/QualitySystem.ts && \
     grep -qE "'low'|\"low\"|low:" src/game/systems/QualitySystem.ts && \
     grep -q "capAutoLevelForViewport" src/game/systems/QualitySystem.ts && \
     grep -q "PORTRAIT_AUTO_HIGH_WIDTH" src/game/systems/QualitySystem.ts; then
    gate "G10" "QualitySystem FPS 자동 품질 조정" "PASS"
  else
    gate "G10" "QualitySystem FPS 자동 품질 조정" "FAIL" "autoDetect/renderScale/low/portrait mobile cap 중 누락"
  fi
else
  gate "G10" "QualitySystem FPS 자동 품질 조정" "FAIL" "파일 없음"
fi

if [ -f "src/ui/Hud.ts" ]; then
  if grep -qE "soldier|soldierCount" src/ui/Hud.ts && \
     grep -qE "progress|stage|Progress" src/ui/Hud.ts && \
     grep -q "hud-command-strip" src/ui/Hud.ts && \
     grep -q "data-role=\"kills\"" src/ui/Hud.ts && \
     grep -q "data-role=\"attack\"" src/ui/Hud.ts && \
     grep -q "data-role=\"upgrade\"" src/ui/Hud.ts && \
     grep -q "data-role=\"stage-fill\"" src/ui/Hud.ts && \
     grep -q "HudStats" src/ui/Hud.ts && \
     grep -q "hud-command-cell" src/styles/global.css && \
     grep -q "hud-stage-track" src/styles/global.css && \
     grep -q "grid-template-columns: auto minmax(112px, 1fr) auto" src/styles/global.css && \
     grep -q "min-height: 32px" src/styles/global.css && \
     grep -q "Mobile clearance" DESIGN.md && \
     grep -q "Kills, ATK, and UPG" DESIGN.md; then
    gate "G11" "HUD 병사수/진행도/공격 강화 표시" "PASS"
  else
    gate "G11" "HUD 병사수/진행도/공격 강화 표시" "FAIL" "soldier/progress/kills/attack/upgrade/meter/mobile-clearance 중 누락"
  fi
else
  gate "G11" "HUD 병사수/진행도/공격 강화 표시" "FAIL" "파일 없음"
fi

if [ -f "scripts/check-loading-screen-qa.mjs" ] && \
   grep -q "MISSION BOOT" src/ui/LoadingScreen.ts && \
   grep -q "role=\"progressbar\"" src/ui/LoadingScreen.ts && \
   grep -q "stageForProgress" src/ui/LoadingScreen.ts && \
   grep -q ".loading-metrics" src/styles/global.css && \
   grep -q "Loading QA" DESIGN.md && \
   grep -q "loading-screen-mobile.png" scripts/check-loading-screen-qa.mjs && \
   npm run test:loading --silent >/dev/null; then
  gate "G59" "초기 로딩 화면/준비 완료 진입 실브라우저 QA" "PASS"
else
  gate "G59" "초기 로딩 화면/준비 완료 진입 실브라우저 QA" "FAIL" "loading progressbar, boot copy, mobile screenshot, ready-to-start 진입 검증 실패"
fi

if [ -f "scripts/check-start-countdown-qa.mjs" ] && \
   grep -q "COUNTDOWN_VALUES = \\[3, 2, 1\\]" src/ui/PreGameCountdown.ts && \
   grep -q "COUNTDOWN_STEP_MS = 1000" src/ui/PreGameCountdown.ts && \
   grep -q "runPrepare" src/ui/PreGameCountdown.ts && \
   grep -q "full 3-2-1 countdown" DESIGN.md && \
   npm run test:start-countdown --silent >/dev/null; then
  gate "G60" "시작 버튼 후 준비 카운트다운 체감 대기 QA" "PASS"
else
  gate "G60" "시작 버튼 후 준비 카운트다운 체감 대기 QA" "FAIL" "countdown 즉시 표시, 3→2→1 전체 진행, 조기 시작 방지 실브라우저 QA 실패"
fi

if [ -f "scripts/check-pause-qa.mjs" ] && \
   grep -q "data-role=\"pause\"" src/ui/PauseControl.ts && \
   grep -q "data-role=\"pause-panel\"" src/ui/PauseControl.ts && \
   grep -q "this.control.setPaused(paused)" src/game/GamePause.ts && \
   grep -q "if (this.pause.paused)" src/game/Game.ts && \
   grep -q "pause-button" src/styles/global.css && \
   grep -q "pause-panel" src/styles/global.css && \
   grep -q "Pause control QA" DESIGN.md && \
   npm run test:pause --silent >/dev/null; then
  gate "G57" "전투 HUD 일시정지/재개 실브라우저 QA" "PASS"
else
  gate "G57" "전투 HUD 일시정지/재개 실브라우저 QA" "FAIL" "pause button, paused overlay, frozen progress/kills, resume browser QA 실패"
fi

# G12 — ResultScreen polished debrief
if [ -f "src/ui/ResultScreen.ts" ]; then
  if grep -qiE "victory|VICTORY" src/ui/ResultScreen.ts && \
     grep -qiE "defeat|DEFEAT" src/ui/ResultScreen.ts && \
     grep -qiE "retry|onRetry" src/ui/ResultScreen.ts && \
     grep -q "onNext" src/ui/ResultScreen.ts && \
     grep -q "shareResult" src/ui/ResultScreen.ts && \
     grep -q "result-actions" src/ui/ResultScreen.ts && \
     grep -q "next-btn" src/ui/ResultScreen.ts && \
     grep -q "share-btn" src/ui/ResultScreen.ts && \
     grep -q "data-role=\"share-status\"" src/ui/ResultScreen.ts && \
     grep -q "result-rank" src/ui/ResultScreen.ts && \
     grep -q "result-medal" src/ui/ResultScreen.ts && \
     grep -q "result-summary" src/ui/ResultScreen.ts && \
     grep -q "result-report" src/ui/ResultScreen.ts && \
     grep -q "result-callout" src/ui/ResultScreen.ts && \
     grep -q "getGrade" src/ui/ResultScreen.ts && \
     grep -q "COMMAND GRADE" src/ui/ResultScreen.ts && \
     grep -q "result-meter-fill" src/ui/ResultScreen.ts && \
     grep -q "RESULT_SCORE_TARGET" src/ui/ResultScreen.ts && \
     grep -q "result-stat-card" src/styles/global.css && \
     grep -q "result-report-row" src/styles/global.css && \
     grep -q "result-callout" src/styles/global.css && \
     grep -q "result-actions" src/styles/global.css && \
     grep -q "result-share-status" src/styles/global.css && \
     grep -q "max-height: calc(100dvh - 24px)" src/styles/global.css && \
     grep -q "grid-template-columns: repeat(3, minmax(0, 1fr))" src/styles/global.css && \
     grep -q "flex-basis: min(100%, 300px)" src/styles/global.css && \
     grep -q "command grade medal" DESIGN.md && \
     grep -q "Retry/Next/Share command row" DESIGN.md; then
    gate "G12" "ResultScreen Victory/Defeat/Retry/Next/Share debrief" "PASS"
  else
    gate "G12" "ResultScreen Victory/Defeat/Retry/Next/Share debrief" "FAIL" "Victory/Defeat/Retry/Next/Share/rank/summary/meter/stat-card/grade-report/mobile-fit 중 누락"
  fi
else
  gate "G12" "ResultScreen Victory/Defeat/Retry/Next/Share debrief" "FAIL" "파일 없음"
fi

# G13 — vercel.json 캐싱
if [ -f "vercel.json" ]; then
  if grep -qE "Cache-Control|max-age" vercel.json; then
    gate "G13" "vercel.json 캐싱 설정" "PASS"
  else
    gate "G13" "vercel.json 캐싱 설정" "FAIL" "Cache-Control/max-age 없음"
  fi
else
  gate "G13" "vercel.json 캐싱 설정" "FAIL" "파일 없음"
fi

# G14 — InputController 터치+마우스+키
if [ -f "src/game/InputController.ts" ]; then
  if grep -qE "pointerdown|touchstart" src/game/InputController.ts && \
     grep -qE "pointermove|touchmove" src/game/InputController.ts && \
     grep -qE "ArrowLeft|keydown" src/game/InputController.ts; then
    gate "G14" "InputController 터치/마우스/키 지원" "PASS"
  else
    gate "G14" "InputController 터치/마우스/키 지원" "FAIL" "pointer/touch/key 이벤트 중 누락"
  fi
else
  gate "G14" "InputController 터치/마우스/키 지원" "FAIL" "파일 없음"
fi

# G15 — App 상태머신 완전성
if [ -f "src/app/App.ts" ]; then
  if grep -qE "loading|start|playing|result" src/app/App.ts && \
     grep -q "transitionTo" src/app/App.ts && \
     grep -q "mission-strip" src/ui/StartScreen.ts && \
     grep -q "Run briefing" src/ui/StartScreen.ts && \
     grep -q "gsap.fromTo(missionStrip" src/ui/StartScreen.ts && \
     grep -q "#start-screen::before" src/styles/global.css && \
     grep -q ".mission-strip strong" src/styles/global.css && \
     grep -q "Mission strip" DESIGN.md; then
    gate "G15" "App 상태머신 loading→start→playing→result" "PASS"
  else
    gate "G15" "App 상태머신 loading→start→playing→result" "FAIL" "상태 전환/start mission strip/진입 애니메이션 누락"
  fi
else
  gate "G15" "App 상태머신 loading→start→playing→result" "FAIL" "파일 없음"
fi

if [ -f "docs/lastwar-quality-upgrade-plan.md" ] && \
   grep -q "P0-1. 전장 환경 세트피스" docs/lastwar-quality-upgrade-plan.md && \
   grep -q "P1-1. 총알과 머즐 플래시" docs/lastwar-quality-upgrade-plan.md; then
  gate "G16" "Last War급 품질 설계 문서 추적" "PASS"
else
  gate "G16" "Last War급 품질 설계 문서 추적" "FAIL" "docs/lastwar-quality-upgrade-plan.md 기준 누락"
fi

if grep -q "water_plane" src/game/SceneEnvironment.ts && \
   grep -q "side_wall" src/game/SceneEnvironment.ts && \
   grep -q "container_" src/game/SceneEnvironment.ts && \
   grep -q "warning_strip" src/game/SceneEnvironment.ts && \
   grep -q "addAuthoredEnvironmentSetpieces" src/game/EnvironmentSetpieces.ts && \
   grep -q "authored_road_segment" src/game/EnvironmentSetpieces.ts && \
   ! grep -q "authored_gate_frame" src/game/EnvironmentSetpieces.ts && \
   grep -q "addAuthoredEnvironmentSetpieces" src/game/Game.ts; then
  gate "G17" "전장 환경 수면/방벽/컨테이너/경고 스트립" "PASS"
else
  gate "G17" "전장 환경 수면/방벽/컨테이너/경고 스트립" "FAIL" "환경 세트피스/도로 authored layer 또는 gate frame 비활성 정책 누락"
fi

if grep -q "road_panel_seam" src/game/SceneEnvironment.ts && \
   grep -q "road_wear_patch" src/game/SceneEnvironment.ts && \
   grep -q "lane_reflector" src/game/SceneEnvironment.ts && \
   grep -q "barrier_cap" src/game/SceneEnvironment.ts && \
   grep -q "freezeEnvironmentMeshes" src/game/SceneEnvironment.ts && \
   grep -q "freezeWorldMatrix" src/game/SceneEnvironment.ts; then
  gate "G37" "도로 패널/마모/반사등/방벽 캡 전장 밀도" "PASS"
else
  gate "G37" "도로 패널/마모/반사등/방벽 캡 전장 밀도" "FAIL" "road detail setpiece/static freeze 누락"
fi

if grep -q "addImpulse" src/game/CameraController.ts && \
   grep -q "impulseTime" src/game/CameraController.ts && \
   grep -q "CAMERA_HEIGHT" src/game/CameraController.ts && \
   grep -q "CAMERA_LOOKAHEAD" src/game/CameraController.ts && \
   grep -q "CAMERA_FOV" src/game/CameraController.ts && \
   grep -q "PORTRAIT_ASPECT_THRESHOLD" src/game/CameraController.ts && \
   grep -q "CameraFollowTarget" src/game/CameraController.ts && \
   grep -q "GATE_FOCUS_FOV_REDUCTION" src/game/CameraController.ts && \
   grep -q "COMBAT_FOCUS_LOOKAHEAD" src/game/CameraController.ts && \
   grep -q "getApproachFocus" src/game/systems/GateSystem.ts && \
   grep -q "GATE_CAMERA_FOCUS_DISTANCE = 12" src/game/systems/GateSystem.ts && \
   grep -q "this.gates.getApproachFocus(this.squad.squadZ)" src/game/Game.ts && \
   grep -q "Camera focus QA" DESIGN.md && \
   grep -q "camera.addImpulse" src/game/Game.ts && \
   npm run test:camera-focus --silent >/dev/null; then
  gate "G18" "카메라 임펄스/게이트 포커스/전투 구도" "PASS"
else
  gate "G18" "카메라 임펄스/게이트 포커스/전투 구도" "FAIL" "CameraController/Game/GateSystem focus 및 QA 연결 누락"
fi

if grep -q "variantScale" src/game/pools/MonsterPool.ts && \
   grep -q "swayAmplitude" src/game/pools/MonsterPool.ts && \
   grep -q "getScatter" src/game/systems/MonsterWaveSystem.ts; then
  gate "G19" "몬스터 크기/흔들림/산포 변주" "PASS"
else
  gate "G19" "몬스터 크기/흔들림/산포 변주" "FAIL" "variantScale/sway/getScatter 누락"
fi

if grep -q "playDeathBurst" src/game/systems/FXSystem.ts && \
   grep -q "playDeathSquash" src/game/systems/FXSystem.ts && \
   grep -q "\"deathSquash\"" src/game/systems/FXSystem.ts && \
   grep -q "DEATH_SQUASH_DURATION = 0.16" src/game/systems/FXSystem.ts && \
   grep -q "DEATH_SQUASH_BASE_SCALE = 0.24" src/game/systems/FXSystem.ts && \
   grep -q "playCollapseAfterimage" src/game/systems/FXSystem.ts && \
   grep -q "\"collapse\"" src/game/systems/FXSystem.ts && \
   grep -q "DEATH_SMOKE_PARTICLE_COUNT = 3" src/game/systems/FXSystem.ts && \
   grep -q "DEATH_SMOKE_BASE_SCALE = 0.082" src/game/systems/FXSystem.ts && \
   grep -q "DEATH_SMOKE_DRIFT_Y = 0.14" src/game/systems/FXSystem.ts && \
   grep -q "kind === \"death\" ? 0.3" src/game/systems/FXSystem.ts && \
   grep -q "without covering the squad" DESIGN.md && \
   grep -q "for (let index = 0; index < 5" src/game/systems/FXSystem.ts && \
   grep -q "hitPulse" src/game/pools/MonsterPool.ts && \
   grep -q "markHit" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "HIT_PULSE_DURATION = 0.12" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "this.waves.markHit(target)" src/game/systems/ShootingSystem.ts && \
   grep -q "playChainPop" src/game/systems/FXSystem.ts && \
   grep -q "\"chain\"" src/game/systems/FXSystem.ts && \
   grep -q "playReinforcementBurst" src/game/systems/FXSystem.ts && \
   grep -q "\"reinforce\"" src/game/systems/FXSystem.ts && \
   grep -q "Chain pop" DESIGN.md && \
   grep -q "Reinforcement" DESIGN.md && \
   grep -q "playDeathBurst" src/game/Game.ts && \
   grep -q "playChainPop" src/game/Game.ts && \
   grep -q "playReinforcementBurst" src/game/Game.ts; then
  gate "G20" "피격/사망 layered FX" "PASS"
else
  gate "G20" "피격/사망 layered FX" "FAIL" "hit/death/chain/reinforcement layered FX 연결 누락"
fi

if grep -q "showCombo" src/ui/Hud.ts && \
   grep -q "hud-combo" src/styles/global.css && \
   grep -q "showCombo" src/game/Game.ts; then
  gate "G21" "HUD kill combo 보상 피드백" "PASS"
else
  gate "G21" "HUD kill combo 보상 피드백" "FAIL" "showCombo/hud-combo 연결 누락"
fi

if grep -q "travelDistance" src/game/systems/ProjectileSystem.ts && \
   grep -q "remainingDistance" src/game/systems/ProjectileSystem.ts && \
   grep -q "onImpact" src/game/systems/ProjectileSystem.ts && \
   grep -q "setPredictedImpactPoint" src/game/systems/ShootingSystem.ts && \
   grep -q "calculateLeadSeconds" src/game/systems/ShootingSystem.ts && \
   grep -q "MAX_TARGET_LEAD_SECONDS" src/game/systems/ShootingSystem.ts && \
   grep -q "PREFERRED_TARGET_RANGE_RATIO" src/game/systems/ShootingSystem.ts && \
   grep -q "MIN_VISUAL_TARGET_DISTANCE" src/game/systems/ShootingSystem.ts && \
   grep -q "CLOSE_TARGET_PENALTY" src/game/systems/ShootingSystem.ts && \
   grep -q "BULLET_FLASH_MIN_ALPHA" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_TRAIL_MIN_ALPHA" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_FRAME_VISIBILITY_SECONDS" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_TAIL_CLEAR_RATIO" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_TAIL_CLEAR_MIN_DISTANCE" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_POST_IMPACT_HEAD_FADE_DISTANCE" src/game/systems/ProjectileMotion.ts && \
   grep -q "impactTriggered" src/game/systems/ProjectileSystem.ts && \
   grep -q "tailClearDistance" src/game/systems/ProjectileSystem.ts && \
   grep -q "impactHeadFade" src/game/systems/ProjectileSystem.ts && \
   grep -q "bulletSpeed: 68" src/game/data/soldierData.ts && \
   grep -q "BULLET_IMPACT_VISUAL_SYNC_TOLERANCE" src/game/systems/ShootingSystem.ts && \
   grep -q "this.shotImpact" src/game/systems/ShootingSystem.ts && \
   grep -q "this.shotTo.copyFrom(this.shotImpact)" src/game/systems/ShootingSystem.ts && \
   grep -q "this.shotFrom.x" src/game/systems/ShootingSystem.ts && \
   grep -q "soldierCapacity \\* 16" src/game/Game.ts && \
   grep -q "SOLDIER_MUZZLE_OFFSET" src/game/systems/SquadSystem.ts && \
   grep -q "getMuzzlePositions" src/game/systems/SquadSystem.ts && \
   grep -q "getMuzzlePositions()" src/game/systems/ShootingSystem.ts && \
   grep -q "getProjectileMotionMetrics" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_VISUAL_LENGTH = 6.2" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_FRAME_VISIBILITY_SECONDS = 0.28" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_WAKE_FAR_OFFSET_RATIO = 2.35" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_TAIL_CLEAR_MIN_DISTANCE = 3" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_TRAIL_ALPHA = 0.108" src/game/systems/ProjectileMotion.ts && \
   grep -q "BULLET_WAKE_ALPHA = 0.18" src/game/systems/ProjectileMotion.ts && \
   grep -q "SOLDIER_FORMATION_SPACING = 0.78" src/game/systems/SquadSystem.ts && \
   grep -q "rowShift" src/game/systems/SquadSystem.ts && \
   grep -q "maxPreImpactTravelRatio" src/game/systems/ProjectileDebug.ts && \
   grep -q "minPreImpactHeadAlpha" src/game/systems/ProjectileDebug.ts && \
   grep -q "minPreImpactTrailAlpha" src/game/systems/ProjectileDebug.ts && \
   grep -q "__squadRushProjectileDebug" src/game/systems/ProjectileDebug.ts && \
   grep -q "wakeNear" src/game/systems/ProjectileSystem.ts && \
   grep -q "wakeFar" src/game/systems/ProjectileSystem.ts && \
   grep -q "bullet_wake_near" src/game/systems/ProjectileVisuals.ts && \
   grep -q "bullet_wake_far" src/game/systems/ProjectileVisuals.ts && \
   grep -q "PROJECTILE_STREAK_WIDTH = 0.032" src/game/systems/ProjectileVisuals.ts && \
   grep -q "PROJECTILE_WAKE_NEAR_DIAMETER = 0.13" src/game/systems/ProjectileVisuals.ts && \
   grep -q "PROJECTILE_WAKE_FAR_DIAMETER = 0.1" src/game/systems/ProjectileVisuals.ts && \
   grep -q "PROJECTILE_SLUG_DIAMETER = 0.093" src/game/systems/ProjectileVisuals.ts && \
   grep -q "PROJECTILE_SLUG_LENGTH = 0.45" src/game/systems/ProjectileVisuals.ts && \
   grep -q "PROJECTILE_CORE_DIAMETER = 0.13" src/game/systems/ProjectileVisuals.ts && \
   grep -q "PROJECTILE_FLASH_DIAMETER = 0.24" src/game/systems/ProjectileVisuals.ts && \
   grep -q "maxPreImpactHeadWorldAdvance" src/game/systems/ProjectileDebug.ts && \
   grep -q "maxNearImpactVisibleRatio" src/game/systems/ProjectileDebug.ts && \
   grep -q "maxPostImpactDistance" src/game/systems/ProjectileDebug.ts && \
   grep -q "Math.max(0, target.velocityZ \\* travelSeconds)" src/game/systems/ShootingSystem.ts && \
   grep -q "targetFrontZ" src/game/systems/ShootingSystem.ts && \
   grep -q "MONSTER_FRONT_CLEARANCE_RATIO" src/game/systems/ShootingSystem.ts && \
   grep -q "IMPACT_FLASH_DURATION_SECONDS" src/game/systems/ProjectileSystem.ts && \
   grep -q "impactPool" src/game/systems/ProjectileSystem.ts && \
   grep -q "playImpactFlash(trail)" src/game/systems/ProjectileSystem.ts && \
   grep -q "impactDistance" src/game/systems/ProjectileSystem.ts && \
   grep -q "maxVisualHeadWorldAdvance" src/game/systems/ProjectileDebug.ts && \
   grep -q "createImpactFlash" src/game/systems/ProjectileVisuals.ts && \
   npm run test:projectile --silent >/dev/null; then
  gate "G22" "발사체 목표 도착/시각 사거리 동기화" "PASS"
else
  gate "G22" "발사체 목표 도착/시각 사거리 동기화" "FAIL" "forward visual reach/impact/tail-clear/pool headroom/projectile visibility regression 누락"
fi

if [ -f "scripts/check-asset-license-qa.mjs" ] && \
   grep -q "public/assets/models/soldier.gltf" scripts/check-asset-license-qa.mjs && \
   grep -q "Commercial use: yes" public/assets/LICENSES.md && \
   grep -q "Adobe Mixamo FAQ" public/assets/LICENSES.md && \
   grep -q "Quaternius Ultimate Monsters" public/assets/LICENSES.md && \
   grep -q "Kenney support/license guidance" public/assets/LICENSES.md && \
   npm run test:assets --silent >/dev/null; then
  gate "G23" "실제 GLTF 리소스와 라이선스 매니페스트" "PASS"
else
  gate "G23" "실제 GLTF 리소스와 라이선스 매니페스트" "FAIL" "runtime asset structure/license/commercial-use/provenance 검증 실패"
fi

if [ -f "scripts/check-resource-budget-qa.mjs" ] && \
   grep -q "runtimeBudgetBytes = 8 \\* 1024 \\* 1024" scripts/check-resource-budget-qa.mjs && \
   grep -q "maxSingleAssetBytes = 3 \\* 1024 \\* 1024" scripts/check-resource-budget-qa.mjs && \
   grep -q "maxLooseRasterBytes = 64 \\* 1024" scripts/check-resource-budget-qa.mjs && \
   grep -q "@babylonjs/ktx2decoder" package.json && \
   grep -q "Texture: KTX2/Basis" prd.md && \
   grep -q "Resource budget QA" DESIGN.md && \
   grep -q "lightweight embedded material atlases" DESIGN.md && \
   npm run test:resources --silent >/dev/null; then
  gate "G48" "리소스 예산/KTX2-Basis 준비 QA" "PASS"
else
  gate "G48" "리소스 예산/KTX2-Basis 준비 QA" "FAIL" "8MB runtime budget, 3MB file cap, loose texture cap, KTX2/Basis policy 검증 실패"
fi

if [ -f "scripts/check-monster-lod-qa.mjs" ] && \
   grep -q "MEDIUM_LOD_DISTANCE = 24" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "FAR_LOD_DISTANCE = 42" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "shouldAnimateMonster" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "getLodSkipRate" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "this.quality.animationSkipRate + distanceSkip" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "config?.behavior === MONSTER_CONFIGS.tank.behavior" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "Monster LOD QA" DESIGN.md && \
   npm run test:monster-lod --silent >/dev/null; then
  gate "G49" "원거리 몬스터 LOD/애니메이션 스킵 QA" "PASS"
else
  gate "G49" "원거리 몬스터 LOD/애니메이션 스킵 QA" "FAIL" "quality animationSkipRate, distance LOD, tank fidelity, movement every-frame 검증 실패"
fi

if [ -f "scripts/check-monster-material-qa.mjs" ] && \
   grep -q "monster_slime_body" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_slime_base" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_slime_cap" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "usesAuthoredMonsterVisual" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "return false" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "rounded slime bodies" DESIGN.md && \
   grep -q "very slow forward crawl" DESIGN.md && \
   grep -q "monster_slime_eye" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "segments: 8" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_back_spine" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_variant_fast_side_fin" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_variant_tank_armor_plate" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "small embedded eyes" DESIGN.md && \
   grep -q "fast side fins" DESIGN.md && \
   grep -q "tank armor blobs" DESIGN.md && \
   grep -q "flat red bars" DESIGN.md && \
   grep -q "redThreatRatio" scripts/check-monster-material-qa.mjs && \
   grep -q "orangeCueRatio" scripts/check-monster-material-qa.mjs && \
   grep -q "monster-slime-combat.png" scripts/check-monster-material-qa.mjs && \
   npm run test:monster-materials --silent >/dev/null; then
  gate "G55" "슬라임형 몬스터 실루엣 QA" "PASS"
else
  gate "G55" "슬라임형 몬스터 실루엣 QA" "FAIL" "slime body/base/cues/browser combat capture 검증 실패"
fi

if rg -q "muzzle_flash" src/game/systems/ProjectileSystem.ts src/game/systems/ProjectileVisuals.ts && \
   grep -q "muzzlePool" src/game/systems/ProjectileSystem.ts && \
   grep -q "playMuzzleFlash" src/game/systems/ProjectileSystem.ts && \
   grep -q "SOLDIER_MUZZLE_OFFSET" src/game/systems/SquadSystem.ts && \
   grep -q "getMuzzlePositions()" src/game/systems/ShootingSystem.ts; then
  gate "G24" "총구 마커 기반 머즐 플래시 연출" "PASS"
else
  gate "G24" "총구 마커 기반 머즐 플래시 연출" "FAIL" "muzzle marker/muzzle flash pool/playback 누락"
fi

if grep -q "BulletStyle" src/game/systems/ProjectileSystem.ts && \
   grep -q "configureBulletStyle" src/game/systems/ProjectileSystem.ts && \
   grep -q "configureMuzzleFlash" src/game/systems/ProjectileSystem.ts && \
   grep -q "const power = Math.min" src/game/systems/ProjectileStyling.ts && \
   grep -q "effectiveRange: range" src/game/systems/ShootingSystem.ts && \
   ! grep -q "rangeBoost" src/game/systems/ShootingSystem.ts && \
   ! grep -q "fireBoost" src/game/systems/ShootingSystem.ts; then
  gate "G25" "공격 업그레이드 반응형 탄환 시각 피드백" "PASS"
else
  gate "G25" "공격 업그레이드 반응형 탄환 시각 피드백" "FAIL" "BulletStyle/power/effectiveRange 또는 disabled range/fire 제거 누락"
fi

if grep -q "class AudioSystem" src/game/systems/AudioSystem.ts && \
   grep -q "AudioContext" src/game/systems/AudioSystem.ts && \
   grep -q "unlock()" src/game/systems/AudioSystem.ts && \
   grep -q "startRunAmbience" src/game/systems/AudioSystem.ts && \
   grep -q "updateRunAmbience" src/game/systems/AudioSystem.ts && \
   grep -q "stopRunAmbience" src/game/systems/AudioSystem.ts && \
   grep -q "audio.unlock" src/game/Game.ts && \
   grep -q "audio.updateRunAmbience" src/game/Game.ts && \
   grep -q "Run ambience" DESIGN.md; then
  gate "G26" "브라우저 제스처 기반 오디오 unlock/런 앰비언스" "PASS"
else
  gate "G26" "브라우저 제스처 기반 오디오 unlock/런 앰비언스" "FAIL" "unlock/run ambience 연결 누락"
fi

if grep -q "onShot" src/game/systems/ShootingSystem.ts && \
   grep -q "playShot" src/game/Game.ts && \
   grep -q "playGate" src/game/Game.ts && \
   grep -q "playPickup" src/game/Game.ts && \
   grep -q "playSquadAdd" src/game/Game.ts && \
   grep -q "playResult" src/game/Game.ts && \
   grep -q "Combat events" DESIGN.md; then
  gate "G27" "전투/강화/결과 사운드 이벤트" "PASS"
else
  gate "G27" "전투/강화/결과 사운드 이벤트" "FAIL" "핵심 사운드 이벤트 연결 누락"
fi

if [ -f "scripts/check-audio-asset-qa.mjs" ] && \
   grep -q "new Howl" src/game/systems/AudioSampleBank.ts && \
   grep -q "pool:" src/game/systems/AudioSampleBank.ts && \
   grep -q "rate(" src/game/systems/AudioSampleBank.ts && \
   grep -q "/assets/audio/" src/game/systems/AudioSampleBank.ts && \
   grep -q "AudioSampleBank" src/game/systems/AudioSystem.ts && \
   grep -q "Runtime Audio Assets" public/assets/LICENSES.md && \
   grep -q "Audio asset QA" DESIGN.md && \
   npm run test:audio-assets --silent >/dev/null; then
  gate "G51" "Howler mp3/ogg 사운드 리소스 QA" "PASS"
else
  gate "G51" "Howler mp3/ogg 사운드 리소스 QA" "FAIL" "mp3/ogg cues, Howler pooling, pitch variation, provenance 검증 실패"
fi

if grep -q "attachSoldierRoleKit" src/game/systems/SquadSystem.ts && \
   grep -q "soldier_role_weapon" src/game/systems/SoldierVisualKit.ts && \
   grep -q "soldier_role_heavy_pack" src/game/systems/SoldierVisualKit.ts && \
   grep -q "soldier_role_scout_antenna" src/game/systems/SoldierVisualKit.ts; then
  gate "G28" "병사 rifle/heavy/scout 역할 장비 변주" "PASS"
else
  gate "G28" "병사 rifle/heavy/scout 역할 장비 변주" "FAIL" "SoldierVisualKit 역할 장비 누락"
fi

if grep -q "monster_slime_body" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_slime_base" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_variant_fast" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_variant_tank" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monster_slime_eye" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "usesAuthoredMonsterVisual" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "monsterFastAsset" src/game/Game.ts && \
   grep -q "MONSTER_BEHAVIORS.fast" src/game/pools/MonsterPool.ts; then
  gate "G29" "몬스터 Basic/Fast/Tank 실루엣 구분" "PASS"
else
  gate "G29" "몬스터 Basic/Fast/Tank 실루엣 구분" "FAIL" "slime body/base/fast/tank/accessory guard 누락"
fi

if grep -q "gate_floor_pad" src/game/systems/GateSystem.ts && \
   grep -q "gate_choice_pad" src/game/systems/GateSystem.ts && \
   grep -q "gate_overhead_beam" src/game/systems/GateSystem.ts && \
   grep -q "gate_anchor_pylon" src/game/systems/GateSystem.ts && \
   grep -q "gate_label_backplate" src/game/systems/GateSystem.ts && \
   grep -q "gate_energy_ring" src/game/systems/GateSystem.ts && \
   grep -q "gate_choice_arrow" src/game/systems/GateSystem.ts && \
   grep -q "gate_depth_plate" src/game/systems/GateSystem.ts && \
   grep -q "BILLBOARDMODE_ALL" src/game/systems/GateSystem.ts && \
   grep -q "animateGate" src/game/systems/GateSystem.ts; then
  gate "G30" "게이트 3D 구조물/선택 유도 연출" "PASS"
else
  gate "G30" "게이트 3D 구조물/선택 유도 연출" "FAIL" "gate pad/beam/pylon/backplate/billboard/ring/arrow/depth animation 누락"
fi

if grep -q "MID_BOSS_SPAWN_Z = \\[104, 154, 204, 258, 318\\]" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "MONSTER_CONFIGS.tank" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "hp: 42" src/game/data/monsterData.ts && \
   grep -q "speed: 0.12" src/game/data/monsterData.ts && \
   grep -q "monster_variant_tank" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "Mid-boss" DESIGN.md && \
   ! grep -q "showBossWarning" src/ui/Hud.ts && \
   ! grep -q "bossHpVisible" src/ui/Hud.ts; then
  gate "G31" "중간보스 일반 웨이브 혼합 등장" "PASS"
else
  gate "G31" "중간보스 일반 웨이브 혼합 등장" "FAIL" "5회 tank wave spawn 또는 boss HUD 비활성 처리 누락"
fi

if [ -f "scripts/check-boss-peak-qa.mjs" ] && \
   grep -q "mid-boss-wave-mobile.png" scripts/check-boss-peak-qa.mjs && \
   grep -q "MID_BOSS_SPAWN_Z" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "Boss peak QA" DESIGN.md && \
   npm run test:boss-peak --silent >/dev/null; then
  gate "G50" "중간보스 웨이브 혼합 실브라우저 QA" "PASS"
else
  gate "G50" "중간보스 웨이브 혼합 실브라우저 QA" "FAIL" "mid-boss wave screenshot, no warning/HUD, FPS, overflow 검증 실패"
fi

if grep -q "MAX_FRAME_DELTA_SECONDS = 0.2" src/game/GameLoop.ts && \
   grep -q "MAX_FRAME_CATCHUP_SECONDS = 0.5" src/game/GameLoop.ts && \
   grep -q "lastFrameTime = performance.now" src/game/GameLoop.ts && \
   grep -q "const now = performance.now" src/game/GameLoop.ts && \
   grep -q "let remainingTime = Math.min((now - this.lastFrameTime) / 1000, MAX_FRAME_CATCHUP_SECONDS)" src/game/GameLoop.ts && \
   grep -q "while (remainingTime > MIN_FRAME_STEP_SECONDS)" src/game/GameLoop.ts && \
   grep -q "Math.min(remainingTime, MAX_FRAME_DELTA_SECONDS)" src/game/GameLoop.ts; then
  gate "G32" "저FPS에서도 느린 진행 속도 유지" "PASS"
else
  gate "G32" "저FPS에서도 느린 진행 속도 유지" "FAIL" "bounded catch-up dt loop 누락"
fi

RUN_SECONDS=$(awk '
  /forwardSpeed:/ { gsub(/[^0-9.]/, "", $2); speed=$2 }
  /totalLength:/ { gsub(/[^0-9.]/, "", $2); levelLength=$2 }
  /squadZ =/ { gsub(/[^0-9.]/, "", $3); start=$3 }
  END {
    if (speed > 0 && levelLength > start) {
      printf "%.1f", (levelLength - start) / speed
    }
  }
' src/game/data/levelData.ts src/game/systems/SquadSystem.ts)

if awk "BEGIN { exit !($RUN_SECONDS >= 120 && $RUN_SECONDS <= 180) }" && \
   grep -q "this.result.show(victory" src/game/Game.ts && \
   grep -q "this.state = \"result\"" src/app/App.ts && \
   grep -q "data-role=\"stats\"" src/ui/ResultScreen.ts; then
  gate "G33" "120~180초 완주와 결과 화면 전환" "PASS" "${RUN_SECONDS}s"
else
  gate "G33" "120~180초 완주와 결과 화면 전환" "FAIL" "runSeconds=${RUN_SECONDS:-unknown}, result flow 확인 필요"
fi

if grep -q "onDamage" src/game/systems/ShootingSystem.ts && \
   grep -q "queueDamagePopup" src/game/Game.ts && \
   grep -q "flushDamagePopup" src/game/Game.ts && \
   grep -q "0.25" src/game/Game.ts && \
   grep -q "showDamage" src/ui/Hud.ts && \
   grep -q "hud-damage" src/styles/global.css; then
  gate "G34" "전투 데미지 숫자 집계 피드백" "PASS"
else
  gate "G34" "전투 데미지 숫자 집계 피드백" "FAIL" "onDamage/queue/flush/showDamage/hud-damage 누락"
fi

if grep -q "pickup_crate" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_orb_shell" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_reward_beam" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_orbit_spark" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_compact_label_backplate" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickupSupplyShellMat" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_reward_gem" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_supply_band" src/game/systems/BonusPickupSystem.ts && \
   grep -q "labelBackMat.alpha = 0.28" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_beacon" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_chevron" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_shadow" src/game/systems/BonusPickupSystem.ts && \
   grep -q "BILLBOARDMODE_ALL" src/game/systems/BonusPickupSystem.ts && \
   grep -q "PICKUP_COLLECT_RADIUS_SQUARED = 3.2" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_soldier_reward" src/game/systems/BonusPickupSystem.ts && \
   grep -q "Idle" src/game/systems/PickupSoldierVisual.ts && \
   grep -q "width: 1.72" src/game/systems/BonusPickupSystem.ts && \
   grep -q "diameter: 2.62" src/game/systems/BonusPickupSystem.ts && \
   grep -q "height: 5.2" src/game/systems/BonusPickupSystem.ts && \
   grep -q "idle soldier silhouette" DESIGN.md; then
  gate "G35" "몬스터 흐름 속 보너스 아이템 3D 보상 오브젝트" "PASS"
else
  gate "G35" "몬스터 흐름 속 보너스 아이템 3D 보상 오브젝트" "FAIL" "soldier reward visual 또는 upgrade crate/gem/beam/orbit/backplate/beacon/chevron/shadow/collect-radius 누락"
fi

if [ -f "scripts/check-pickup-readability-qa.mjs" ] && \
   grep -q "pickup-readability-mobile-combat.png" scripts/check-pickup-readability-qa.mjs && \
   grep -q "__squadRushPickupDebug" src/game/systems/BonusPickupSystem.ts && \
   grep -q "pickup_soldier_reward" scripts/check-pickup-readability-qa.mjs && \
   grep -q "pickup_reward_beam" scripts/check-pickup-readability-qa.mjs && \
   grep -q "idle soldier silhouette" DESIGN.md && \
   npm run test:pickups --silent >/dev/null; then
  gate "G56" "보상 아이템 탄환 분리 실브라우저 QA" "PASS"
else
  gate "G56" "보상 아이템 탄환 분리 실브라우저 QA" "FAIL" "pickup soldier reward visual, active-scene debug, mobile screenshot QA 실패"
fi

if [ -f "src/game/systems/ObstacleSystem.ts" ] && \
   grep -q "lane_obstacle_body" src/game/systems/ObstacleSystem.ts && \
   grep -q "lane_obstacle_warning_disc" src/game/systems/ObstacleSystem.ts && \
   grep -q "lane_obstacle_beacon_ring" src/game/systems/ObstacleSystem.ts && \
   grep -q "OBSTACLE_SPAWNS" src/game/systems/ObstacleSystem.ts && \
   grep -q "removeSoldiers" src/game/systems/ObstacleSystem.ts && \
   grep -q "playExplosion" src/game/systems/ObstacleSystem.ts && \
   grep -q "new ObstacleSystem" src/game/Game.ts && \
   grep -q "this.obstacles.update" src/game/Game.ts && \
   grep -q "data-role=\"obstacles\"" src/ui/Hud.ts && \
   grep -q "minObstacles: 1" scripts/check-milestone-qa.mjs && \
   grep -q "Lane hazards" DESIGN.md && \
   npm run test:milestones --silent >/dev/null; then
  gate "G46" "PRD 장애물/회피형 lane hazard QA" "PASS"
else
  gate "G46" "PRD 장애물/회피형 lane hazard QA" "FAIL" "hazard mesh/warning/collision/HUD telemetry/browser milestone 검증 실패"
fi

if grep -q "previousSoldiers" src/ui/Hud.ts && \
   grep -q "punchSoldierCount" src/ui/Hud.ts && \
   grep -q "gsap.killTweensOf(\\[this.soldierWrapEl, this.soldierEl\\])" src/ui/Hud.ts && \
   grep -q "hud-soldiers--gain" src/styles/global.css && \
   grep -q "hud-soldiers--loss" src/styles/global.css; then
  gate "G36" "Squad 숫자 변화 scale punch 보상 피드백" "PASS"
else
  gate "G36" "Squad 숫자 변화 scale punch 보상 피드백" "FAIL" "soldier count punch/color feedback 누락"
fi

if grep -q "SWARM_OFFSET_X" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "HORDE_ROW_DEPTH = 0.31" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "HORDE_STAGGER_DEPTH = 0.06" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "BATCH_LAYER_DEPTH = 0.18" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "count: 7" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "count: 34" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "count: 76" src/game/systems/MonsterWaveSystem.ts && \
   grep -q "spacing: 1.32" src/game/data/monsterData.ts && \
   grep -q "lookAhead: 96" src/game/data/monsterData.ts && \
   grep -q "monster_contact_shadow" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "createMonsterContactShadowMaterial" src/game/pools/MonsterVisualFactory.ts && \
   grep -q "maxMonsters: 140" src/game/systems/QualitySystem.ts && \
   grep -q "maxMonsters: 180" src/game/systems/QualitySystem.ts && \
   grep -q "maxMonsters: 360" src/game/systems/QualitySystem.ts && \
   grep -q "data-role=\"monsters\"" src/ui/Hud.ts && \
   grep -q "minLowQualityHorde = 120" scripts/check-fullrun-qa.mjs && \
   grep -q "rounded slime bodies" DESIGN.md && \
   grep -q "shared contact shadows" DESIGN.md; then
  gate "G38" "Last War식 화면 밀집 몬스터 군집 연출" "PASS"
else
  gate "G38" "Last War식 화면 밀집 몬스터 군집 연출" "FAIL" "overlapped rows/contact shadows/dense early pressure/material readability/quality pool cap 누락"
fi

if [ -f "scripts/check-runtime-qa.mjs" ] && \
   grep -q "chromium.launch({ channel: \"chrome\" })" scripts/check-runtime-qa.mjs && \
   grep -q "runtime-qa-mobile-combat.png" scripts/check-runtime-qa.mjs && \
   grep -q "runtime-qa-desktop-combat.png" scripts/check-runtime-qa.mjs && \
   grep -q "maxMobileCommandHeight" scripts/check-runtime-qa.mjs && \
   grep -q "Runtime QA" DESIGN.md && \
   npm run test:runtime --silent >/dev/null; then
  gate "G39" "Chrome production preview runtime QA" "PASS"
else
  gate "G39" "Chrome production preview runtime QA" "FAIL" "real Chrome smoke/screenshot/console/mobile overflow/HUD runtime 검증 실패"
fi

if [ -f "scripts/check-fullrun-qa.mjs" ] && \
   grep -q "chromium.launch()" scripts/check-fullrun-qa.mjs && \
   grep -q "fullrun-qa-mobile-result.png" scripts/check-fullrun-qa.mjs && \
   grep -q "fullrun-qa-desktop-result.png" scripts/check-fullrun-qa.mjs && \
   grep -q "quality-low-mobile-combat.png" scripts/check-fullrun-qa.mjs && \
   grep -q "quality-medium-mobile-combat.png" scripts/check-fullrun-qa.mjs && \
   grep -q "quality-high-mobile-combat.png" scripts/check-fullrun-qa.mjs && \
   grep -q "readUrlOverride" src/game/systems/QualitySystem.ts && \
   grep -q "quality=low|medium|high" DESIGN.md && \
   grep -q "minRunMs = 30000" scripts/check-fullrun-qa.mjs && \
   grep -q "maxRunMs = 65000" scripts/check-fullrun-qa.mjs && \
   grep -q "resultStats.title === \"VICTORY\"" scripts/check-fullrun-qa.mjs && \
   grep -q "RUN AGAIN" scripts/check-fullrun-qa.mjs && \
   grep -q "NEXT RUN" scripts/check-fullrun-qa.mjs && \
   grep -q "Result share control did not expose share feedback" scripts/check-fullrun-qa.mjs && \
   grep -q "locator(\".share-btn\").click" scripts/check-fullrun-qa.mjs && \
   grep -q "Full-run QA" DESIGN.md && \
   npm run test:fullrun --silent >/dev/null; then
  gate "G40" "Chrome production preview full-run victory QA" "PASS"
else
  gate "G40" "Chrome production preview full-run victory QA" "FAIL" "real Chrome full run/result/victory/debrief/mobile overflow 검증 실패"
fi

if [ -f "scripts/check-milestone-qa.mjs" ] && \
   grep -q "milestone-desktop-start.png" scripts/check-milestone-qa.mjs && \
   grep -q "milestone-desktop-first-gate.png" scripts/check-milestone-qa.mjs && \
   grep -q "milestone-desktop-first-horde.png" scripts/check-milestone-qa.mjs && \
   grep -q "milestone-mobile-start.png" scripts/check-milestone-qa.mjs && \
   grep -q "milestone-mobile-first-horde.png" scripts/check-milestone-qa.mjs && \
   grep -q "__squadRushStartHeroDebug" src/game/StartHeroPreview.ts && \
   grep -q "heroVisible" scripts/check-milestone-qa.mjs && \
   grep -q "heroRole === \"heavy\"" scripts/check-milestone-qa.mjs && \
   grep -q "Start hero preview" DESIGN.md && \
   grep -q "Milestone QA" DESIGN.md && \
   npm run test:milestones --silent >/dev/null; then
  gate "G41" "Chrome production preview milestone/start hero visual QA" "PASS"
else
  gate "G41" "Chrome production preview milestone/start hero visual QA" "FAIL" "start hero/gate/horde desktop/mobile screenshot QA 실패"
fi

if [ -f "scripts/check-webapp-static-qa.mjs" ] && \
   grep -q "manifest.webmanifest" scripts/check-webapp-static-qa.mjs && \
   grep -q "icon-192.svg" scripts/check-webapp-static-qa.mjs && \
   grep -q "mobile-web-app-capable" index.html && \
   grep -q "Web app shell QA" DESIGN.md && \
   npm run test:webapp --silent >/dev/null; then
  gate "G42" "Vercel/static web app shell QA" "PASS"
else
  gate "G42" "Vercel/static web app shell QA" "FAIL" "manifest/icon/mobile meta/cache header/production preview 정적 배포 검증 실패"
fi

if [ -f "scripts/check-commercial-screenshot-qa.mjs" ] && \
   grep -q "colorBuckets" scripts/check-commercial-screenshot-qa.mjs && \
   grep -q "edgeDensity" scripts/check-commercial-screenshot-qa.mjs && \
   grep -q "activeRatio" scripts/check-commercial-screenshot-qa.mjs && \
   grep -q "Commercial screenshot QA" DESIGN.md && \
   npm run test:commercial-screens --silent >/dev/null; then
  gate "G43" "상용품질 스크린샷 색상/밀도 QA" "PASS"
else
  gate "G43" "상용품질 스크린샷 색상/밀도 QA" "FAIL" "milestone/runtime/fullrun PNG의 color/contrast/chroma/edge/active pixel 검증 실패"
fi

if [ -f "scripts/check-renderer-strategy-qa.mjs" ] && \
   grep -q "WebGPUEngine.CreateAsync" src/game/RendererFactory.ts && \
   grep -q "renderer.*webgpu" src/game/RendererFactory.ts && \
   grep -q "falling back to WebGL2" src/game/RendererFactory.ts && \
   grep -q "Renderer strategy QA" DESIGN.md && \
   npm run test:renderer --silent >/dev/null; then
  gate "G44" "WebGL2 기본/WebGPU 옵션 렌더러 QA" "PASS"
else
  gate "G44" "WebGL2 기본/WebGPU 옵션 렌더러 QA" "FAIL" "default WebGL2, ?renderer=webgpu, WebGPU fallback preview 검증 실패"
fi

if [ -f "scripts/check-input-control-qa.mjs" ] && \
   grep -q "data-role=\"lane-x\"" src/ui/Hud.ts && \
   grep -q "KeyD did not move squad right" scripts/check-input-control-qa.mjs && \
   grep -q "Touch drag did not move squad left" scripts/check-input-control-qa.mjs && \
   grep -q "Input control QA" DESIGN.md && \
   npm run test:input --silent >/dev/null; then
  gate "G45" "시작 전 입력 잠금/실제 조작 QA" "PASS"
else
  gate "G45" "시작 전 입력 잠금/실제 조작 QA" "FAIL" "pre-start lock, keyboard/mouse/touch lane movement, scroll drift 검증 실패"
fi

if [ -f "scripts/check-safari-mobile-qa.mjs" ] && \
   grep -q "WEBKIT_MOBILE_PRESETS" src/game/systems/QualitySystem.ts && \
   grep -q "isWebKitMobile" src/game/systems/QualitySystem.ts && \
   grep -q "webkit.launch" scripts/check-safari-mobile-qa.mjs && \
   grep -q "iPhone Safari" scripts/check-safari-mobile-qa.mjs && \
   grep -q "safari-mobile-combat.png" scripts/check-safari-mobile-qa.mjs && \
   grep -q "minSafariFps = 24" scripts/check-safari-mobile-qa.mjs && \
   grep -q "WebKit mobile QA" DESIGN.md && \
   npm run test:safari --silent >/dev/null; then
  gate "G47" "iOS Safari/WebKit 모바일 런타임 QA" "PASS"
else
  gate "G47" "iOS Safari/WebKit 모바일 런타임 QA" "FAIL" "WebKit mobile combat screenshot/FPS/overflow 검증 실패"
fi

if [ -f "scripts/check-firefox-runtime-qa.mjs" ] && \
   grep -q "firefox.launch" scripts/check-firefox-runtime-qa.mjs && \
   grep -q "firefox-desktop-combat.png" scripts/check-firefox-runtime-qa.mjs && \
   grep -q "minRuntimeFps = 24" scripts/check-firefox-runtime-qa.mjs && \
   grep -q "Firefox desktop QA" DESIGN.md && \
   npm run test:firefox --silent >/dev/null; then
  gate "G53" "Firefox Desktop production runtime QA" "PASS"
else
  gate "G53" "Firefox Desktop production runtime QA" "FAIL" "Firefox desktop combat screenshot/FPS/horde density/overflow 검증 실패"
fi

if [ -f "scripts/check-reduced-motion-qa.mjs" ] && \
   grep -q "@media (prefers-reduced-motion: reduce)" src/styles/global.css && \
   grep -q "prefersReducedMotion" src/ui/StartScreen.ts && \
   grep -q "prefersReducedMotion" src/ui/ResultScreen.ts && \
   grep -q "reducedMotion: \"reduce\"" scripts/check-reduced-motion-qa.mjs && \
   grep -q "Reduced motion QA" DESIGN.md && \
   npm run test:reduced-motion --silent >/dev/null; then
  gate "G58" "prefers-reduced-motion 접근성/전투 런타임 QA" "PASS"
else
  gate "G58" "prefers-reduced-motion 접근성/전투 런타임 QA" "FAIL" "CSS media query, JS tween bypass, reduced-motion browser combat QA 실패"
fi

if [ -f "scripts/check-graphics-polish-qa.mjs" ] && \
   grep -q "HIGH_QUALITY_BLOOM_WEIGHT = 0.76" src/game/SceneEnvironment.ts && \
   grep -q "HIGH_QUALITY_BLOOM_THRESHOLD = 0.42" src/game/SceneEnvironment.ts && \
   grep -q "__squadRushGraphicsDebug" src/game/SceneEnvironment.ts && \
   grep -q "GATE_BURST_PARTICLE_COUNT = 64" src/game/systems/FXSystem.ts && \
   grep -q "GATE_RING_PARTICLE_COUNT = 18" src/game/systems/FXSystem.ts && \
   grep -q "GATE_PARTICLE_ALPHA = 0.58" src/game/systems/FXSystem.ts && \
   grep -q "GATE_BURST_BASE_SCALE = 0.1" src/game/systems/FXSystem.ts && \
   grep -q "fx.baseAlpha \\* (1 - age)" src/game/systems/FXSystem.ts && \
   grep -q "lastGateParticleAlpha" scripts/check-graphics-polish-qa.mjs && \
   grep -q "lastGateParticleMaxScale" scripts/check-graphics-polish-qa.mjs && \
   grep -q "__squadRushFxDebug" src/game/systems/FXSystem.ts && \
   grep -q "graphics-polish-gate-burst.png" scripts/check-graphics-polish-qa.mjs && \
   grep -q "Graphics polish QA" DESIGN.md && \
   npm run test:graphics-polish --silent >/dev/null; then
  gate "G60" "고품질 Bloom/게이트 버스트 실브라우저 QA" "PASS"
else
  gate "G60" "고품질 Bloom/게이트 버스트 실브라우저 QA" "FAIL" "high quality bloom debug, layered gate burst screenshot/browser QA 실패"
fi

if [ -f "scripts/check-environment-setpiece-qa.mjs" ] && \
   grep -q "side_service_deck" src/game/EnvironmentSetpieces.ts && \
   ! grep -q "combat_gantry_beam" src/game/EnvironmentSetpieces.ts && \
   grep -q "authored_side_cargo" src/game/EnvironmentSetpieces.ts && \
   grep -q "__squadRushEnvironmentDebug" src/game/EnvironmentSetpieces.ts && \
   grep -q "GATE_VISUAL_SCALE = 0.7" src/game/systems/GateVisualFactory.ts && \
   grep -q "GATE_LEFT_X = -4.2" src/game/systems/GateVisualFactory.ts && \
   grep -q "GATE_RIGHT_X = 4.2" src/game/systems/GateVisualFactory.ts && \
   grep -q "Environment setpiece QA" DESIGN.md && \
   npm run test:environment --silent >/dev/null; then
  gate "G61" "전장 환경 서비스덱/분리 게이트 세트피스 QA" "PASS"
else
  gate "G61" "전장 환경 서비스덱/분리 게이트 세트피스 QA" "FAIL" "side service decks/cargo/authored road/no gate connector browser QA 실패"
fi

# ── 결과 출력 ──────────────────────────────────────────────
echo ""
for r in "${RESULTS[@]}"; do
  echo "$r"
done
echo ""
echo "══════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  결과: ${PASS}/${TOTAL} PASS  |  ${FAIL}/${TOTAL} FAIL"
echo "══════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  품질 게이트 미통과 — 위 FAIL 항목을 수정하고 재실행하세요."
  exit 1
else
  echo "🏆 모든 품질 게이트 통과! Vercel 배포 준비 완료."
  exit 0
fi
