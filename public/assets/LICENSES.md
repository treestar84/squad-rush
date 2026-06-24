# Asset Licenses

This manifest tracks the files loaded by `src/game/utils/assetLoader.ts`.

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

### Additional Stored Assets
- `public/assets/models/soldier.glb`: Kenney Platformer Kit, `character-oobi.glb`, CC0, retained as fallback/reference.
- `public/assets/models/boss.glb`: Kenney Platformer Kit, `block-moving-large.glb`, CC0, retained as fallback/reference.
- `public/assets/models/Textures/colormap.png`: Kenney Platformer Kit texture folder, CC0, retained for Kenney GLB references.

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
- `public/assets/audio/bgm-run.mp3` / `bgm-run.ogg`: looping in-game BGM derived from `docs/Squad_Rush/Pixel turbo run_2.mp3`.
- `public/assets/audio/run-footsteps.mp3` / `run-footsteps.ogg`: looping movement bed derived from `docs/Squad_Rush/Squad running footsteps_1_6537e435.wav`.
- Source: project-provided `docs/Squad_Rush` audio, trimmed and transcoded with FFmpeg into browser runtime MP3/OGG pairs.
- Commercial use: follows the project-provided asset grant for this game repository.
- Raw redistribution: keep as part of this repository/game build; do not redistribute as a standalone audio pack without confirming the source asset terms.

## Source References

- Adobe Mixamo FAQ: characters and animations may be used royalty-free in personal, commercial, and non-profit projects including video games, but raw assets must not be redistributed as standalone stock/template/asset packages.
- Quaternius Ultimate Monsters: free to use in personal and commercial projects; Poly Pizza mirrors the bundle as Public Domain (CC0).
- Kenney support/license guidance: game assets on asset pages are public domain licensed, Creative Commons CC0, and may be used in commercial projects.
