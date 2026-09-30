# M011/S04 T04 — Docs + full repo verify + raw evidence commit

## Docs (minimal, pointer-style)

`docs/agent-hooks/JEVE-HANDOFF.md`:
- Artifact JSON example gains the additive `findings[]` row shape.
- Artifact bullets gain the `findings[]` definition (rule -> files -> band ->
  evidence pointer; additive; older reports still parse) and the embeddable
  `## abide/JEV compliance` table + `Verdict:` line contract.
- New `## PR section generation (M011/S04)`: row generation (model rows from
  findings, lint rows attested via green eslint), the dry-run prove command,
  and evidence pointers to the T01–T03 files.

`loop/review.md` step 4 pointer: SKIPPED — the step text already cites the
exact mechanized pre-check command and row-coverage semantics, so no edit was
needed; editing a lane prompt would also desync the repo copy from the Paseo
schedule runtime source (loop/README.md sync rule) for a zero-information
pointer. The procedure now lives in JEVE-HANDOFF.md, which the review lane
reaches from any JEV verdict.

## Full repo verify (quoted)

- `npx vitest run` (full): 72 files passed, 954 tests passed; 1 suite
  (`tests/idleWander.test.ts`) hit a vitest-worker `fetch` timeout under load
  (transform 903s) — rerun in isolation: 6/6 passed. Unrelated to this slice
  (diff touches `scripts/jeve-report.mjs`, docs, `.abide/reports/` only).
- `npx tsc --noEmit`: exit 0.
- `node esbuild.config.mjs`: exit 0 (`Webview built: dist/webview.js`).
- No ts/tsx files changed → `npm run lint` not required by the task; additionally
  `npx eslint scripts/jeve-report.mjs` exit 0 (T03 lint-row attestation basis)
  and `abide check scripts/jeve-report.mjs` → 9 rules clear (T02).

## Committed evidence under `.abide/reports/` (raw tool output, this slice)

- `m011-s04-t01-assessment.md` — T01 consumer requirements (R1–R4) + gaps (G1–G4).
- `m011-s04-t02-findings.md` — T02 row excerpts (JSON + md) + shape stability.
- `m011-s04-t03-proof.md` — T03 probe report + generated section + dry-run quote.
- `gsd-m011-s04-handoff-evidence-pipeline-63188d55.{json,md}` — T03 probe report
  pair (verdict `clear`; superseded at closeout by the seal-commit report).
- This file (`m011-s04-t04-docs-verify.md`).

## Verify (T04)

- Verify results quoted above (vitest/tsc/esbuild; lint N/A with rationale).
- Committed evidence files listed above (all under `.abide/reports/`).
