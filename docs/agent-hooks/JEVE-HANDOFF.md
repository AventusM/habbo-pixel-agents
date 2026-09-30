# JEV handoff report — per-pass abide evidence artifact

> Q15. One inspectable obeyance (abide/JEV) report per agent pass, for the
> files that pass changed. Builder → reviewer → fixer handoffs share this file
> instead of self-reported prose.

## Problem

PR #128 was escalated because the JEV/abide report for its changed files was
missing/unverifiable: `.abide/events.jsonl` is gitignored, so the evidence the
judge produced lived only on the machine that ran it — and recent entries were
`skip: turn diff incomplete`, i.e. no rule bands at all. A reviewer could not
tell whether the pass was judged clear, flagged, or never judged.

## Artifact

`scripts/hooks/jeve-report.mjs` folds three inputs into one report:

- `.abide/events.jsonl` — check/skip rows (judge evidence, gitignored);
- `.abide/rubric.json` — rule scopes (`**` crosses `/`, absent scope = all);
- the git change set (`base...head`, deletions split out).

Report (`version 1`, `generator jeve-report/1.0.0`), written as
`<out>/<name>-<headSha8>.{json,md}`:

```json
{
  "verdict": "unverified",
  "head": { "sha": "0e92326…", "shortSha": "0e92326a", "subject": "feat(M008): …" },
  "changedFiles": ["src/x.ts"],
  "rules": [{ "id": "no-derived-state-effect", "band": "unverified",
               "probability": null, "checks": 0, "evidence": "none",
               "scope": ["**/*.ts"] }],
  "findings": [{ "rule": "no-derived-state-effect",
                 "files": ["src/x.ts"], "band": "unverified",
                 "evidence": "none" }],
  "files": [{ "path": "src/x.ts", "status": "unseen", "governedRules": ["…"] }],
  "live": { "ran": false, "reason": "live check not requested", "spendUsd": 0 },
  "totals": { "checks": 0, "unverified": 1, "files": 1, "governedFiles": 1 },
  "notes": ["no abide events in window"]
}
```

- Bands: `clear < act < blocked` (worst wins); a governed rule with no verdict
  is `unverified`. Overall verdict: `blocked > act > unverified > clear`;
  `empty` when there are no changed files or no governed model rules.
- Files: `checked` (a check event in the window touches it) · `unseen`
  (governed, no event) · `no-rules`.
- Events are bounded to `base` commit time when one resolves; `skip` rows are
  counted and their distinct reasons noted (they carry no files).
- `lint` rules are listed in `lintRules`/notes (eslint enforces them);
  `deferred`/`unenforceable` are counted in `excludedRules`.
- Markdown is stable and greppable: verdict heading, `head: <sha>`,
  `## Rules` / `## Files` tables, `## Verdict` reason.
- `findings[]` (M011/S04) is the per-rule application shape the PR contract
  reads: `{rule, files, band, evidence}` — rule -> changed files it governed
  -> band -> evidence pointer (`event`/`live`/`event+live`/`none`, detail in
  the matching `rules[]` row). Additive: older reports without `findings`
  still parse. The markdown carries an embeddable `## abide/JEV compliance`
  table (`| rule | where | band | evidence |`) plus a
  `Verdict: <clear|empty|unverified> <reason>` line, both parsed by
  `parseJevSection` in `scripts/gsd-pr-contract.mjs`.

## CLI usage

`node scripts/hooks/jeve-report.mjs [flags]` — exit 0 ok (`-h|--help` prints
usage and exits 0); 1 when `--require-clear` and verdict is not `clear`/`empty`;
2 usage/IO.

| Flag | Default | Effect |
|---|---|---|
| `--base <ref>` / `--head <ref>` | `origin/main` / `HEAD` | git range |
| `--files a,b,c` | — | override the diff change set |
| `--out <dir>` / `--name <slug>` | `.abide/reports` / branch slug | artifact path |
| `--live` | off | `abide check <uncommitted changed files> --json` and merge |
| `--pr <n>` | off | best-effort `gh pr comment <n> --body-file <md>` |
| `--require-clear` | off | exit 1 unless verdict is clear/empty |
| `--feed` | off | append one `.gsd/hooks-feed.jsonl` row (role reviewer) |
| `--latest` / `--quiet` / `--stdout md\|json\|none` | `md` | also `latest.{json,md}`; suppress the stdout line |
| `--events/--rubric/--head-sha/--base-sha` | repo files | test/fixture overrides |
| `-h`, `--help` | — | print usage and exit 0 |

stdout in `md` mode: `<verdict> <json path> <md path>` (one line).

## PR section generation (M011/S04)

The PR `## abide/JEV compliance` section is generated from the committed
report, not hand-written: one row per `report.findings` entry
(`| <rule> | <files csv> | <band> | <evidence + checks/last/p> |`), plus one
`clear` row per `report.lintRules` entry attested by a green
`npx eslint` run (evidence: `eslint clean (report lintRules; npx eslint
exit 0)`), plus `Verdict: <verdict> <reason>`. Lint rows stay author-attested
because the report never scores lint rules — mechanically safe, since
`checkJevReport` only compares bands for rules present in `findings`.

Prove it before opening the PR:

```
node scripts/gsd-pr-contract.mjs --pr-file <generated-body> \
  --issue-file <issue-body> --report .abide/reports/<...>-<sha8>.json \
  --changed-files <csv> --head-sha <sha> --milestone <M00X> --slice <S0Y> \
  --dry-run   # parity PASS + jev PASS, exit 0
```

Evidence: `.abide/reports/m011-s04-t01-assessment.md` (consumer requirements
R1–R4, gaps G1–G4), `m011-s04-t02-findings.md` (row excerpts, shape stability),
`m011-s04-t03-proof.md` (probe report + generated section + dry-run quote).

## Plugin behavior

`.opencode/plugin/jeve-handoff.ts` — on `session.idle` (SDK event with
`properties.sessionID`) it runs the CLI best-effort:

```
node scripts/hooks/jeve-report.mjs --out .gsd/runtime/jeve-handoff \
  --name <sessionID> --latest --feed --quiet --stdout none
```

Rolling artifact per session (`.gsd/runtime/jeve-handoff/latest.md`); one run at
a time per session (in-flight set); 60s timeout; every error is swallowed so a
session is never blocked or broken.

## Lane wiring

- **Continue lane closeout / fix pass**: run the CLI before sealing — with
  `--live` while the diff is uncommitted — and commit the report pair
  `.abide/reports/*-<headSha8>.{json,md}` with the slice work.
- **Review lane**: for the PR head sha, verify
  `.abide/reports/*-<headSha8>.md` exists, its `head:` matches, and the verdict
  is `clear` (or `empty` with a reason). Absence, a stale sha, or `unverified`
  is itself the JEV finding — exactly the PR #128 escalation.
- **Fix pass**: re-run after repairs; the new artifact supersedes the old for
  the same sha.
- The plugin's `.gsd/runtime/jeve-handoff/latest.*` copy is runtime-only
  (gitignored); the committed ground truth is `.abide/reports/`.

## Worktree snapshots and the skip signature (M011/S01)

A `skip` row with `reason: "turn diff incomplete: git could not snapshot the
working tree in time"` usually does NOT mean slow git. Every hook in a turn
snapshots through one shared scratch index
(`snapshotTree(root, <turnDir>/index)`), so concurrent hooks of the same turn
(parallel tool batches) collide on its `index.lock` and all but one fail in
~30 ms with `fatal: Unable to create '.../index.lock': File exists`. The
message covers that fast failure too, and the skips arrive in same-second
pairs — that signature means "lock race", not "slow repo". Measured isolated
costs are 50–260 ms against the 5 s / 8 s budgets, in main checkouts and fresh
worktrees alike (fresh worktrees are faster, not slower); no
`fsmonitor`/`untrackedCache`/`.gitignore` tuning is indicated.

- Upstream (published CLI, not repo-owned):
  https://github.com/coldteadotai/abide/issues/14
- Workaround: ride through (the next sequential hook snapshots fine), or
  reproduce the verdicts deterministically with `abide check <files>` — it
  uses the `workingTreeDiff` path, and `GIT_INDEX_FILE` is set only in
  `snapshotTree`, so `check` is immune to the race by construction.
- Evidence: `.abide/reports/m011-s01-t01-baseline.md` (skip + timing table),
  `m011-s01-t02-root-cause.md` (toggle matrix), `m011-s01-t03-workaround.md`
  (fresh-worktree `kind: check` verdict, 7/7 rules `clear`).

## Plugin + credentials everywhere (M011/S02)

The hook must intercept in the main checkout AND in fresh worktrees, with
quota/auth failures as clear errors — never fabricated verdicts (D033).

- **Credential sources** (exactly as `abide help` reports them): `abide login`,
  or `TYPESAFE_AI_API_KEY` (or `AI_GATEWAY_API_KEY`) in the environment or a
  `.env.local` or `.env` at the repo root. The pasted key goes to
  `~/.abide/.env` (every repo on the machine, mode 600) or `.env.local`
  (this repo, owner-only); a repo-root `.env` works too. Worktrees carry no
  `.env`, so they resolve via the machine-global `~/.abide/.env`.
- **Per-checkout setup**: `.opencode/plugins/abide.js` is tracked, so fresh
  checkouts/worktrees inherit the hook. It re-exports an absolute
  `file://…~/.local/share/abide/…` path; on a machine without that checkout,
  run `abide init opencode` in the repo — verified to regenerate the committed
  file byte-identically (hook self-test passes, rubric present).
- **Failure contract**: with no key reachable the hook appends
  `{"kind":"error","code":"NO_API_KEY",…}` to `.abide/events.jsonl` — a clear
  error, never a `check` verdict. CLI `abide check` judges correctly in
  worktrees but writes no events rows (verdicts surface on stdout only);
  `.abide/events.jsonl` rows come from the agent hook path.
- Evidence: `.abide/reports/m011-s02-t01-baseline.md` (plugin resolution,
  credential presence, main + worktree probe quotes),
  `m011-s02-t02-verdicts.md` (re-run verdicts, init-identical proof),
  `m011-s02-t03-quota.md` (NO_API_KEY error quote, source list).

## Verification

```
npx vitest run tests/jeve-report.test.ts   # pure + offline CLI tests
npx tsc --noEmit && npm run lint
node scripts/hooks/jeve-report.mjs --base-sha <base> --head-sha HEAD --stdout md
```

Tests are offline: no network, no live `abide` (paid), no git subprocess in
pure tests. Fixture overrides (`--events/--rubric/--files/--head-sha/
--base-sha`) make the CLI deterministic on temp files.
