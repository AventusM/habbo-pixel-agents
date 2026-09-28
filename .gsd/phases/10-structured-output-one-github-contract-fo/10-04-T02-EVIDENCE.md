# M010/S04 T02 evidence — scratch PR + abide/JEV section leg (2026-09-28)

- Scratch branch: `scratch/m010-s04-walkthrough` @ `a66b17b3` (docs-only probe, pushed)
- SCRATCH issue: #159 (canonical; #160 closed as index-lag duplicate in T01)
- Draft scratch PR: #161 (draft, never merge — no Closes keyword)
- JEV report for the probe commit (`jeve-report --base origin/main --head
  origin/scratch/m010-s04-walkthrough`): verdict **empty** — 1 file changed
  (`docs/guides/ISSUE-PR-CONTRACT.md`), 0 governed. Section rendered into the
  PR body as zero rows + `Verdict: empty (docs-only probe — …)`.
- No code gap found: gate, report, and empty-verdict path all behaved
  canonically, so no tool change was needed for this leg.

## Accept leg (live, dry-run, exit 0)

Command:

```text
node scripts/gsd-pr-contract.mjs --pr 161 --issue 159 \
  --report /tmp/s04-walkthrough-reports/scratch-probe-a66b17b3.json \
  --changed-files docs/guides/ISSUE-PR-CONTRACT.md \
  --head-sha a66b17b3ed12ede17acc9339b0b7d2a715fdc82f --dry-run
```

Log:

```text
[gsd-pr-contract] dry-run: parity PASS (ok)
[gsd-pr-contract] dry-run: jev PASS (ok)
[gsd-pr-contract] approval: none/stale
[gsd-pr-contract] verdict: GATE CLEAR
```

## Refuse leg (tampered body: O-1 → O-9 in evidence table + trailer, dry-run, exit 1)

Log:

```text
[gsd-pr-contract] dry-run: parity REFUSE (parity-missing-outcomes,parity-extra-outcomes)
[gsd-pr-contract] missing outcomes: O-1
[gsd-pr-contract] extra outcomes: O-9
[gsd-pr-contract] dry-run: jev PASS (ok)
[gsd-pr-contract] approval: none/stale
[gsd-pr-contract] verdict: GATE REFUSES
```

## Unit evidence

`npx vitest run tests/gsd-pr-contract.test.ts` — 23/23 pass.
