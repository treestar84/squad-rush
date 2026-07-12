# Asset Licenses

This manifest tracks the model, texture, UI, and audio assets included in the runtime build.

## Runtime Model Assets

### `public/assets/models/soldier.gltf`
- Role: player soldier model and animation source.
- Source: project-owner supplied `Character_Soldier.gltf` imported into this repository for the runnable vertical slice.
- License basis: Adobe Mixamo FAQ for Mixamo-exported characters and animations.
- Commercial use: yes, for games and other creative projects when embedded in the project.
- Raw redistribution: no standalone model, animation library, stock asset, template, or asset-pack redistribution.
- Local transforms: scaled down, rotated to face away from the camera, role kit attachments added procedurally.

### `public/assets/models/ghost.gltf`
- Role: default ghost swarm monster visual source.
- Source: Quaternius Ultimate Monsters, Ghost model.
- License basis: Quaternius free game assets / Ultimate Monsters terms, CC0-compatible and free for personal and commercial projects.
- Commercial use: yes.
- Raw redistribution: keep as part of this runnable game build, not as a standalone asset product.
- Local transforms: scale/material variation and shared contact shadows applied at runtime.

### `public/assets/models/monster_basic.glb`
- Role: fast monster visual variant source.
- Source: Kenney Platformer Kit, `character-oozi.glb`.
- License basis: Kenney asset pages are public domain licensed, Creative Commons CC0.
- Commercial use: yes.
- Raw redistribution: allowed by CC0; still tracked here for provenance.
- Local transforms: fast behavior scale/material variation, horn cue, eye glow, and shared contact shadows applied at runtime.

### `public/assets/models/monster_tank.glb`
- Role: tank monster visual variant source.
- Source: Kenney Platformer Kit, `bomb.glb`.
- License basis: Kenney asset pages are public domain licensed, Creative Commons CC0.
- Commercial use: yes.
- Raw redistribution: allowed by CC0; still tracked here for provenance.
- Local transforms: tank behavior scale/material variation, shoulder cue, eye glow, and shared contact shadows applied at runtime.

### `public/assets/models/yeti.gltf`
- Role: mid-boss visual source.
- Source: Quaternius Ultimate Monsters, Yeti model.
- License basis: Quaternius free game assets / Ultimate Monsters terms, CC0-compatible and free for personal and commercial projects.
- Commercial use: yes.
- Raw redistribution: keep as part of this runnable game build, not as a standalone asset product.
- Local transforms: boss scale, hazard shadow, warning beacon, and procedural combat FX applied at runtime.

### `public/assets/models/squad/pangyo_runner.glb`
- Role: optimized authored running Pangyo squad member visual.
- Source: project-owner supplied `달리는판교인.glb` from the local source-asset archive.
- License basis: project-provided asset grant for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone model pack without confirming the source asset terms.
- Local transforms: Draco geometry compression, mesh simplification, 128px WebP texture compression, animation resampling, runtime cloning, and Pangyo-only squad scale/rotation.

### `public/assets/models/pickups/pangyo_man.glb`
- Role: optimized authored Pangyo pickup character visual.
- Source: project-owner supplied `판교맨.glb` from the local source-asset archive.
- License basis: project-provided asset grant for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone model pack without confirming the source asset terms.
- Local transforms: Draco geometry compression, 128px WebP texture compression, runtime cloning, and pickup-only scale/rotation.

### `public/assets/models/environment/road_segment.glb`
- Role: authored road module.
- Source: Kenney Platformer Kit, derived from `platform.glb`.
- License basis: Kenney asset pages are public domain licensed, Creative Commons CC0.
- Commercial use: yes.
- Raw redistribution: allowed by CC0; still tracked here for provenance.
- Local transforms: repeated/positioned by `SceneEnvironment.ts`.

### `public/assets/models/environment/gate_frame.glb`
- Role: authored gate frame module.
- Source: Kenney Platformer Kit, derived from `fence-corner.glb`.
- License basis: Kenney asset pages are public domain licensed, Creative Commons CC0.
- Commercial use: yes.
- Raw redistribution: allowed by CC0; still tracked here for provenance.
- Local transforms: repeated/positioned by `SceneEnvironment.ts`.

### `public/assets/models/environment/attack_buildings/nc.glb`
- Role: PC-only attack-mode roadside building visual variant.
- Source: project-owner supplied `docs/구조물/엔씨.glb`, optimized from the local source batch with `gltf-transform optimize`.
- License basis: project-provided asset grant for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone model pack without confirming the source asset terms.
- Local transforms: Draco geometry compression, 64px WebP texture compression, runtime cloning, side placement, and attack-mode scroll movement.

### `public/assets/models/environment/attack_buildings/new_office.glb`
- Role: PC-only attack-mode roadside building visual variant.
- Source: project-owner supplied `docs/구조물/신사옥.glb`, optimized from the local source batch with `gltf-transform optimize`.
- License basis: project-provided asset grant for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone model pack without confirming the source asset terms.
- Local transforms: Draco geometry compression, 64px WebP texture compression, runtime cloning, side placement, and attack-mode scroll movement.

### `public/assets/models/environment/attack_buildings/alparium.glb`
- Role: PC-only attack-mode roadside building visual variant.
- Source: project-owner supplied `docs/구조물/알파리움.glb`, optimized from the local source batch with `gltf-transform optimize`.
- License basis: project-provided asset grant for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone model pack without confirming the source asset terms.
- Local transforms: Draco geometry compression, 64px WebP texture compression, runtime cloning, side placement, and attack-mode scroll movement.

### `public/assets/models/environment/attack_buildings/avenue.glb`
- Role: PC-only attack-mode roadside building visual variant.
- Source: project-owner supplied `docs/구조물/아비뉴.glb`, optimized from the local source batch with `gltf-transform optimize`.
- License basis: project-provided asset grant for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone model pack without confirming the source asset terms.
- Local transforms: Draco geometry compression, 64px WebP texture compression, runtime cloning, side placement, and attack-mode scroll movement.

### `public/assets/models/environment/defense/portal.glb`
- Role: defense-mode distant castle portal and monster-wave source landmark.
- Source: project-owner supplied `docs/구조물/포탈.glb`, optimized from the local source batch with `gltf-transform optimize`.
- License basis: project-provided asset grant for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone model pack without confirming the source asset terms.
- Local transforms: aggressive Draco geometry compression, 256px WebP texture compression, runtime scaling, and fixed defense-mode placement.

### `public/assets/textures/defense_cobblestone.webp`
- Role: low-resolution defense-mode cobblestone road texture.
- Source: project-owner supplied generated cobblestone image from the local source-asset archive.
- License basis: project-provided generated texture for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone texture pack without confirming the source image terms.
- Local transforms: downscaled to 512px and compressed to low-quality WebP for runtime budget and stylized texture softness.

### `public/assets/textures/attack_dirt_ground.webp`
- Role: low-resolution attack-mode dirt ground and road texture.
- Source: project-owner supplied generated dirt-ground image from the local source-asset archive.
- License basis: project-provided generated texture for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone texture pack without confirming the source image terms.
- Local transforms: cropped to a square tile, downscaled to 512px, and compressed to low-quality WebP for runtime budget and stylized texture softness.

### `public/assets/textures/attack_dirt_ground_hard.webp`
- Role: low-resolution hard difficulty attack-mode dirt ground and road texture.
- Source: project-owner supplied generated hard-mode dirt-ground image from the local source-asset archive.
- License basis: project-provided generated texture for this game repository.
- Commercial use: yes, under the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone texture pack without confirming the source image terms.
- Local transforms: cropped to a square tile, downscaled to 512px, and compressed to low-quality WebP for runtime budget and stylized texture softness.

## Runtime UI Artwork

### `public/assets/ui/command-center/*.webp`
- Files: `training-facility.webp`, `armory.webp`, and `fortification-workshop.webp`.
- Role: facility artwork for the three persistent Command Center upgrade cards.
- Source: generated for this repository with OpenAI image generation on 2026-07-12, using the existing Gate Attack and Wave Defence panels as art-direction references.
- License basis: project-generated output used under the applicable OpenAI service terms at the project owner's direction.
- Commercial use: yes, subject to the applicable OpenAI service terms and project policies.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone concept-art pack.
- Local transforms: downscaled from 1672x941 PNG to 960x540 and compressed to quality-80 WebP; combined runtime transfer size is approximately 183 KB.

### `public/assets/ui/portraits/tactical/*.webp`
- Files: nine guide-only personnel portraits for Pangyo, unemployed, soldier, developer, officer, general, senior developer, CEO, and gamer roles.
- Role: realistic personnel-dossier portraits used only by the `GAME GUIDE`; existing HUD and in-game portraits remain unchanged.
- Source: generated for this repository with OpenAI image generation on 2026-07-12, using the three Command Center facility images as art-direction references.
- License basis: project-generated output used under the applicable OpenAI service terms at the project owner's direction.
- Commercial use: yes, subject to the applicable OpenAI service terms and project policies.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone portrait pack.
- Local transforms: a generated 3x3 personnel contact sheet was divided into nine crops, trimmed, downscaled to 160x160, and compressed to quality-82 WebP; the combined portrait set is approximately 29 KB.

### `public/assets/ui/result/*.webp`
- Files: `after-action-desktop.webp` and `after-action-mobile.webp`.
- Role: responsive decorative backgrounds for the compact bilingual after-action result screen.
- Source: generated for this repository with OpenAI image generation on 2026-07-12, using the existing Gate Attack, Wave Defence, and Command Center training artwork as art-direction references.
- License basis: project-generated output used under the applicable OpenAI service terms at the project owner's direction.
- Commercial use: yes, subject to the applicable OpenAI service terms and project policies.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone concept-art pack.
- Local transforms: generated landscape and portrait PNG outputs were compressed to quality-66 and quality-74 WebP respectively; the combined runtime transfer size is approximately 107 KB.

## Additional Stored Assets
- `public/assets/models/soldier.glb`: Kenney Platformer Kit, `character-oobi.glb`, CC0, retained as fallback/reference.
- `public/assets/models/boss.glb`: Kenney Platformer Kit, `block-moving-large.glb`, CC0, retained as fallback/reference.
- `public/assets/models/Textures/colormap.png`: Kenney Platformer Kit texture folder, CC0, retained for Kenney GLB references.
- `docs/구조물/optimized/building_01.glb` through `building_07.glb`: optimized local derivatives of the project-provided building GLBs, retained outside runtime assets for future selection.

## Procedural Runtime Assets

- Muzzle flash, bullet head, bullet tail, impact flash, hit spark, death smoke, chain pop, gate burst, pickup beacon, reinforcement beams, road lights, contact shadows, and HUD/result motion are generated procedurally in Babylon.js/CSS/GSAP for this repository build.
- Lightweight fallback tone/noise layers are generated procedurally by `AudioSystem.ts` and mixed under authored runtime audio.

## Runtime Audio Assets

- `public/assets/audio/shot.mp3` / `shot.ogg`: projectile click cue derived from `docs/Squad_Rush/Ui button click_1_81767265.wav`.
- `public/assets/audio/hit.mp3` / `hit.ogg`: enemy hit cue derived from `docs/Squad_Rush/Enemy pop stream_1.wav`.
- `public/assets/audio/gate.mp3` / `gate.ogg`: gate reward cue derived from `docs/Squad_Rush/Multiplier gate pass_1.wav`.
- `public/assets/audio/pickup.mp3` / `pickup.ogg`: pickup cue derived from `docs/Squad_Rush/Item pickup_1_1e52f8c0.wav`.
- `public/assets/audio/squad-add.mp3` / `squad-add.ogg`: reinforcement cue derived from `docs/Squad_Rush/Squad member spawn 2_1_217dd767.wav`.
- `public/assets/audio/start-jingle.mp3` / `start-jingle.ogg`: start jingle derived from `docs/Squad_Rush/Game start jingle_1_c1d2b792.wav`.
- `public/assets/audio/countdown-low.mp3` / `countdown-low.ogg`: countdown low cue derived from `docs/Squad_Rush/Countdown beep low_1_63bdc851.wav`.
- `public/assets/audio/countdown-mid.mp3` / `countdown-mid.ogg`: countdown mid cue derived from `docs/Squad_Rush/Countdown beep mid_1_de741ba1.wav`.
- `public/assets/audio/countdown-high.mp3` / `countdown-high.ogg`: countdown high cue derived from `docs/Squad_Rush/Countdown beep high_1_e68e2814.wav`.
- `public/assets/audio/chain-kill.mp3` / `chain-kill.ogg`: five-kill chain cue derived from `docs/Squad_Rush/Kill chain multiplier_1.wav`.
- `public/assets/audio/boss-attack.mp3` / `boss-attack.ogg`: hazard attack cue derived from `docs/Squad_Rush/Obstacle energy hum_1_9a44ee39.wav`.
- `public/assets/audio/boss-warning.mp3` / `boss-warning.ogg`: warning hum cue derived from `docs/Squad_Rush/Obstacle energy hum_1_9a44ee39.wav`.
- `public/assets/audio/boss-down.mp3` / `boss-down.ogg`: heavy defeat cue derived from `docs/Squad_Rush/Final unit losses_1.wav`.
- `public/assets/audio/result-victory.mp3` / `result-victory.ogg`: victory cue derived from `docs/Squad_Rush/Game start jingle_1_c1d2b792.wav`.
- `public/assets/audio/result-defeat.mp3` / `result-defeat.ogg`: defeat cue derived from `docs/Squad_Rush/Final unit losses_1.wav`.
- `public/assets/audio/bgm-run-1.mp3` / `bgm-run-1.ogg`: looping in-game BGM derived from `docs/Squad_Rush/Pixel turbo run_2.mp3`.
- `public/assets/audio/bgm-run-2.mp3` / `bgm-run-2.ogg`: looping in-game BGM derived from `docs/Squad_Rush/Turbo coin rush_1_56223d99.mp3`.
- `public/assets/audio/bgm-run-3.mp3` / `bgm-run-3.ogg`: looping in-game BGM derived from `docs/Squad_Rush/Turbo coin rush_2_d785fb05.mp3`.
- `public/assets/audio/bgm-run-4.mp3` / `bgm-run-4.ogg`: looping in-game BGM derived from `docs/Arcade_Lane/Neon grid riot_1_ad4fbe7c.mp3`.
- `public/assets/audio/bgm-run-5.mp3` / `bgm-run-5.ogg`: looping in-game BGM derived from `docs/Arcade_Lane/Neon grid riot_2_ff51450c.mp3`.
- `public/assets/audio/chain-kill-1.mp3` / `chain-kill-1.ogg`: kill-chain cue derived from `docs/Arcade_Lane/Kill chain notification 1_1_ad1f3728.wav`.
- `public/assets/audio/chain-kill-2.mp3` / `chain-kill-2.ogg`: kill-chain cue derived from `docs/Arcade_Lane/Kill chain notification 2_1_fe7b1426.wav`.
- `public/assets/audio/chain-kill-3.mp3` / `chain-kill-3.ogg`: kill-chain cue derived from `docs/Arcade_Lane/Kill chain notification 3_1_c571a8c0.wav`.
- `public/assets/audio/chain-kill-4.mp3` / `chain-kill-4.ogg`: kill-chain cue derived from `docs/Arcade_Lane/Kill chain notification 4_1_e8c3cf3f.wav`.
- `public/assets/audio/enemy-flurry-1.mp3` / `enemy-flurry-1.ogg`: enemy destruction cue derived from `docs/Arcade_Lane/Enemy destruction flurry 1_1_5df9109b.wav`.
- `public/assets/audio/enemy-flurry-2.mp3` / `enemy-flurry-2.ogg`: enemy destruction cue derived from `docs/Arcade_Lane/Enemy destruction flurry 2_1_2d8ca2b2.wav`.
- `public/assets/audio/enemy-flurry-3.mp3` / `enemy-flurry-3.ogg`: enemy destruction cue derived from `docs/Arcade_Lane/Enemy destruction flurry 3_1_e4af247e.wav`.
- `public/assets/audio/enemy-flurry-4.mp3` / `enemy-flurry-4.ogg`: enemy destruction cue derived from `docs/Arcade_Lane/Enemy destruction flurry 4_1_64d43d30.wav`.
- `public/assets/audio/final-pop.mp3` / `final-pop.ogg`: combo pop cue derived from `docs/Arcade_Lane/Final enemy pops_1_b8a89f8d.wav`.
- `public/assets/audio/ui-reveal.mp3` / `ui-reveal.ogg`: UI panel reveal cue derived from `docs/Arcade_Lane/Upgrade menu reveal_1_6f5fa5a6.wav`.
- `public/assets/audio/weapon-spin.mp3` / `weapon-spin.ogg`: weapon/upgrade spin cue derived from `docs/Arcade_Lane/Player weapon spin_1_456c0ea3.wav`.
- `public/assets/audio/allied-gunfire.mp3` / `allied-gunfire.ogg`: squad gunfire layer derived from `docs/Arcade_Lane/Allied soldier gunfire_1_adfecc2c.wav`.
- `public/assets/audio/run-footsteps.mp3` / `run-footsteps.ogg`: looping movement bed derived from `docs/Squad_Rush/Squad running footsteps_1_6537e435.wav`.
- Source: project-provided `docs/Squad_Rush` and `docs/Arcade_Lane` audio, trimmed and transcoded with FFmpeg into browser runtime MP3/OGG pairs.
- Commercial use: follows the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone audio pack without confirming the source asset terms.

## Source References

- Adobe Mixamo FAQ: characters and animations may be used royalty-free in personal, commercial, and non-profit projects including video games, but raw assets must not be redistributed as standalone stock/template/asset packages.
- Quaternius Ultimate Monsters: free to use in personal and commercial projects; Poly Pizza mirrors the bundle as Public Domain (CC0).
- Kenney support/license guidance: game assets on asset pages are public domain licensed, Creative Commons CC0, and may be used in commercial projects.
