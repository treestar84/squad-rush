#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p public/assets/models/environment public/assets/textures public/assets/audio public/assets/ui

cat <<'MSG'
Squad Rush asset pipeline directories are ready.

This build uses Babylon.js procedural meshes so it runs without external downloads.
To upgrade art assets, add commercial-use GLB/KTX2/audio files with these names:
  public/assets/models/soldier.glb
  public/assets/models/monster_basic.glb
  public/assets/models/monster_tank.glb
  public/assets/models/boss.glb
  public/assets/models/environment/road_segment.glb
  public/assets/models/environment/gate_frame.glb
  public/assets/models/environment/boss_arena.glb
MSG
