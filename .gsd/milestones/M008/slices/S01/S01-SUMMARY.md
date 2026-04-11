---
id: S01
parent: M008
milestone: M008
provides:
  - ["scripts/configure.mjs — runnable wizard", "npm run configure shortcut"]
requires:
  []
affects:
  []
key_files:
  - ["scripts/configure.mjs", "package.json"]
key_decisions:
  - ["Used Node.js built-in readline/promises — no new runtime dependencies", "Merge strategy: overwrite matched keys, append new keys; preserve comments and unknown vars in raw .env text"]
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-11T13:28:44.610Z
blocker_discovered: false
---

# S01: CLI configuration wizard

**CLI configuration wizard — node scripts/configure.mjs guides through all env vars and writes .env**

## What Happened

Created `scripts/configure.mjs`, a fully interactive .env wizard built on Node.js built-in readline with no new dependencies. The script loads existing .env, asks kanban source choice, GitHub Copilot monitoring vars, source-specific kanban vars (GitHub Projects or Azure DevOps), and optional PORT. Produces a coloured diff and writes the file (or skips with --dry-run). Added `npm run configure` as the canonical entry point.

## Verification

npm run configure -- --dry-run --yes exits 0. Empty-.env test shows correct diff. Script and npm shortcut both work.

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

Wizard is sequential — no back-navigation. For very complex configurations this could be improved, but it covers all current env vars.

## Follow-ups

None.

## Files Created/Modified

- `scripts/configure.mjs` — New CLI wizard — interactive, --dry-run, --yes flags; loads/merges existing .env; ANSI colour output
- `package.json` — Added 'configure' script
