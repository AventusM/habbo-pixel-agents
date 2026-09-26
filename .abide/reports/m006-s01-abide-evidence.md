# M006/S01 — abide/JEV evidence for the changed files

- PR: #132 (`gsd/m006-s01-role-outfits-render-at-spawn`)
- Reviewed head sha at evidence time: **`59d074c`** (slice seal commit; this report commit is report-only after it)
- Review finding addressed: *"the JEV/abide report for the changed files is
  missing/unverifiable"* — this file makes that report inspectable and reproducible.
- Q15 handoff tooling: **not merged** — `scripts/hooks/jeve-report.mjs` does not exist on
  `origin/main` (it lives only on the unmerged `gsd/q15-jeve-handoff` branch), so no Q15
  `.abide/reports/*-<sha8>.{json,md}` pair was produced. Per the #128 repair pattern
  (`59832d3`) the raw `abide check --json` / `abide audit --json` output is committed
  verbatim instead.
- Rubric: `.abide/rubric.json` — for `.ts` files (non-`.tsx`) the governed `when: edit`
  rules in scope are `no-derived-state-effect` and `no-listener-without-cleanup`; the
  remaining rules are either lint-enforced (`hooks-top-level`, `exhaustive-deps`,
  `typescript-eslint-recommended`) or `.tsx`-scoped (`no-app-logic-in-components`, etc.).

## How the evidence was produced

The rubric's code-shape rules are `when: "edit"` — abide/JEV judges a **diff**, which is
how the hook enforces them per edit (AGENTS.md, "abide/JEV tier"). The PR's diff was
reproduced as uncommitted changes and judged with that same lens, in an isolated
temporary worktree (the primary checkout had unrelated GSD state churn in flight at
evidence time):

```bash
# from the repo (needs the abide CLI + TYPESAFE_AI_API_KEY, present in .env)
git worktree add --detach <tmp>/wt origin/main
git -C <tmp>/wt checkout gsd/m006-s01-role-outfits-render-at-spawn -- \
  src/avatarManager.ts src/pixelLabAvatarRenderer.ts \
  tests/avatarManager.test.ts tests/avatarOutfitConfig.test.ts \
  tests/isoAvatarRenderer.test.ts tests/roleOutfitLineup.test.ts
cd <tmp>/wt && abide check --json
cd <tmp>/wt && abide audit src/avatarManager.ts src/pixelLabAvatarRenderer.ts \
  tests/avatarManager.test.ts tests/avatarOutfitConfig.test.ts \
  tests/isoAvatarRenderer.test.ts tests/roleOutfitLineup.test.ts --json
```

The raw output is committed verbatim as `.abide/reports/m006-s01-abide-check.json` and
`.abide/reports/m006-s01-abide-audit.json`; their `root` field names the temporary git
worktree used for isolation. No verdict data was altered.

## Result — edit check: 12 checks, 0 blocked, 0 act-band

| changed file | rules judged | max probability | max band |
| --- | --- | --- | --- |
| `src/avatarManager.ts` | 2 | 0.02 | clear |
| `src/pixelLabAvatarRenderer.ts` | 2 | 0.02 | clear |
| `tests/avatarManager.test.ts` | 2 | 0.02 | clear |
| `tests/avatarOutfitConfig.test.ts` | 2 | 0.02 | clear |
| `tests/isoAvatarRenderer.test.ts` | 2 | 0.03 | clear |
| `tests/roleOutfitLineup.test.ts` | 2 | 0.02 | clear |

All 12 verdicts are `band: clear`, `blocked: false` (`no-derived-state-effect`,
`no-listener-without-cleanup`). No act/blocked verdicts.

## Whole-file audit context

`abide audit` judges a whole file *"as if just written"* — a different lens from the
edit-phase enforcement above.

| file | checked rules | broken | flagged |
| --- | --- | --- | --- |
| all 6 changed files | `no-derived-state-effect` × 6, `no-listener-without-cleanup` × 6 | 0 | 0 |

`byRule` reports `checked=6, broken=[], flagged=[]` for both rules; all 12 `byFile`
verdicts are `clear`. Raw output: `.abide/reports/m006-s01-abide-audit.json`.
