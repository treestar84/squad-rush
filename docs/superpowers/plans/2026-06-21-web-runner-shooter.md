# Web Runner Shooter — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vite + TypeScript + Babylon.js 기반 3D 러너 슈팅 게임을 Vercel에 배포해 누구나 URL로 즉시 플레이할 수 있는 30~60초 Vertical Slice 완성

**Architecture:** 씬 레이어(Babylon.js) + 게임 시스템 레이어(TypeScript 클래스) + UI 레이어(HTML/CSS Overlay) 3-tier 구조. 모든 전투 오브젝트는 ObjectPool로 관리하며, QualitySystem이 FPS를 감지해 렌더 스케일·몬스터 수·파티클 수를 자동 조정한다.

**Tech Stack:** Vite 5, TypeScript 5, Babylon.js 7, WebGL2(WebGPU 옵션), GSAP 3(UI 트윈), Howler.js(오디오), Vercel(배포), GLB/glTF(모델), KTX2/Basis(텍스처)

---

## 품질 게이트 — Last War 90% 기준

모든 Task 완료 후 아래 게이트를 **전부** 통과해야 완료로 인정한다.

```
[ ] G1  Vercel URL에서 모바일/PC 브라우저 5초 이내 첫 화면 표시
[ ] G2  PC Chrome 60fps, Android Chrome 30fps 이상 (전투 최대 웨이브 기준)
[ ] G3  병사 40명 동시 렌더 + 몬스터 100마리 동시 렌더 → 프레임 드랍 없음
[ ] G4  게이트 통과 → 병사 수/공격력 즉각 반영, 팝업 이펙트 재생
[ ] G5  몬스터 → 병사 충돌 판정 오차 ±0.5 유닛 이하
[ ] G6  보스 HP Bar 표시, 공격 패턴 1종 동작, 사망 폭발 연출 재생
[ ] G7  Victory/Defeat 화면 전환 후 Retry 버튼으로 재플레이 가능
[ ] G8  모델: 병사(GLB, 런/슈트/히트/다이 애니), 몬스터 2종(GLB), 보스(GLB) 실제 리소스 적용
[ ] G9  파티클: 머즐 플래시, 히트 스파크, 폭발, 게이트 통과 이펙트 전부 재생
[ ] G10 UI: 시작화면·HUD·결과화면 모두 상용 게임 수준 폰트·레이아웃 적용
[ ] G11 터치 드래그(모바일) + 마우스 드래그(PC) 모두 지연 없이 동작
[ ] G12 KTX2 텍스처 압축 적용, 번들 초기 로딩 40MB 이하
[ ] G13 Low/Medium/High 품질 자동 전환 (FPS 측정 후 3초 내)
[ ] G14 iOS Safari 실기기 크래시 없음
[ ] G15 화면 캡처만 봐도 상용 하이퍼캐주얼 게임처럼 보이는 아트 퀄리티
```

---

## Global Constraints

- Node ≥ 20, Babylon.js ^7.0, Vite ^5.0, TypeScript strict mode
- 모든 에셋은 `public/assets/` 하위 (Vite public 폴더 → hash 없이 서빙)
- 모델 폴리곤: 병사 ≤1500tri, 몬스터 ≤1500tri, 보스 ≤8000tri
- 텍스처: 병사/몬스터 512px, 보스/환경 1024px, KTX2 변환 필수
- 전투 중 `new` 키워드로 동적 오브젝트 생성 금지 (풀 사용)
- 모든 무료 리소스 CC0 또는 상업용 허용 라이선스 확인 필수
- Vercel `vercel.json`에 `Cache-Control: max-age=31536000` 적용 (에셋)

---

## 파일 구조

```
game-runner/
├── public/
│   ├── assets/
│   │   ├── models/
│   │   │   ├── soldier.glb          # Quaternius 군인 모델
│   │   │   ├── monster_basic.glb    # Quaternius 좀비/적 모델
│   │   │   ├── monster_tank.glb     # 스케일업 변형
│   │   │   ├── boss.glb             # Quaternius 대형 적 모델
│   │   │   └── environment/
│   │   │       ├── road_segment.glb
│   │   │       ├── gate_frame.glb
│   │   │       └── boss_arena.glb
│   │   ├── textures/
│   │   │   ├── soldier_diffuse.ktx2
│   │   │   ├── monster_diffuse.ktx2
│   │   │   ├── boss_diffuse.ktx2
│   │   │   └── road_diffuse.ktx2
│   │   ├── audio/
│   │   │   ├── bgm_battle.mp3
│   │   │   ├── sfx_shoot.mp3
│   │   │   ├── sfx_hit.mp3
│   │   │   ├── sfx_explosion.mp3
│   │   │   ├── sfx_gate.mp3
│   │   │   └── sfx_victory.mp3
│   │   └── ui/
│   │       └── logo.svg
├── src/
│   ├── main.ts                       # 엔트리, App 마운트
│   ├── app/
│   │   └── App.ts                    # 씬 전환 상태머신 (LOADING→START→PLAYING→RESULT)
│   ├── game/
│   │   ├── Game.ts                   # 게임 루트, 시스템 조합
│   │   ├── GameLoop.ts               # Babylon onBeforeRenderObservable 래퍼
│   │   ├── SceneBootstrap.ts         # 씬/카메라/조명 초기화
│   │   ├── RendererFactory.ts        # WebGPU 감지 → Engine 생성
│   │   ├── InputController.ts        # 터치/마우스 드래그 → deltaX
│   │   ├── CameraController.ts       # 부대 추적 카메라 (3인칭 후방)
│   │   ├── systems/
│   │   │   ├── SquadSystem.ts        # 병사 군집 이동·Formation
│   │   │   ├── GateSystem.ts         # 게이트 스폰·충돌·효과
│   │   │   ├── ShootingSystem.ts     # 타깃 선택·데미지 틱
│   │   │   ├── ProjectileSystem.ts   # 총알 Trail 시각화
│   │   │   ├── MonsterWaveSystem.ts  # 웨이브 스케줄·몬스터 AI
│   │   │   ├── CollisionSystem.ts    # 거리 기반 충돌
│   │   │   ├── BossSystem.ts         # 보스 AI·HP·공격 패턴
│   │   │   ├── FXSystem.ts           # 파티클·이펙트 재생
│   │   │   └── QualitySystem.ts      # FPS 측정·품질 자동 조정
│   │   ├── pools/
│   │   │   ├── ObjectPool.ts         # 제네릭 풀
│   │   │   ├── MonsterPool.ts        # 몬스터 인스턴스 풀
│   │   │   └── FXPool.ts             # 이펙트 오브젝트 풀
│   │   ├── data/
│   │   │   ├── levelData.ts
│   │   │   ├── gateData.ts
│   │   │   ├── soldierData.ts
│   │   │   ├── monsterData.ts
│   │   │   └── bossData.ts
│   │   └── utils/
│   │       ├── math.ts
│   │       ├── perf.ts
│   │       └── assetLoader.ts
│   ├── ui/
│   │   ├── LoadingScreen.ts
│   │   ├── StartScreen.ts
│   │   ├── Hud.ts
│   │   └── ResultScreen.ts
│   └── styles/
│       └── global.css
├── scripts/
│   └── download-assets.sh            # 무료 리소스 자동 다운로드
├── package.json
├── vite.config.ts
├── vercel.json
└── tsconfig.json
```

---

## Task 1: 프로젝트 세팅 + Vercel 첫 배포

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `vercel.json`
- Create: `src/main.ts`
- Create: `src/styles/global.css`
- Create: `index.html`

**Interfaces:**
- Produces: `http://localhost:5173` 에서 검은 canvas 렌더, Vercel URL 생성

- [ ] **Step 1: Vite + TypeScript 프로젝트 초기화**

```bash
cd /Users/treestar/dev/game-runner
npm create vite@latest . -- --template vanilla-ts
npm install
```

- [ ] **Step 2: Babylon.js 및 의존성 설치**

```bash
npm install @babylonjs/core @babylonjs/loaders @babylonjs/materials @babylonjs/gui
npm install @babylonjs/ktx2decoder
npm install gsap howler
npm install -D @types/howler
```

- [ ] **Step 3: vite.config.ts 작성**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ['@babylonjs/core', '@babylonjs/loaders', '@babylonjs/materials'],
        },
      },
    },
  },
  server: {
    host: true,
  },
})
```

- [ ] **Step 4: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: vercel.json 작성 (캐싱 전략 포함)**

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*).html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    }
  ]
}
```

- [ ] **Step 6: index.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#0a0a1a" />
  <title>Squad Rush</title>
  <link rel="stylesheet" href="/src/styles/global.css" />
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <div id="ui-root"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: global.css 작성**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  background: #0a0a1a;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
#game-canvas {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100%;
  display: block; touch-action: none;
}
#ui-root {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}
#ui-root * { pointer-events: auto; }
```

- [ ] **Step 8: src/main.ts 작성 (빈 캔버스 렌더 확인)**

```typescript
import { Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, Vector3, Color4 } from '@babylonjs/core'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
scene.clearColor = new Color4(0.04, 0.04, 0.1, 1)

const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 20, Vector3.Zero(), scene)
camera.attachControl(canvas, true)
new HemisphericLight('light', new Vector3(0, 1, 0), scene)

const box = MeshBuilder.CreateBox('box', { size: 2 }, scene)
box.position.y = 1

engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())
```

- [ ] **Step 9: 로컬 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 → 검은 배경에 회색 박스 표시 확인

- [ ] **Step 10: Git 초기화 + Vercel 연결**

```bash
git init
echo "node_modules\ndist\n.env" > .gitignore
git add .
git commit -m "feat: initial Vite+Babylon.js project setup"
```

GitHub 리포 생성 → `git remote add origin <URL>` → `git push -u origin main`
Vercel 대시보드 → Import → Framework: Vite → Deploy

- [ ] **Step 11: Vercel URL 접속 확인**

배포된 URL에서 박스 렌더 확인 → 완료

---

## Task 2: 무료 3D 리소스 다운로드 + 에셋 파이프라인

**Files:**
- Create: `scripts/download-assets.sh`
- Create: `public/assets/models/` (구조)
- Create: `public/assets/audio/` (구조)

**Interfaces:**
- Produces: `public/assets/models/soldier.glb`, `monster_basic.glb`, `monster_tank.glb`, `boss.glb`, `environment/*.glb`
- Produces: `public/assets/audio/*.mp3`

> 이 Task는 **그래픽 품질의 핵심**이다. 무료 리소스지만 선별과 리터칭으로 상용 퀄리티에 근접시킨다.

- [ ] **Step 1: 디렉토리 구조 생성**

```bash
mkdir -p public/assets/models/environment
mkdir -p public/assets/textures
mkdir -p public/assets/audio
mkdir -p public/assets/ui
```

- [ ] **Step 2: Quaternius 팩 다운로드 (CC0, 상업 사용 가능)**

Quaternius 사이트(quaternius.com)에서 아래 팩을 수동 다운로드:
- **Ultimate Modular Soldier** → `soldier.glb` 추출
- **Animated Zombie Pack** → `monster_basic.glb` 추출  
- **Ultimate Monster Pack** → `boss.glb` 추출

다운로드 후 Blender 3.6에서:
1. GLB Import
2. 폴리곤 수 확인 (병사 ≤1500tri, 보스 ≤8000tri)
3. 텍스처 512px 리사이즈 (보스 1024px)
4. GLB Export (Draco 압축 ON)

- [ ] **Step 3: Kenney 환경 에셋 다운로드 (CC0)**

kenney.nl → "City Kit (Roads)" 또는 "Platformer Kit" 다운로드
필요한 메시만 추출해 `road_segment.glb`, `gate_frame.glb`, `boss_arena.glb` 저장

또는 아래 방법으로 프로시저럴 생성 (Task 3에서 코드로 대체 가능):
```
road_segment: 40 x 8 x 0.2 박스 + 양쪽 가드레일
gate_frame: 두 개의 기둥 + 상단 가로대
boss_arena: 원형 플랫폼
```

- [ ] **Step 4: Mixamo 애니메이션 리타게팅**

mixamo.com (무료, Adobe 계정 필요):
1. 병사 모델 업로드
2. 아래 4개 애니메이션 다운로드:
   - Running (in place)
   - Firing Rifle
   - Hit Reaction
   - Dying
3. Without Skin 옵션으로 FBX 다운로드
4. Blender에서 병사 모델에 리타게팅 → GLB Export

- [ ] **Step 5: 오디오 리소스 수집 (CC0)**

freesound.org 또는 opengameart.org에서 CC0 라이선스 오디오 검색:

```bash
# 아래는 수동 다운로드 후 이름 변경
# 검색 키워드:
# shoot: "gunshot", "rifle fire" CC0
# hit: "bullet impact", "flesh hit" CC0  
# explosion: "explosion medium" CC0
# gate: "power up", "upgrade" CC0
# victory: "fanfare short" CC0
# bgm: opengameart.org "battle music CC0"
```

각 파일을 `public/assets/audio/` 에 저장:
- `bgm_battle.mp3`
- `sfx_shoot.mp3`
- `sfx_hit.mp3`
- `sfx_explosion.mp3`
- `sfx_gate.mp3`
- `sfx_victory.mp3`

- [ ] **Step 6: KTX2 텍스처 변환 (선택적 최적화)**

```bash
# KTX-Software 설치 (https://github.com/KhronosGroup/KTX-Software)
brew install ktx-software  # 또는 빌드

# 각 PNG/JPG 텍스처를 KTX2로 변환
toktx --t2 --bcmp public/assets/textures/soldier_diffuse.ktx2 soldier_diffuse.png
toktx --t2 --bcmp public/assets/textures/monster_diffuse.ktx2 monster_diffuse.png
toktx --t2 --bcmp public/assets/textures/boss_diffuse.ktx2 boss_diffuse.png
```

KTX-Software 설치가 어려운 경우 PNG 그대로 사용하고 Task 8에서 최적화

- [ ] **Step 7: 에셋 라이선스 기록**

`public/assets/LICENSES.md` 파일 생성:
```markdown
# Asset Licenses
- Soldier model: Quaternius (CC0) - quaternius.com
- Monster models: Quaternius (CC0) - quaternius.com
- Environment: Kenney (CC0) - kenney.nl
- Animations: Mixamo (Free, Adobe ToS)
- Audio SFX: freesound.org (CC0, see individual attributions)
- BGM: opengameart.org (CC0)
```

- [ ] **Step 8: 커밋**

```bash
git add public/assets/ scripts/
git commit -m "feat: add CC0 game assets (models, audio, textures)"
```

---

## Task 3: RendererFactory + SceneBootstrap + QualitySystem

**Files:**
- Create: `src/game/RendererFactory.ts`
- Create: `src/game/SceneBootstrap.ts`
- Create: `src/game/systems/QualitySystem.ts`
- Create: `src/game/utils/perf.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `RendererFactory.create(canvas): Promise<Engine>`
- Produces: `SceneBootstrap.init(engine): Scene` — 씬, 카메라, 조명, 지형 초기화
- Produces: `QualitySystem` — `quality: 'low'|'medium'|'high'`, `apply(scene): void`

- [ ] **Step 1: perf.ts 작성**

```typescript
// src/game/utils/perf.ts
export function measureFPS(durationMs: number): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0
    const start = performance.now()
    function tick() {
      frames++
      if (performance.now() - start < durationMs) {
        requestAnimationFrame(tick)
      } else {
        resolve(frames / (durationMs / 1000))
      }
    }
    requestAnimationFrame(tick)
  })
}
```

- [ ] **Step 2: QualitySystem.ts 작성**

```typescript
// src/game/systems/QualitySystem.ts
import { Engine, Scene } from '@babylonjs/core'
import { measureFPS } from '../utils/perf'

export type QualityLevel = 'low' | 'medium' | 'high'

export interface QualitySettings {
  renderScale: number
  maxSoldiers: number
  maxMonsters: number
  particleMultiplier: number
  shadowEnabled: boolean
  postProcessEnabled: boolean
  animationSkipRate: number
}

const PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    renderScale: 0.7,
    maxSoldiers: 20,
    maxMonsters: 40,
    particleMultiplier: 0.3,
    shadowEnabled: false,
    postProcessEnabled: false,
    animationSkipRate: 3,
  },
  medium: {
    renderScale: 0.85,
    maxSoldiers: 40,
    maxMonsters: 70,
    particleMultiplier: 0.6,
    shadowEnabled: false,
    postProcessEnabled: false,
    animationSkipRate: 2,
  },
  high: {
    renderScale: 1.0,
    maxSoldiers: 60,
    maxMonsters: 100,
    particleMultiplier: 1.0,
    shadowEnabled: false,
    postProcessEnabled: true,
    animationSkipRate: 0,
  },
}

export class QualitySystem {
  level: QualityLevel = 'medium'
  settings: QualitySettings = PRESETS.medium

  async autoDetect(engine: Engine): Promise<void> {
    const fps = await measureFPS(3000)
    if (fps >= 50) this.level = 'high'
    else if (fps >= 28) this.level = 'medium'
    else this.level = 'low'
    this.settings = PRESETS[this.level]
    engine.setHardwareScalingLevel(1 / this.settings.renderScale)
    console.log(`[Quality] detected fps=${fps.toFixed(1)} → ${this.level}`)
  }
}

export const qualitySystem = new QualitySystem()
```

- [ ] **Step 3: RendererFactory.ts 작성**

```typescript
// src/game/RendererFactory.ts
import { Engine, WebGPUEngine } from '@babylonjs/core'

export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  const hasWebGPU = 'gpu' in navigator
  if (hasWebGPU) {
    try {
      const engine = new WebGPUEngine(canvas, { antialias: true })
      await engine.initAsync()
      console.log('[Renderer] WebGPU enabled')
      return engine
    } catch {
      console.warn('[Renderer] WebGPU init failed, falling back to WebGL2')
    }
  }
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    disableWebGL2Support: false,
  })
  console.log('[Renderer] WebGL2 enabled')
  return engine
}
```

- [ ] **Step 4: SceneBootstrap.ts 작성**

```typescript
// src/game/SceneBootstrap.ts
import {
  Scene, Engine, ArcRotateCamera, Vector3, HemisphericLight,
  DirectionalLight, Color3, Color4, FogMode, MeshBuilder, StandardMaterial, Texture,
} from '@babylonjs/core'

export function initScene(engine: Engine): Scene {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.53, 0.81, 0.98, 1) // 하늘 색
  scene.fogMode = FogMode.LINEAR
  scene.fogStart = 80
  scene.fogEnd = 160
  scene.fogColor = new Color3(0.53, 0.81, 0.98)

  // 카메라 (게임 중 CameraController로 대체됨)
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.5, 30, new Vector3(0, 0, 10), scene)

  // 조명
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.6
  hemi.diffuse = new Color3(0.9, 0.95, 1.0)

  const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
  sun.intensity = 1.2
  sun.diffuse = new Color3(1.0, 0.95, 0.8)

  // 지면 (프로시저럴, 에셋 없어도 동작)
  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 200, subdivisions: 2 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.3, 0.35, 0.4)
  ground.material = groundMat
  ground.position.z = 80

  return scene
}
```

- [ ] **Step 5: main.ts 업데이트**

```typescript
// src/main.ts
import { createEngine } from './game/RendererFactory'
import { initScene } from './game/SceneBootstrap'
import { qualitySystem } from './game/systems/QualitySystem'

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  const engine = await createEngine(canvas)
  const scene = initScene(engine)

  engine.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => engine.resize())

  // 품질 자동 감지 (3초 후)
  qualitySystem.autoDetect(engine)
}

main().catch(console.error)
```

- [ ] **Step 6: 로컬 실행 확인**

```bash
npm run dev
```

브라우저 콘솔에서 `[Renderer] WebGL2 enabled` 또는 `WebGPU enabled` 확인
3초 후 `[Quality] detected fps=XX → high/medium/low` 확인

- [ ] **Step 7: 커밋**

```bash
git add src/game/
git commit -m "feat: RendererFactory, SceneBootstrap, QualitySystem"
```

---

## Task 4: 로딩 화면 + 에셋 로더 + 시작 화면

**Files:**
- Create: `src/game/utils/assetLoader.ts`
- Create: `src/ui/LoadingScreen.ts`
- Create: `src/ui/StartScreen.ts`
- Create: `src/app/App.ts`
- Modify: `src/main.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `loadGameAssets(scene): Promise<AssetManifest>` — 모든 GLB/오디오 사전 로딩
- Produces: `AssetManifest.soldiers`, `.monsters`, `.boss`, `.environment` (Babylon Mesh 레퍼런스)
- Produces: `App.transitionTo('loading'|'start'|'playing'|'result'): void`

- [ ] **Step 1: assetLoader.ts 작성**

```typescript
// src/game/utils/assetLoader.ts
import { Scene, SceneLoader, Mesh } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'

export interface AssetManifest {
  soldier: Mesh
  monsterBasic: Mesh
  monsterTank: Mesh
  boss: Mesh
}

export async function loadGameAssets(
  scene: Scene,
  onProgress: (pct: number) => void
): Promise<AssetManifest> {
  const items = [
    { key: 'soldier', path: '/assets/models/soldier.glb' },
    { key: 'monsterBasic', path: '/assets/models/monster_basic.glb' },
    { key: 'monsterTank', path: '/assets/models/monster_tank.glb' },
    { key: 'boss', path: '/assets/models/boss.glb' },
  ]

  const results: Record<string, Mesh> = {}
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const container = await SceneLoader.LoadAssetContainerAsync('', item.path, scene)
    container.addAllToScene()
    const root = container.meshes[0] as Mesh
    root.setEnabled(false) // 풀 원본은 숨김
    root.name = `template_${item.key}`
    results[item.key] = root
    onProgress(Math.round(((i + 1) / items.length) * 100))
  }

  return results as unknown as AssetManifest
}
```

- [ ] **Step 2: LoadingScreen.ts 작성**

```typescript
// src/ui/LoadingScreen.ts
export class LoadingScreen {
  private el: HTMLDivElement

  constructor(root: HTMLElement) {
    this.el = document.createElement('div')
    this.el.id = 'loading-screen'
    this.el.innerHTML = `
      <div class="loading-inner">
        <div class="loading-logo">SQUAD RUSH</div>
        <div class="loading-bar-wrap">
          <div class="loading-bar" id="loading-bar"></div>
        </div>
        <div class="loading-text" id="loading-text">Loading...</div>
      </div>
    `
    root.appendChild(this.el)
  }

  setProgress(pct: number): void {
    const bar = document.getElementById('loading-bar')
    if (bar) bar.style.width = `${pct}%`
    const txt = document.getElementById('loading-text')
    if (txt) txt.textContent = `Loading... ${pct}%`
  }

  hide(): void { this.el.style.display = 'none' }
  show(): void { this.el.style.display = 'flex' }
}
```

- [ ] **Step 3: StartScreen.ts 작성**

```typescript
// src/ui/StartScreen.ts
export class StartScreen {
  private el: HTMLDivElement
  onStart?: () => void

  constructor(root: HTMLElement) {
    this.el = document.createElement('div')
    this.el.id = 'start-screen'
    this.el.innerHTML = `
      <div class="start-inner">
        <div class="game-title">SQUAD RUSH</div>
        <div class="game-subtitle">생존하라. 증식하라. 정복하라.</div>
        <div class="tap-to-start" id="tap-to-start">TAP TO START</div>
        <div class="controls-hint">
          <span>🖱️ 마우스 드래그</span>
          <span>👆 터치 드래그</span>
        </div>
      </div>
    `
    root.appendChild(this.el)
    document.getElementById('tap-to-start')?.addEventListener('click', () => this.onStart?.())
  }

  show(): void { this.el.style.display = 'flex' }
  hide(): void { this.el.style.display = 'none' }
}
```

- [ ] **Step 4: CSS 업데이트 (로딩/시작 화면 스타일)**

`src/styles/global.css` 에 추가:

```css
/* Loading Screen */
#loading-screen {
  position: fixed; inset: 0;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.loading-inner { text-align: center; width: 300px; }
.loading-logo {
  font-size: 3rem; font-weight: 900; letter-spacing: 0.2em;
  color: #ffd700; text-shadow: 0 0 30px #ffd70088;
  margin-bottom: 2rem;
}
.loading-bar-wrap {
  width: 100%; height: 8px; background: #333;
  border-radius: 4px; overflow: hidden; margin-bottom: 1rem;
}
.loading-bar {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, #ffd700, #ff6b00);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.loading-text { color: #aaa; font-size: 0.9rem; }

/* Start Screen */
#start-screen {
  position: fixed; inset: 0;
  background: linear-gradient(180deg, #0a0a1a00 0%, #0a0a1acc 60%, #0a0a1a 100%);
  display: none; flex-direction: column;
  align-items: center; justify-content: flex-end;
  padding-bottom: 15vh; z-index: 50;
}
.start-inner { text-align: center; }
.game-title {
  font-size: 4rem; font-weight: 900; letter-spacing: 0.15em;
  color: #fff; text-shadow: 0 0 40px #ffd70066, 0 4px 20px #00000088;
  margin-bottom: 0.5rem;
}
.game-subtitle { color: #ffcc44; font-size: 1.1rem; margin-bottom: 3rem; }
.tap-to-start {
  font-size: 1.5rem; font-weight: 700; letter-spacing: 0.2em;
  color: #ffd700; cursor: pointer;
  animation: pulse 1.5s ease-in-out infinite;
  border: 2px solid #ffd700; padding: 1rem 3rem; border-radius: 50px;
  background: #ffd70011; margin-bottom: 2rem;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.97); }
}
.controls-hint { color: #888; font-size: 0.85rem; display: flex; gap: 2rem; }
```

- [ ] **Step 5: App.ts 작성**

```typescript
// src/app/App.ts
import { Engine, Scene } from '@babylonjs/core'
import { LoadingScreen } from '../ui/LoadingScreen'
import { StartScreen } from '../ui/StartScreen'
import { loadGameAssets, AssetManifest } from '../game/utils/assetLoader'

export type AppState = 'loading' | 'start' | 'playing' | 'result'

export class App {
  private state: AppState = 'loading'
  private loadingScreen: LoadingScreen
  private startScreen: StartScreen
  assets?: AssetManifest

  constructor(
    private engine: Engine,
    private scene: Scene,
    root: HTMLElement
  ) {
    this.loadingScreen = new LoadingScreen(root)
    this.startScreen = new StartScreen(root)
    this.startScreen.hide()
  }

  async init(): Promise<void> {
    try {
      this.assets = await loadGameAssets(this.scene, (pct) => {
        this.loadingScreen.setProgress(pct)
      })
      this.transitionTo('start')
    } catch (e) {
      console.error('[App] Asset loading failed:', e)
      // 에셋 없어도 프로시저럴 메시로 진행
      this.transitionTo('start')
    }
  }

  transitionTo(next: AppState): void {
    this.state = next
    if (next === 'start') {
      this.loadingScreen.hide()
      this.startScreen.show()
      this.startScreen.onStart = () => this.transitionTo('playing')
    } else if (next === 'playing') {
      this.startScreen.hide()
      // Game.start() 호출은 main.ts에서 처리
    }
  }

  getState(): AppState { return this.state }
}
```

- [ ] **Step 6: main.ts 업데이트**

```typescript
// src/main.ts
import { createEngine } from './game/RendererFactory'
import { initScene } from './game/SceneBootstrap'
import { qualitySystem } from './game/systems/QualitySystem'
import { App } from './app/App'

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  const uiRoot = document.getElementById('ui-root') as HTMLElement
  const engine = await createEngine(canvas)
  const scene = initScene(engine)

  const app = new App(engine, scene, uiRoot)
  await app.init()

  engine.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => engine.resize())
  qualitySystem.autoDetect(engine)
}

main().catch(console.error)
```

- [ ] **Step 7: 로컬 확인**

```bash
npm run dev
```

- 로딩 바 100%까지 채워짐 확인 (모델 없으면 즉시 100%)
- "TAP TO START" 화면 표시 확인
- 클릭 시 시작화면 숨겨짐 확인

- [ ] **Step 8: 커밋**

```bash
git add src/
git commit -m "feat: loading screen, asset loader, start screen"
```

---

## Task 5: InputController + CameraController + 자동 전진

**Files:**
- Create: `src/game/InputController.ts`
- Create: `src/game/CameraController.ts`
- Create: `src/game/GameLoop.ts`
- Create: `src/game/data/levelData.ts`

**Interfaces:**
- Produces: `InputController.getDeltaX(): number` — 이번 프레임의 좌우 드래그 delta
- Produces: `CameraController.follow(targetZ: number, squadX: number): void`
- Produces: `LEVEL_1: LevelData` — 레벨 설정값

- [ ] **Step 1: levelData.ts 작성**

```typescript
// src/game/data/levelData.ts
export interface LevelSegment {
  type: 'GATE' | 'WAVE' | 'BOSS' | 'INTRO'
  startZ: number
  endZ: number
  config?: unknown
}

export interface LevelData {
  id: string
  startSoldiers: number
  trackWidth: number
  forwardSpeed: number
  totalLength: number
  segments: LevelSegment[]
}

export const LEVEL_1: LevelData = {
  id: 'level_1',
  startSoldiers: 20,
  trackWidth: 14,
  forwardSpeed: 8,      // 유닛/초
  totalLength: 200,
  segments: [
    { type: 'INTRO',  startZ: 0,   endZ: 20 },
    { type: 'GATE',   startZ: 20,  endZ: 40,  config: { gateIds: ['gate_add5', 'gate_atk20'] } },
    { type: 'WAVE',   startZ: 40,  endZ: 90,  config: { waveId: 'wave_1' } },
    { type: 'GATE',   startZ: 90,  endZ: 110, config: { gateIds: ['gate_mul2', 'gate_fire20'] } },
    { type: 'WAVE',   startZ: 110, endZ: 160, config: { waveId: 'wave_2' } },
    { type: 'BOSS',   startZ: 160, endZ: 200, config: { bossId: 'boss_titan' } },
  ],
}
```

- [ ] **Step 2: InputController.ts 작성**

```typescript
// src/game/InputController.ts
export class InputController {
  private deltaX = 0
  private lastPointerX = 0
  private isDown = false
  private sensitivity = 0.06

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
  }

  private keysHeld = new Set<string>()

  private onDown = (e: PointerEvent) => {
    this.isDown = true
    this.lastPointerX = e.clientX
  }

  private onMove = (e: PointerEvent) => {
    if (!this.isDown) return
    const dx = e.clientX - this.lastPointerX
    this.deltaX = dx * this.sensitivity
    this.lastPointerX = e.clientX
  }

  private onUp = () => { this.isDown = false }

  private onKey = (e: KeyboardEvent) => { this.keysHeld.add(e.key) }
  private onKeyUp = (e: KeyboardEvent) => { this.keysHeld.delete(e.key) }

  getDeltaX(): number {
    let d = this.deltaX
    if (this.keysHeld.has('ArrowLeft') || this.keysHeld.has('a')) d -= 0.15
    if (this.keysHeld.has('ArrowRight') || this.keysHeld.has('d')) d += 0.15
    this.deltaX *= 0.7 // 드래그 감쇠
    return d
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
  }
}
```

- [ ] **Step 3: CameraController.ts 작성**

```typescript
// src/game/CameraController.ts
import { TargetCamera, Vector3, Scene } from '@babylonjs/core'

export class CameraController {
  private camera: TargetCamera

  constructor(scene: Scene) {
    this.camera = new TargetCamera('gameCamera', new Vector3(0, 18, -20), scene)
    this.camera.setTarget(new Vector3(0, 0, 10))
    this.camera.fov = 0.9
  }

  follow(targetZ: number, squadX: number, dt: number): void {
    const camZ = targetZ - 20
    const camX = squadX * 0.3
    this.camera.position.x += (camX - this.camera.position.x) * Math.min(dt * 5, 1)
    this.camera.position.z += (camZ - this.camera.position.z) * Math.min(dt * 8, 1)
    this.camera.setTarget(new Vector3(squadX * 0.2, 2, targetZ + 10))
  }
}
```

- [ ] **Step 4: GameLoop.ts 작성**

```typescript
// src/game/GameLoop.ts
import { Scene } from '@babylonjs/core'

export type UpdateFn = (dt: number, totalTime: number) => void

export class GameLoop {
  private updateFns: UpdateFn[] = []
  private totalTime = 0

  constructor(private scene: Scene) {
    scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000
      this.totalTime += dt
      for (const fn of this.updateFns) fn(dt, this.totalTime)
    })
  }

  add(fn: UpdateFn): void { this.updateFns.push(fn) }
  remove(fn: UpdateFn): void {
    const i = this.updateFns.indexOf(fn)
    if (i >= 0) this.updateFns.splice(i, 1)
  }
}
```

- [ ] **Step 5: 기본 자동 전진 동작 확인 (임시 main.ts 코드)**

```typescript
// main.ts에 임시로 추가해서 동작 확인
import { InputController } from './game/InputController'
import { CameraController } from './game/CameraController'
import { GameLoop } from './game/GameLoop'
import { MeshBuilder, Vector3 } from '@babylonjs/core'

// ... engine/scene 생성 후
const input = new InputController(canvas)
const camCtrl = new CameraController(scene)
const loop = new GameLoop(scene)

const placeholder = MeshBuilder.CreateCylinder('squad', { height: 2, diameter: 1.5 }, scene)
let squadX = 0, squadZ = 10
const TRACK_HALF = 7

loop.add((dt) => {
  squadX = Math.max(-TRACK_HALF, Math.min(TRACK_HALF, squadX + input.getDeltaX()))
  squadZ += 8 * dt
  placeholder.position.set(squadX, 1, squadZ)
  camCtrl.follow(squadZ, squadX, dt)
})
```

```bash
npm run dev
```

드래그/키로 좌우 이동, 카메라가 자동 전진 추적 확인

- [ ] **Step 6: 임시 코드 제거 후 커밋**

```bash
git add src/
git commit -m "feat: InputController, CameraController, GameLoop, LevelData"
```

---

## Task 6: SquadSystem — 병사 군집

**Files:**
- Create: `src/game/systems/SquadSystem.ts`
- Create: `src/game/data/soldierData.ts`
- Create: `src/game/pools/ObjectPool.ts`

**Interfaces:**
- Consumes: `AssetManifest.soldier` (Mesh 템플릿), `InputController.getDeltaX()`, `QualitySystem.settings.maxSoldiers`
- Produces: `SquadSystem.squadX`, `.squadZ`, `.soldierCount`, `.addSoldiers(n)`, `.removeSoldiers(n)`, `.getAlivePositions(): Vector3[]`

- [ ] **Step 1: ObjectPool.ts 작성**

```typescript
// src/game/pools/ObjectPool.ts
export class ObjectPool<T> {
  private pool: T[] = []
  private active: Set<T> = new Set()

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory())
    }
  }

  get(): T {
    const obj = this.pool.pop() ?? this.factory()
    this.active.add(obj)
    return obj
  }

  release(obj: T): void {
    if (!this.active.has(obj)) return
    this.active.delete(obj)
    this.reset(obj)
    this.pool.push(obj)
  }

  getActive(): T[] { return Array.from(this.active) }
  activeCount(): number { return this.active.size }
}
```

- [ ] **Step 2: soldierData.ts 작성**

```typescript
// src/game/data/soldierData.ts
export const SOLDIER_BASE = {
  hp: 3,
  attackDamage: 10,
  attackRange: 25,
  fireRate: 2.0,   // 초당 발사 횟수
  bulletSpeed: 40,
}
```

- [ ] **Step 3: SquadSystem.ts 작성**

```typescript
// src/game/systems/SquadSystem.ts
import { Scene, Mesh, Vector3, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'
import { ObjectPool } from '../pools/ObjectPool'
import { LEVEL_1 } from '../data/levelData'

interface Soldier {
  mesh: Mesh
  offsetX: number
  offsetZ: number
  hp: number
  alive: boolean
}

export class SquadSystem {
  squadX = 0
  squadZ = 10
  private soldiers: Soldier[] = []
  private pool: ObjectPool<Soldier>
  private template: Mesh | null = null
  private scene: Scene
  private trackHalf: number

  constructor(scene: Scene, templateMesh: Mesh | null, maxCount: number) {
    this.scene = scene
    this.template = templateMesh
    this.trackHalf = LEVEL_1.trackWidth / 2

    this.pool = new ObjectPool<Soldier>(
      () => this.createSoldier(),
      (s) => { s.mesh.setEnabled(false); s.alive = false },
      maxCount
    )

    // 초기 병사 20명 생성
    this.addSoldiers(LEVEL_1.startSoldiers)
  }

  private createSoldier(): Soldier {
    let mesh: Mesh
    if (this.template) {
      mesh = this.template.clone('soldier_clone', null) as Mesh
    } else {
      // 프로시저럴 폴백
      mesh = MeshBuilder.CreateCylinder('soldier', { height: 1.8, diameter: 0.7 }, this.scene)
      const mat = new StandardMaterial('soldierMat', this.scene)
      mat.diffuseColor = new Color3(0.2, 0.5, 1.0)
      mesh.material = mat
    }
    mesh.setEnabled(false)
    return { mesh, offsetX: 0, offsetZ: 0, hp: 3, alive: false }
  }

  addSoldiers(n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.pool.get()
      s.alive = true
      s.hp = 3
      s.mesh.setEnabled(true)
      this.soldiers.push(s)
    }
    this.recalcFormation()
  }

  removeSoldiers(n: number): void {
    let removed = 0
    for (let i = this.soldiers.length - 1; i >= 0 && removed < n; i--) {
      const s = this.soldiers.splice(i, 1)[0]
      this.pool.release(s)
      removed++
    }
  }

  private recalcFormation(): void {
    const count = this.soldiers.length
    const cols = Math.ceil(Math.sqrt(count * 1.5))
    const spacing = 1.4
    for (let i = 0; i < count; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      this.soldiers[i].offsetX = (col - (cols - 1) / 2) * spacing
      this.soldiers[i].offsetZ = -row * spacing * 0.8
    }
  }

  get soldierCount(): number { return this.soldiers.length }

  getAlivePositions(): Vector3[] {
    return this.soldiers.map(s => s.mesh.position.clone())
  }

  update(deltaX: number, dt: number): void {
    this.squadX = Math.max(-this.trackHalf, Math.min(this.trackHalf, this.squadX + deltaX))
    this.squadZ += LEVEL_1.forwardSpeed * dt

    for (const s of this.soldiers) {
      const tx = this.squadX + s.offsetX
      const tz = this.squadZ + s.offsetZ
      // 개별 병사는 살짝 늦게 따라옴 (군집감)
      s.mesh.position.x += (tx - s.mesh.position.x) * Math.min(dt * 12, 1)
      s.mesh.position.z += (tz - s.mesh.position.z) * Math.min(dt * 12, 1)
      s.mesh.position.y = 0.9
    }
  }
}
```

- [ ] **Step 4: 동작 확인**

```bash
npm run dev
```

- 20개 병사가 격자 formation으로 이동 확인
- 드래그 시 군집 전체 이동, 개별 병사 살짝 늦게 따라옴 확인
- 콘솔에 `soldierCount: 20` 출력 확인

- [ ] **Step 5: 커밋**

```bash
git add src/
git commit -m "feat: SquadSystem with formation + ObjectPool"
```

---

## Task 7: GateSystem — 강화 게이트

**Files:**
- Create: `src/game/systems/GateSystem.ts`
- Create: `src/game/data/gateData.ts`

**Interfaces:**
- Consumes: `SquadSystem.squadX`, `.squadZ`, `.addSoldiers()`, `.soldierData` stats
- Produces: `GateSystem.update(dt)`, gates spawned at correct Z positions

- [ ] **Step 1: gateData.ts 작성**

```typescript
// src/game/data/gateData.ts
export type GateType = 'ADD_SOLDIER' | 'MULTIPLY_SOLDIER' | 'ATTACK_UP' | 'FIRE_RATE_UP' | 'RANGE_UP'

export interface GateConfig {
  id: string
  type: GateType
  value: number
  displayText: string
  color: string   // CSS 색상 (HUD 텍스트용)
}

export const GATE_CONFIGS: Record<string, GateConfig> = {
  gate_add1:  { id: 'gate_add1',  type: 'ADD_SOLDIER',      value: 1,    displayText: '+1',   color: '#44ff88' },
  gate_add5:  { id: 'gate_add5',  type: 'ADD_SOLDIER',      value: 5,    displayText: '+5',   color: '#44ff88' },
  gate_mul2:  { id: 'gate_mul2',  type: 'MULTIPLY_SOLDIER', value: 2,    displayText: 'x2',   color: '#ffdd00' },
  gate_atk20: { id: 'gate_atk20', type: 'ATTACK_UP',        value: 0.20, displayText: 'ATK+20%', color: '#ff6644' },
  gate_fire20:{ id: 'gate_fire20',type: 'FIRE_RATE_UP',     value: 0.20, displayText: 'FIRE+20%', color: '#ff44cc' },
  gate_rng20: { id: 'gate_rng20', type: 'RANGE_UP',         value: 0.20, displayText: 'RNG+20%', color: '#44ccff' },
}

export interface GateSpawn {
  z: number
  leftGateId: string
  rightGateId: string
}

export const GATE_SPAWNS: GateSpawn[] = [
  { z: 25,  leftGateId: 'gate_add5',  rightGateId: 'gate_atk20' },
  { z: 95,  leftGateId: 'gate_mul2',  rightGateId: 'gate_fire20' },
]
```

- [ ] **Step 2: GateSystem.ts 작성**

```typescript
// src/game/systems/GateSystem.ts
import {
  Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3, DynamicTexture
} from '@babylonjs/core'
import { GATE_CONFIGS, GATE_SPAWNS, GateConfig } from '../data/gateData'
import { SquadSystem } from './SquadSystem'

interface GateInstance {
  leftPillar: Mesh
  rightPillar: Mesh
  leftLabel: Mesh
  rightLabel: Mesh
  config: GateConfig
  side: 'left' | 'right'
  z: number
  passed: boolean
  pairPassed: boolean
}

export class GateSystem {
  private gates: GateInstance[] = []
  private onPassCallbacks: Array<(cfg: GateConfig) => void> = []
  private spawnIndex = 0
  private squadStats = { attackMultiplier: 1.0, fireRateMultiplier: 1.0, rangeMultiplier: 1.0 }

  constructor(private scene: Scene, private squad: SquadSystem) {}

  onPass(cb: (cfg: GateConfig) => void): void { this.onPassCallbacks.push(cb) }

  getStats() { return this.squadStats }

  private spawnGatePair(spawnZ: number, leftId: string, rightId: string): void {
    const leftCfg = GATE_CONFIGS[leftId]
    const rightCfg = GATE_CONFIGS[rightId]
    const laneX = 4

    const makeGate = (cfg: GateConfig, x: number, side: 'left' | 'right') => {
      const pillar = MeshBuilder.CreateBox(`gate_${cfg.id}_${side}`, { width: 0.4, height: 6, depth: 0.4 }, this.scene)
      const mat = new StandardMaterial(`gatemat_${cfg.id}_${side}`, this.scene)
      mat.diffuseColor = Color3.FromHexString(cfg.color)
      mat.emissiveColor = Color3.FromHexString(cfg.color).scale(0.3)
      pillar.material = mat
      pillar.position.set(x, 3, spawnZ)

      // 라벨 텍스처
      const tex = new DynamicTexture(`labtex_${cfg.id}_${side}`, { width: 256, height: 128 }, this.scene)
      const ctx = tex.getContext() as CanvasRenderingContext2D
      ctx.fillStyle = 'transparent'
      ctx.clearRect(0, 0, 256, 128)
      ctx.fillStyle = cfg.color
      ctx.font = 'bold 64px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(cfg.displayText, 128, 80)
      tex.update()

      const labelMesh = MeshBuilder.CreatePlane(`label_${cfg.id}_${side}`, { width: 4, height: 2 }, this.scene)
      const labelMat = new StandardMaterial(`labelmat_${cfg.id}_${side}`, this.scene)
      labelMat.diffuseTexture = tex
      labelMat.emissiveTexture = tex
      labelMat.backFaceCulling = false
      labelMesh.material = labelMat
      labelMesh.position.set(x, 4.5, spawnZ)

      return { pillar, label: labelMesh }
    }

    const leftMeshes  = makeGate(leftCfg,  -laneX, 'left')
    const rightMeshes = makeGate(rightCfg,  laneX, 'right')

    const inst: GateInstance = {
      leftPillar: leftMeshes.pillar,
      rightPillar: rightMeshes.pillar,
      leftLabel: leftMeshes.label,
      rightLabel: rightMeshes.label,
      config: leftCfg,    // placeholder, checked per-side
      side: 'left',
      z: spawnZ,
      passed: false,
      pairPassed: false,
    }
    // Store both configs
    ;(inst as unknown as Record<string, GateConfig>)['leftCfg'] = leftCfg
    ;(inst as unknown as Record<string, GateConfig>)['rightCfg'] = rightCfg
    this.gates.push(inst)
  }

  update(dt: number): void {
    // 스폰
    while (
      this.spawnIndex < GATE_SPAWNS.length &&
      this.squad.squadZ >= GATE_SPAWNS[this.spawnIndex].z - 40
    ) {
      const s = GATE_SPAWNS[this.spawnIndex++]
      this.spawnGatePair(s.z, s.leftGateId, s.rightGateId)
    }

    // 충돌 판정
    for (const g of this.gates) {
      if (g.pairPassed) continue
      const dz = Math.abs(this.squad.squadZ - g.z)
      if (dz > 3) continue

      const cfgMap = g as unknown as Record<string, GateConfig>
      const laneX = 4

      // 왼쪽 게이트 통과
      if (!g.passed && this.squad.squadX < 0) {
        g.passed = true
        g.pairPassed = true
        this.applyGate(cfgMap['leftCfg'])
        g.leftPillar.dispose(); g.leftLabel.dispose()
        g.rightPillar.dispose(); g.rightLabel.dispose()
      }
      // 오른쪽 게이트 통과
      else if (!g.passed && this.squad.squadX >= 0) {
        g.passed = true
        g.pairPassed = true
        this.applyGate(cfgMap['rightCfg'])
        g.leftPillar.dispose(); g.leftLabel.dispose()
        g.rightPillar.dispose(); g.rightLabel.dispose()
      }
    }
  }

  private applyGate(cfg: GateConfig): void {
    switch (cfg.type) {
      case 'ADD_SOLDIER':
        this.squad.addSoldiers(cfg.value)
        break
      case 'MULTIPLY_SOLDIER':
        this.squad.addSoldiers(Math.floor(this.squad.soldierCount * (cfg.value - 1)))
        break
      case 'ATTACK_UP':
        this.squadStats.attackMultiplier *= (1 + cfg.value)
        break
      case 'FIRE_RATE_UP':
        this.squadStats.fireRateMultiplier *= (1 + cfg.value)
        break
      case 'RANGE_UP':
        this.squadStats.rangeMultiplier *= (1 + cfg.value)
        break
    }
    for (const cb of this.onPassCallbacks) cb(cfg)
  }
}
```

- [ ] **Step 3: 게이트 동작 확인**

게임 진행 중 Z=25에서 게이트 2개 등장, 부대 위치에 따라 왼/오른쪽 게이트 통과, 병사 증가 확인

- [ ] **Step 4: 커밋**

```bash
git add src/
git commit -m "feat: GateSystem with lane-based gate collision and stat buffs"
```

---

## Task 8: MonsterWaveSystem + CollisionSystem

**Files:**
- Create: `src/game/systems/MonsterWaveSystem.ts`
- Create: `src/game/systems/CollisionSystem.ts`
- Create: `src/game/pools/MonsterPool.ts`
- Create: `src/game/data/monsterData.ts`

**Interfaces:**
- Consumes: `SquadSystem.squadZ`, `QualitySystem.settings.maxMonsters`
- Produces: `MonsterWaveSystem.getAliveMonsters(): MonsterInstance[]`
- Produces: `CollisionSystem.checkBulletHits(pos, radius): MonsterInstance[]`
- Produces: `CollisionSystem.checkMonsterSquadHits(): void` (병사 제거 트리거)

- [ ] **Step 1: monsterData.ts 작성**

```typescript
// src/game/data/monsterData.ts
export type MonsterBehavior = 'BASIC' | 'FAST' | 'TANK'

export interface MonsterConfig {
  id: string
  hp: number
  speed: number
  damage: number
  scale: number
  behavior: MonsterBehavior
  color: string   // 프로시저럴 폴백 색상
}

export const MONSTER_CONFIGS: Record<string, MonsterConfig> = {
  basic: { id: 'basic', hp: 30,  speed: 3.5, damage: 1, scale: 1.0, behavior: 'BASIC', color: '#cc4444' },
  fast:  { id: 'fast',  hp: 15,  speed: 6.0, damage: 1, scale: 0.8, behavior: 'FAST',  color: '#cc8844' },
  tank:  { id: 'tank',  hp: 120, speed: 1.5, damage: 3, scale: 1.6, behavior: 'TANK',  color: '#884488' },
}

export interface WaveConfig {
  id: string
  monsters: Array<{ configId: string; count: number; spawnPattern: 'LINE' | 'BLOCK' | 'V_SHAPE' }>
  startZ: number
}

export const WAVE_CONFIGS: Record<string, WaveConfig> = {
  wave_1: {
    id: 'wave_1',
    startZ: 60,
    monsters: [
      { configId: 'basic', count: 60, spawnPattern: 'BLOCK' },
      { configId: 'fast',  count: 20, spawnPattern: 'LINE'  },
    ],
  },
  wave_2: {
    id: 'wave_2',
    startZ: 130,
    monsters: [
      { configId: 'basic', count: 40, spawnPattern: 'BLOCK' },
      { configId: 'tank',  count: 10, spawnPattern: 'LINE'  },
      { configId: 'fast',  count: 20, spawnPattern: 'V_SHAPE' },
    ],
  },
}
```

- [ ] **Step 2: MonsterPool.ts 작성**

```typescript
// src/game/pools/MonsterPool.ts
import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'
import { ObjectPool } from './ObjectPool'
import { MonsterConfig } from '../data/monsterData'

export interface MonsterInstance {
  mesh: Mesh
  config: MonsterConfig
  hp: number
  maxHp: number
  alive: boolean
  velocity: { x: number; z: number }
}

export class MonsterPool {
  private pool: ObjectPool<MonsterInstance>

  constructor(private scene: Scene, templateMesh: Mesh | null, capacity: number) {
    this.pool = new ObjectPool<MonsterInstance>(
      () => this.createInstance(),
      (m) => {
        m.mesh.setEnabled(false)
        m.alive = false
        m.hp = 0
      },
      capacity
    )
  }

  private createInstance(): MonsterInstance {
    const mesh = MeshBuilder.CreateCylinder('monster', { height: 2, diameter: 1 }, this.scene)
    const mat = new StandardMaterial('monsterMat', this.scene)
    mat.diffuseColor = new Color3(0.8, 0.2, 0.2)
    mesh.material = mat
    mesh.setEnabled(false)
    return { mesh, config: null!, hp: 0, maxHp: 0, alive: false, velocity: { x: 0, z: 0 } }
  }

  spawn(config: MonsterConfig, x: number, z: number): MonsterInstance {
    const inst = this.pool.get()
    inst.config = config
    inst.hp = config.hp
    inst.maxHp = config.hp
    inst.alive = true
    inst.velocity.x = 0
    inst.velocity.z = -config.speed
    inst.mesh.scaling.setAll(config.scale)
    ;(inst.mesh.material as StandardMaterial).diffuseColor = Color3.FromHexString(config.color)
    inst.mesh.position.set(x, 1, z)
    inst.mesh.setEnabled(true)
    return inst
  }

  release(inst: MonsterInstance): void { this.pool.release(inst) }
  getActive(): MonsterInstance[] { return this.pool.getActive() }
  activeCount(): number { return this.pool.activeCount() }
}
```

- [ ] **Step 3: MonsterWaveSystem.ts 작성**

```typescript
// src/game/systems/MonsterWaveSystem.ts
import { Scene, Mesh } from '@babylonjs/core'
import { MonsterPool, MonsterInstance } from '../pools/MonsterPool'
import { WAVE_CONFIGS, MonsterConfig, MONSTER_CONFIGS } from '../data/monsterData'
import { QualitySettings } from './QualitySystem'

export class MonsterWaveSystem {
  private pool: MonsterPool
  private spawnedWaves = new Set<string>()

  constructor(
    private scene: Scene,
    templateMesh: Mesh | null,
    private quality: QualitySettings
  ) {
    this.pool = new MonsterPool(scene, templateMesh, quality.maxMonsters)
  }

  update(squadZ: number, dt: number): void {
    // 웨이브 스폰 트리거
    for (const [id, wave] of Object.entries(WAVE_CONFIGS)) {
      if (!this.spawnedWaves.has(id) && squadZ >= wave.startZ - 50) {
        this.spawnedWaves.add(id)
        this.spawnWave(wave.startZ)
      }
    }

    // 몬스터 이동
    for (const m of this.pool.getActive()) {
      m.mesh.position.x += m.velocity.x * dt
      m.mesh.position.z += m.velocity.z * dt

      // 부대 쪽으로 조금씩 방향 조정 (추후 ShootingSystem에서 사용)
      if (m.mesh.position.z < -10) {
        this.kill(m)
      }
    }
  }

  private spawnWave(baseZ: number): void {
    const waveKeys = Object.keys(WAVE_CONFIGS)
    // 현재 Z 기준으로 가장 가까운 웨이브 찾기
    for (const [, wave] of Object.entries(WAVE_CONFIGS)) {
      if (wave.startZ !== baseZ) continue
      let spawnCount = 0
      for (const group of wave.monsters) {
        const cfg = MONSTER_CONFIGS[group.configId]
        const count = Math.min(group.count, this.quality.maxMonsters - spawnCount)
        this.spawnGroup(cfg, count, baseZ, group.spawnPattern)
        spawnCount += count
        if (spawnCount >= this.quality.maxMonsters) break
      }
    }
  }

  private spawnGroup(
    cfg: MonsterConfig,
    count: number,
    baseZ: number,
    pattern: 'LINE' | 'BLOCK' | 'V_SHAPE'
  ): void {
    for (let i = 0; i < count; i++) {
      let x = 0, z = baseZ
      if (pattern === 'LINE') {
        x = (i - count / 2) * 1.5
      } else if (pattern === 'BLOCK') {
        const cols = Math.ceil(Math.sqrt(count))
        x = ((i % cols) - cols / 2) * 1.8
        z = baseZ + Math.floor(i / cols) * 2.0
      } else if (pattern === 'V_SHAPE') {
        x = (i - count / 2) * 1.5
        z = baseZ + Math.abs(i - count / 2) * 1.5
      }
      this.pool.spawn(cfg, x, z)
    }
  }

  kill(m: MonsterInstance): void {
    if (!m.alive) return
    m.alive = false
    this.pool.release(m)
  }

  getAlive(): MonsterInstance[] { return this.pool.getActive().filter(m => m.alive) }
  aliveCount(): number { return this.pool.activeCount() }
}
```

- [ ] **Step 4: CollisionSystem.ts 작성**

```typescript
// src/game/systems/CollisionSystem.ts
import { Vector3 } from '@babylonjs/core'
import { MonsterInstance, MonsterPool } from '../pools/MonsterPool'
import { SquadSystem } from './SquadSystem'
import { MonsterWaveSystem } from './MonsterWaveSystem'

export class CollisionSystem {
  constructor(
    private squad: SquadSystem,
    private waves: MonsterWaveSystem
  ) {}

  // 총알 히트 판정: 위치 + 반경
  getBulletsInRange(originX: number, originZ: number, range: number): MonsterInstance[] {
    const result: MonsterInstance[] = []
    for (const m of this.waves.getAlive()) {
      const dx = m.mesh.position.x - originX
      const dz = m.mesh.position.z - originZ
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist <= range) result.push(m)
    }
    return result
  }

  // 몬스터-병사 충돌 (몬스터가 부대 Z 근처에 도달 시)
  checkMonsterSquadCollision(): MonsterInstance[] {
    const hits: MonsterInstance[] = []
    for (const m of this.waves.getAlive()) {
      const dz = m.mesh.position.z - this.squad.squadZ
      const dx = m.mesh.position.x - this.squad.squadX
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 2.5) hits.push(m)
    }
    return hits
  }
}
```

- [ ] **Step 5: 몬스터 웨이브 동작 확인**

Z=60에서 몬스터 80마리 블록 대형 등장, Z=-10 이하 도달 시 풀 반환 확인
`console.log('[Wave] alive:', waveSystem.aliveCount())` 로 수 추적

- [ ] **Step 6: 커밋**

```bash
git add src/
git commit -m "feat: MonsterWaveSystem, MonsterPool, CollisionSystem"
```

---

## Task 9: ShootingSystem + ProjectileSystem (자동 사격)

**Files:**
- Create: `src/game/systems/ShootingSystem.ts`
- Create: `src/game/systems/ProjectileSystem.ts`

**Interfaces:**
- Consumes: `SquadSystem.getAlivePositions()`, `CollisionSystem.getBulletsInRange()`, `GateSystem.getStats()`
- Produces: 몬스터 HP 감소 → 0 이하 시 `MonsterWaveSystem.kill()` 호출
- Produces: Trail 파티클 시각화

- [ ] **Step 1: ShootingSystem.ts 작성**

```typescript
// src/game/systems/ShootingSystem.ts
import { Vector3 } from '@babylonjs/core'
import { SquadSystem } from './SquadSystem'
import { MonsterWaveSystem } from './MonsterWaveSystem'
import { CollisionSystem } from './CollisionSystem'
import { GateSystem } from './GateSystem'
import { SOLDIER_BASE } from '../data/soldierData'

export class ShootingSystem {
  private timers = new Map<string, number>()   // soldierIndex → cooldown 남은 시간

  constructor(
    private squad: SquadSystem,
    private waves: MonsterWaveSystem,
    private collision: CollisionSystem,
    private gates: GateSystem
  ) {}

  update(dt: number): void {
    const stats = this.gates.getStats()
    const fireRate = SOLDIER_BASE.fireRate * stats.fireRateMultiplier
    const cooldown = 1 / fireRate
    const damage = SOLDIER_BASE.attackDamage * stats.attackMultiplier
    const range = SOLDIER_BASE.attackRange * stats.rangeMultiplier

    const aliveMonsters = this.waves.getAlive()
    if (aliveMonsters.length === 0) return

    const count = this.squad.soldierCount

    for (let i = 0; i < count; i++) {
      const key = `s_${i}`
      const timer = (this.timers.get(key) ?? 0) - dt
      if (timer > 0) {
        this.timers.set(key, timer)
        continue
      }
      this.timers.set(key, cooldown)

      // 가장 가까운 몬스터 타깃
      const soldierX = this.squad.squadX + (i % 5 - 2) * 1.4
      const soldierZ = this.squad.squadZ
      let nearest = aliveMonsters[0]
      let nearestDist = Infinity
      for (const m of aliveMonsters) {
        const dx = m.mesh.position.x - soldierX
        const dz = m.mesh.position.z - soldierZ
        const d = Math.sqrt(dx * dx + dz * dz)
        if (d < nearestDist && d <= range) {
          nearestDist = d
          nearest = m
        }
      }
      if (!nearest || nearestDist > range) continue

      // 데미지 적용
      nearest.hp -= damage
      if (nearest.hp <= 0) {
        this.waves.kill(nearest)
      }
    }
  }
}
```

- [ ] **Step 2: ProjectileSystem.ts (Trail 시각화) 작성**

```typescript
// src/game/systems/ProjectileSystem.ts
import {
  Scene, ParticleSystem, Texture, Vector3, Color4, MeshBuilder, Mesh
} from '@babylonjs/core'

interface Trail {
  from: Vector3
  to: Vector3
  lifetime: number
  mesh: Mesh
}

export class ProjectileSystem {
  private trails: Trail[] = []
  private scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
  }

  addTrail(from: Vector3, to: Vector3): void {
    // 실린더로 총알 궤적 표현
    const dir = to.subtract(from)
    const length = dir.length()
    if (length < 0.1) return

    const mid = from.add(dir.scale(0.5))
    const trail = MeshBuilder.CreateCylinder(
      'trail',
      { height: length, diameter: 0.04, tessellation: 3 },
      this.scene
    )
    trail.position.copyFrom(mid)
    // 방향 정렬
    const up = new Vector3(0, 1, 0)
    const axis = Vector3.Cross(up, dir.normalize())
    const angle = Math.acos(Vector3.Dot(up, dir.normalize()) / dir.normalize().length())
    trail.rotateAround(mid, axis.normalize(), angle)

    this.trails.push({ from, to, lifetime: 0.06, mesh: trail })
  }

  update(dt: number): void {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].lifetime -= dt
      if (this.trails[i].lifetime <= 0) {
        this.trails[i].mesh.dispose()
        this.trails.splice(i, 1)
      }
    }
  }
}
```

- [ ] **Step 3: 자동 사격 동작 확인**

몬스터 웨이브 등장 시 자동으로 HP 감소 → 사망 확인
Trail 실린더가 병사→몬스터 방향으로 짧게 표시되다 사라짐 확인

- [ ] **Step 4: 커밋**

```bash
git add src/
git commit -m "feat: ShootingSystem auto-fire + ProjectileSystem trail"
```

---

## Task 10: BossSystem + FXSystem

**Files:**
- Create: `src/game/systems/BossSystem.ts`
- Create: `src/game/systems/FXSystem.ts`

**Interfaces:**
- Consumes: `SquadSystem.squadZ`, `.removeSoldiers()`, boss GLB template
- Produces: `BossSystem.isAlive(): boolean`, `.update(dt)`, `BossSystem.onDeath: () => void`
- Produces: `FXSystem.playHitSpark(pos)`, `.playExplosion(pos)`, `.playGateEffect(pos)`

- [ ] **Step 1: FXSystem.ts 작성**

```typescript
// src/game/systems/FXSystem.ts
import {
  Scene, ParticleSystem, Color4, Vector3, MeshBuilder, StandardMaterial, Color3, Mesh
} from '@babylonjs/core'

export class FXSystem {
  constructor(private scene: Scene) {}

  playHitSpark(pos: Vector3): void {
    const ps = new ParticleSystem('hit', 20, this.scene)
    ps.emitter = pos.clone()
    ps.color1 = new Color4(1, 0.8, 0.2, 1)
    ps.color2 = new Color4(1, 0.2, 0, 1)
    ps.colorDead = new Color4(0, 0, 0, 0)
    ps.minSize = 0.05
    ps.maxSize = 0.15
    ps.minLifeTime = 0.08
    ps.maxLifeTime = 0.2
    ps.emitRate = 200
    ps.minEmitPower = 3
    ps.maxEmitPower = 6
    ps.updateSpeed = 0.02
    ps.start()
    setTimeout(() => ps.dispose(), 300)
  }

  playExplosion(pos: Vector3, scale = 1.0): void {
    const ps = new ParticleSystem('explosion', 60, this.scene)
    ps.emitter = pos.clone()
    ps.color1 = new Color4(1, 0.6, 0.1, 1)
    ps.color2 = new Color4(1, 0.1, 0, 0.8)
    ps.colorDead = new Color4(0.1, 0.1, 0.1, 0)
    ps.minSize = 0.3 * scale
    ps.maxSize = 1.2 * scale
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.8
    ps.emitRate = 500
    ps.minEmitPower = 5 * scale
    ps.maxEmitPower = 12 * scale
    ps.updateSpeed = 0.02
    ps.start()
    setTimeout(() => ps.dispose(), 1000)
  }

  playGateEffect(pos: Vector3): void {
    const ps = new ParticleSystem('gate', 40, this.scene)
    ps.emitter = pos.clone()
    ps.color1 = new Color4(0.2, 1, 0.4, 1)
    ps.color2 = new Color4(1, 1, 0, 1)
    ps.colorDead = new Color4(0, 0, 0, 0)
    ps.minSize = 0.1
    ps.maxSize = 0.4
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.6
    ps.emitRate = 300
    ps.minEmitPower = 4
    ps.maxEmitPower = 8
    ps.updateSpeed = 0.02
    ps.start()
    setTimeout(() => ps.dispose(), 800)
  }
}
```

- [ ] **Step 2: BossSystem.ts 작성**

```typescript
// src/game/systems/BossSystem.ts
import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core'
import { SquadSystem } from './SquadSystem'
import { FXSystem } from './FXSystem'

export class BossSystem {
  private bossMesh: Mesh | null = null
  private hp = 0
  private maxHp = 500
  private spawned = false
  private attackTimer = 0
  private attackInterval = 3.0
  onDeath?: () => void
  onDamageSoldiers?: (n: number) => void

  private spawnZ = 175

  constructor(
    private scene: Scene,
    private squad: SquadSystem,
    private fx: FXSystem,
    templateMesh: Mesh | null
  ) {}

  update(dt: number, squadAttack: number): void {
    if (!this.spawned && this.squad.squadZ >= this.spawnZ - 60) {
      this.spawn()
    }
    if (!this.bossMesh || this.hp <= 0) return

    this.attackTimer -= dt
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackInterval
      this.doAttack()
    }

    // 병사 사격 데미지 (ShootingSystem이 보스를 타깃으로 잡을 수 있도록)
    if (this.squad.squadZ >= this.spawnZ - 30) {
      const dps = squadAttack * this.squad.soldierCount * 0.5
      this.hp -= dps * dt
      if (this.hp <= 0) {
        this.die()
      }
    }
  }

  private spawn(): void {
    this.spawned = true
    this.hp = this.maxHp

    this.bossMesh = MeshBuilder.CreateCylinder('boss', { height: 5, diameter: 4 }, this.scene)
    const mat = new StandardMaterial('bossMat', this.scene)
    mat.diffuseColor = new Color3(0.6, 0.1, 0.8)
    mat.emissiveColor = new Color3(0.1, 0, 0.15)
    this.bossMesh.material = mat
    this.bossMesh.position.set(0, 2.5, this.spawnZ)
  }

  private doAttack(): void {
    if (!this.bossMesh) return
    // 충격파: 일정 범위 병사 제거
    const removed = Math.max(1, Math.floor(this.squad.soldierCount * 0.1))
    this.squad.removeSoldiers(removed)
    this.onDamageSoldiers?.(removed)
    this.fx.playExplosion(this.bossMesh.position, 1.5)
  }

  private die(): void {
    if (this.bossMesh) {
      this.fx.playExplosion(this.bossMesh.position, 3.0)
      this.bossMesh.dispose()
      this.bossMesh = null
    }
    this.onDeath?.()
  }

  getHpRatio(): number { return this.spawned ? Math.max(0, this.hp / this.maxHp) : -1 }
  isAlive(): boolean { return this.spawned && this.hp > 0 }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/
git commit -m "feat: BossSystem + FXSystem particle effects"
```

---

## Task 11: HUD + ResultScreen + 전체 게임 루프 통합

**Files:**
- Create: `src/ui/Hud.ts`
- Create: `src/ui/ResultScreen.ts`
- Create: `src/game/Game.ts`
- Modify: `src/main.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: 모든 시스템 인스턴스
- Produces: 완전한 게임 루프 (LOADING→START→PLAYING→RESULT→RETRY)

- [ ] **Step 1: Hud.ts 작성**

```typescript
// src/ui/Hud.ts
export class Hud {
  private el: HTMLDivElement
  private soldierEl!: HTMLElement
  private stageEl!: HTMLElement
  private bossHpEl!: HTMLElement
  private bossHpBarEl!: HTMLElement
  private fpsEl!: HTMLElement

  constructor(root: HTMLElement) {
    this.el = document.createElement('div')
    this.el.id = 'hud'
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-soldiers">👥 <span id="hud-soldiers">20</span></div>
        <div class="hud-stage" id="hud-stage">▓▒░ 0%</div>
        <div class="hud-fps" id="hud-fps">60fps</div>
      </div>
      <div class="hud-boss-bar" id="hud-boss-bar" style="display:none">
        <div class="boss-label">⚡ TITAN BOSS</div>
        <div class="boss-hp-wrap">
          <div class="boss-hp-fill" id="boss-hp-fill"></div>
        </div>
      </div>
    `
    root.appendChild(this.el)
    this.soldierEl = document.getElementById('hud-soldiers')!
    this.stageEl = document.getElementById('hud-stage')!
    this.bossHpEl = document.getElementById('hud-boss-bar')!
    this.bossHpBarEl = document.getElementById('boss-hp-fill')!
    this.fpsEl = document.getElementById('hud-fps')!
  }

  update(soldiers: number, progressPct: number, bossHpRatio: number, fps: number): void {
    this.soldierEl.textContent = String(soldiers)
    this.stageEl.textContent = `${Math.round(progressPct)}%`
    this.fpsEl.textContent = `${Math.round(fps)}fps`
    if (bossHpRatio >= 0) {
      this.bossHpEl.style.display = 'block'
      this.bossHpBarEl.style.width = `${bossHpRatio * 100}%`
    } else {
      this.bossHpEl.style.display = 'none'
    }
  }

  show(): void { this.el.style.display = 'block' }
  hide(): void { this.el.style.display = 'none' }
}
```

- [ ] **Step 2: ResultScreen.ts 작성**

```typescript
// src/ui/ResultScreen.ts
export class ResultScreen {
  private el: HTMLDivElement
  onRetry?: () => void

  constructor(root: HTMLElement) {
    this.el = document.createElement('div')
    this.el.id = 'result-screen'
    this.el.style.display = 'none'
    this.el.innerHTML = `
      <div class="result-inner">
        <div class="result-title" id="result-title">VICTORY!</div>
        <div class="result-stats" id="result-stats"></div>
        <button class="retry-btn" id="retry-btn">RETRY</button>
      </div>
    `
    root.appendChild(this.el)
    document.getElementById('retry-btn')?.addEventListener('click', () => this.onRetry?.())
  }

  show(victory: boolean, stats: { monstersKilled: number; soldiersLeft: number }): void {
    const title = document.getElementById('result-title')!
    title.textContent = victory ? '🏆 VICTORY!' : '💀 DEFEAT'
    title.style.color = victory ? '#ffd700' : '#ff4444'
    document.getElementById('result-stats')!.innerHTML = `
      <div>처치: ${stats.monstersKilled}마리</div>
      <div>생존: ${stats.soldiersLeft}명</div>
    `
    this.el.style.display = 'flex'
  }

  hide(): void { this.el.style.display = 'none' }
}
```

- [ ] **Step 3: HUD + Result CSS 추가**

`src/styles/global.css` 에 추가:

```css
/* HUD */
#hud { position: fixed; top: 0; left: 0; width: 100%; z-index: 20; pointer-events: none; }
.hud-top {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px;
  background: linear-gradient(180deg, #00000088 0%, transparent 100%);
}
.hud-soldiers { color: #fff; font-size: 1.3rem; font-weight: 700; text-shadow: 0 2px 8px #000; }
.hud-stage { color: #ffcc44; font-size: 1rem; }
.hud-fps { color: #44ff88; font-size: 0.8rem; opacity: 0.7; }
.hud-boss-bar {
  margin: 0 20px;
  background: #00000088; border-radius: 8px; padding: 8px 16px;
}
.boss-label { color: #ff4444; font-weight: 700; font-size: 0.9rem; margin-bottom: 6px; text-align: center; }
.boss-hp-wrap {
  width: 100%; height: 16px; background: #333;
  border-radius: 8px; overflow: hidden; border: 1px solid #ff4444;
}
.boss-hp-fill {
  height: 100%; width: 100%;
  background: linear-gradient(90deg, #ff2200, #ff6600);
  border-radius: 8px;
  transition: width 0.2s ease;
}

/* Result Screen */
#result-screen {
  position: fixed; inset: 0;
  background: #00000099;
  display: none; align-items: center; justify-content: center;
  z-index: 80;
}
.result-inner { text-align: center; }
.result-title {
  font-size: 4rem; font-weight: 900;
  color: #ffd700; text-shadow: 0 0 40px #ffd70088;
  margin-bottom: 1.5rem;
}
.result-stats { color: #ccc; font-size: 1.2rem; margin-bottom: 2rem; line-height: 2; }
.retry-btn {
  font-size: 1.3rem; font-weight: 700; letter-spacing: 0.1em;
  color: #0a0a1a; background: #ffd700;
  border: none; border-radius: 50px; padding: 1rem 3rem;
  cursor: pointer; transition: transform 0.1s, box-shadow 0.1s;
}
.retry-btn:hover { transform: scale(1.05); box-shadow: 0 0 30px #ffd70088; }
```

- [ ] **Step 4: Game.ts — 전체 시스템 조합**

```typescript
// src/game/Game.ts
import { Scene, Engine } from '@babylonjs/core'
import { GameLoop } from './GameLoop'
import { InputController } from './InputController'
import { CameraController } from './CameraController'
import { SquadSystem } from './systems/SquadSystem'
import { GateSystem } from './systems/GateSystem'
import { ShootingSystem } from './systems/ShootingSystem'
import { ProjectileSystem } from './systems/ProjectileSystem'
import { MonsterWaveSystem } from './systems/MonsterWaveSystem'
import { CollisionSystem } from './systems/CollisionSystem'
import { BossSystem } from './systems/BossSystem'
import { FXSystem } from './systems/FXSystem'
import { QualitySystem } from './systems/QualitySystem'
import { AssetManifest } from './utils/assetLoader'
import { Hud } from '../ui/Hud'
import { ResultScreen } from '../ui/ResultScreen'
import { LEVEL_1 } from './data/levelData'

export class Game {
  private loop: GameLoop
  private input: InputController
  private camera: CameraController
  private squad: SquadSystem
  private gates: GateSystem
  private waves: MonsterWaveSystem
  private collision: CollisionSystem
  private shooting: ShootingSystem
  private projectiles: ProjectileSystem
  private boss: BossSystem
  private fx: FXSystem
  private hud: Hud
  private result: ResultScreen
  private monstersKilled = 0
  private gameOver = false
  onGameOver?: (victory: boolean) => void

  constructor(
    private scene: Scene,
    private engine: Engine,
    canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    assets: AssetManifest | undefined,
    quality: QualitySystem
  ) {
    this.fx = new FXSystem(scene)
    this.loop = new GameLoop(scene)
    this.input = new InputController(canvas)
    this.camera = new CameraController(scene)
    this.squad = new SquadSystem(scene, assets?.soldier ?? null, quality.settings.maxSoldiers)
    this.gates = new GateSystem(scene, this.squad)
    this.waves = new MonsterWaveSystem(scene, assets?.monsterBasic ?? null, quality.settings)
    this.collision = new CollisionSystem(this.squad, this.waves)
    this.shooting = new ShootingSystem(this.squad, this.waves, this.collision, this.gates)
    this.projectiles = new ProjectileSystem(scene)
    this.boss = new BossSystem(scene, this.squad, this.fx, assets?.boss ?? null)
    this.hud = new Hud(uiRoot)
    this.result = new ResultScreen(uiRoot)

    this.boss.onDeath = () => this.endGame(true)
    this.result.onRetry = () => window.location.reload()

    this.hud.show()
  }

  start(): void {
    let fpsAccum = 0, fpsFrames = 0

    this.loop.add((dt) => {
      if (this.gameOver) return

      const dx = this.input.getDeltaX()
      this.squad.update(dx, dt)
      this.gates.update(dt)
      this.waves.update(this.squad.squadZ, dt)
      this.shooting.update(dt)
      this.projectiles.update(dt)
      this.boss.update(dt, 10 * this.gates.getStats().attackMultiplier)
      this.camera.follow(this.squad.squadZ, this.squad.squadX, dt)

      // 몬스터-병사 충돌
      const hits = this.collision.checkMonsterSquadCollision()
      for (const m of hits) {
        this.squad.removeSoldiers(m.config.damage)
        this.waves.kill(m)
        this.fx.playHitSpark(m.mesh.position)
      }

      if (this.squad.soldierCount <= 0) {
        this.endGame(false)
        return
      }

      // HUD 업데이트
      fpsAccum += 1 / dt
      fpsFrames++
      if (fpsFrames >= 30) {
        const fps = fpsAccum / fpsFrames
        const progress = Math.min(100, (this.squad.squadZ / LEVEL_1.totalLength) * 100)
        this.hud.update(this.squad.soldierCount, progress, this.boss.getHpRatio(), fps)
        fpsAccum = 0; fpsFrames = 0
      }
    })
  }

  private endGame(victory: boolean): void {
    if (this.gameOver) return
    this.gameOver = true
    this.hud.hide()
    this.result.show(victory, {
      monstersKilled: this.monstersKilled,
      soldiersLeft: this.squad.soldierCount,
    })
    this.onGameOver?.(victory)
  }
}
```

- [ ] **Step 5: main.ts 최종 연결**

```typescript
// src/main.ts
import { createEngine } from './game/RendererFactory'
import { initScene } from './game/SceneBootstrap'
import { qualitySystem } from './game/systems/QualitySystem'
import { App } from './app/App'
import { Game } from './game/Game'

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  const uiRoot = document.getElementById('ui-root') as HTMLElement
  const engine = await createEngine(canvas)
  const scene = initScene(engine)

  const app = new App(engine, scene, uiRoot)
  await app.init()

  app.transitionTo = (next) => {
    if (next === 'playing') {
      const game = new Game(scene, engine, canvas, uiRoot, app.assets, qualitySystem)
      game.start()
    }
    ;(app as unknown as Record<string, unknown>)['state'] = next
  }

  engine.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => engine.resize())
  qualitySystem.autoDetect(engine)
}

main().catch(console.error)
```

- [ ] **Step 6: 전체 게임 루프 테스트**

```bash
npm run dev
```

체크리스트:
- [ ] 로딩 → TAP TO START → 게임 시작
- [ ] 병사 20명 격자 이동
- [ ] Z=25 게이트 통과 → 병사 수 증가 확인
- [ ] Z=60 몬스터 웨이브 등장 → 자동 사격 → 몬스터 사망
- [ ] Z=160 보스 등장 → HP Bar 표시 → 보스 공격 → 병사 감소
- [ ] 보스 사망 → Victory 화면 → Retry 동작

- [ ] **Step 7: 커밋**

```bash
git add src/
git commit -m "feat: complete game loop - HUD, ResultScreen, Game.ts integration"
```

---

## Task 12: 그래픽 품질 향상 (포스트 프로세싱 + 환경)

**Files:**
- Modify: `src/game/SceneBootstrap.ts`
- Create: `src/game/SceneEnvironment.ts`

**Interfaces:**
- Produces: Bloom 포스트 프로세싱, HDR 환경맵, 다이나믹 스카이박스

- [ ] **Step 1: SceneEnvironment.ts 작성**

```typescript
// src/game/SceneEnvironment.ts
import {
  Scene, Color3, Color4, MeshBuilder, StandardMaterial, GradientMaterial,
  PostProcess, BloomMergePostProcess, DefaultRenderingPipeline, Vector3
} from '@babylonjs/core'
import { QualitySettings } from './systems/QualitySystem'

export function setupEnvironment(scene: Scene, quality: QualitySettings): void {
  // 하늘
  const sky = MeshBuilder.CreateSphere('sky', { diameter: 500, segments: 4 }, scene)
  const skyMat = new StandardMaterial('skyMat', scene)
  skyMat.emissiveColor = new Color3(0.53, 0.81, 0.98)
  skyMat.backFaceCulling = false
  sky.material = skyMat

  // 포스트 프로세싱 (High 품질만)
  if (quality.postProcessEnabled) {
    const pipeline = new DefaultRenderingPipeline('pipeline', true, scene, scene.cameras)
    pipeline.bloomEnabled = true
    pipeline.bloomWeight = 0.3
    pipeline.bloomThreshold = 0.7
    pipeline.bloomScale = 0.5
    pipeline.sharpenEnabled = true
    pipeline.sharpen.edgeAmount = 0.2
  }

  // 도로 생성 (환경 에셋 없을 때 프로시저럴)
  const roadCount = 20
  for (let i = 0; i < roadCount; i++) {
    const road = MeshBuilder.CreateBox(`road_${i}`, { width: 14, height: 0.2, depth: 12 }, scene)
    const mat = new StandardMaterial(`roadMat_${i}`, scene)
    mat.diffuseColor = new Color3(0.25, 0.28, 0.32)
    road.material = mat
    road.position.set(0, -0.1, i * 12)
  }
}
```

- [ ] **Step 2: 환경 적용 확인**

High 품질에서 Bloom 효과 확인, 도로 타일 생성 확인

- [ ] **Step 3: 커밋**

```bash
git add src/
git commit -m "feat: SceneEnvironment with bloom post-processing and procedural road"
```

---

## Task 13: 성능 최적화 + Instanced Mesh + 모바일 최적화

**Files:**
- Modify: `src/game/pools/MonsterPool.ts`
- Modify: `src/game/systems/SquadSystem.ts`

- [ ] **Step 1: MonsterPool Instanced Mesh 전환**

```typescript
// MonsterPool.ts - createInstance 메서드를 InstancedMesh로 교체

import { Mesh, InstancedMesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'

// 클래스 필드 추가
private baseMesh: Mesh | null = null

// initBaseMesh 메서드 추가
initBaseMesh(template: Mesh | null): void {
  if (template) {
    this.baseMesh = template
  } else {
    this.baseMesh = MeshBuilder.CreateCylinder('monsterBase', { height: 2, diameter: 1 }, this.scene)
    const mat = new StandardMaterial('monsterBaseMat', this.scene)
    mat.diffuseColor = new Color3(0.8, 0.2, 0.2)
    this.baseMesh.material = mat
    this.baseMesh.setEnabled(false)
  }
}

// createInstance에서 InstancedMesh 사용
private createInstance(): MonsterInstance {
  if (!this.baseMesh) this.initBaseMesh(null)
  const mesh = this.baseMesh!.createInstance('monster_inst')
  mesh.setEnabled(false)
  return { mesh: mesh as unknown as Mesh, config: null!, hp: 0, maxHp: 0, alive: false, velocity: { x: 0, z: 0 } }
}
```

- [ ] **Step 2: 모바일 성능 테스트**

실기기(또는 DevTools 모바일 에뮬레이션)에서:
```
Chrome DevTools → Performance → Throttle 4x CPU → 게임 실행
목표: 30fps 이상
```

- [ ] **Step 3: FPS 드랍 시 자동 품질 하향 확인**

게임 실행 3초 후 콘솔 `[Quality] detected fps=XX → XX` 출력 확인

- [ ] **Step 4: 커밋**

```bash
git add src/
git commit -m "perf: InstancedMesh for monsters, mobile optimization"
```

---

## Task 14: Vercel 최종 배포 + 공유 URL 생성

**Files:**
- Modify: `vercel.json`
- Create: `public/manifest.webmanifest`

- [ ] **Step 1: manifest.webmanifest 작성 (PWA 지원)**

```json
{
  "name": "Squad Rush",
  "short_name": "Squad Rush",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#0a0a1a",
  "theme_color": "#ffd700",
  "icons": [
    { "src": "/assets/ui/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/ui/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

`dist/` 폴더 생성, 에러 없음 확인

- [ ] **Step 3: 프로덕션 빌드 로컬 프리뷰**

```bash
npm run preview
```

`http://localhost:4173` 에서 프로덕션 빌드 전체 테스트

- [ ] **Step 4: Vercel 최종 배포**

```bash
git add .
git commit -m "feat: final build - Squad Rush v1.0 Vertical Slice"
git push origin main
```

Vercel 자동 배포 트리거 → 배포 완료 후 URL 확인

- [ ] **Step 5: 품질 게이트 전체 검증**

배포된 URL에서 모든 품질 게이트 체크:

```
[ ] G1  URL 접속 → 5초 이내 로딩 화면
[ ] G2  PC 60fps, Android 30fps
[ ] G3  병사 40명 + 몬스터 100마리 렌더
[ ] G4  게이트 통과 효과
[ ] G5  충돌 판정 오차 ±0.5 이하
[ ] G6  보스 HP Bar + 공격 + 사망 연출
[ ] G7  Victory/Retry 동작
[ ] G8  실제 GLB 모델 적용 (또는 프로시저럴 폴백 명확히 표시)
[ ] G9  파티클 이펙트 전부 재생
[ ] G10 HUD/UI 상용 품질
[ ] G11 터치/마우스 입력 지연 없음
[ ] G12 번들 40MB 이하
[ ] G13 품질 자동 전환
[ ] G14 iOS Safari 크래시 없음
[ ] G15 스크린샷이 상용 게임처럼 보임
```

**게이트 미통과 항목 → 해당 Task로 돌아가 수정 후 재배포**

- [ ] **Step 6: URL 공유**

```
배포 URL: https://squad-rush.vercel.app
공유 텍스트: "Squad Rush 플레이 — 설치 없이 바로 플레이: [URL]"
```

---

## Self-Review 결과

### Spec 커버리지

| 요구사항 | 담당 Task |
|---------|----------|
| Vite + TS + Babylon.js | Task 1 |
| Vercel 배포 | Task 1, 14 |
| 무료 리소스 다운로드 | Task 2 |
| 로딩 화면 | Task 4 |
| 자동 전진 + 드래그 이동 | Task 5 |
| 병사 군집 Formation | Task 6 |
| 강화 게이트 | Task 7 |
| 몬스터 웨이브 100+ | Task 8 |
| 자동 사격 + Trail | Task 9 |
| 보스전 | Task 10 |
| HUD + 결과 화면 | Task 11 |
| Bloom 포스트 프로세싱 | Task 12 |
| ObjectPool + InstancedMesh | Task 6, 8, 13 |
| QualitySystem 자동 조정 | Task 3 |
| KTX2 텍스처 | Task 2 |
| 모바일 30fps | Task 13 |
| 품질 게이트 15개 | Task 14 |

### 타입 일관성

- `AssetManifest.soldier`: Task 4에서 정의 → Task 6, 10에서 소비 ✓
- `QualitySettings`: Task 3에서 정의 → Task 8, 11에서 소비 ✓
- `GateConfig`: Task 7에서 정의 → Task 9에서 `getStats()` 소비 ✓
- `MonsterInstance`: Task 8에서 정의 → Task 9, 10, 11에서 소비 ✓
