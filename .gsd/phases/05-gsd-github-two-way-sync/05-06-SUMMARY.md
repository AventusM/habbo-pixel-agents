---
id: S06
parent: M005
milestone: M005
provides:
  - "GSD→GitHub second hop: slice terminal events become exactly-once, loop-guarded GitHub reactions"
requires:
  - slice: S05
    provides: "the <!-- gsd-sync --> marker + one-hop protocol this half honors"
affects:
  - scripts/hooks/gsd-event-hook.mjs
key_files:
  - scripts/gsd-github-reactions.mjs
  - scripts/gsd-github-reactions.d.mts
  - scripts/hooks/gsd-event-hook.mjs
  - tests/gsd-github-reactions.test.ts
key_decisions:
  - "Safe by default: live gh writes require --github; --dry-run does read-only matching (D025)"
  - "Dedupe-before-act by event hash; historical tail never triggers live reactions"
patterns_established:
  - "Two-way sync protocol: marker-carrying echoes + hash dedupe + actor guard (shared by both halves)"
observability_surfaces:
  - .gsd/runtime/github-sync/gsd-events-state.json
  - console reaction lines from gsd-event-hook
drill_down_paths: []
duration: 45m
verification_result: passed
completed_at: 2026-09-26
---

# S06: GSD→GitHub hook reactions

**GSD slice terminal events become exactly-once GitHub reactions — comment now, close on completion — loop-safe against S05.**

## What Happened

- `scripts/gsd-github-reactions.mjs` (pure): `classifyGsdEvent` maps `complete-slice` → comment + close, `skip-slice` → comment only; guards: known command, milestoneId + sliceId present, event hash required (dedupe key), actor `github-sync` never echoed; `buildReactionComment` always carries `<!-- gsd-sync -->`; `matchesIssueTitle` reuses S05's `parseTitlePrefix`.
- `scripts/hooks/gsd-event-hook.mjs`: new flags `--github` (live writes), `--dry-run` (read-only matching + intent log), `--event-log` / `--state` overrides; dedupe state at `.gsd/runtime/github-sync/gsd-events-state.json`, persisted before acting (at-most-once); historical tail is feed-only (live reactions happen on NEW events); issue lookup via `gh issue list --search '<M>/<S> in:title'` + exact prefix match; per-line try/catch.
- Commits: `8fac12d` (module + tests), `a444395` (hook).

## Verification

- `npx vitest run`: 49 files / **682 tests green** (9 new for the classifier).
- `npx tsc --noEmit` clean; `node --check scripts/hooks/gsd-event-hook.mjs` ok.
- Hermetic smoke (fixture log, `--once --dry-run`):
  - run 1, fresh state → `would comment on #110 "M005/S06: GSD→GitHub hook reactions" and close it`; `M999/S01 — no matching issue`; feed line for `plan-slice`.
  - run 2 with `smk1` pre-seeded → `M005/S06 already handled` (dedupe read path).
- No live writes performed (safe-by-default); the live close/comment proof is S07's round-trip UAT.

## Forward Intelligence

### What the next slice should know
- To go live: `node scripts/hooks/gsd-event-hook.mjs --github` (watcher acts on NEW events only). A scratch issue titled `M…/S…` plus a real `complete-slice` event is the round-trip fixture.
- Echo protocol to keep: the `<!-- gsd-sync -->` marker + bot sender is exactly what S05 ignores — do not drop either.
- Found while wiring: the prototype feed map still uses pre-v2 command names (`'slice-complete'` vs actual `complete-slice`), so the FEED path misses v2 completions; the reactions path uses correct v2 names. Aligning the feed map is a candidate follow-up outside S06.

### What's fragile
- `gh` CLI auth is a runtime premise; unauthenticated runs log per-line errors and continue.
- State persists before the gh call: a crash between persist and call loses that reaction by design (at-most-once).
