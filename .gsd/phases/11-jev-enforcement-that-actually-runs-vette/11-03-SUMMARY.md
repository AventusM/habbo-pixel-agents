# M011/S03 SUMMARY — Vetted rules + calibration (delivered, seal pending review per D018)

All 4 planned tasks executed live on branch
`gsd/m011-s03-vetted-rules-calibration` (base `origin/main` @ `a200810`):

- T01 rule set → researched community grounding (eslint-react
  `static-components`; `react-hooks/exhaustive-deps` construction diagnostic
  as the `no-unstable-dep-identity` equivalent) + 4 floor-median (0.02) rules
  for enrichment; true/false probe pairs quoted
  (commit `71a58b8`, evidence `.abide/reports/m011-s03-rule-candidates.md`).
- T02 land rules → `static-components` (AGENTS.md:67) and
  `no-unstable-dep-identity` (AGENTS.md:69) added to `.abide/rubric.json` as
  model questions with T01 criteria; instructions enriched on the 4 weak
  rules; `abide rubric validate` exit 0, both rules active in `abide report`,
  `abide check` clean (commit `4a5345d`).
- T03 calibrate → `abide calibrate`: 12 model rules, 20 hunks / 8 commits,
  weak: [] noisy: [] (no rewrite round, within the #148 ≤1 contract);
  history medians all clear (0.00–0.03, skipped — no false positives).
  Probe firing per rule per file: static 0.98 act / 0.03 clear; dep-identity
  0.97 act / 0.04 clear; derived 0.98 act / 0.04 clear; listener 0.98 act /
  0.03 clear; lazy 0.94 act / 0.06 clear; clone 0.99 act / 0.02 clear
  (commit `b594838`).
- T04 evidence + verify → raw `abide calibrate` + `abide check` JSON committed
  under `.abide/reports/`; vitest 73 files / 960 tests passed,
  `tsc --noEmit` clean, `node esbuild.config.mjs` exit 0
  (commit `b3317ba`; no ts/tsx touched, lint n/a).

Verification: `abide rubric validate` exit 0; `abide report` shows both new
rules active; `npx vitest run` green; `npx tsc --noEmit` green;
`node esbuild.config.mjs` exit 0.

Seal: executed live with pushed commits (evidence above); the GSD DB seal was
not applied mechanically — this lane has no `gsd_gsd_*` MCP tools, and
hand-writing attempt-grade rows is forbidden (D039), so slice/task rows stay
pending for the next auto pass (D018/D037 precedent). GitHub reconcile is
seal-skipped: #148 commented, stays OPEN for the review lane's close-at-merge
(D039: never close pre-merge). No merges by this lane.
