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

- **Structure**: title, subtitle, mission strip, primary button, compact control hint.
- **Start hero preview**: before play begins, a single heavy-role soldier preview must be visible in the lower runway lane, using the real soldier asset, Run animation, and role kit so the one-soldier start reads as a protagonist moment rather than a hidden count in the UI.
- **States**: default, hover, active, focus.
- **Motion**: opacity and transform pulse only.
- **Mission strip**: three compact metric cells using mono tabular numbers, amber values, and tonal elevated surfaces.

### Loading Screen

- **Structure**: mission boot kicker, title, stage label, accessible progressbar, and three compact readiness chips.
- **States**: visible during asset boot, hidden at start screen, reduced motion safe.
- **Loading QA**: production preview must capture `loading-screen-mobile.png`, prove the accessible progressbar exists, show the tactical boot copy before the Start screen, and then transition to a visible TAP TO START within the ready-to-start entry budget.

### Pre-game Countdown

- **Structure**: full-screen tactical overlay with `RUNWAY SYNC`, a large mono 3-2-1 countdown, and a compact readiness status.
- **Behavior**: appears immediately after TAP TO START, while game systems finish warming behind it; gameplay begins only after each 3, 2, and 1 value has been shown for a full beat and preparation has completed.
- **States**: visible, hidden, reduced motion safe, no pointer capture.
- **Motion**: transform and opacity only; no layout animation.
- **QA**: production preview must prove countdown value `3` is visible within 700ms of tapping start, progresses through `2` and `1`, does not enter active combat before the full 3-2-1 countdown elapses, and finishes without console/page errors or horizontal overflow.

### HUD Meter

- **Structure**: top command row with Squad, progress bar, FPS, plus a compact command strip for Kills, ATK, and UPG.
- **States**: normal, warning, hidden.
- **Accessibility**: text labels remain visible without relying on color.
- **Numerics**: command strip values use mono tabular numbers and fixed cell widths to avoid layout shift during combat.
- **Progress**: stage percent always pairs with a thin amber-to-blue meter so mobile players read distance at a glance.
- **Mobile clearance**: phone HUD compresses into a low-height tactical ribbon; all labels remain visible while the center combat lane stays open for projectiles, pickups, and swarm readability.
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
- **Monster LOD QA**: low and medium quality modes skip non-critical sway/rotation updates for distant horde members, while nearby monsters, tank silhouettes, movement and collision stay every-frame so density and play feel do not degrade.
- **WebKit mobile QA**: iPhone Safari emulation uses an adaptive WebKit mobile quality profile so the horde stays readable while FPS remains above the mobile floor.
- **Firefox desktop QA**: Firefox production preview must render the WebGL2 combat scene, preserve horde density, keep HUD/canvas layout stable, and save `firefox-desktop-combat.png` with zero console/page errors.
- **Boss peak QA**: production preview must capture the mid-boss mixed into the regular monster wave after 25% progress, with no warning banner, no boss HP bar, no overflow, stable FPS, enough combat pressure, and a visible oversized tank/yeti body in the lane.
- **Camera focus QA**: gate approach uses a 12m focus pulse with subtle FOV reduction, lower camera height, stronger lookahead, and combat-density framing, while mid-boss wave moments preserve the opening chase camera angle so the squad never snaps into a top-down view.
- **Pause control QA**: the combat HUD exposes a compact PAUSE/RESUME control, freezes stage progress and kill count while paused, shows a small tactical paused panel without horizontal overflow, and resumes progression through the same control in production preview.
- **Reduced motion QA**: production preview must run under `prefers-reduced-motion: reduce`, skip JS-driven start/result entrance tweens, clamp CSS animation durations, preserve focus, and still reach active combat without overflow.
- **Graphics polish QA**: high-quality production preview must expose active ACES/bloom debug state, capture `graphics-polish-gate-burst.png`, and prove the first gate reward emits a dense layered burst without overflow, console/page errors, or opaque particle blobs that cover squad/projectile readability.
- **Environment setpiece QA**: high-quality production preview must capture `environment-setpiece-desktop.png` and prove side service decks, cargo stacks, authored road modules, and no central gate-connecting gantry or authored gate frame without overflow or console/page errors.

### Combat FX

- **Hit**: amber spark particles stay small and readable against ghost swarms.
- **Projectile**: compact yellow bullet slugs spawn from the soldier muzzle marker, travel fast enough to cover the reduced base attack range in under a second, keep a small short slug as the primary readable shape, use only tiny glow spheres as support light, apply limited forward-lane lateral aim so the visual endpoint matches the damaged target, keep separated medium-alpha wake packets short enough to avoid oversized trails, and visibly reach moving targets while still reading as gunfire rather than a laser or orb chain.
- **Death**: very small low-alpha gray dust and squash/fade cues indicate kills without covering the squad, lane, or pickups.
- **Chain pop**: every rapid five-kill beat adds a compact amber burst near the defeated enemy.
- **Reinforcement**: squad gains create short blue vertical beams at live soldier positions.
- **Swarm readability**: basic, fast, and tank monsters render as low, rounded slime bodies with small embedded eyes, soft caps, flattened bases, subtle back spines, fast side fins, tank armor blobs, tight overlapping offset rows, and shared contact shadows so dense waves read as crawling slime pressure instead of face-only props or flat red bars.
- **Mid-boss wave**: after 25% progress, five oversized tank slime monsters appear inside regular swarms at the same very slow forward crawl as basic enemies, with no dedicated warning message or separate HP bar.

### Gate & Reward Objects

- **Gates**: choice frames use depth plates, floor pads, energy rings, and camera-facing text so each lane reads as a deliberate selection; the two choices stay separated near the runway edges at 70% visual scale with no fence-like connector between them.
- **First gate**: the first choice pair must stay forgiving and immediately felt: left `+1`, centered/right `UPGRADE`, with a visible HUD popup, `ATK 1.5x`, and `UPG 1/2` during the opening lane.
- **Opening balance**: the first 30 seconds should stay tense rather than explosive; the squad starts at 1, usually reaches about 3 soldiers by 20% progress, and only begins recovering toward a larger squad after the 25% pressure point.
- **Advanced gates**: `FIRE +20%`, `RANGE +20%`, `EXPLOSION`, and `PIERCE` remain only as unused config records for future reactivation; they must not spawn, alter stats, change bullets, or affect damage in the current run.
- **Upgrade cap**: first-round upgrades stop at `2/2`, producing attack multipliers `1.5x` and `2.25x`; later visual tiers remain available for future rounds.
- **Pickups**: soldier gain rewards use the real idle soldier silhouette inside the existing thick rotating shell, vertical reward beam, compact elevated label, and readable collection radius so `+1/+2/+3` reads as reinforcement instead of a generic box; attack upgrade rewards keep the cyan supply-crate silhouette with amber bands and a small diamond reward core.
- **Lane hazards**: avoidable barricades use orange bodies, dark braces, amber warning discs, and elevated beacon rings so obstacles read before contact without stealing attention from rewards.
- **Environment setpieces**: runway edges use staggered side service decks, vertical supports, signal bars, cargo stacks, and authored road modules so the track reads as a constructed battlefield instead of a flat bridge, while gate-connecting gantries and authored gate frames stay disabled around choice gates.
- **Feedback**: every reward pickup triggers squad beams, HUD popup, and an audio cue within the same moment; gate reward particles stay compact and semi-transparent so they read as celebration without hiding soldiers, bullets, or pickups.

### Audio Feedback

- **Unlock**: WebAudio starts only from the start button gesture.
- **Run ambience**: the `Pixel turbo run` BGM loop and squad footstep loop start with active combat, pause with the game, and scale gently with squad size and stage progress.
- **Countdown and start**: the start gesture unlocks audio, plays the 바로 Go 스쿼드 start jingle, then drives low/mid/high countdown beeps on each visible countdown value.
- **Combat events**: shots, hits, gates, pickups, squad gains, five-kill chains, boss pressure, and results each use distinct short cues derived from `docs/Squad_Rush`.
- **Audio asset QA**: mp3/ogg event samples and loops load through Howler with small pitch variation for short cues, while WebAudio keeps lightweight fallback tone/noise layers unlocked from the start gesture.
- **Mixing**: BGM stays under combat feedback, footstep volume follows squad intensity, and event cues stay short enough to avoid masking bullets, gates, and pickup timing.

### Result Panel

- **Structure**: centered title, command grade medal, stat grid, after-action report, tactical callout, and Retry/Next/Share command row.
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
