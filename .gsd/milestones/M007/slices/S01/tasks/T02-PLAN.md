---
estimated_steps: 2
estimated_files: 2
skills_used: []
---

# T02: Run pack script on habbo_inspiration_new

Run: node scripts/pack-pixellab-sprites.mjs /Users/antonmoroz/Downloads/habbo_inspiration_new habbo-inspiration-new --frame-size=104
Verify output PNG dimensions and JSON key count match expectations.

## Inputs

- `/Users/antonmoroz/Downloads/habbo_inspiration_new`

## Expected Output

- `assets/pixellab/habbo-inspiration-new.png`
- `assets/pixellab/habbo-inspiration-new.json`

## Verification

node -e "const j=JSON.parse(require('fs').readFileSync('assets/pixellab/habbo-inspiration-new.json','utf8')); const keys=Object.keys(j.frames); console.log('total keys:', keys.length); console.log('rot keys:', keys.filter(k=>k.includes('_rot_')).length); console.log('idle keys:', keys.filter(k=>k.includes('_idle_')).length); console.log('walk keys:', keys.filter(k=>k.includes('_walk_')).length);"
