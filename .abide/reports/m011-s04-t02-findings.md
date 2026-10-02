# M011/S04 T02 — Per-rule application rows in the handoff report

**Change (repo-owned, minimal):** `scripts/jeve-report.mjs` only —
`buildReport` now emits additive top-level `findings[]`, and `renderMarkdown`
prints an embeddable `## abide/JEV compliance` section. No wrapper-flag changes
were needed (`scripts/hooks/jeve-report.mjs` untouched); no product code, no
rubric rule changes.

## Sample report excerpt (probe: `scripts/probe-target.mjs` + 2 clear verdicts)

JSON (`report.findings[0..1]`, full rows):

```json
[
  {
    "rule": "no-new-object-in-memo-props",
    "files": ["scripts/probe-target.mjs"],
    "band": "unverified",
    "evidence": "none"
  },
  {
    "rule": "no-derived-state-effect",
    "files": ["scripts/probe-target.mjs"],
    "band": "unverified",
    "evidence": "none"
  }
]
```

Markdown (`## abide/JEV compliance` section, generated — not hand-written):

```md
## abide/JEV compliance
| rule | where | band | evidence |
|---|---|---|---|
| no-new-object-in-memo-props | scripts/probe-target.mjs | unverified | none |
| no-derived-state-effect | scripts/probe-target.mjs | unverified | none |
| no-listener-without-cleanup | scripts/probe-target.mjs | clear | event · 1 checks · last 2026-09-29T06:00:00Z · p=0.2 |
| no-fetch-in-components | scripts/probe-target.mjs | clear | event · 1 checks · last 2026-09-29T06:00:00Z · p=0.12 |
...
Verdict: unverified no abide evidence for 7 governed rule(s): ...
```

## Existing shape stable (quoted key order)

`version,generator,generatedAt,repo,branch,base,head,changedFiles,deletedFiles,
rules,findings,files,lintRules,excludedRules,live,totals,verdict,notes` —
every pre-existing top-level field present in order; `findings` is additive.
Older reports without `findings` still render (embeddable section degrades to
`| _(none)_ |` + `Verdict: empty no model rules govern the changed files` —
verified against
`.abide/reports/gsd-m011-s03-vetted-rules-calibration-91dc6d1b.json`).

## Verify (T02)

- `npx vitest run tests/jeve-report.test.ts` → 17 passed.
- `abide check scripts/jeve-report.mjs` → 9 rules clear, nothing to repair.
- Gap closure: G1 (contract's `report.findings[].{rule,band}` now populated),
  G2 (rule -> files -> band -> evidence rows emitted), G3 (md section parses
  via `parseJevSection`: 4-column table + `Verdict:` line).
