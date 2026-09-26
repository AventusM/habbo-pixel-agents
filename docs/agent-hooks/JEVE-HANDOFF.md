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

## CLI usage

`node scripts/hooks/jeve-report.mjs [flags]` — exit 0 ok; 1 when
`--require-clear` and verdict is not `clear`/`empty`; 2 usage/IO.

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

stdout in `md` mode: `<verdict> <json path> <md path>` (one line).

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

## Verification

```
npx vitest run tests/jeve-report.test.ts   # pure + offline CLI tests
npx tsc --noEmit && npm run lint
node scripts/hooks/jeve-report.mjs --base-sha <base> --head-sha HEAD --stdout md
```

Tests are offline: no network, no live `abide` (paid), no git subprocess in
pure tests. Fixture overrides (`--events/--rubric/--files/--head-sha/
--base-sha`) make the CLI deterministic on temp files.
