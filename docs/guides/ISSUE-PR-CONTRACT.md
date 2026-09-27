# Issue–PR Contract (M010)

One canonical shape for every GSD-published GitHub artifact. Slice issues
carry Goal / Demo / Outcomes (O1..On) / Exclusions / GSD tasks plus a
machine-readable `gsd-meta` trailer; slice PRs cite the same outcome IDs with
per-outcome evidence, the same trailer (plus `stacked-on` / `human-merge`
keys), and a dedicated abide/JEV compliance section fed by the committed
Q15 handoff report. The wording below mirrors the published M010/M011 slice
issues (#142–#149) and the review lane's JEV expectations (`loop/review.md`).

## 1. Canonical slice-issue shape

```markdown
## Goal

<one-sentence deliverable>

## Demo

<observable end state — what a human checks>

## Outcomes

- O-1 — <verifiable end state>
- O-2 — <verifiable end state>

## Exclusions

- X-1 — <explicit non-goal>
- X-2 — <explicit non-goal>

## GSD tasks

- <planned task bullets, or "Planned at execution time by the worker lane">

---
GSD slice <MID>/<SID> (risk: <low|medium|high>, depends: <none|S01,...>) — planned in `.gsd/`.
```

Followed by the `gsd-meta` trailer (section 3). The `---` + `GSD slice …`
footer is the human-readable seal line; the trailer block after it is the
machine-readable twin. The two-way sync labels/comments/closes the issue when
the slice reaches a terminal state.

## 2. Canonical slice-PR shape

```markdown
## Linked slice issue

Closes #<n> (M<NN>/S<NN>: <title>)

## Outcome evidence

| Outcome | Evidence |
| ------- | -------- |
| O-1 | <commit SHA + what it proves> |
| O-2 | <commit SHA + what it proves> |

## Verification

- `npx vitest run` — <pass / notes>
- `npx tsc --noEmit` — <clean / notes>
- `npm run lint` — <when ts/tsx changed>

## abide/JEV compliance

| Rule | Where applied | Band | Evidence |
| ---- | ------------- | ---- | -------- |
| <rule id from .abide/rubric.json> | <files / outcomes> | clear | <handoff report path or `abide check` ref> |

Verdict: <clear|empty (reason)|unverified (why, quoted)> — `.abide/reports/*-<headSha8>.{json,md}`
```

Followed by the `gsd-meta` trailer (section 3). Every outcome ID in the
evidence table must match an outcome ID from the linked issue — an outcome
mismatch refuses the merge (parity rule, mechanized in S03).

## 3. `gsd-meta` trailer key registry

```text
<!-- gsd-meta
milestone: M<NN>
slice: S<NN>
parent: <base branch, default main>
stacked-on: <branch this head builds on, when stacked>
outcomes: O-1,O-2,...
human-merge: <true|false>
-->
```

Keys:

- `milestone`, `slice` — required on issues and PRs.
- `parent` — base branch of the delivery (default `main`).
- `stacked-on` — set when the head branch carries another slice's commits;
  marks a stacked delivery that needs a fresh owner approval.
- `outcomes` — comma-separated outcome IDs claimed by the artifact; the
  review lane diffs the PR's set against the issue's set.
- `human-merge` — `true` means a human merges (lane never merges); a fresh
  owner approval still required on stacked/human-gated PRs.

## 4. Outcome-ID and exclusion rules

- Outcome IDs are `O-<N>`, numbered from 1 with no gaps, phrased as
  verifiable end states (`O-1 — Widget state transitions animate over 200ms`).
- Exclusion IDs are `X-<N>`, phrased as fences (`X-1 — no changes to the room
  render pipeline`). Anything inside a fence is out of scope.
- IDs are stable once published: never renumber, only append (`O-4`, `X-3`).
  The PR evidence table cites the issue's IDs verbatim.
- The agent ticks outcomes when verified; the gsd-loop outcomes tool syncs
  them back to the plan.

## 5. Owner approval ("ok") wording

An owner approval is a PR comment whose body, trimmed and lowercased with
trailing punctuation stripped, is exactly one of: `ok`, `okay`, `k`,
`approve`, `approved`, `lgtm`, `ship it`, `merge`, `merge it`, `go ahead`,
`do it`, `yes` — or begins with `/approve` or `gsd:approve`. Comments
beginning `gsd-loop`/`GSD:` are never approvals. An approval is FRESH only
when its `createdAt` is later than the newest commit on the PR head. A fresh
approval lifts the human-only gates (a `Human merge only` phrase, a
`human-merge: true` trailer, a stacked delivery, `gsd:escalated`) but never
`gsd:blocked`, `gsd:rework`, failing CI, unmet criteria, or missing JEV.

## 6. Merge-reconcile wording

At merge the lane posts one comment on each delivered issue, headed
`gsd-sync: <MID>/<SID> delivered`, naming the merge commit and the
per-outcome evidence, then closes the issue. Seal-only comments (slice
sealed `skipped`, no merge) use the same head with `sealed skipped` and the
delivery reasons, and do not close. Every sync comment carries a stable
dedupe key so re-runs never double-post.

## 7. abide/JEV compliance section rules

- One row per governed rule from `.abide/rubric.json` that scopes the
  changed files: rule id, where applied (files/outcomes), band
  (`clear` / `flag` / `act`; thresholds 0.5 / 0.8), evidence ref.
- Bands come from the committed Q15 handoff report
  (`.abide/reports/*-<headSha8>.{json,md}`, produced by
  `node scripts/hooks/jeve-report.mjs --base origin/main --head <sha>
  --out .abide/reports`); never self-reported.
- `flag` is advisory and logged; `act` blocks. Whole-file findings
  identical on `origin/main` (pre-existing, not introduced by the diff) are
  advisory — only diff-level bands block.
- Report verdicts: `clear` (or `empty` with a stated reason) merges;
  `unverified` must quote the report's notes as the reason and never
  fabricates evidence.

## Templates

- Issue skeleton: `.github/ISSUE_TEMPLATE/gsd-slice.yml`
- PR skeleton: `.github/pull_request_template.md`
- Fixture: `tests/issue-pr-contract.test.ts` asserts both templates render
  this canonical skeleton (sections, outcome-ID placeholders, trailer keys,
  JEV table columns).
