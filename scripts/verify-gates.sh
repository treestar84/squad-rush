#!/usr/bin/env bash
# verify-gates.sh — Squad Rush 품질 게이트 자동 검증
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
echo "  Squad Rush — 품질 게이트 검증"
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
  "src/game/systems/FXSystem.ts"
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

# G6 — GateSystem 게이트 타입
if [ -f "src/game/data/gateData.ts" ]; then
  if grep -q "ADD_SOLDIER" src/game/data/gateData.ts && \
     grep -q "MULTIPLY_SOLDIER" src/game/data/gateData.ts && \
     grep -q "ATTACK_UP" src/game/data/gateData.ts && \
     grep -q "FIRE_RATE_UP" src/game/data/gateData.ts; then
    gate "G6" "GateSystem 4종 게이트 타입" "PASS"
  else
    gate "G6" "GateSystem 4종 게이트 타입" "FAIL" "ADD_SOLDIER/MULTIPLY_SOLDIER/ATTACK_UP/FIRE_RATE_UP 중 누락"
  fi
else
  gate "G6" "GateSystem 4종 게이트 타입" "FAIL" "파일 없음"
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

# G8 — BossSystem HP/공격/사망
if [ -f "src/game/systems/BossSystem.ts" ]; then
  if grep -q "onDeath" src/game/systems/BossSystem.ts && \
     grep -q "getHpRatio" src/game/systems/BossSystem.ts && \
     grep -qE "doAttack|attack|Attack" src/game/systems/BossSystem.ts; then
    gate "G8" "BossSystem HP/공격/사망 구현" "PASS"
  else
    gate "G8" "BossSystem HP/공격/사망 구현" "FAIL" "onDeath/getHpRatio/attack 중 누락"
  fi
else
  gate "G8" "BossSystem HP/공격/사망 구현" "FAIL" "파일 없음"
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
     grep -qE "'low'|\"low\"|low:" src/game/systems/QualitySystem.ts; then
    gate "G10" "QualitySystem FPS 자동 품질 조정" "PASS"
  else
    gate "G10" "QualitySystem FPS 자동 품질 조정" "FAIL" "autoDetect/renderScale/low 중 누락"
  fi
else
  gate "G10" "QualitySystem FPS 자동 품질 조정" "FAIL" "파일 없음"
fi

# G11 — HUD 3요소
if [ -f "src/ui/Hud.ts" ]; then
  if grep -qE "soldier|soldierCount" src/ui/Hud.ts && \
     grep -qE "boss|bossHp|Boss" src/ui/Hud.ts && \
     grep -qE "progress|stage|Progress" src/ui/Hud.ts; then
    gate "G11" "HUD 병사수/보스HP/진행도 표시" "PASS"
  else
    gate "G11" "HUD 병사수/보스HP/진행도 표시" "FAIL" "soldier/boss/progress 중 누락"
  fi
else
  gate "G11" "HUD 병사수/보스HP/진행도 표시" "FAIL" "파일 없음"
fi

# G12 — ResultScreen Victory/Defeat/Retry
if [ -f "src/ui/ResultScreen.ts" ]; then
  if grep -qiE "victory|VICTORY" src/ui/ResultScreen.ts && \
     grep -qiE "defeat|DEFEAT" src/ui/ResultScreen.ts && \
     grep -qiE "retry|onRetry" src/ui/ResultScreen.ts; then
    gate "G12" "ResultScreen Victory/Defeat/Retry" "PASS"
  else
    gate "G12" "ResultScreen Victory/Defeat/Retry" "FAIL" "Victory/Defeat/Retry 중 누락"
  fi
else
  gate "G12" "ResultScreen Victory/Defeat/Retry" "FAIL" "파일 없음"
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
     grep -q "transitionTo" src/app/App.ts; then
    gate "G15" "App 상태머신 loading→start→playing→result" "PASS"
  else
    gate "G15" "App 상태머신 loading→start→playing→result" "FAIL" "상태 전환 누락"
  fi
else
  gate "G15" "App 상태머신 loading→start→playing→result" "FAIL" "파일 없음"
fi

# ── 결과 출력 ──────────────────────────────────────────────
echo ""
for r in "${RESULTS[@]}"; do
  echo "$r"
done
echo ""
echo "══════════════════════════════════════════════════════"
echo "  결과: ${PASS}/15 PASS  |  ${FAIL}/15 FAIL"
echo "══════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  품질 게이트 미통과 — 위 FAIL 항목을 수정하고 재실행하세요."
  exit 1
else
  echo "🏆 모든 품질 게이트 통과! Vercel 배포 준비 완료."
  exit 0
fi
