---
id: S01
parent: M007
milestone: M007
provides:
  - ["assets/pixellab/habbo-inspiration-new.png — 936x832 spritesheet", "assets/pixellab/habbo-inspiration-new.json — manifest with pl_rot/pl_idle/pl_walk keys at 104x104"]
requires:
  []
affects:
  []
key_files:
  - ["scripts/pack-pixellab-sprites.mjs", "assets/pixellab/habbo-inspiration-new.png", "assets/pixellab/habbo-inspiration-new.json"]
key_decisions:
  - ["Used --frame-size CLI flag rather than auto-detecting from PNG dimensions, keeping the script predictable", "normaliseAnimName strips 8-char hex hash and normalises case, so any future PixelLab download with similar naming works without script changes"]
patterns_established:
  - ["PixelLab new export format: animation dirs use CapitalCase + 8-char hex hash (e.g. Breathing_Idle-98af97b4); strip hash and normalise for ANIM_MAP lookup", "For 104px characters: node scripts/pack-pixellab-sprites.mjs <dir> <name> --frame-size=104"]
observability_surfaces:
  - ["Pack script logs frame count, sheet dimensions, animation names, and key sample"]
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-10T19:59:01.171Z
blocker_discovered: false
---

# S01: Download & pack spritesheet

**Packed habbo_inspiration_new (104×104, 8 dirs, idle+walk) into assets/pixellab/habbo-inspiration-new.png + .json**

## What Happened

The PixelLab character zip was already downloaded. The existing pack script had two gaps for this asset: CELL_SIZE was hardcoded at 48, and animation dir name matching expected lowercase-hyphen names (e.g. breathing-idle) while PixelLab now exports with capitalised names and hash suffixes (Breathing_Idle-98af97b4). Added a --frame-size flag and a normaliseAnimName helper that strips the hash and normalises casing. Ran the updated script to produce the 936x832 spritesheet with 72 frames covering all 8 directions across rot, idle (4 frames), and walk (4 frames).

## Verification

JSON key counts 8+32+32=72 correct. Cell size 104×104. Sheet 936×832. Pack script usage string updated.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `scripts/pack-pixellab-sprites.mjs` — Added --frame-size=N CLI arg and normaliseAnimName() to handle PixelLab's hash-suffixed uppercase animation dir names
- `assets/pixellab/habbo-inspiration-new.png` — New 936x832 spritesheet, 72 frames at 104x104
- `assets/pixellab/habbo-inspiration-new.json` — Manifest with pl_rot_N, pl_idle_N_F, pl_walk_N_F keys; cell size 104
