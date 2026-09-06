---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: Extend pack script: frame-size arg + animation name normalization

Add --frame-size=N CLI arg (default 48) to pack-pixellab-sprites.mjs. Add animation name normalization that strips hash suffixes and normalizes Breathing_Idle-xxx → breathing-idle, Walking-xxx → walking before the ANIM_MAP lookup. The cell blit loop already clips to CELL_SIZE — just make that variable.

## Inputs

- `scripts/pack-pixellab-sprites.mjs`

## Expected Output

- `scripts/pack-pixellab-sprites.mjs (updated)`

## Verification

node scripts/pack-pixellab-sprites.mjs --help 2>&1 || node scripts/pack-pixellab-sprites.mjs 2>&1 | head -5
