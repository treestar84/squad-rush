# PRD: 웹 기반 3D 러너 슈팅 게임

## 1. 제품 개요

본 프로젝트는 사용자가 별도 앱 설치 없이 웹 주소로 접속해 즉시 플레이할 수 있는 3D 러너 슈팅 게임이다.

게임은 `Last War`류의 전투 감각을 참고하되, IP·캐릭터·UI·세계관은 독자적으로 설계한다. 플레이어는 자동 전진하는 병사 부대를 좌우로 이동시키며, 강화 게이트를 통과하고, 대량으로 몰려오는 몬스터를 자동 사격으로 처치하고, 최종 보스를 쓰러뜨린다.

본 프로젝트의 1차 목표는 완성형 상용 게임 전체가 아니라, **웹 브라우저에서 바로 실행되는 30~60초 고품질 Vertical Slice**를 만드는 것이다.

---

## 2. 핵심 변경 사항

기존 Unity 모바일 앱 계획을 폐기하고, 웹 기반 게임으로 재설계한다.

### 기존 방향

```text
Unity
URP Mobile
Android/iOS 앱 빌드
Unity Asset Store 중심
APK/IPA 배포
```

### 변경 방향

```text
Vite
TypeScript
Babylon.js
WebGL2 기본 렌더링
WebGPU 선택 지원
GLB/glTF 리소스
KTX2/Basis 텍스처 압축
Vercel 정적 배포
모바일/PC 브라우저 즉시 플레이
```

---

## 3. 기술 스택 결정

### 3.1 최종 추천 스택

```text
Runtime: Browser
Build Tool: Vite
Language: TypeScript
3D Engine: Babylon.js
Rendering: WebGL2 First, WebGPU Optional
UI: HTML/CSS Overlay
Deploy: Vercel
Asset Format: GLB/glTF
Texture Format: KTX2/Basis
Audio: mp3/ogg
Analytics: 추후 Vercel Analytics 또는 GA4
```

---

## 4. 기술 스택 선정 이유

### 4.1 Three.js를 메인으로 선택하지 않는 이유

Three.js는 가장 널리 쓰이는 웹 3D 라이브러리이며 생태계가 매우 크다. 다만 본 프로젝트는 단순 3D 뷰어나 인터랙티브 랜딩 페이지가 아니라, 아래 요소가 필요한 게임이다.

```text
게임 루프
대량 유닛 관리
카메라 추적
애니메이션 상태 관리
파티클
충돌
오브젝트 풀링
씬 디버깅
성능 튜닝
모바일 브라우저 대응
```

Three.js로도 충분히 구현 가능하지만, 게임 엔진적 기능을 직접 조립해야 할 가능성이 크다. 따라서 빠르게 고품질 웹 게임을 만들기 위한 메인 엔진으로는 Babylon.js를 우선 선택한다.

### 4.2 Babylon.js를 선택하는 이유

Babylon.js는 웹 기반 3D 렌더링 엔진이면서 게임 제작에 필요한 기능이 상대적으로 통합되어 있다.

장점:

```text
씬/카메라/메시/머티리얼 구조가 게임 개발에 적합
Inspector 디버깅 도구가 좋음
glTF/GLB 로딩이 자연스러움
파티클/애니메이션/충돌/카메라 기능이 통합적
WebGL2 기반 안정 운영 가능
WebGPU 옵션 확장 가능
Vite/TypeScript와 궁합이 좋음
```

### 4.3 PlayCanvas를 메인으로 선택하지 않는 이유

PlayCanvas는 웹 게임에 강력한 엔진이고, WebGL/WebGPU 기반 게임 제작에 적합하다. 다만 본 프로젝트는 다음 방식의 개발을 선호한다.

```text
로컬 코드 중심
GitHub 중심
Vercel 배포
AI 코딩 도구 활용
직접 아키텍처 제어
커스텀 시스템 설계
```

PlayCanvas의 클라우드 에디터 중심 워크플로우는 협업/비주얼 편집에는 좋지만, 초기 1인 개발/AI 코딩/코드 중심 실험에는 Babylon.js + Vite가 더 단순하다.

### 4.4 WebGPU를 기본값으로 선택하지 않는 이유

WebGPU는 차세대 웹 그래픽 API로 중요하지만, 아직 모든 브라우저/기기에서 안정적인 기본값으로 보기 어렵다.

따라서 본 프로젝트는 아래 전략을 따른다.

```text
기본 렌더러: WebGL2
지원 브라우저: WebGPU 옵션 활성화
미지원 브라우저: WebGL2 유지
저사양 기기: 품질 자동 하향
```

---

## 5. 제품 목표

### 5.1 1차 목표

```text
웹 주소 접속만으로 플레이 가능
Vercel에 정적 배포
30~60초 플레이 가능한 Vertical Slice
모바일 브라우저 30fps 목표
PC 브라우저 60fps 목표
대량 몬스터 웨이브 연출
병사 증가 게이트 구현
자동 사격 구현
보스전 구현
상용 게임처럼 보이는 첫 화면 품질 확보
```

### 5.2 비목표

초기 버전에서는 아래 기능을 제외한다.

```text
회원가입
로그인
랭킹
서버 저장
과금
광고
상점
스킨 뽑기
멀티플레이
복잡한 성장 시스템
앱스토어 출시
Unity 연동
```

---

## 6. 타깃 플랫폼

### 6.1 1차 타깃

```text
Chrome Desktop
Chrome Android
Safari iOS
Edge Desktop
```

### 6.2 2차 타깃

```text
Firefox Desktop
Samsung Internet
iPad Safari
```

### 6.3 성능 목표

```text
PC 브라우저: 60fps
중급 Android Chrome: 30fps 이상
iPhone Safari: 30fps 이상
저사양 모바일: 품질 자동 하향 후 24~30fps
```

---

## 7. 게임 콘셉트

### 7.1 장르

```text
웹 기반 3D 하이퍼캐주얼 러너 슈팅
```

### 7.2 플레이 요약

플레이어는 병사 부대를 조종한다. 부대는 자동으로 전진하고, 사용자는 좌우 드래그로 부대를 움직인다.

전방에는 강화 게이트, 몬스터 웨이브, 장애물, 보스가 등장한다.

플레이어는 좋은 게이트를 선택해 병력 수, 공격력, 발사 속도, 탄환 성능을 강화하고, 다수의 몬스터를 처치하며 끝까지 살아남아야 한다.

---

## 8. 핵심 게임 루프

```text
URL 접속
→ 로딩
→ Tap to Start
→ 병사 부대 자동 전진
→ 좌우 드래그 이동
→ 강화 게이트 선택
→ 병력/공격력/발사 속도 증가
→ 몬스터 웨이브 등장
→ 자동 사격
→ 몬스터 처치
→ 보스 등장
→ 보스 처치
→ Victory 화면
→ Retry / Next
```

---

## 9. 조작 설계

### 9.1 모바일

```text
터치 드래그 좌우 이동
손가락 위치 기반 부대 이동
상하 이동 없음
```

### 9.2 PC

```text
마우스 드래그 좌우 이동
A/D 키 테스트 지원
좌우 방향키 테스트 지원
```

### 9.3 조작 감각

```text
입력 지연 최소화
좌우 이동은 부드럽지만 둔하지 않게
부대 중심은 입력을 즉각 추적
개별 병사는 살짝 늦게 따라오며 군집감 표현
```

---

## 10. 게임 시스템

## 10.1 Player Squad System

플레이어는 개별 병사 하나가 아니라 병사 군집을 조종한다.

### 주요 기능

```text
부대 중심점 이동
병사 Formation Offset 관리
병사 수 증가/감소
자동 사격 타깃 선택
병사 사망 처리
군집 재정렬
```

### 성능 원칙

```text
모든 병사에 독립 AI를 넣지 않는다
모든 병사에 복잡한 물리 충돌을 넣지 않는다
전체 부대 중심을 기준으로 단순 계산한다
병사 개별 위치는 formation offset으로 처리한다
```

---

## 10.2 Gate System

플레이어가 통과하면 즉시 효과가 적용되는 강화 게이트 시스템이다.

### 게이트 종류

```text
+1 Soldier
+5 Soldiers
x2 Soldiers
ATK +20%
FIRE +20%
RANGE +20%
BULLET LV +1
EXPLOSION
PIERCE
```

### 게이트 연출

```text
게이트 텍스트 대형 표시
통과 시 숫자 팝업
병사 생성 이펙트
짧은 카메라 흔들림
강화 사운드
```

---

## 10.3 Auto Shooting System

병사들은 전방의 몬스터를 자동으로 공격한다.

### 타깃 우선순위

```text
가장 가까운 몬스터
부대 중앙선에 가까운 몬스터
체력이 낮은 몬스터
보스
```

### 웹 최적화 원칙

실제 총알 오브젝트를 대량으로 생성하지 않는다.

```text
판정: 즉시 계산 / 거리 기반 / 라인 기반
표현: Trail / Particle / 짧은 Projectile Mesh
피격: Hit Spark Effect
데미지: Damage Tick
```

---

## 10.4 Monster Wave System

몬스터는 다량으로 등장해야 한다. 단, 웹 브라우저 성능 제약을 고려해 실제 계산은 단순화한다.

### 몬스터 종류

```text
Basic Monster
Fast Monster
Tank Monster
Explosive Monster
Boss
```

### 목표 수량

```text
화면 내 동시 몬스터: 50~100
전체 웨이브 몬스터: 100~200
저사양 기기: 30~60으로 자동 하향
```

### 성능 전략

```text
Object Pooling
Instanced Mesh
단순 이동 벡터
거리 기반 충돌
스켈레톤 애니메이션 최소화
멀리 있는 몬스터 애니메이션 생략
죽은 몬스터 즉시 풀 반환
```

---

## 10.5 Boss System

스테이지 마지막에 대형 보스가 등장한다.

### 보스 구성

```text
대형 모델
HP Bar
등장 연출
피격 흔들림
공격 패턴 1개
사망 폭발 연출
Victory 전환
```

### 초기 보스 패턴

```text
일정 시간마다 전방 충격파 발사
충격파에 닿은 병사 일부 제거
```

---

## 11. 웹 렌더링 전략

### 11.1 기본 렌더링

```text
WebGL2 기본
WebGPU 지원 브라우저에서는 옵션 활성화 가능
렌더 스케일 자동 조절
모바일에서는 후처리 최소화
실시간 그림자 제한
Blob Shadow 사용
```

### 11.2 그래픽 품질 단계

```text
Low
- 몬스터 수 감소
- 파티클 수 감소
- 그림자 제거
- 렌더 스케일 0.7

Medium
- 기본 몬스터 수
- 기본 파티클
- Blob Shadow
- 렌더 스케일 0.85

High
- 몬스터 수 증가
- 파티클 증가
- 일부 후처리
- 렌더 스케일 1.0
```

### 11.3 자동 품질 조정

초기 3초 동안 FPS를 측정하고 품질 단계를 자동 설정한다.

```text
FPS 50 이상: High
FPS 30~50: Medium
FPS 30 미만: Low
```

---

## 12. 리소스 전략

### 12.1 포맷

웹에서는 Unity용 FBX/Prefab이 아니라 GLB/glTF 중심으로 리소스를 관리한다.

```text
3D Model: GLB
Texture: KTX2/Basis
Audio: mp3/ogg
UI Icon: SVG/PNG/WebP
Config: JSON/TypeScript
```

### 12.2 병사 리소스 기준

```text
500~1,500 tris
텍스처 512
애니메이션 3~4개
Run / Shoot / Hit / Die
가능하면 동일 스켈레톤 공유
```

### 12.3 몬스터 리소스 기준

```text
500~1,500 tris
텍스처 512
애니메이션 2~3개
Walk / Hit / Die
Basic/Fast/Tank는 동일 모델 변형 가능
```

### 12.4 보스 리소스 기준

```text
3,000~8,000 tris
텍스처 1024
애니메이션 3~4개
Idle / Attack / Hit / Die
```

### 12.5 지형 리소스 기준

```text
모듈형 GLB
Bridge Segment
Road Segment
Gate Frame
Container
Barrier
Water Plane
Boss Arena
```

### 12.6 이펙트 리소스 기준

```text
Muzzle Flash
Bullet Trail
Hit Spark
Small Explosion
Boss Explosion
Gate Upgrade Effect
Damage Number
```

### 12.7 리소스 출처

초기 개발에서 사용할 수 있는 후보:

```text
Quaternius
Kenney
Mixamo
Sketchfab CC0/상업 사용 가능 리소스
Poly Pizza
직접 Blender 리터칭
```

주의사항:

```text
라이선스 확인 필수
상업 사용 가능 여부 확인
재배포 금지 조건 확인
AI 생성 리소스는 원본성과 이용 약관 확인
Last War와 유사한 디자인 직접 복제 금지
```

---

## 13. 프로젝트 구조

```text
web-runner-shooter/
├─ public/
│  ├─ assets/
│  │  ├─ models/
│  │  │  ├─ soldiers/
│  │  │  ├─ monsters/
│  │  │  ├─ boss/
│  │  │  └─ environment/
│  │  ├─ textures/
│  │  ├─ audio/
│  │  └─ ui/
│  ├─ manifest.webmanifest
│  └─ icons/
├─ src/
│  ├─ main.ts
│  ├─ app/
│  │  ├─ App.ts
│  │  └─ routes.ts
│  ├─ game/
│  │  ├─ Game.ts
│  │  ├─ GameLoop.ts
│  │  ├─ SceneBootstrap.ts
│  │  ├─ RendererFactory.ts
│  │  ├─ InputController.ts
│  │  ├─ CameraController.ts
│  │  ├─ systems/
│  │  │  ├─ SquadSystem.ts
│  │  │  ├─ GateSystem.ts
│  │  │  ├─ ShootingSystem.ts
│  │  │  ├─ ProjectileSystem.ts
│  │  │  ├─ MonsterWaveSystem.ts
│  │  │  ├─ CollisionSystem.ts
│  │  │  ├─ BossSystem.ts
│  │  │  ├─ FXSystem.ts
│  │  │  └─ QualitySystem.ts
│  │  ├─ pools/
│  │  │  ├─ ObjectPool.ts
│  │  │  ├─ MonsterPool.ts
│  │  │  └─ FXPool.ts
│  │  ├─ data/
│  │  │  ├─ levelData.ts
│  │  │  ├─ gateData.ts
│  │  │  ├─ soldierData.ts
│  │  │  ├─ monsterData.ts
│  │  │  └─ bossData.ts
│  │  └─ utils/
│  │     ├─ math.ts
│  │     ├─ perf.ts
│  │     └─ assetLoader.ts
│  ├─ ui/
│  │  ├─ Hud.ts
│  │  ├─ LoadingScreen.ts
│  │  ├─ StartScreen.ts
│  │  └─ ResultScreen.ts
│  └─ styles/
│     └─ global.css
├─ package.json
├─ vite.config.ts
├─ vercel.json
└─ README.md
```

---

## 14. 주요 시스템 설계

### 14.1 RendererFactory

브라우저 환경을 감지해 렌더러를 생성한다.

```text
WebGPU 지원 + 옵션 ON → WebGPU Engine
그 외 → WebGL2 Engine
실패 시 → 에러 화면 또는 저사양 안내
```

### 14.2 QualitySystem

기기 성능에 따라 품질을 자동 조절한다.

관리 항목:

```text
renderScale
maxSoldiers
maxMonsters
particleMultiplier
shadowEnabled
postProcessEnabled
animationSkipRate
```

### 14.3 AssetLoader

게임 시작 전 필수 리소스를 로딩한다.

초기 로딩 대상:

```text
병사 모델
기본 몬스터 모델
보스 모델
지형 모듈
게이트 모델
핵심 이펙트
핵심 사운드
```

추후 레벨이 많아지면 지연 로딩을 적용한다.

### 14.4 ObjectPool

전투 중 생성/삭제 비용을 줄이기 위해 풀링을 사용한다.

대상:

```text
몬스터
발사체 표현 오브젝트
피격 이펙트
폭발 이펙트
데미지 숫자
```

---

## 15. UI 설계

### 15.1 HTML/CSS Overlay 사용

3D 씬 내부에 모든 UI를 넣지 않고, 주요 UI는 HTML/CSS로 오버레이한다.

이유:

```text
웹에서 텍스트 렌더링이 선명함
반응형 대응 쉬움
버튼/결과창 구현 쉬움
Vercel/웹 앱 구조와 궁합 좋음
접근성과 모바일 대응이 쉬움
```

### 15.2 전투 HUD

```text
현재 병사 수
현재 공격 레벨
스테이지 진행도
보스 HP
일시정지 버튼
FPS 디버그 표시
```

### 15.3 시작 화면

```text
게임명
Tap to Start
간단한 조작 안내
로딩 완료 상태 표시
```

### 15.4 결과 화면

```text
Victory / Defeat
처치 몬스터 수
남은 병사 수
획득 골드
Retry
Next
Share
```

---

## 16. 레벨 설계

### 16.1 Vertical Slice 레벨 구성

```text
Intro Segment
Gate Segment 1
Monster Wave Segment 1
Gate Segment 2
Monster Wave Segment 2
Boss Segment
Result
```

### 16.2 1차 레벨 목표

```text
플레이 시간: 30~60초
시작 병사 수: 20
최대 병사 수: 60
몬스터 총량: 150
보스 1마리
강화 게이트 4~6개
```

---

## 17. 데이터 구조

### 17.1 LevelData

```typescript
type LevelData = {
  id: string;
  startSoldiers: number;
  trackWidth: number;
  forwardSpeed: number;
  segments: LevelSegment[];
  boss: BossConfig;
};
```

### 17.2 GateConfig

```typescript
type GateConfig = {
  id: string;
  type: 'ADD_SOLDIER' | 'MULTIPLY_SOLDIER' | 'ATTACK_UP' | 'FIRE_RATE_UP' | 'BULLET_UP';
  value: number;
  displayText: string;
  laneX: number;
};
```

### 17.3 MonsterConfig

```typescript
type MonsterConfig = {
  id: string;
  hp: number;
  speed: number;
  damage: number;
  reward: number;
  modelKey: string;
  behavior: 'BASIC' | 'FAST' | 'TANK' | 'EXPLOSIVE';
};
```

### 17.4 WaveConfig

```typescript
type WaveConfig = {
  id: string;
  monsterId: string;
  count: number;
  spawnPattern: 'LINE' | 'BLOCK' | 'V_SHAPE' | 'RANDOM';
  spawnInterval: number;
  startZ: number;
};
```

---

## 18. 성능 요구사항

### 18.1 초기 로딩

```text
PC: 3초 이내 목표
모바일: 5~8초 이내 목표
초기 번들 + 핵심 리소스 20~40MB 이하 목표
```

### 18.2 런타임

```text
PC: 60fps
모바일: 30fps 이상
프레임 드랍 시 자동 품질 하향
전투 중 GC 발생 최소화
```

### 18.3 메모리

```text
모바일 브라우저 메모리 사용량 최소화
텍스처 512 중심
보스/대형 지형만 1024 허용
불필요한 모델 즉시 dispose
```

---

## 19. 최적화 원칙

### 19.1 금지사항

```text
전투 중 대량 new 객체 생성 금지
몬스터마다 복잡한 물리 엔진 사용 금지
총알마다 독립 Mesh/Rigidbody 생성 금지
몬스터마다 고비용 스켈레톤 애니메이션 남발 금지
모바일에서 과한 후처리 금지
실시간 그림자 남발 금지
```

### 19.2 권장사항

```text
Object Pool
Instanced Mesh
단순 거리 기반 충돌
가짜 총알 Trail
Blob Shadow
텍스처 압축
LOD 또는 애니메이션 스킵
렌더 스케일 조정
모바일 품질 자동 하향
```

---

## 20. 배포 전략

### 20.1 Vercel 배포

Vite 프로젝트를 Vercel에 연결해 자동 배포한다.

```text
GitHub push
→ Vercel Preview Deploy
→ 테스트
→ Production Deploy
```

### 20.2 배포 URL

초기에는 Vercel 기본 도메인을 사용한다.

```text
https://project-name.vercel.app
```

추후 커스텀 도메인을 연결한다.

### 20.3 캐싱 전략

```text
모델/텍스처/오디오 파일은 강한 캐시 적용
HTML은 최신 배포 반영
리소스 파일명에 hash 적용
```

---

## 21. 오픈소스 활용 전략

기존 Unity 오픈소스는 직접 코드 베이스로 사용하지 않는다.

### 참고 대상

```text
open-video-game-library/HyperCasualRunningGame
MobControl-Clone
CountMaster
Unity EndlessRunnerSampleGame
```

### 활용 방식

```text
게이트 구조 참고
군집 이동 참고
스테이지 흐름 참고
몬스터 웨이브 구조 참고
카메라 감각 참고
밸런싱 아이디어 참고
```

### 직접 사용하지 않는 이유

```text
Unity 기반이므로 웹 TypeScript 코드와 직접 호환되지 않음
Unity WebGL은 모바일 웹에서 리스크가 큼
프로젝트 목표가 Vercel 기반 웹 즉시 플레이로 바뀜
```

---

## 22. 리스크

### 22.1 웹 성능 리스크

브라우저는 네이티브 앱보다 메모리와 성능 제약이 크다.

대응:

```text
초기 몬스터 수 제한
Instanced Mesh 사용
텍스처 압축
렌더 스케일 조절
품질 자동 하향
```

### 22.2 모바일 Safari 리스크

iOS Safari는 메모리와 WebGL 안정성 이슈가 발생할 수 있다.

대응:

```text
iOS에서는 Low/Medium 품질 기본값
초기 리소스 크기 제한
후처리 비활성화
실기기 테스트 필수
```

### 22.3 리소스 품질 리스크

무료 리소스만으로 상용 게임 느낌을 내기 어렵다.

대응:

```text
초기: 무료/저가 리소스
중기: 핵심 병사/몬스터/이펙트 유료 구매
후기: 캐릭터/UI/이펙트 커스텀 제작
```

### 22.4 IP 리스크

Last War를 그대로 복제하면 법적/스토어/광고 플랫폼 리스크가 있다.

대응:

```text
세계관 변경
캐릭터 디자인 변경
몬스터 디자인 변경
UI 스타일 변경
게이트 디자인 변경
스테이지 테마 변경
광고 소재 직접 복제 금지
```

---

## 23. Vertical Slice 범위

### 포함 기능

```text
웹 URL 접속
로딩 화면
Tap to Start
좌우 드래그 이동
병사 20명 시작
+1 / +5 / x2 게이트
공격력 증가 게이트
자동 사격
몬스터 150마리 웨이브
기본 몬스터 1종
탱커 몬스터 1종
보스 1종
탄환 Trail
피격 이펙트
폭발 이펙트
보스 HP Bar
Victory 화면
Vercel 배포
```

### 제외 기능

```text
로그인
회원가입
DB 저장
랭킹
상점
과금
광고
스킨
다중 스테이지
튜토리얼
앱 패키징
```

---

## 24. 마일스톤

### Milestone 1: 웹 게임 프로젝트 세팅

목표:

```text
Vite + TypeScript 세팅
Babylon.js 설치
Vercel 배포 연결
기본 3D 씬 렌더링
모바일 브라우저 접속 확인
```

산출물:

```text
https://프로젝트명.vercel.app 접속 가능
기본 3D 씬 표시
FPS 디버그 표시
```

---

### Milestone 2: 기본 러너 조작 구현

목표:

```text
자동 전진
좌우 드래그 이동
카메라 추적
트랙 제한
PC/모바일 입력 대응
```

산출물:

```text
브라우저에서 좌우 이동 가능한 부대
모바일 터치 조작 가능
```

---

### Milestone 3: 병사 군집 구현

목표:

```text
병사 20명 표시
Formation Offset
부대 중심 이동
병사 증가/감소
군집 재정렬
```

산출물:

```text
병사 부대가 자연스럽게 이동
게이트 없이도 병사 수 변화 테스트 가능
```

---

### Milestone 4: 게이트 시스템 구현

목표:

```text
+1 / +5 / x2 게이트
공격력 증가 게이트
게이트 충돌 판정
게이트 통과 이펙트
숫자 팝업
```

산출물:

```text
게이트 선택에 따라 병사 수와 공격력이 변화
```

---

### Milestone 5: 몬스터 웨이브 구현

목표:

```text
MonsterWaveSystem
Object Pool
기본 몬스터 100마리 이상
거리 기반 충돌
사망 처리
```

산출물:

```text
대량 몬스터가 등장하고 처치 가능
```

---

### Milestone 6: 자동 사격 구현

목표:

```text
타깃 탐색
Damage Tick
Bullet Trail
Hit Spark
사운드
```

산출물:

```text
병사들이 자동으로 몬스터를 공격
전투가 시각적으로 시원하게 보임
```

---

### Milestone 7: 보스전 구현

목표:

```text
보스 등장
보스 HP Bar
보스 공격 1종
보스 피격/사망 연출
Victory 화면
```

산출물:

```text
30~60초 Vertical Slice 완성
```

---

### Milestone 8: 웹 성능 최적화

목표:

```text
모바일 브라우저 테스트
FPS 측정
품질 자동 조절
리소스 압축
렌더 스케일 조정
Vercel 캐싱 확인
```

산출물:

```text
모바일 30fps 목표 달성
PC 60fps 목표 달성
배포 URL 공유 가능
```

---

## 25. 성공 기준

Vertical Slice는 아래 조건을 만족하면 성공으로 본다.

```text
1. Vercel URL로 누구나 접속 가능
2. 모바일 브라우저에서 설치 없이 실행 가능
3. 30~60초 플레이 가능
4. 좌우 이동/게이트/전투/보스/승리 루프 완성
5. 병사 40명 이상 표시 가능
6. 몬스터 100마리 이상 웨이브 연출 가능
7. PC 60fps, 모바일 30fps 근접 달성
8. 화면 캡처만 봐도 상용 웹 게임처럼 보임
9. Last War와 직접 복제처럼 보이지 않는 독자적 아트 방향 확보
```

---

## 26. 최종 판단

본 프로젝트는 Unity 모바일 앱이 아니라, 웹 주소로 즉시 플레이 가능한 브라우저 기반 3D 게임으로 제작한다.

기술 스택은 다음으로 확정한다.

```text
Vite + TypeScript + Babylon.js + WebGL2 + optional WebGPU + Vercel
```

Three.js는 후보로 유지하되, 본 프로젝트의 1차 구현에서는 Babylon.js를 메인으로 사용한다.

가장 중요한 방향은 다음과 같다.

```text
앱급 실사 퀄리티를 욕심내기보다,
웹에서 즉시 로딩되고,
모바일에서도 버티며,
대량 전투처럼 보이는 착시와 연출을 극대화한다.
```

1차 목표는 전체 게임 완성이 아니라,
**웹에서 바로 플레이 가능한 30~60초 고품질 Vertical Slice**다.
