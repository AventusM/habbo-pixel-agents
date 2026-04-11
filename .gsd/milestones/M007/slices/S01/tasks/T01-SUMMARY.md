---
id: T01
parent: S01
milestone: M007
key_files:
  - scripts/pack-pixellab-sprites.mjs
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-10T19:58:25.546Z
blocker_discovered: false
---

# T01: Added --frame-size CLI arg and animation name normalisation to pack-pixellab-sprites.mjs

**Added --frame-size CLI arg and animation name normalisation to pack-pixellab-sprites.mjs**

## What Happened

Added flag parsing that separates positional and --flag args, reads --frame-size=N (default 48), removes the duplicate hardcoded `const CELL_SIZE = 48` from the packing section, and adds a normaliseAnimName() function that strips 8-char hex hash suffixes and normalises capitalisation + underscores. Updated the animation loop to normalise the directory name before the ANIM_MAP lookup.

## Verification

node scripts/pack-pixellab-sprites.mjs returned usage string with --frame-size mention. No syntax errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node scripts/pack-pixellab-sprites.mjs 2>&1 | head -5` | 1 | ✅ pass | 120ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `scripts/pack-pixellab-sprites.mjs`
