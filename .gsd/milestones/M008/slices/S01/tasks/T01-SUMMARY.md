---
id: T01
parent: S01
milestone: M008
key_files:
  - scripts/configure.mjs
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-11T13:28:06.686Z
blocker_discovered: false
---

# T01: Wrote scripts/configure.mjs — interactive .env wizard with dry-run, --yes, and diff output

**Wrote scripts/configure.mjs — interactive .env wizard with dry-run, --yes, and diff output**

## What Happened

Built a 230-line Node.js CLI wizard using only built-in `readline` (no new deps). Handles: flag parsing (--dry-run, --yes), loading existing .env with key preservation, kanban source selection, GitHub Copilot monitoring fields, source-specific fields (GitHub Projects vs AzDO), optional PORT, diff computation, and merge-write that preserves comments and unknown vars in existing .env. ANSI colour output degrades gracefully when stdout is not a TTY.

## Verification

Ran `node scripts/configure.mjs --dry-run --yes` against real .env (no changes expected — correct). Ran against empty .env (dry-run) — showed `+ KANBAN_SOURCE=github` diff correctly. Ran against github-mode .env with fresh GitHub Projects vars — no spurious changes.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node scripts/configure.mjs --dry-run --yes` | 0 | ✅ pass | 320ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `scripts/configure.mjs`
