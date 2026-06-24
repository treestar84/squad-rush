# 바로 Go 스쿼드

![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Babylon.js](https://img.shields.io/badge/Babylon.js-7-BB464B)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-111111)

브라우저에서 바로 실행되는 3D 러너 슈팅 vertical slice입니다. 플레이어는 자동 전진하는 스쿼드를 좌우로 조작하고, 강화 게이트와 보상 픽업을 선택하며, 대량 몬스터 웨이브를 돌파합니다.

## Highlights

- 30~60초 안에 끝나는 모바일 우선 플레이 세션
- WebGL2 기본 렌더링, WebGPU 선택 초기화 및 폴백
- Babylon.js 기반 3D 씬, HTML/CSS HUD, Howler 오디오
- 품질 프리셋: `?quality=low`, `?quality=medium`, `?quality=high`
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

Full verification:

```bash
npm run verify
```

## Project Structure

```text
src/app/        App state and screen flow
src/game/       Babylon scene, systems, data, pools
src/ui/         Loading, start, HUD, result overlays
public/assets/ Runtime models, audio, icons, license notes
scripts/       QA and release gate scripts
docs/          Design and planning notes
```

## Release Notes

- Target browsers: Chrome Desktop/Android, Edge, Safari iOS, Firefox Desktop.
- Runtime assets are documented in `public/assets/LICENSES.md`.
- Deployment output is `dist/`; do not commit generated build artifacts.
- Local agent/tool state such as `.omc/` and `.omo/` is ignored.

## Docs

- `prd.md`: product requirements
- `DESIGN.md`: visual identity and UI rules
- `GOAL.md`: release checklist and gates
- `GOAL_PHASE2.md`: post-release improvement roadmap

## Tags

`web-game` `3d-runner` `babylonjs` `vite` `typescript` `mobile-first` `vercel` `vertical-slice`
