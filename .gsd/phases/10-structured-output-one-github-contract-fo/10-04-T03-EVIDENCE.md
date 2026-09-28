# M010/S04 T03 evidence — approval lift + reconcile leg, merge-free (2026-09-28)

Lane policy: never merges. All legs below are dry-run / fixture-level; no
GitHub writes were made in T03.

## Fresh vs stale approval (gate helpers, fixture timestamps)

Helpers from `scripts/gsd-github-reactions.mjs` (`isApprovalBody`,
`findFreshApproval`, `approvalLifts`), head `2026-09-28T18:00:00Z`:

```text
vocab ok: true | GSD: approved: false | gsd-loop ok: false
fresh-set: {"fresh":true,"approval":{"body":"ok","author":"AventusM","createdAt":"2026-09-28T19:00:00Z"}}
stale-set: {"fresh":false,"approval":null}
fresh lifts: {"lifted":["humanMergeTrailer","stacked","escalated"],"stillBlocking":["blocked"]}
stale lifts: {"lifted":[],"stillBlocking":["humanMergeTrailer","stacked","escalated"]}
```

Notes: bot `approve` comments never count (the fresh-set pick is the human
`ok`); `gsd:blocked` is never lifted; with no approval everything still
blocks. Matches contract section 5.

## Fresh vs stale via the gate CLI (canonical scratch bodies + comments file)

Fresh (`--head-date 2026-09-28T18:35:00Z`, owner `ok` at 18:40):

```text
[gsd-pr-contract] dry-run: parity PASS (ok)
[gsd-pr-contract] dry-run: jev PASS (ok)
[gsd-pr-contract] approval: fresh (AventusM)
[gsd-pr-contract] verdict: GATE CLEAR
```

Stale (`--head-date 2026-09-28T19:00:00Z`, same comments):

```text
[gsd-pr-contract] approval: none/stale
[gsd-pr-contract] verdict: GATE CLEAR
```

## Reconcile wording (seal-skipped dry-run, read-only — no --github)

`gsd-event-hook.mjs --milestone M010 --slice S04 --seal skipped --dry-run`:

```text
[gsd-github-reactions] would label + comment on #145 "M010/S04: End-to-end verification + UAT"
```

Wording shape (seal-skipped head + reasons + no close) is pinned by the
`seal-skipped head carries reasons and does not close` unit case in
`tests/gsd-github-publish.test.ts`.

GAP (recorded, not fixed in this slice): `--github --dry-run` is NOT
side-effect-free — `reactToGsd` (`scripts/hooks/gsd-event-hook.mjs`) guards
writes with `if (!githubLive)` only, so passing `--github` together with
`--dry-run` still labels + comments. The live `--github` run was deliberately
withheld (it would have posted a false `sealed skipped` comment on #145).
Fixing the guard is sync write-path behavior change and belongs in its own
slice; the walkthrough proves the read-only path and records the gap here
(see 10-04-SUMMARY.md validation notes).

## Legacy tolerance (already-closed issues skipped, read-only)

`--milestone M010 --slice S02 --seal skipped --dry-run` (issue #143 CLOSED):

```text
[gsd-github-reactions] M010/S02 already handled        # dedupe key from the earlier S02 seal
```

With a fresh dedupe state against M010/S03 (issue #144 CLOSED):

```text
[gsd-github-reactions] #144 already in terminal state — skipping
```

Both terminal paths (dedupe + closed-skip) proven without writes.

## Unit evidence

`npx vitest run tests/gsd-github-publish.test.ts` — 13/13 pass.
