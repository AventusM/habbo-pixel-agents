# JEV handoff report — CLEAR
head: 30e4ed21f6e6802adafb35acca3a3ebd4c5d60fc — feat(M010/S04): fix jeve-report inWindow mixed-offset compare + test
base: origin/main @ 9be8b256
branch: gsd/m010-s04-end-to-end-verification · generated: 2026-09-28T18:43:08.539Z
changed: 10 files (5 governed)

## Rules
| rule | band | prob | evidence | checks | last |
|---|---|---|---|---|---|
| no-new-object-in-memo-props | clear | 0.05 | event | 30 | 2026-09-28T18:42:15.289Z |
| no-derived-state-effect | clear | 0.03 | event | 30 | 2026-09-28T18:42:15.289Z |
| no-listener-without-cleanup | clear | 0.02 | event | 30 | 2026-09-28T18:42:15.289Z |
| no-fetch-in-components | clear | 0.03 | event | 30 | 2026-09-28T18:42:15.289Z |
| lazy-loading-fallback | clear | 0.03 | event | 30 | 2026-09-28T18:42:15.289Z |
| no-children-clone-for-state | clear | 0.02 | event | 30 | 2026-09-28T18:42:15.289Z |
| no-app-logic-in-components | clear | 0.03 | event | 30 | 2026-09-28T18:42:15.289Z |

## Files
| file | status | last event |
|---|---|---|
| .gsd/phases/10-structured-output-one-github-contract-fo/10-04-SUMMARY.md | no-rules | 2026-09-28T18:42:45.740Z |
| .gsd/phases/10-structured-output-one-github-contract-fo/10-04-T02-EVIDENCE.md | no-rules | 2026-09-28T18:35:46.816Z |
| .gsd/phases/10-structured-output-one-github-contract-fo/10-04-T03-EVIDENCE.md | no-rules | 2026-09-28T18:37:11.222Z |
| .gsd/phases/10-structured-output-one-github-contract-fo/10-04-UAT.md | no-rules | 2026-09-28T18:37:55.604Z |
| docs/guides/ISSUE-PR-CONTRACT.md | no-rules | 2026-09-28T18:38:01.436Z |
| scripts/gsd-github-publish.d.mts | checked | 2026-09-28T18:28:48.732Z |
| scripts/gsd-github-publish.mjs | checked | 2026-09-28T18:28:41.868Z |
| scripts/jeve-report.mjs | checked | 2026-09-28T18:42:15.289Z |
| tests/gsd-github-publish.test.ts | checked | 2026-09-28T18:29:22.104Z |
| tests/jeve-report.test.ts | checked | 2026-09-28T18:41:32.979Z |

## Verdict
clear — all 7 governed rule(s) have clear evidence
