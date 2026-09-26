# S04 Summary — abide/JEV trial stood up (project-local, OpenCode)

**Milestone:** M007
**Slice:** S04
**Status:** done-in-fact (task rows pending per D018 precedent)

## Key finding: no TypeSafe key needed
OpenCode Zen serves JEV directly. Verified live: `POST https://opencode.ai/zen/v1/systemone` returns TypeSafe-format answers (noul/choice/score) using the user's existing opencode-go key. Models available: `jev-1.13` (paid) and `jev-1.13-free` (free). abide's default model id `jev-latest` is NOT accepted by Zen (400 "Model is unavailable").

## Setup
- abide npm 0.0.5 lacks base-URL support; master (unreleased) adds `TYPESAFE_AI_BASE_URL`. Built master from source at `~/.local/share/abide` with one local patch: `TYPESAFE_MODEL_ID = process.env.TYPESAFE_AI_MODEL_ID ?? "jev-1.13-free"` (was hardcoded `jev-latest`).
- `abide init opencode --project` → `.opencode/plugins/abide.js` + `.abide/` scaffold; hook self-test passed.
- Credentials sourced per-invocation from opencode's auth.json (no secret duplication yet).

## Trial results
- **compile** (headless claude): rubric with 15 rules — 9 model/JEV, 3 lint (overlap with eslint.config.js), 3 unenforceable (GSD workflow, terminal output safety, furniture pipeline), 0 deferred. Sources: AGENTS.md + CLAUDE.md.
- **calibrate**: 9 rules x 20 hunks / 8 commits = 28 calls, **$0.00015**, "Every rule is decisive on this repository's history".
- **audit src/RoomCanvas.tsx**: 5.6s, **$0.00123** → `no-frame-allocations` 1 broken; `no-listener-without-cleanup` 1 uncertain. (audit exits 1 when a rule is broken — CI-usable.)

## Artifacts
- `.abide/rubric.json` (15 rules), `.abide/compile-skill.md`, `.abide/events.jsonl`, `.opencode/plugins/abide.js`
- `~/.local/share/abide` (source build of master, patched)

## Pending (user)
- Restart opencode to load the plugin (also pending for skills + model config).
- For live hook checks, the key must be file-readable: put `TYPESAFE_AI_API_KEY` + `TYPESAFE_AI_BASE_URL=https://opencode.ai/zen/v1` in repo `.env` (gitignored) or `~/.abide/.env`.
- Review the rubric (especially `no-frame-allocations`) and decide whether to commit `.abide/`.
