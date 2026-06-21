# GOAL Phase 2: Vercel 배포 + 그래픽 품질 향상

## 현재 상태 (Phase 1 완료)

- ✅ 15/15 품질 게이트 통과
- ✅ TypeScript strict 빌드 성공 (5.2MB)
- ✅ 모든 게임 시스템 구현 완료
- ✅ git commit: `902a58e`
- ⬜ Vercel 배포 미완료
- ⬜ 실제 GLB 에셋 미적용 (프로시저럴 메시 폴백 상태)
- ⬜ 그래픽 품질 최종 폴리시 미완료

---

## Phase 2 목표

1. **GitHub 원격 연결 + Vercel 배포** → 공유 가능한 URL 생성
2. **CC0 무료 GLB 에셋 다운로드 + 적용** → 프로시저럴 메시 → 실제 3D 모델
3. **그래픽 폴리시** → 조명·포스트 프로세싱·UI 애니메이션 강화

---

## Task A: GitHub 원격 연결 + Vercel 배포

### A-1: GitHub 리포 연결

```bash
# 이미 git init 완료, 커밋 있음
cd /Users/treestar/dev/game-runner

# GitHub CLI로 리포 생성 (gh 설치 필요)
gh repo create squad-rush --public --source=. --remote=origin --push

# 또는 수동:
# 1. github.com에서 'squad-rush' 리포 생성
# 2. git remote add origin https://github.com/YOUR_USERNAME/squad-rush.git
# 3. git push -u origin master
```

### A-2: Vercel 배포

```bash
# Vercel CLI 설치 (없으면)
npm install -g vercel

# 배포
vercel --prod

# 설정:
# - Framework: Vite
# - Build Command: npm run build
# - Output Directory: dist
# - Install Command: npm install
```

### A-3: 배포 확인

```bash
# URL 확인
vercel ls | head -5

# 브라우저에서 확인할 것:
# - 로딩 화면 표시
# - TAP TO START 버튼 동작
# - 병사 20명 렌더
# - 드래그 이동
# - 게이트 통과
# - 몬스터 웨이브
# - 보스전 + Victory
```

---

## Task B: CC0 GLB 에셋 다운로드

### B-1: Quaternius 팩 (CC0 라이선스)

아래 URL에서 수동 다운로드 후 Blender로 GLB 추출:

```
병사 모델:
https://quaternius.com/packs/ultimatemodularsoldiers.html
→ soldier.glb 추출 (Run/Shoot/Hit/Die 애니메이션 포함)

몬스터 기본:
https://quaternius.com/packs/ultimatemonsters.html
→ monster_basic.glb, monster_tank.glb 추출

보스:
https://quaternius.com/packs/ultimatemonsters.html
→ boss.glb 추출 (큰 크기 적)
```

또는 Kenney (kenney.nl/assets):
```
환경:
https://kenney.nl/assets/platformer-kit
→ road_segment.glb, gate_frame.glb 추출
```

### B-2: 파일 배치

```bash
public/assets/models/soldier.glb
public/assets/models/monster_basic.glb
public/assets/models/monster_tank.glb
public/assets/models/boss.glb
public/assets/models/environment/road_segment.glb
public/assets/models/environment/gate_frame.glb
```

### B-3: assetLoader.ts 확인

`src/game/utils/assetLoader.ts` 에서 GLB 로딩 경로가 올바른지 확인:
```typescript
// 경로: /assets/models/soldier.glb
// 파일 없으면 프로시저럴 폴백 자동 동작
```

---

## Task C: 그래픽 품질 향상

### C-1: Bloom + 후처리 강화

`src/game/SceneEnvironment.ts` 수정:
```typescript
// High 품질에서 Bloom weight 0.5로 강화
pipeline.bloomWeight = 0.5
pipeline.bloomThreshold = 0.6

// Tone mapping 추가
pipeline.imageProcessingEnabled = true
pipeline.imageProcessing.toneMappingEnabled = true
pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
```

### C-2: 게이트 이펙트 강화

`src/game/systems/FXSystem.ts` - `playGateEffect` 수정:
- 파티클 수 60 → 100
- 파티클 크기 0.1~0.4 → 0.2~0.8
- 지속 시간 0.8초 → 1.2초
- 골드 + 그린 + 화이트 색상 레이어 추가

### C-3: UI 애니메이션 (GSAP)

`src/ui/StartScreen.ts` 에서 GSAP 트윈 추가:
```typescript
import { gsap } from 'gsap'

// 게임 타이틀 등장 애니메이션
gsap.from('.game-title', { y: -50, opacity: 0, duration: 1, ease: 'power3.out' })
gsap.from('.game-subtitle', { y: 20, opacity: 0, duration: 0.8, delay: 0.4 })
gsap.from('.tap-to-start', { scale: 0.8, opacity: 0, duration: 0.6, delay: 0.8 })
```

### C-4: HUD 숫자 팝업

게이트 통과 시 병사 수 증가 팝업:
```typescript
// src/ui/Hud.ts - showPopup 메서드 추가
showPopup(text: string, color: string = '#ffd700'): void {
  const el = document.createElement('div')
  el.className = 'hud-popup'
  el.textContent = text
  el.style.color = color
  this.el.appendChild(el)
  gsap.to(el, { y: -60, opacity: 0, duration: 1.2, onComplete: () => el.remove() })
}
```

---

## 완료 기준 (Phase 2)

```
[ ] Vercel URL 존재 (https://squad-rush-xxx.vercel.app)
[ ] 모바일 브라우저에서 URL 접속 → 5초 이내 로딩
[ ] 실제 GLB 모델 표시 (또는 프로시저럴 폴백 명시)
[ ] Bloom 포스트 프로세싱 적용
[ ] 게이트 이펙트 강화
[ ] UI 입장 애니메이션
[ ] 화면 캡처 → 상용 하이퍼캐주얼 게임 수준
```

---

## Codex 인터랙티브 세션 실행 방법

### 방법 1: CLI 직접 실행

```bash
cd /Users/treestar/dev/game-runner
codex "$(cat GOAL_PHASE2.md)"
```

### 방법 2: 파일 참조 실행

```bash
cd /Users/treestar/dev/game-runner
codex --file GOAL_PHASE2.md
```

### 방법 3: 비대화형 자동 실행

```bash
cd /Users/treestar/dev/game-runner
codex exec "$(cat GOAL_PHASE2.md)" \
  -C . \
  -s workspace-write \
  -c 'model_reasoning_effort="high"'
```

---

## 현재 파일 구조 (참조용)

```
squad-rush/
├── src/
│   ├── main.ts
│   ├── app/App.ts
│   ├── game/
│   │   ├── Game.ts
│   │   ├── RendererFactory.ts
│   │   ├── SceneBootstrap.ts
│   │   ├── SceneEnvironment.ts
│   │   ├── InputController.ts
│   │   ├── CameraController.ts
│   │   ├── GameLoop.ts
│   │   ├── systems/
│   │   │   ├── SquadSystem.ts
│   │   │   ├── GateSystem.ts
│   │   │   ├── ShootingSystem.ts
│   │   │   ├── ProjectileSystem.ts
│   │   │   ├── MonsterWaveSystem.ts
│   │   │   ├── CollisionSystem.ts
│   │   │   ├── BossSystem.ts
│   │   │   ├── FXSystem.ts
│   │   │   └── QualitySystem.ts
│   │   ├── pools/
│   │   │   ├── ObjectPool.ts
│   │   │   └── MonsterPool.ts
│   │   ├── data/
│   │   │   ├── levelData.ts
│   │   │   ├── gateData.ts
│   │   │   ├── monsterData.ts
│   │   │   ├── soldierData.ts
│   │   │   └── bossData.ts (미생성 시 추가 필요)
│   │   └── utils/
│   │       ├── assetLoader.ts
│   │       ├── perf.ts
│   │       └── math.ts
│   ├── ui/
│   │   ├── LoadingScreen.ts
│   │   ├── StartScreen.ts
│   │   ├── Hud.ts
│   │   └── ResultScreen.ts
│   └── styles/global.css
├── public/assets/
│   ├── models/           ← GLB 파일 여기에 배치
│   ├── textures/
│   ├── audio/
│   └── ui/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── vercel.json           ← Cache-Control 설정 완료
└── package.json
```
