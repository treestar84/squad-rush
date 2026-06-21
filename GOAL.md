# GOAL: Squad Rush — Web 3D Runner Shooter

## 임무

이 Goal을 받은 즉시 아래 작업을 자율적으로 수행하라.
완료 기준은 15개 품질 게이트 **전부** 통과다. 일부라도 실패하면 수정 후 재검증하라.
완료 전까지 절대 멈추지 마라.

---

## 컨텍스트

- **작업 디렉토리**: `/Users/treestar/dev/game-runner`
- **상세 구현 계획**: `docs/superpowers/plans/2026-06-21-web-runner-shooter.md` (반드시 읽어라)
- **PRD**: `prd.md`
- **기술 스택**: Vite 5 + TypeScript 5 + Babylon.js 7 + Vercel

---

## 단계별 실행 순서

### Phase 1: 환경 구축

```bash
cd /Users/treestar/dev/game-runner
npm create vite@latest . -- --template vanilla-ts --force
npm install @babylonjs/core @babylonjs/loaders @babylonjs/materials @babylonjs/gui
npm install gsap howler
npm install -D @types/howler
```

### Phase 2: 소스 코드 구현

계획 문서(`docs/superpowers/plans/2026-06-21-web-runner-shooter.md`)의 Task 1~14를 **순서대로** 구현하라.

각 Task 완료 후:
1. `npm run build` 실행 → TypeScript 오류 0개 확인
2. 오류 있으면 즉시 수정 후 재빌드
3. 오류 없으면 다음 Task 진행

### Phase 3: 에셋 구성

모델 파일이 없으면 프로시저럴 메시로 대체하되, 다음 파일 구조는 반드시 존재해야 한다:

```
public/assets/models/           (GLB 파일 또는 폴백 마커)
public/assets/audio/            (mp3 파일 또는 폴백 마커)
public/assets/textures/         (텍스처 파일 또는 폴백 마커)
public/assets/ui/               (UI 에셋)
```

실제 무료 GLB 리소스 다운로드:
- Quaternius CC0 팩: https://quaternius.com/packs/ultimatemodularsoldiers.html
- Kenney 환경: https://kenney.nl/assets (road, platform kit)
- 다운로드 불가능한 경우 프로시저럴 메시로 완전 대체 구현 (게임이 동작해야 함)

### Phase 4: 빌드 및 검증

```bash
npm run build
```

빌드 성공 후 자동 게이트 검증 실행 (아래 스크립트 참조).

---

## 품질 게이트 (완료 조건)

**모든 게이트가 PASS여야 완료다. 하나라도 FAIL이면 수정 후 재검증하라.**

### 자동 검증 가능 게이트 (코드 분석 + 빌드 체크)

**G1 — 번들 빌드 성공**
```bash
npm run build && echo "G1:PASS" || echo "G1:FAIL"
```

**G2 — 번들 크기 40MB 이하**
```bash
BUILD_SIZE=$(du -sm dist/ 2>/dev/null | cut -f1)
[ "$BUILD_SIZE" -lt 40 ] && echo "G2:PASS (${BUILD_SIZE}MB)" || echo "G2:FAIL (${BUILD_SIZE}MB > 40MB)"
```

**G3 — TypeScript 타입 오류 0개**
```bash
npx tsc --noEmit && echo "G3:PASS" || echo "G3:FAIL"
```

**G4 — 핵심 시스템 파일 존재**
```bash
FILES=(
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
  "src/game/data/bossData.ts"
  "src/game/utils/assetLoader.ts"
  "src/game/utils/perf.ts"
  "src/ui/LoadingScreen.ts"
  "src/ui/StartScreen.ts"
  "src/ui/Hud.ts"
  "src/ui/ResultScreen.ts"
  "src/app/App.ts"
  "vercel.json"
)
FAIL=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "  MISSING: $f"; FAIL=1; }
done
[ "$FAIL" = "0" ] && echo "G4:PASS" || echo "G4:FAIL (missing files above)"
```

**G5 — SquadSystem 핵심 인터페이스 구현**
```bash
grep -q "addSoldiers" src/game/systems/SquadSystem.ts && \
grep -q "removeSoldiers" src/game/systems/SquadSystem.ts && \
grep -q "soldierCount" src/game/systems/SquadSystem.ts && \
grep -q "squadX" src/game/systems/SquadSystem.ts && \
grep -q "squadZ" src/game/systems/SquadSystem.ts && \
echo "G5:PASS" || echo "G5:FAIL"
```

**G6 — GateSystem 게이트 타입 구현**
```bash
grep -q "ADD_SOLDIER" src/game/data/gateData.ts && \
grep -q "MULTIPLY_SOLDIER" src/game/data/gateData.ts && \
grep -q "ATTACK_UP" src/game/data/gateData.ts && \
grep -q "FIRE_RATE_UP" src/game/data/gateData.ts && \
echo "G6:PASS" || echo "G6:FAIL"
```

**G7 — MonsterWaveSystem ObjectPool 사용**
```bash
grep -q "ObjectPool\|MonsterPool" src/game/systems/MonsterWaveSystem.ts && \
grep -q "getAlive\|aliveCount" src/game/systems/MonsterWaveSystem.ts && \
echo "G7:PASS" || echo "G7:FAIL"
```

**G8 — BossSystem 구현 (HP, 공격 패턴, 사망)**
```bash
grep -q "onDeath" src/game/systems/BossSystem.ts && \
grep -q "getHpRatio" src/game/systems/BossSystem.ts && \
grep -q "doAttack\|attack" src/game/systems/BossSystem.ts && \
echo "G8:PASS" || echo "G8:FAIL"
```

**G9 — FXSystem 파티클 구현**
```bash
grep -q "playHitSpark" src/game/systems/FXSystem.ts && \
grep -q "playExplosion" src/game/systems/FXSystem.ts && \
grep -q "playGateEffect" src/game/systems/FXSystem.ts && \
echo "G9:PASS" || echo "G9:FAIL"
```

**G10 — QualitySystem FPS 자동 감지**
```bash
grep -q "autoDetect\|measureFPS" src/game/systems/QualitySystem.ts && \
grep -q "low.*medium.*high\|renderScale" src/game/systems/QualitySystem.ts && \
echo "G10:PASS" || echo "G10:FAIL"
```

**G11 — HUD 필수 요소 (병사 수, 보스 HP, 진행도)**
```bash
grep -q "soldiers\|soldierCount" src/ui/Hud.ts && \
grep -q "boss\|bossHp" src/ui/Hud.ts && \
grep -q "progress\|stage" src/ui/Hud.ts && \
echo "G11:PASS" || echo "G11:FAIL"
```

**G12 — ResultScreen Victory/Defeat + Retry**
```bash
grep -q "victory\|Victory\|VICTORY" src/ui/ResultScreen.ts && \
grep -q "defeat\|Defeat\|DEFEAT" src/ui/ResultScreen.ts && \
grep -q "retry\|Retry\|onRetry" src/ui/ResultScreen.ts && \
echo "G12:PASS" || echo "G12:FAIL"
```

**G13 — vercel.json 캐싱 설정**
```bash
grep -q "Cache-Control\|max-age" vercel.json && \
echo "G13:PASS" || echo "G13:FAIL"
```

**G14 — InputController 터치 + 마우스 모두 지원**
```bash
grep -q "pointerdown\|touchstart" src/game/InputController.ts && \
grep -q "pointermove\|touchmove" src/game/InputController.ts && \
grep -q "ArrowLeft\|ArrowRight\|keydown" src/game/InputController.ts && \
echo "G14:PASS" || echo "G14:FAIL"
```

**G15 — 게임 루프 완전성 (LOADING→START→PLAYING→RESULT 전환)**
```bash
grep -q "loading\|start\|playing\|result" src/app/App.ts && \
grep -q "transitionTo" src/app/App.ts && \
echo "G15:PASS" || echo "G15:FAIL"
```

---

## 루프 종료 조건

스크립트 `scripts/verify-gates.sh` 를 실행해 모든 게이트 결과를 출력하라.
FAIL이 하나라도 있으면:
1. 실패 원인 분석
2. 해당 파일 수정
3. `npm run build` 재실행
4. 게이트 재검증
5. 모든 PASS까지 반복

모든 게이트 PASS 확인 후:
```bash
git add -A
git commit -m "feat: Squad Rush v1.0 — all 15 quality gates passed"
```

---

## 코딩 표준

- TypeScript strict mode 필수
- 전투 중 `new` 객체 동적 생성 금지 (풀 사용)
- 모든 에셋 경로는 `/assets/` 하위
- 모델 없으면 프로시저럴 메시 폴백 (게임이 반드시 실행돼야 함)
- 주석 최소화, 코드로 의도 표현
- 각 파일은 단일 책임

---

## 금지 사항

- 구현을 건너뛰거나 TODO 남기기 금지
- "나중에 구현" 코멘트 금지
- 빌드 오류 있는 상태로 다음 단계 진행 금지
- 품질 게이트 우회 금지 (게이트 스크립트 수정 금지)
