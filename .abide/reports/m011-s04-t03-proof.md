# M011/S04 T03 — Prove generation: PR section from report rows + dry-run pass

**Probe change set (kept):** the slice's own T01+T02 diff
(`scripts/jeve-report.mjs` + evidence md + PLAN.md) — governed by 9 model
rules, all with clear hook-recorded event evidence, so the probe report
verdict is `clear` with no synthetic events.

## Committed probe report

`.abide/reports/gsd-m011-s04-handoff-evidence-pipeline-63188d55.{json,md}`
(`node scripts/hooks/jeve-report.mjs --base origin/main --head HEAD
--out .abide/reports` → `clear ...-63188d55.json ...-63188d55.md`):
9 findings rows (rule -> `scripts/jeve-report.mjs` -> clear -> event pointer),
`head.sha` = T02 commit `63188d5`, verdict `clear`.

## Generated PR abide/JEV section (from report rows — no hand-written bands)

Model rows generated from `report.findings` (band + where + evidence detail);
lint rows attested per the T01/G4 decision (`npx eslint
scripts/jeve-report.mjs` exit 0, quoted below):

```md
## abide/JEV compliance
| rule | where | band | evidence |
|---|---|---|---|
| no-new-object-in-memo-props | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.04 |
| no-derived-state-effect | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.04 |
| no-listener-without-cleanup | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.02 |
| no-fetch-in-components | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.03 |
| lazy-loading-fallback | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.02 |
| no-children-clone-for-state | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.02 |
| no-app-logic-in-components | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.03 |
| static-components | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.03 |
| no-unstable-dep-identity | scripts/jeve-report.mjs | clear | event · 8 checks · last 2026-09-29T06:28:16.405Z · p=0.06 |
| hooks-top-level | scripts/jeve-report.mjs | clear | eslint clean (report lintRules; npx eslint exit 0) |
| exhaustive-deps | scripts/jeve-report.mjs | clear | eslint clean (report lintRules; npx eslint exit 0) |
| typescript-eslint-recommended | scripts/jeve-report.mjs | clear | eslint clean (report lintRules; npx eslint exit 0) |

Verdict: clear all 9 governed rule(s) have clear evidence
```

## Contract dry-run verdict (quoted, exit 0)

`node scripts/gsd-pr-contract.mjs --pr-file <generated> --issue-file
<probe issue> --report ...-63188d55.json --changed-files <report list>
--head-sha 63188d55... --milestone M011 --slice S04 --dry-run`:

```text
[gsd-pr-contract] dry-run: parity PASS (ok)
[gsd-pr-contract] dry-run: jev PASS (ok)
[gsd-pr-contract] approval: none/stale
[gsd-pr-contract] verdict: GATE CLEAR
```

## Verify (T03)

- Quoted dry-run exit 0 with `parity PASS` + `jev PASS` (JEV checks: rows cover
  governed rules, no act bands, head.sha fresh, changed files covered).
- Generated PR abide/JEV section quoted above, derived from report rows.
- `npx eslint scripts/jeve-report.mjs` → exit 0 (lint-row attestation basis).
