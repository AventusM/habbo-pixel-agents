# Experiment dispatch runbook (M004/S02)

Repeatable procedure: one board issue x N dynamically-chosen opencode-go
models, each in an isolated worktree, all captured as per-run JSONL.

## Standing rules (hard, every run)

- Draft PRs only. Human merges. Experiment PRs are NEVER auto-merged.
- Main untouched: workers branch from the pinned base commit, never push main.
- F9: all lane work in isolated worktrees, never the shared checkout.
- Figure assets stay local-only/gitignored. No Xcode/Android/Claude-transcript data.
- The worker PR is the evaluation artifact (no separate report).

## Boundary

`scripts/exp/dispatch.mjs` automates worktree + branch + registry + worker
prompt creation. Launching the workers stays an explicit operator step:
scripts cannot spawn agents. The operator pastes each run's PROMPT file
content as the worker agent's briefing.

## Procedure

1. Pick the issue (any GH board issue with checkbox Outcomes) and N models
   at issue-pick time (no fixed set; check `paseo_list_models` for current
   `opencode-go/*` ids).
2. Run the dispatcher (from the repo root):
   `node scripts/exp/dispatch.mjs --issue <N> --models <m1,m2> [--base HEAD]`
   Record the RUN lines (run ids) it prints.
3. Preview first with `--dry-run` (no writes) when trying new flags.
4. Spawn one agent per RUN line (Paseo `create_agent`, opencode provider,
   the run's model id) with the run's
   `scripts/exp/runs/<run-id>.prompt.md` content as its briefing.
   Wait for all workers to finish (each opens its own draft PR).
5. Collect: `scripts/exp/runs/<run-id>.jsonl` per run. Validate each line:
   `node -e "require('fs').readFileSync(process.argv[1],'utf8').trim().split('\n').forEach((l,i)=>{const r=JSON.parse(l);for(const k of ['run_id','issue','path','model','sections'])if(!(k in r))throw new Error('line '+(i+1)+' missing '+k);});console.log('records OK')" scripts/exp/runs/<run-id>.jsonl`
   (Keys mirror `scripts/exp/schema.json` required fields.)
6. Backstop demo (one run): `node scripts/exp/translate-loop.mjs --issue <N>
   --pr <worker-pr> --model <model-id> --run-id <run-id>` and confirm one
   JSON record on stdout.
7. Triage worker draft PRs: human merges at most one (or none).
8. Clean up lane worktrees (records are kept as evaluation artifacts):
   `node scripts/exp/dispatch.mjs --cleanup --issue <N> --run <STAMP>`

## Worker env contract

Every worker shell session exports `EXP_RUN_ID`, `EXP_ISSUE`, `EXP_MODEL`,
`EXP_PATH=direct`, and `EXP_OUT` (absolute path into the dispatching repo's
`scripts/exp/runs/<run-id>.jsonl`, so records survive worktree cleanup).
Workers emit `spec` after reading the issue and `build` after tests go
green via `scripts/exp/hook-record.mjs`; `review`/`merge` sections belong
to the operator/backstop, not the worker.

## Files

- `scripts/exp/dispatch.mjs` — the dispatcher
- `scripts/exp/runs/` — transient per-run state (gitignored): `*.meta.json`
  registry, `*.prompt.md` briefings, `*.jsonl` hook records
- `<repo>/.worktrees/` — lane worktrees (gitignored, removed by --cleanup)
