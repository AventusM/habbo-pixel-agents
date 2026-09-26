# M005/S07 — One-time bidirectional reconcile report (2026-09-26)

Scope: every GitHub issue with an M00X(/S0X) title prefix vs GSD milestone/slice statuses (SQLite read-only).
Method: `gh issue list --state all` + `sqlite3 -json` comparison. Raw output: `.gsd/exec/c136d220-1c18-4462-9e50-aac6db19b85c.stdout`.

## Result: agreement; no stragglers to fix

- **18 agreeing pairs** — e.g. #109/#110/#111 (M005/S05–S07: OPEN ↔ pending at read time), #106–#108 (M006/S01–S03: OPEN ↔ pending), every M003/M002/M001 slice issue CLOSED ↔ terminal, milestone issues #71/#60/#57 CLOSED ↔ complete.
- **2 flagged entries are false positives** of the milestone-level rule: #102 and #104 ("M004 eval lane…", "M004 select lane…") are M004-era lane-task issues, correctly closed; they are not the M004 milestone issue and need no action.
- **Informational:** slices without issues (M004/S01, M004/S03, M005/S01–S04, M007/S01–S05, M008/S01–S04) — those ran locally or are not yet published.

## Verdict

Both sides agree at every real milestone/slice point; the one-time reconcile required no fixes. The round-trip UAT (see S07 SUMMARY) then proved the ongoing mechanism, including the D026 `gsd:synced` echo guard.
