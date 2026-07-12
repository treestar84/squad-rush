# 바로 Go 스쿼드

![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Babylon.js](https://img.shields.io/badge/Babylon.js-7-BB464B)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-111111)

브라우저에서 바로 실행되는 3D 러너 슈팅 vertical slice입니다. `Gate Attack`에서는 강화 게이트와 보상 픽업을 선택해 전진하고, `Wave Defence`에서는 화면 위치를 지키며 도로 전폭의 몬스터 카펫과 좌우 `+1` 강화 레일을 상대합니다.

## Highlights

- 짧고 반복 가능한 모바일 우선 플레이 세션
- 시작 화면 난이도 선택: `EASY`, `NORMAL`, `HARD`. `HARD`를 완료하면 `INFINITE`가 열린다.
- WebGL2 기본 렌더링, WebGPU 선택 초기화 및 폴백
- Babylon.js 기반 3D 씬, HTML/CSS HUD, Howler 오디오
- 품질 프리셋: `?quality=low`, `?quality=medium`, `?quality=high`
- 게임 모드: `?mode=run`, `?mode=defense`
- Gate Attack: Wave Defence와 같은 경량 Doguri 몬스터를 사용하고, 기존 대비 20% 빠른 기본 진행 속도를 적용한다. 처치된 몬스터는 별도 텍스처 생성 없이 하나의 공유 회색 재질로 잠시 쓰러진다.
- Persistent Command Center: 공격은 `작전 정보`, 방어는 `방어 합금`을 중심으로 보상한다. 전용 콘셉트 아트가 적용된 훈련소·무기고·방벽 공방을 최대 10레벨까지 성장시키며, 시작 인원은 2레벨마다 +1, 전체 화력은 레벨마다 +3%, 시작 방어막은 레벨마다 +1씩 다음 작전에 반영된다. 기존 v1 저장 데이터는 효과와 자원을 보존한 채 v2의 두 배 단계로 자동 이전된다.
- Personnel Command Guide: 우측 상단 캐릭터 가이드는 커맨드 센터와 같은 차콜·그레이 전술 콘솔을 사용한다. 가이드 전용 실사형 인사기록 초상화 9종, `ROSTER MATRIX`, `SELECTED DOSSIER`, `FIREPOWER`, 승급 입력·결과를 제공하며 기존 컬러 애니 카드 스타일은 사용하지 않는다.
- Combat roles: 청색 방패형은 방패가 유지되는 동안 탄환 피해를 72% 줄이고, 황색 돌진형은 0.72초 경고 후 가속해 2배 충돌 피해를 준다. 자홍색 분열형은 총격 처치 시 소형 2개로 한 번만 갈라지며, 충돌·전선 통과·소형 개체 처치에는 재분열하지 않는다. 두 모드 모두 역할을 순차적으로 소개하며 결과 화면에서 가장 큰 사상 원인과 대응법을 알려준다.
- Mid-boss targeting: 중간보스 뒤쪽으로 향하는 발사체는 막되, 앞쪽 일반 몬스터가 있으면 그 몬스터가 먼저 피격된다.
- Wave Defence: 5초 준비 구간 뒤 느리게 밀려오는 11열 적 카펫, 119개 단일 메시 `+1` 게이트, 20명 고정 스쿼드와 우측 백수 예비 인력, 8개 대표 화력의 31.25ms 시간차 사격. 20명 대형은 가로 최대 3명·세로 7행으로 압축한다. 20명 이후 `백수 10명`마다 판교인/개발자가 균형 자동 배치되고 `판교인→장교→장군`, `개발자→시니어 개발자→AI`로 무손실 전직한다. 360마리 고밀도에서도 compact horde 렌더링, 행 단위 분산 생성, 12Hz HUD, 단일-pass 프레임 루프로 순간 렉을 억제한다.
- After Action Report: 한글과 영어를 균형 있게 배치한 콤팩트 결과판과 가로·세로 전용 배경을 사용하며 작은 화면에서도 문서 스크롤이 생기지 않도록 맞춘다.
- 난이도 프리셋: `?difficulty=easy`, `?difficulty=medium`, `?difficulty=hard`, `?difficulty=infinite`
- 정적 배포 최적화: Vite build + Vercel cache headers

## Tech Stack

| Area | Stack |
| --- | --- |
| Runtime | Browser, Vite |
| Language | TypeScript |
| 3D | Babylon.js |
| UI | HTML/CSS overlay |
| Audio | Howler, WebAudio fallback |
| Deploy | Vercel static hosting |

## Quick Start

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Focused QA:

```bash
npm run test:webapp
npm run test:assets
npm run test:audio-assets
npm run test:start-countdown
npm run test:input
npm run test:runtime
npm run test:campaign-progression
npm run test:mid-boss-absorption
npm run test:defense-performance
npm run test:monster-combat-roles
npm run test:monster-splitter
npm run test:result-layout
npm run test:defense-density-stress
npm run test:defense-density-stress:webkit
```

Full gate verification is still available with `npm run verify`, but it is intentionally broader and slower.

## Vercel Deployment

Production deploy:

```bash
npm run build
npx vercel --prod --yes
```

Current production alias: <https://game-runner-smoky.vercel.app>

Vercel CLI prints both a deployment URL and an aliased URL. Share the `Aliased:` URL as the stable production URL.

Before deploying:

- Keep runtime assets under `public/assets/`; they must not be ignored.
- Keep local-only files out of upload with `.vercelignore`: `docs/`, `scripts/`, `*.md`, logs, QA captures, and agent state.
- Do not commit or upload generated output such as `dist/`, `logs/`, `playwright-report/`, `test-results/`, or `coverage/`.

After deploying, run a quick production smoke check:

```bash
curl -I https://game-runner-smoky.vercel.app
```

Then open the same URL in a browser or Playwright mobile viewport and confirm:

- HTTP status is `200`.
- The title is `바로 Go 스쿼드`.
- The start button is visible.
- There is no horizontal overflow or console/page error on load.

## Project Structure

```text
src/app/         App state and screen flow
src/game/        Babylon scene, systems, data, pools
src/ui/          Loading, start, HUD, guide, result overlays
public/assets/  Runtime models, audio, artwork, license notes
scripts/        QA, balance harness, and release gates
DESIGN.md       Visual identity and UI rules
```

## Gameplay Flags

| Flag | Values | Purpose |
| --- | --- | --- |
| `difficulty` | `easy`, `medium`, `hard`, `infinite` | Selects enemy pressure and damage profile. `infinite` is unlocked after completing `hard`. |
| `mode` | `run`, `defense` | Opens Gate Attack or Wave Defence. |
| `quality` | `low`, `medium`, `high` | Forces render/performance quality preset. |
| `renderer` | `webgl2`, `webgpu` | Requests renderer strategy; WebGPU falls back to WebGL2 if unavailable. |
| `qaSpeed` | number | Speeds up run progression for QA only; do not use alone to judge balance. |

## Release Notes

- Target browsers: Chrome Desktop/Android, Edge, Safari iOS, Firefox Desktop.
- Runtime assets are documented in `public/assets/LICENSES.md`.
- Deployment output is `dist/`; do not commit generated build artifacts.
- Local agent/tool state such as `.omc/` and `.omo/` is ignored.

## Docs

- `README.md`: setup, gameplay flags, QA, and deployment
- `DESIGN.md`: visual identity and UI rules
- `public/assets/LICENSES.md`: runtime asset provenance and usage notes
- `scripts/balance-harness/README.md`: repeatable balance simulation workflow

## Tags

`web-game` `3d-runner` `babylonjs` `vite` `typescript` `mobile-first` `vercel` `vertical-slice`
