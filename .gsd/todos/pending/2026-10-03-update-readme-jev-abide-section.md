---
created: 2026-10-03T21:10:00.000Z
title: Update README JEV+ABIDE section and verify with repo-wide audit
area: docs
files:
  - README.md
  - src/kanbanFilter.ts
---

## Problem

The README's "Abide/JEV fire drill" section needs updating to reflect current rules and
provide a fresh example that exercises the `no-fetch-in-components` detector. We also
want to verify the JEV/ABIDE pipeline still catches violations by running a full
repo-wide audit after introducing a deliberate violation.

## Solution

1. Add a deliberate `no-fetch-in-components` violation to `src/kanbanFilter.ts` (fetch
   inside a custom hook) to trigger the JEV judge.
2. Update the README "Abide/JEV fire drill" section with the new example and refresh
   the "Whole-codebase audit snapshot" section.
3. Run `abide audit --all` to confirm the violation is caught repo-wide.
4. Report results.

## Verify

- `abide audit --all` flags `src/kanbanFilter.ts` with `no-fetch-in-components`
- README fire drill section includes the new example
- All other files remain clear (no new violations introduced)
