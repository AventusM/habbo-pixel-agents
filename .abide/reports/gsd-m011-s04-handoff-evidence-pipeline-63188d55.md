# JEV handoff report — CLEAR
head: 63188d55eb29bd9850d150ec2c8954ee7f169077 — feat(M011/S04): T02 per-rule findings rows in handoff report (JSON+md)
base: origin/main @ 00e29953
branch: gsd/m011-s04-handoff-evidence-pipeline · generated: 2026-09-29T06:30:46.497Z
changed: 4 files (1 governed)

## Rules
| rule | band | prob | evidence | checks | last |
|---|---|---|---|---|---|
| no-new-object-in-memo-props | clear | 0.04 | event | 8 | 2026-09-29T06:28:16.405Z |
| no-derived-state-effect | clear | 0.04 | event | 8 | 2026-09-29T06:28:16.405Z |
| no-listener-without-cleanup | clear | 0.02 | event | 8 | 2026-09-29T06:28:16.405Z |
| no-fetch-in-components | clear | 0.03 | event | 8 | 2026-09-29T06:28:16.405Z |
| lazy-loading-fallback | clear | 0.02 | event | 8 | 2026-09-29T06:28:16.405Z |
| no-children-clone-for-state | clear | 0.02 | event | 8 | 2026-09-29T06:28:16.405Z |
| no-app-logic-in-components | clear | 0.03 | event | 8 | 2026-09-29T06:28:16.405Z |
| static-components | clear | 0.03 | event | 8 | 2026-09-29T06:28:16.405Z |
| no-unstable-dep-identity | clear | 0.06 | event | 8 | 2026-09-29T06:28:16.405Z |

## Files
| file | status | last event |
|---|---|---|
| .abide/reports/m011-s04-t01-assessment.md | no-rules | - |
| .abide/reports/m011-s04-t02-findings.md | no-rules | - |
| .gsd/phases/11-jev-enforcement-that-actually-runs-vette/11-04-PLAN.md | no-rules | - |
| scripts/jeve-report.mjs | checked | 2026-09-29T06:28:16.405Z |

## Verdict
clear — all 9 governed rule(s) have clear evidence

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

Verdict: clear all 9 governed rule(s) have clear evidence
