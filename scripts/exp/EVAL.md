# Experiment eval lane (merge-lane reviewer step)

After worker draft PRs open and before human triage, one reviewer agent on
a model DISJOINT from every build model of the issue evaluates each worker
PR against the repo's coding standards and posts a machine-readable verdict.
The verdict feeds `translate-loop` review sections, closing the per-run
record: hook `spec`/`build` + eval `review` + merge state.

## Eval-model rule (hard)

The reviewer model must differ from every build model of the issue it
reviews (different-model review; no self-grading). Default reviewer:
`opencode-go/kimi-k3` (smartest available; never a build model).
`eval-brief.mjs` refuses when `--model` equals the recorded build model.

## Read-only rule (hard)

The reviewer never commits, never pushes, never merges. It works in a
detached eval worktree, verifies `git status --short` is empty when done,
and delivers only: a PR comment, a hook record, and (if asked) a short
report to the operator. Lane junk it creates (e.g. a local `node_modules`
symlink for test runs) stays untracked and dies with the worktree.

## Rubric (all findings need file:line + command evidence, never vibes)

- **R1 scope containment (blocking).** `git diff --stat` + `git status`:
  diff limited to issue-relevant paths; no lane junk (`.gsd/exec/`,
  `.gsd/uat/`, `node_modules`, lockfiles unless the issue justifies them,
  IDE files); no unrelated refactors or drive-bys. Compare the worker's
  own commits against the pinned base (`git diff base...head`); PR-vs-main
  drift from a newer base is operator scope, not worker scope — call it
  out explicitly instead of failing the worker for it.
- **R2 tests as proof (red suite is blocking).** Run the issue-stated
  suite green in the eval worktree; new tests must exercise the new
  behavior (reference the new code path; would fail if it regressed);
  tests stay hermetic (tmp dirs, no network). The worker's own run
  records must parse as JSONL carrying the schema-required keys
  (`run_id, issue, path, model` per line, `sections` per run) —
  structured-output compliance is itself evaluated.
- **R3 repo standards (violations blocking).** `npx tsc --noEmit` clean
  where TypeScript is touched (strict); no `console.log`/`debugger`
  leftovers; no secrets/keys; naming + file placement follow the touched
  area's conventions (`tests/` for tests, `scripts/exp/*.mjs` plain node
  for harness); commit message `<type>(<scope>): <what> (#N [model])`.
  (There is no lint config in this repo — do not invent a lint gate.)
- **R4 issue fidelity.** Map every `## Outcomes` box to diff evidence
  (`file:line` quotes) or mark it unmet (blocking if a box is unmet).
- **R5 blast radius (advisory).** What could break, who consumes the
  touched files, what the merge would do to `main`.

Any blocking R1–R4 fail → `REWORK`, else `APPROVE`.

## Verdict format (exact — `translate-loop` parses it)

First line must be exactly:
`gsd-loop verdict for <head-sha> issue #<N>`
then `Verdict: APPROVE|REWORK — <one line>`, `### Evidence` bullets, and
`### Blocking` with `- [ ] <finding>` items for REWORK or `(none)` for
APPROVE. Post with `gh pr comment <N> --body-file <verdict.md>`
(a plain comment, not a review), apply the matching label
(`gh pr edit <N> --add-label gsd:approved|gsd:rework`, removing the other
if present — labels are the machine signal `translate-loop` reads; no
automation merges on them), then append the review hook record with
`--result approved|rework` (must match), `--verdict <short-sha>`,
`--verdict-url <comment-url>`.

## Files

- `scripts/exp/eval-brief.mjs` — builds the eval briefing + detached
  worktree (see `--help`); prompts live in `scripts/exp/runs/`
- `scripts/exp/runs/<run-id>.eval.prompt.md`, `<run-id>.verdict.md`
  (transient, gitignored); verdict comments live on the PR
- Eval worktrees default to `<repo>/.worktrees/.eval/` (transient,
  removed by `eval-brief --cleanup`; shares S02's ignored lane root)
