# Issue–PR Contract (M010)

One canonical shape for every GSD-published GitHub artifact. Slice issues
carry Goal / Demo / Outcomes (O1..On) / Exclusions / GSD tasks plus a
machine-readable `gsd-meta` trailer; slice PRs cite the same outcome IDs with
per-outcome evidence and the same trailer (plus `stacked-on` / `human-merge`
keys). abide/JEV judging is not part of the PR body: `.github/workflows/
abide-judge.yml` runs the judge on the changed files and posts the result as a
sticky PR comment. The wording below mirrors the published M010/M011 slice
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

No section: the abide judge runs in CI and posts a sticky comment on the PR.
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

## 7. abide/JEV compliance (CI judge)

- `.github/workflows/abide-judge.yml` runs `abide audit` on the PR's changed
  files at head and at the base tree, then posts the per-rule result as one
  sticky PR comment (found by its `<!-- abide-judge -->` marker and updated in
  place). The judge output is the source of truth; no committed report.
- The gate is a ratchet: a rule blocks only when its band is *worse* in head
  than base (newly `act`/broken). Pre-existing findings in a touched file are
  advisory. New files count every finding.
- `flag` is advisory and logged; `act` (broken) blocks. The job fails closed if
  the judge cannot run. Fork PRs receive no secrets and are skipped (green).
- Band semantics (`clear` / `flag` / `act`; thresholds 0.5 / 0.8) match the
  rubric in `.abide/rubric.json`.

## Templates

- Issue skeleton: `.github/ISSUE_TEMPLATE/gsd-slice.yml`
- PR skeleton: `.github/pull_request_template.md`
- Fixture: `tests/issue-pr-contract.test.ts` asserts both templates render
  this canonical skeleton (sections, outcome-ID placeholders, trailer keys).

## Mechanization (M010/S03)

- `node scripts/gsd-pr-contract.mjs --pr <n> --issue <m> [--dry-run]`
  enforces sections 2–4 (trailer parse, outcome parity, fresh-approval
  vocabulary); exit 0 clear, 1 refuse with a kebab-case reason, 2 usage.
  `--json` emits the machine-readable verdict for the review lane. abide/JEV
  judging is separate (section 7). Approval + seal-comment helpers live in
  `scripts/gsd-github-reactions.mjs` (`isApprovalBody`, `findFreshApproval`,
  `approvalLifts`); evidence in `tests/gsd-pr-contract.test.ts`.

## Validation notes (M010/S04 walkthrough)

- Publisher re-runs race the GitHub search index: a re-run seconds after
  create can miss the exact-title match and duplicate the issue (walkthrough:
  #160 duplicated #159 after 3s; a re-run after the index settled logged
  `updated #159`). Space publish re-runs past the index lag; the upsert itself
  is exact-title idempotent. Scratch publishes use
  `gsd-github-publish.mjs --scratch "<exact title>"` (sync labels omitted).
- `gsd-event-hook.mjs --github --dry-run` is NOT side-effect-free:
  `reactToGsd` guards writes with `if (!githubLive)` only, so adding
  `--github` writes (label + comment) even with `--dry-run`. Walkthrough legs
  use `--dry-run` without `--github` (read-only); fixing the guard is
  sync write-path behavior change reserved for its own slice.
