# M011/S04 T01 — Contract assessment: consumer requirements vs report shape

**Task:** Map what the consumers require against what the current report emits.
**No builder edits in this task** — build list only (executed in T02).

## Consumer requirements (quoted)

**R1 — loop/review.md step 4a (committed handoff artifact, Q15):**
"take the newest report whose `head` sha is an ancestor of the PR head
(`git merge-base --is-ancestor <reportHeadSha> <headRefOid>`) and whose commits
after it are report-only ... Read it: verdict must be `clear` (or `empty` with
a stated reason) and its changed-file set must cover the PR's changed files."

**R2 — loop/review.md step 4 (mechanized pre-check, M010/S03):**
"`node scripts/gsd-pr-contract.mjs --pr <n> --issue <m> --report
.abide/reports/<...>-<sha8>.json --changed-files <csv> --head-sha <sha> --dry-run`
verifies the PR's abide/JEV section against the committed report (rows cover the
governed rules, no act bands, head.sha fresh, changed files covered)".

**R3 — scripts/gsd-pr-contract.mjs `checkJevSection` (lines 230-275):** the PR body
must carry a `## abide/JEV compliance` section whose table rows parse as
`| rule | where | band | evidence |` with band in `{clear, flag, act}`
(`parseJevSection`, lines 168-187); EVERY in-scope governed rule needs a row
(`jev-row-missing:<id>` otherwise); `act` rows refuse (`jev-band-act:<id>`);
the `Verdict:` line must be `clear` (or `empty` with a reason) —
`jev-verdict-unverified` / `jev-verdict-reason-missing` otherwise. When
model-judged rules scope the diff, a committed report object is REQUIRED
(`jev-report-missing`), and it is cross-checked by `checkJevReport`.

**R4 — scripts/gsd-pr-contract.mjs `checkJevReport` (lines 283-322):**
`report.head.sha` must equal the PR head sha (or be its ancestor);
`report.changedFiles` must cover the changed files (minus `.abide/reports/`)
or `jev-report-uncovered-files` fires; each PR row's band must equal the
report's band for that rule — read from **`report.findings`**
(line 311: `new Map((report?.findings || []).map((f) => [f.rule, ...]))`) —
or `jev-report-band-mismatch:<rule>` fires.

## Current report shape (quoted)

Builder `scripts/jeve-report.mjs` (`buildReport`, lines 208-335) emits top-level
`version/generator/base/head/changedFiles/deletedFiles/rules/files/lintRules/
excludedRules/live/totals/verdict/notes` — e.g.
`.abide/reports/gsd-m011-s03-vetted-rules-calibration-91dc6d1b.json`:
- `rules[]` rows are `{id, band, probability, checks, lastAt, evidence, scope}`
  (rule -> aggregate band; NO per-file breakdown, key is `id` not `rule`).
- `files[]` rows are `{path, status, lastEventAt, governedRules[]}`
  (file -> governing rule ids; NO band per file).
- There is NO `findings` key anywhere in the emitted JSON.
- `renderMarkdown` (lines 359-389) prints a 6-column Rules table
  (`| rule | band | prob | evidence | checks | last |`), a Files table, and a
  `## Verdict` heading followed by `<verdict> — <reason>` prose — NOT the
  4-column `| rule | where | band | evidence |` table plus `Verdict: <kind>
  <reason>` line that `parseJevSection` consumes.

## Gap list (T02 build list)

- **G1 (blocking): shape mismatch `rules[]` vs `findings[]`.** The contract reads
  per-rule bands from `report.findings[].{rule,band}`; the builder emits
  `rules[].{id,band,...}`. Band consistency (`jev-report-band-mismatch`) can
  never match. T02 fix: ADD a `findings` array of per-rule application rows
  `{rule, files, band, evidence}` derived from the existing `rules` rows; keep
  every existing top-level key stable so older reports still parse.
- **G2 (blocking): no per-rule -> files rows.** The PR section needs a `where`
  (files) cell per row; the report has rule->band and file->ruleIds but no
  rule->files->band->evidence mapping. T02 fix: each `findings` row lists the
  changed files that rule governed (from the `files[].governedRules` mapping),
  the band, and an evidence pointer (`event(n checks, lastAt)` / `live` /
  `event+live` / `none`, mirroring the `rules[].evidence` vocabulary).
- **G3 (blocking): md not embeddable as a PR section.** `parseJevSection`
  requires the 4-column table plus a `Verdict:` line. T02 fix: `renderMarkdown`
  prints the `findings` rows as an embeddable `| rule | where | band |
  evidence |` table (keeping the existing tables), plus a
  `Verdict: <clear|empty|unverified> <reason>` line generated from the same
  verdict math.
- **G4 (advisory, scope decision for T02/T03): lint-scoped rows.** The contract's
  `governedRulesForFiles` includes active lint rules with scopes (3 in the
  current rubric), which the report never scores (lint rules are listed, not
  banded). PR-section generation therefore emits model rows from `findings` and
  attests lint rows as `clear` with evidence pointing at the report's
  `lintRules` list + eslint run — mechanically safe because `checkJevReport`
  only compares bands for rules present in `findings`.

## Verify (T01)

- Consumer requirement list quoted above (R1-R4 with file:line refs).
- Gap list quoted above (G1-G4); T02 build list = G1+G2+G3 (+G4 attestation).
- No edits to `scripts/jeve-report.mjs` or `scripts/hooks/jeve-report.mjs`
  in this task (`git diff --name-only` for this commit shows only this file).
