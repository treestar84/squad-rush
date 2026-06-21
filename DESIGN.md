# Squad Rush Design System

## 1. Atmosphere & Identity

Squad Rush feels like a premium mobile arcade battlefield: high-contrast, readable at speed, and kinetic without becoming noisy. The signature is a sunlit steel runway with amber command UI and electric combat feedback, so a screenshot should instantly read as a polished runner shooter.

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
| Accent/danger | --accent-danger | #DC2626 | #F43F5E | Enemies and boss |
| Accent/success | --accent-success | #16A34A | #22C55E | Positive gates |
| Accent/energy | --accent-energy | #7C3AED | #A78BFA | Boss and special attacks |
| Border/default | --border-default | #CBD5E1 | #475569 | Panel borders |
| Shadow/glow | --shadow-glow | #F59E0B | #F59E0B | Amber glow |

### Rules

- Amber is reserved for calls to action, progress, and reward states.
- Blue indicates player agency or squad strength.
- Red and violet belong to enemy pressure and boss danger.
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

## 5. Components

### Start Action

- **Structure**: title, subtitle, primary button, compact control hint.
- **States**: default, hover, active, focus.
- **Motion**: opacity and transform pulse only.

### HUD Meter

- **Structure**: compact stat cells and a boss meter band.
- **States**: normal, warning, hidden.
- **Accessibility**: text labels remain visible without relying on color.

### Result Panel

- **Structure**: centered title, stat grid, retry button.
- **States**: victory, defeat, focus, hover.
- **Motion**: scale and opacity entry.

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
