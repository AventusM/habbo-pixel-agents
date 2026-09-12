# Experiment select lane (judge run)

After eval verdicts land on the worker PRs, one judge run compares all
candidates for the issue and recommends a single winner for human merge.
Selection recommends only — the human still merges (or merges none).

## Judge-model rule (hard)

The judge model must differ from every build model of the issue (same
disjointness as the eval lane; reviewers judge, builders build). Default
judge: `opencode-go/kimi-k3`. `select-brief.mjs` refuses a judge model
that matches any candidate build model it can resolve.

## Inputs

- Worker PRs (2+), each with an eval verdict posted (APPROVE verdicts are
  the normal pool; a REWORK-only pool means "no mergeable candidate" and
  the judge says so instead of picking).
- One detached read-only checkout per candidate PR head (built by
  `select-brief.mjs` under `<repo>/.worktrees/.select/<run>/pr<N>/`).
- Worker run jsonls + eval verdict comments as prior evidence.

## Comparison (starts where eval verdicts end)

Score each candidate on the EVAL.md R1–R5 record, then break ties on:

- **Test strength:** which new tests assert more behavior (keys covered,
  edge cases, failure-mode precision — quote the assertions).
- **Diff minimality:** smaller, single-concern diffs win ties.
- **Robustness:** flake risks called out in verdicts (timeouts, shared
  dirs, ordering assumptions) count against.
- **Commit hygiene:** message format, one concern per commit.

Pick exactly one winner (or declare no-winner with reasons). Judge the
artifacts, not the models — never prefer a candidate because of which
model built it.

## Selection format (exact — forward-compatible machine reading)

Post one comment on the ISSUE (per-issue scope, not per-PR), first line:
`exp-select for issue #<N>: winner #<M> (<build-model>)`
(or `exp-select for issue #<N>: no winner`)
then `Scores:` one line per candidate, `Rationale:` 2–4 sentences,
`Runner-up disposition:` recommendation only (leave open / close / cherry-pick).
Then append one judge hook record (`--section review --result approved`,
`--verdict <winner-short-sha>`, `--verdict-url <issue-comment-url>`)
to the judge's own jsonl (`scripts/exp/runs/<judge-run-id>.jsonl`).

## Files

- `scripts/exp/select-brief.mjs` — builds the judge briefing + candidate
  checkouts (see `--help`); briefings live in `scripts/exp/runs/`
- `scripts/exp/runs/<judge-run-id>.{meta,prompt}.md`, `.jsonl`
  (transient, gitignored); selection comment lives on the issue
- Candidate dirs default to `<repo>/.worktrees/.select/<run>/pr<N>/`
  (transient, removed by `select-brief --cleanup`; shares S02's lane root)
