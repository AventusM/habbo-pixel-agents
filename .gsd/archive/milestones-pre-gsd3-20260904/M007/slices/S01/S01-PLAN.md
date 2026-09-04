# S01: Download & pack spritesheet

**Goal:** Produce assets/pixellab/habbo-inspiration-new.png + .json with all 8 directions × idle (4 frames) + walk (4 frames) packed into a 104×104-cell spritesheet using the same pl_rot/pl_idle/pl_walk key convention as existing characters
**Demo:** assets/pixellab/habbo-inspiration-new.png exists with correct frame layout

## Must-Haves

- assets/pixellab/habbo-inspiration-new.png exists and loads without error
- assets/pixellab/habbo-inspiration-new.json has 8 rot keys + 64 idle/walk frame keys
- All keys match the pl_rot_N / pl_idle_N_F / pl_walk_N_F convention
- pack-pixellab-sprites.mjs --frame-size arg works for both 48 and 104

## Proof Level

- This slice proves: script output + JSON key count

## Integration Closure

Output files committed to assets/pixellab/ — S02 can consume them

## Verification

- Pack script logs frame count and key sample to stdout

## Tasks

- [x] **T01: Extend pack script: frame-size arg + animation name normalization** `est:20m`
  Add --frame-size=N CLI arg (default 48) to pack-pixellab-sprites.mjs. Add animation name normalization that strips hash suffixes and normalizes Breathing_Idle-xxx → breathing-idle, Walking-xxx → walking before the ANIM_MAP lookup. The cell blit loop already clips to CELL_SIZE — just make that variable.
  - Files: `scripts/pack-pixellab-sprites.mjs`
  - Verify: node scripts/pack-pixellab-sprites.mjs --help 2>&1 || node scripts/pack-pixellab-sprites.mjs 2>&1 | head -5

- [x] **T02: Run pack script on habbo_inspiration_new** `est:10m`
  Run: node scripts/pack-pixellab-sprites.mjs /Users/antonmoroz/Downloads/habbo_inspiration_new habbo-inspiration-new --frame-size=104
Verify output PNG dimensions and JSON key count match expectations.
  - Files: `assets/pixellab/habbo-inspiration-new.png`, `assets/pixellab/habbo-inspiration-new.json`
  - Verify: node -e "const j=JSON.parse(require('fs').readFileSync('assets/pixellab/habbo-inspiration-new.json','utf8')); const keys=Object.keys(j.frames); console.log('total keys:', keys.length); console.log('rot keys:', keys.filter(k=>k.includes('_rot_')).length); console.log('idle keys:', keys.filter(k=>k.includes('_idle_')).length); console.log('walk keys:', keys.filter(k=>k.includes('_walk_')).length);"

## Files Likely Touched

- scripts/pack-pixellab-sprites.mjs
- assets/pixellab/habbo-inspiration-new.png
- assets/pixellab/habbo-inspiration-new.json
