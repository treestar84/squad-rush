# 바로 Go 스쿼드 Design System

## 1. Atmosphere & Identity

바로 Go 스쿼드 feels like a premium mobile arcade battlefield: high-contrast, readable at speed, and kinetic without becoming noisy. The signature is a sunlit steel runway with amber command UI and electric combat feedback, so a screenshot should instantly read as a polished runner shooter.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | --surface-primary | #F8FAFC | #111827 | Page and overlay base |
| Surface/secondary | --surface-secondary | #E5E7EB | #1F2937 | HUD panels |
| Surface/elevated | --surface-elevated | #FFFFFF | #263244 | Modal and result panels |
| Text/primary | --text-primary | #111827 | #F9FAFB | Primary labels |
| Text/secondary | --text-secondary | #475569 | #CBD5E1 | Secondary text |
| Text/tertiary | --text-tertiary | #64748B | #94A3B8 | Muted hints |
| Accent/primary | --accent-primary | #D97706 | #F59E0B | CTA, progress, upgrades |
| Accent/secondary | --accent-secondary | #0284C7 | #38BDF8 | Player/squad UI |
| Accent/danger | --accent-danger | #DC2626 | #F43F5E | Enemies and mid-boss monsters |
| Accent/success | --accent-success | #16A34A | #22C55E | Positive gates |
| Accent/energy | --accent-energy | #7C3AED | #A78BFA | Upgrade and heavy enemy accents |
| Border/default | --border-default | #CBD5E1 | #475569 | Panel borders |
| Shadow/glow | --shadow-glow | #F59E0B | #F59E0B | Amber glow |

### Rules

- Amber is reserved for calls to action, progress, and reward states.
- Blue indicates player agency or squad strength.
- Red and violet belong to enemy pressure and heavy mid-boss monsters.
- UI code must use CSS variables rather than raw hex colors.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | clamp(48px, 10vw, 112px) | 900 | 0.92 | 0 | Start/result title |
| H1 | clamp(32px, 7vw, 72px) | 900 | 1 | 0 | Major UI title |
| H2 | 28px | 800 | 1.15 | 0 | Modal headings |
| H3 | 20px | 800 | 1.2 | 0 | HUD labels |
| Body | 16px | 500 | 1.45 | 0 | General text |
| Body/sm | 14px | 600 | 1.35 | 0 | HUD text |
| Caption | 12px | 700 | 1.3 | 0.08em | Uppercase metadata |

### Font Stack

- Primary: "Arial Black", "Segoe UI", system-ui, sans-serif
- Mono: "SFMono-Regular", Consolas, monospace

### Rules

- Game commands use uppercase only when they are short and action-oriented.
- Body text stays at 14px or above.
- Display text uses no negative tracking.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Hairline gaps |
| --space-2 | 8px | Compact control gaps |
| --space-3 | 12px | HUD padding |
| --space-4 | 16px | Standard panel padding |
| --space-5 | 20px | Screen edge padding |
| --space-6 | 24px | Modal padding |
| --space-8 | 32px | Group spacing |
| --space-10 | 40px | Large callout spacing |
| --space-12 | 48px | Result screen spacing |

### Grid

- Max content width: 960px for overlays.
- Breakpoints: mobile 375px, tablet 768px, desktop 1280px.
- UI must fit portrait phones first.

### Rules

- Overlay controls avoid nested cards.
- Fixed-format HUD elements use stable dimensions to prevent layout shift.
- Browser scrolling, wheel zoom, and pre-start pointer/key input must remain locked so the 3D camera never drifts before play begins.

## 5. Components

### Start Action

- **Structure**: title, subtitle, two large game-mode image panels, three-option difficulty selector, primary button, compact control hint.
- **Game mode panels**: `Gate Attack` and `Wave Defence` are large radio-style panels designed for high-contrast black/white mode artwork with limited amber or blue accents. They must remain readable without final artwork by using dark tactical gradients, visible labels, and selected-state borders.
- **Difficulty selector**: `EASY`, `NORMAL`, `HARD`, and locked `INFINITE` are compact radio-style command tiles. `EASY` preserves the completed baseline balance, higher tiers increase enemy pressure through typed difficulty profiles rather than separate level files, and `INFINITE` unlocks per game mode only after that mode clears `HARD`.
- **Start hero preview**: before play begins, a single heavy-role soldier preview must be visible in the lower runway lane, using the real soldier asset, Run animation, and role kit so the one-soldier start reads as a protagonist moment rather than a hidden count in the UI.
- **Game guide**: the main screen exposes a fixed top-right `PERSONNEL / ROSTER GUIDE` command. It opens a neutral charcoal-gray personnel console that matches the Command Center, with realistic guide-only portraits, firepower values, branch rules, gate rules, and the full career/promotion flow. The former colorful anime-card treatment is intentionally excluded: portraits receive a restrained grayscale dossier filter, surfaces and copy use zinc/gray, and amber is reserved for top classification, selection, focus, and promotion-output accents. Desktop, tablet, and portrait-phone layouts must fit without horizontal or nested vertical scrolling.
- **States**: default, hover, active, focus.
- **Motion**: opacity and transform pulse only.
- **Mission strip**: three compact metric cells using mono tabular numbers, amber values, and tonal elevated surfaces.

### Loading Screen

- **Structure**: title image, short Pangyo portal emergency message, stage label, accessible progressbar, and three compact readiness chips.
- **States**: visible during asset boot, hidden at start screen, reduced motion safe.
- **Loading QA**: production preview must capture `loading-screen-mobile.png`, prove the accessible progressbar exists, show the tactical boot copy before the Start screen, and then transition to a visible TAP TO START within the ready-to-start entry budget.

### Pre-game Countdown

- **Structure**: full-screen tactical overlay with `RUNWAY SYNC`, a large mono 3-2-1 countdown, and a compact readiness status.
- **Behavior**: appears immediately after TAP TO START, while game systems finish warming behind it; gameplay begins only after each 3, 2, and 1 value has been shown for a full beat and preparation has completed.
- **States**: visible, hidden, reduced motion safe, no pointer capture.
- **Motion**: transform and opacity only; no layout animation.
- **QA**: production preview must prove countdown value `3` is visible within 700ms of tapping start, progresses through `2` and `1`, does not enter active combat before the full 3-2-1 countdown elapses, and finishes without console/page errors or horizontal overflow.

### HUD Meter

- **Structure**: top command row with Squad, progress bar, FPS, plus a compact command strip for Kills, ATK, and SHD.
- **States**: normal, warning, hidden.
- **Accessibility**: text labels remain visible without relying on color.
- **Numerics**: command strip values use mono tabular numbers and fixed cell widths to avoid layout shift during combat.
- **Progress**: finite stages show percent paired with a thin amber-to-blue meter so mobile players read distance at a glance. Infinite mode uses an `INF stage-percent` label while the meter loops per survival stage.
- **Mobile clearance**: phone HUD compresses into a low-height tactical ribbon; all labels remain visible while the center combat lane stays open for projectiles, pickups, and swarm readability.
- **Roster panel**: the upper-right HUD keeps a compact roster grid for currently owned unit types only, using each unit's simple color token so players can read the current squad engine without noise from undiscovered units.
- **Runtime QA**: production preview must be driven in real Chrome on mobile and desktop viewports, Firefox desktop, plus WebKit iPhone Safari emulation, with screenshots, zero console/page errors, no overflow, readable HUD metrics, and active combat progress.
- **Input control QA**: production preview must prove pre-start pointer, wheel, and key input cannot start/move the page, then prove KeyA/KeyD, mouse drag, and touch drag move the squad lane in-game without scroll drift.
- **Milestone QA**: production preview must capture `milestone-desktop-start.png`, `milestone-desktop-first-gate.png`, `milestone-desktop-first-horde.png`, `milestone-mobile-start.png`, and `milestone-mobile-first-horde.png` so the Phase A visual moments stay observable.
- **Full-run QA**: production preview must auto-start in Playwright Chromium on mobile and desktop viewports, reach the result screen in a 30-65 second window, end with VICTORY, show a complete debrief plus Retry/Next/Share controls, and save `fullrun-qa-mobile-result.png` plus `fullrun-qa-desktop-result.png`.
- **Quality capture QA**: low, medium, and high quality presets must be selectable through `?quality=low|medium|high` and each preset must produce a mobile combat screenshot with live kills, progress, and no horizontal overflow.
- **Auto quality**: default automatic detection caps automatic play at medium so first-run desktop and portrait mobile stay playable under real horde load, while explicit `?quality=high` continues to prove the maximum-density visual preset.
- **Commercial screenshot QA**: milestone, runtime, quality-preset, and result PNG captures must pass objective color-bucket, contrast, chroma, edge-density, and active-pixel thresholds so blank, flat, or visually sparse screens fail release gates.
- **Renderer strategy QA**: production preview defaults to stable WebGL2, while `?renderer=webgpu` must either initialize Babylon WebGPU successfully or fall back to WebGL2 without page errors.
- **Web app shell QA**: static deployment must expose Korean HTML shell metadata, mobile web app tags, `/manifest.webmanifest`, SVG app icons, and Vercel cache headers through the production preview before release.
- **Resource budget QA**: runtime model/UI assets stay under an 8MB budget, single runtime files stay under 3MB, and character/enemy glTFs use KTX2/Basis-ready textures or lightweight embedded material atlases with no oversized loose raster texture sprawl.
- **Monster LOD QA**: low and medium quality modes skip non-critical sway/rotation updates for distant horde members, while nearby monsters, tank silhouettes, movement and collision stay every-frame so density and play feel do not degrade. Monster pool visuals instantiate lazily so preserved high-quality GLB resources do not create unused clone overhead before spawn. Gate Attack and Wave Defence share the same compact Doguri body profile instead of adding attack-only badges, tint passes, or regular-monster contact shadows.
- **WebKit mobile QA**: iPhone Safari emulation uses an adaptive WebKit mobile quality profile so the horde stays readable while FPS remains above the mobile floor.
- **Firefox desktop QA**: Firefox production preview must render the WebGL2 combat scene, preserve horde density, keep HUD/canvas layout stable, and save `firefox-desktop-combat.png` with zero console/page errors.
- **Boss peak QA**: production preview must capture the attack-mode giant doguri mid-boss after 25% progress as a regular walking monster, with a large readable head-mounted HP bar, no same-spawn duplicate giant doguri, no separate boss HUD, no overflow, stable FPS, enough combat pressure, and a visible oversized doguri body in the lane.
- **Camera focus QA**: gate approach uses a 12m focus pulse with subtle FOV reduction, lower camera height, stronger lookahead, and combat-density framing, while mid-boss wave moments preserve the opening chase camera angle so the squad never snaps into a top-down view.
- **Pause control QA**: the combat HUD exposes a compact PAUSE/RESUME control, freezes stage progress and kill count while paused, shows a small tactical paused panel without horizontal overflow, and resumes progression through the same control in production preview.
- **Reduced motion QA**: production preview must run under `prefers-reduced-motion: reduce`, skip JS-driven start/result entrance tweens, clamp CSS animation durations, preserve focus, and still reach active combat without overflow.
- **Graphics polish QA**: high-quality production preview must expose active ACES/bloom debug state, capture `graphics-polish-gate-burst.png`, and prove the first gate reward emits a dense layered burst without overflow, console/page errors, or opaque particle blobs that cover squad/projectile readability.
- **Environment setpiece QA**: high-quality production preview must capture `environment-setpiece-desktop.png` and prove side service decks, cargo stacks, authored road modules, and no central gate-connecting gantry or authored gate frame without overflow or console/page errors.

### Combat FX

- **Hit**: amber spark particles stay small and readable against ghost swarms.
- **Projectile**: compact yellow bullet slugs spawn from the soldier muzzle marker, travel fast enough to cover the reduced base attack range in under a second, keep a small short slug as the primary readable shape, use only tiny glow spheres as support light, apply limited forward-lane lateral aim so the visual endpoint matches the damaged target, keep separated medium-alpha wake packets short enough to avoid oversized trails, and visibly reach moving targets while still reading as gunfire rather than a laser or orb chain.
- **Death**: very small low-alpha gray dust and squash/fade cues indicate kills without covering the squad, lane, or pickups. Every falling monster temporarily swaps its visible meshes to one frozen shared gray material, then restores the original material references before returning to the pool; no per-kill texture or material is allocated. Basic monsters briefly grey out, topple sideways, and sink out before returning to the pool so kills read as defeated bodies instead of instant pop-outs. Wave Defence renders the extra dust burst once per three regular kills while keeping every pooled body fall, preventing high-power squads from turning kill FX into a draw-call spike.
- **Chain pop**: every rapid five-kill beat adds a compact amber burst near the defeated enemy.
- **Reinforcement**: squad gains create short blue vertical beams at live soldier positions.
- **Swarm readability**: basic, fast, and tank monsters render as low, rounded slime bodies with small embedded eyes, soft caps, flattened bases, subtle back spines, fast side fins, tank armor blobs, tight overlapping offset rows, and shared contact shadows so dense waves read as crawling slime pressure instead of face-only props or flat red bars. The very slow forward crawl stays readable even when distant animation frames are skipped.
- **Combat roles — first set**: Gate Attack and Wave Defence introduce no more than two advanced roles in this slice. Shield Doguri carries a cyan frontal plate with extra pooled shield HP and 72% mitigation while the plate remains; changing the squad firing lane or breaking the plate restores full body damage. Charger Doguri slows for a 0.72-second yellow lane warning, then moves at 3.4x role speed and deals 2x contact damage. The windup receives higher automatic target priority so lane alignment and early focus both work as counters.
- **Role readability and telemetry**: shield and charge cues use a few low-poly boxes plus one three-sided warning mesh and remain available in compact horde mode without per-frame allocation. Each warning is announced once per operation, pooled role state resets on reuse, and the result debrief names the dominant casualty source with its counter. QA debug state exposes shield durability, visible cues, winding chargers, and active charges.
- **Combat roles — splitter slice**: the next slice adds only Splitter Doguri; the planned ranged role remains deferred. A magenta twin-core parent appears after the first two roles are learned. Projectile death creates exactly two smaller pooled splitlings at ±0.36m and 0.9m behind the impact point, while contact/escape death and splitling death never recurse. A 16-instance lazy pool reserve and four-unit live overflow cap preserve the two-child read under full carpet pressure without unbounded growth; debug telemetry reports successful or capacity-dropped child spawns. Splitling casualties remain attributed to the parent splitter role, whose counter is early long-range cleanup.
- **Mid-boss wave**: after 25% progress, frequent giant doguri mid-bosses appear inside regular swarms, move like normal monsters, use at least twice the regular monster body size, never spawn as duplicate giants in the same spawn point, and carry large HP bars above their heads instead of using a separate boss HUD.
- **Wave Defence pressure states**: defense tuning is measured by road coverage and visible combat-band density, not only total active monster count. Every pressure state keeps an 11-column descending carpet; device-scaled budgets target roughly 180-360 active enemies, with the high-quality final band holding about 250-360 visible threats.
- **Defense screen bands**: the upper and center combat bands form one continuous red enemy carpet. Shooting may open temporary holes near the squad, but authored wave gaps are not allowed; the bottom band keeps the lateral defense line and the currently collectible `+1` rail readable.
- **Defense opening grace**: the first five real-time seconds spawn only six full-width rows (66 monsters) beginning 18m ahead of the squad. After the grace window, pressure eases back to the normal carpet target over two seconds so the opening never jumps directly from empty road to maximum density.
- **Giant Doguri boss jam**: in Wave Defence, giant Doguri spawns near the center firing lane and is pulled forward relative to the raw wave spawn so it can absorb bullets before the wave has already passed. Its projectile hit volume follows the rendered body with 12% lateral animation padding and 55% rear depth padding. Regular monsters visibly in front of the boss remain valid targets; the boss only intercepts shots whose target lies behind its visible front surface. A boss already reserved by one in-flight shot remains targetable by every other emitter, while shots outside the padded left/right silhouette continue past its sides. Boss-targeted projectile trails terminate on the impact frame instead of performing the normal post-impact tail travel through the body. QA must prove foreground-target priority, concurrent boss reservations, repeated boss damage, HP movement below full, rear monster backlog, and active pickup-risk pressure.
- **Engine-building pressure timing**: military, developer, and unemployed random routes remain a Gate Attack system. Wave Defence disables that shared combination engine and uses a separate deterministic reserve-promotion ladder, so sequential reinforcement gains never trigger hidden attack-mode synergies.

### Gate & Reward Objects

- **Persistent operation loop**: every completed or failed operation grants persistent resources before the result screen appears. Gate Attack primarily grants `작전 정보`; Wave Defence primarily grants `방어 합금`. Both modes provide a smaller amount of the other resource so a player is never completely blocked, while mixed upgrades still encourage alternating modes.
- **Command Center**: the start screen keeps `TAP TO START` as its single primary action and exposes persistent growth through a secondary Command Center dialog. The neutral charcoal-gray dialog uses three lightweight 960x540 facility artworks, a 0/30 base-growth meter, compact current-bonus chips, exact next costs, disabled reasons, keyboard focus containment, Escape/backdrop dismissal, and an `aria-live` purchase result. Its header, overview, and facility grid are constrained to the current dynamic viewport with no nested panel or backdrop scrolling; short landscape screens hide secondary overview details and keep all three facilities visible in one row.
- **Facility effects**: each facility has ten smaller steps. 훈련소 completes one mode-appropriate starting-unit reinforcement every two levels, 무기고 adds 3% aggregate squad power per level, and 방벽 공방 adds one starting shield point per level. These effects apply to both modes, but the starting unit follows the mode identity: 판교인 in Gate Attack and 병사 in Wave Defence. Ten-step total costs exceed the former five-step totals, extending the resource sink without a single large power spike.
- **Campaign persistence**: campaign resources, facility levels, runs, and victories use a defensive, bounded v2 local-storage document. If only the legacy v1 document exists, each old facility level becomes two v2 steps so starting units, power, shields, resources, and run records remain unchanged; the migrated v2 document is then persisted without deleting the legacy source. A result grant is committed exactly once by the guarded game-over transition, and the original hard-clear/infinite unlock storage remains independent.

- **Gates (Gate Attack)**: choice frames use depth plates, floor pads, energy rings, and camera-facing text so each lane reads as a deliberate selection; gates spawn as two-choice pairs on the far left and far right with no center option. Wave Defence does not spawn these one-shot center gates.
- **Mystery reward pacing**: after the opening tutorial gate, gate pairs appear more frequently as asymmetric information decisions. The left lane always shows its actual reward. The right lane shows `?` until the right-side wall is destroyed; breaking the wall reveals the right effect before the squad crosses the choice line.
- **Left reward pool**: the left lane has no wall and stays stable: `+1`, `+2`, `+3`, and `x2` only. It never applies a negative reward and never uses `x3`.
- **Right reward pool**: the right lane has a destructible wall and higher but risky expected value: `-1`, `+1`, `+2`, `+3`, `x2`, `병사 +1`, `개발자 +1`, `백수 +1`, and very rare `장교 +1`, permanent `전체 공격 +20%`, or permanent `판교인 2배` rewards. It never uses `x3`.
- **Right-gate wall**: the right-side gate effect applies only if the squad breaks the wall before crossing and is positioned in the right lane. Failing to break the wall leaves the right reward unavailable; the player can still take the left reward.
- **Gate sorting**: reward pairs are not sorted by value. Left and right are rolled from separate weighted pools so the right lane is usually but not always better.
- **First gate**: the opening gate preserves the onboarding baseline with `병사 +1` and `판교인 +2`, no wall, and a visible HUD popup only when the chosen effect actually applies.
- **Opening balance (Gate Attack)**: the first 30 seconds should stay tense rather than explosive; the squad starts from 판교인 1명, then the first fixed gate and early pickup quickly establish the first 판교인/병사 engine baseline before the 25% pressure point.
- **Enlist gate**: crossing enlistment converts all 판교인 and 백수 into 병사, then applies soldier-growth engine bonuses.
- **Pickups (Gate Attack)**: rotating field pickups supply 판교인 and 병사 with a 90:10 reward ratio. Each pickup shows one floating character inside the thick rotating shell: 판교인은 the soldier-derived black-hair Pangyo marker, 병사는 the armed idle soldier silhouette. Fixed floor box/crate reward pickups stay unused.
- **Defense reinforcement track**: Wave Defence replaces large pickup cards and one-shot choice gates with 119 lightweight upright cyan `+1` gates spaced every 3m. Each gate combines its frame, panel, pulse, and label into one render mesh. Six-gate segments alternate between the left and right outer lane. Before the 20-person cap every crossed gate grants `병사 +1`; after the cap it grants `백수 +1` to the separate reserve counter. Both paths use compact popup feedback and never launch a portrait card over combat.
- **Lane hazards**: avoidable barricades use orange bodies, dark braces, amber warning discs, and elevated beacon rings so obstacles read before contact without stealing attention from rewards.
- **Environment setpieces**: runway edges use staggered side service decks, vertical supports, signal bars, and cargo stacks so the track reads as a constructed battlefield instead of a flat bridge. Floor-attached item-like road patches, authored road modules, gate-connecting gantries, and authored gate frames stay disabled around choice gates.
- **Defense castle environment**: Wave Defence replaces lightweight runway setpieces with a static castle approach: a long rounded cobblestone road, dense optimized buildings on both sides, banners and low walls, and a far portal gate aligned with the monster spawn lane. Runtime QA must prove the portal GLB, low-quality cobblestone texture, and both-side building rows load in real Chrome without overflow.
- **Feedback**: Gate Attack reward pickups keep squad beams, portrait feedback, HUD popup, and audio. Defense `+1` cells use only a compact popup, small impulse, and short cue so repeated collection never hides the carpet or squad.

### 엔진 빌딩 설계

- **기본 시작과 모드별 한계**: Gate Attack은 판교인 1명으로 시작하고 기존 15명 제한과 조합 트리를 유지한다. Wave Defence는 병사 1명으로 시작하며 활성 스쿼드와 시각화 모두 최대 20명이다. 20명 대형도 한 행 최대 3명만 두고 7개 행으로 뒤쪽에 배치한다. 방어 전용 간격은 좌우 0.42m, 앞뒤 0.21m이며 행 좌우 엇갈림은 사용하지 않는다.
- **방어 시간차 대표 사격**: 최대 8개 emitter가 전체 스쿼드 화력을 나눠 갖되 같은 프레임의 긴 가로 일제사격은 금지한다. 각 emitter 시작 위상을 31.25ms씩 벌리고 한 렌더 업데이트에서는 최대 2발만 생성한다. 60FPS 기준 대부분 한 프레임 1발씩 이어지며, emitter당 초당 4발과 합산 DPS는 기존과 동일하다. 방어 총알은 64개 풀과 compact 2메시 표현을 유지한다.
- **방어 백수 예비 인력**: Wave Defence에서 활성 스쿼드가 20명이 된 뒤 얻는 병사는 전투 유닛으로 생성하지 않고 우측 HUD의 백수 예비 인력으로 누적한다. 백수 10명이 모이면 즉시 10명을 소모해 판교인 또는 개발자 1명을 자동 배치한다. 두 계열의 현재 인원수가 적은 쪽을 우선하고, 동률이면 교대로 선택한다.
- **방어 포화 교체**: 20명 상태에서 전문병이 합류하면 병사를 우선 1명 내보내고, 내보낸 병사는 백수 예비 인력 1명으로 환급한다. 병사가 남아 있는 동안 활성 인원은 항상 20명이며, 병사가 모두 전문병으로 바뀐 뒤에는 아래의 직접 훈련 규칙으로 전환한다.
- **방어 전직 트리**: 지휘 계열은 `판교인 → 장교 → 장군`, 기술 계열은 `개발자 → 시니어 개발자 → AI`다. 같은 단계가 3명 이상이면 그중 1명만 다음 단계로 자동 전직해 활성 인원수가 줄지 않는다. 전직 후 하위 단계 2명이 남아 다음 합류의 진행도를 눈으로 추적할 수 있다.
- **방어 극후반 훈련**: 병사가 한 명도 남지 않은 뒤 백수 10명이 다시 모이면 새 하위 병종을 같은 자리에 교체하지 않는다. 선택된 계열의 가장 낮은 전문병 1명을 다음 단계로 직접 훈련하고, 그 결과 3명 집결 조건이 생기면 연속 전직한다. 장군/AI 20명으로 완성되면 백수를 더 소모하지 않고 `최종 전직 완료`로 표시한다.
- **방어 화력 단조 증가**: 방어 전용 기본 화력은 병사 1.5, 판교인/개발자 2, 장교/시니어 개발자 4, 장군/AI 8이다. 공격 모드의 시니어 전체 배율, 장교 생성, 백수 랜덤 사건, CEO 보너스는 적용하지 않아 어떤 교체·전직에서도 즉시 화력이 감소하지 않는다.
- **방어 성능 계약**: Wave Defence는 한 렌더 프레임당 시뮬레이션을 한 번만 수행한다. 최대 250ms의 저FPS 구간은 실제 시간 속도를 유지하되 그보다 긴 정지 시간은 버려 연쇄 캐치업 렉을 막는다. 몬스터 생성은 11마리 한 행씩 분산하며, 일반 군중은 추가 표식과 hierarchy bounds 계산을 생략한다. 사망 표시는 추가 overlay 패스나 재질 복제 대신 모든 풀 인스턴스가 하나의 동결된 회색 재질을 공유한다. 스쿼드·충돌 버퍼는 재사용하고 HUD는 전투 이벤트와 분리해 12Hz로 갱신한다.
- **판교인 스쿼드 시각화**: 판교인 유닛은 최적화된 authored running Pangyo 모델과 러닝 애니메이션을 사용한다. 병사 및 다른 전투 계열 유닛은 기존 병사 실루엣/장비 시각 루트를 유지한다.
- **공격 진로 결정**: 판교인 3명이 모이면 오른쪽 HUD에 진로 결정 패널을 띄운다. `J`는 군입대(병사 1명), `K`는 야근(개발자 1명), `L`은 해고(백수 1명)를 선택하며, 선택 즉시 판교인 3명을 소모한다.
- **공격 군 라인**: 병사 5명은 장교 1명으로 자동 승급한다. 장교는 25초마다 병사 1명을 생성하고, 장교가 늘 때마다 5초씩 빨라져 2명 20초, 3명 15초, 4명 10초, 5명 이상 5초 cadence를 가진다. 장교 5명은 장군 1명으로 자동 승급한다. 장군은 병사와 장교 수에 비례해 추가 화력을 얻는다.
- **공격 개발 라인**: 개발자 3명은 시니어 개발자 1명으로 자동 승급한다. 개발자는 1명당 전진 속도를 20% 낮춰 게임의 진행속도를 조절하고, 시니어 개발자는 승급 필요 인원을 1명 줄이며 전체 화력과 게이머 화력을 더 강력하게 만든다. 시니어 개발자가 있으면 게이머 화력이 2배로 증폭된다.
- **공격 백수 라인**: 백수는 화력 0.5로 판교인보다 약하다. 백수가 2명 이상 모인 뒤부터 10초마다 50% 확률로 병사 또는 판교인 1명을 백수로 만들거나, 50% 확률로 아무 일도 일어나지 않는다. 백수 5명은 CEO 또는 게이머 중 하나로 랜덤 자동 승급하며 비율은 CEO:게이머 = 8:2다.
- **공격 CEO 보너스**: CEO가 있으면 승급이 발생할 때마다 30% 확률로 병사, 개발자, 백수 중 1명이 추가 등장한다. CEO가 늘면 확률이 20%p씩 증가한다. CEO는 시니어 개발자 화력을 2배, 장교 화력을 1.5배로 보조한다.
- **공격 게이머 분기**: 게이머는 백수 5명 랜덤 승급의 희귀 공격형 결과다. 기본 화력은 8로 CEO보다 높은 순수 전투 압축 유닛이며, 시니어 개발자가 있으면 2배 화력으로 상승한다.
- **공격 화력 기준**: 판교인 1, 백수 0.5, 병사 1.5, 개발자 1.6, 시니어 개발자 3, 장교 3.5, CEO 4.5, 장군 7+보정, 게이머 8이다.
- **공격 티어 기준**: 최상위 티어는 장군, 게이머, CEO, 시니어 개발자다. 중간 티어는 병사, 개발자, 장교 등 승급 중간 노드이며, 최하위 티어는 판교인과 백수다. 게임 가이드에서는 이 구분을 무지개색 카드가 아니라 제한된 앰버·중성 회색 분류선과 `CLASS` 표기로 전달한다.
- **공격 스쿼드 패널티**: 공격 모드에서 스쿼드 인원이 1명보다 많아질수록 전진 속도가 1명당 15% 증가한다. 11명이 되면 기본 대비 2.5배로 전진해 큰 스쿼드가 더 강하지만 선택 시간이 짧아진다.
- **공격 기본 진행 속도**: Gate Attack의 병사 전진과 콘텐츠 스크롤을 같은 1.2배 계수로 높여, 스쿼드 구성에 따른 가감속 관계를 유지하면서 전체 진행을 기존보다 20% 빠르게 한다.
- **게임 가이드 구성**: 메인 화면의 전투 인사 기록부는 `ENTRY-00`, `MIL-10`, `DEV-20`, `CIV-30`, `FIELD DIRECTIVES` 구역으로 나뉜다. 각 캐릭터는 실사형 전술 포트레이트, 이름, `FIREPOWER`, 효과 설명을 함께 보여주며, 캐릭터를 누르면 `SELECTED DOSSIER`에서 필요한 하위 캐릭터와 상위 승급 결과를 작은 인사기록 아이콘으로 보여준다.

### 보완 코멘트

- **확률 가시화**: CEO 보너스와 백수 랜덤성은 체감이 흔들릴 수 있으므로 HUD 팝업 또는 짧은 이펙트로 원인을 알려주는 것이 좋다.
- **자동 승급 타이밍**: 조건 만족 즉시 승급하면 플레이어가 선택 전에 판교인을 잃는 문제가 생긴다. 그래서 판교인 3명은 자동 승급에서 제외하고 진로 결정 전용 재화로 둔다.
- **속도 상쇄 관계**: 개발자 둔화와 대형 스쿼드 전진 가속이 서로 상쇄되므로, 후반에는 개발자 라인이 “시간을 사는 빌드”인지 “화력 보조 빌드”인지 QA 수치로 분리 검증해야 한다.
- **백수 분기 밸런스**: CEO는 엔진형, 게이머는 순수 화력형이므로 랜덤 결과의 체감 격차가 크다. 실패감이 크면 게이머 등장 시 즉시 공격 이펙트, CEO 등장 시 다음 승급 확률 표시처럼 결과별 피드백을 강화한다.
- **스쿼드 캡 압박**: 15명 공격 모드에서는 장교 생성과 CEO 보너스가 쉽게 막힐 수 있다. 방어 모드는 20명 활성 캡 이후 보상을 백수 예비 인력으로 전환하고, 별도 무손실 자동 전직 트리로 압축해 공격 모드의 자동 승급 밸런스와 분리한다.

### Audio Feedback

- **Unlock**: WebAudio starts only from the start button gesture.
- **Run ambience**: active combat randomly selects one of five BGM tracks sourced from `docs/Squad_Rush` and `docs/Arcade_Lane`; the squad footstep loop pauses with the game and scales gently with squad size and stage progress.
- **Countdown and start**: the start gesture unlocks audio, plays the 바로 Go 스쿼드 start jingle, then drives low/mid/high countdown beeps on each visible countdown value.
- **Combat events**: shots, collision hits, gates, pickups, squad gains, five-kill chains, enemy flurries, final pops, boss pressure, and results each use distinct short cues derived from `docs/Squad_Rush` and `docs/Arcade_Lane`.
- **Kill restraint**: normal monster deaths do not replay the squishy `hit` cue every time; frequent kill feedback stays visual or uses throttled chain/flurry cues.
- **Audio asset QA**: mp3/ogg event samples and loops load through Howler with small pitch variation for short cues, while WebAudio keeps lightweight fallback tone/noise layers unlocked from the start gesture.
- **Mixing**: BGM stays under combat feedback, footstep volume follows squad intensity, and event cues stay short enough to avoid masking bullets, gates, and pickup timing.

### Result Panel

- **Structure**: compact three-band debrief with a bilingual Korean/English title, command grade, horizontal combat metrics and rewards, threat review, tactical callout, and one Retry/Next/Share command row. Korean and English carry equal visual weight while duplicated prose is collapsed into paired labels.
- **Viewport fit**: the result overlay and panel never scroll. Portrait phones stack the two information columns; short and landscape viewports switch them back to a compressed two-column layout, clamp secondary detail to two lines, and preserve three 44px command targets inside the dynamic viewport.
- **Backdrop artwork**: responsive desktop and portrait after-action images match the existing monochrome generated mode-panel style, keep the center low-contrast for legibility, and use only restrained amber/cyan light behind the opaque tactical panel.
- **States**: victory, defeat, focus, hover.
- **Motion**: scale and opacity entry with a short grade pop and report reveal.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | ease-out | Button press |
| Standard | 240ms | ease-in-out | Overlay transitions |
| Emphasis | 500ms | cubic-bezier(0.16, 1, 0.3, 1) | Start/result entry |

### Rules

- Animate `transform`, `opacity`, and `filter` only.
- Respect `prefers-reduced-motion`.
- Every button has focus-visible styling.

## 7. Depth & Surface

### Strategy

Mixed: translucent tonal panels with restrained shadows and amber glow for active elements.

| Level | Value | Usage |
|-------|-------|-------|
| Subtle | 0 2px 8px rgba(0, 0, 0, 0.25) | HUD text/panels |
| Prominent | 0 18px 60px rgba(0, 0, 0, 0.45) | Result and start actions |
| Glow | 0 0 28px rgba(245, 158, 11, 0.45) | CTA and reward effects |
