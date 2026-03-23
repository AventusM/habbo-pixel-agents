# S06: CLI and Package Cleanup

## Objective

Fix the loose ends from the rapid M005 iteration: broken CLI env overrides, drifted package copy, and workarounds.

## Tasks

- [ ] **T01: Fix CLI env override — dotenv stomps fork() env** `est:10m`
  `web-server.mjs` runs `import 'dotenv/config'` which re-reads `.env` and overwrites the CLI-provided `GITHUB_REPO`. Fix: pass CLI overrides via `--` args to the server script instead of relying on env, or configure dotenv with `override: false` explicitly, or remove dotenv from web-server.mjs and let the CLI handle it.

- [ ] **T02: Sync package copy with root source** `est:15m`
  Drift between `src/web/copilotMonitor.ts` and `packages/agent-dashboard/src/copilotMonitor.ts` (setOnAdoStateChange, Done sync, quote style). Same for wsClient.ts (clearAgents event). One-time copy from root → package to re-sync.

- [ ] **T03: Remove SKIP_LOCAL_AGENTS workaround** `est:5m`
  The `SKIP_LOCAL_AGENTS` env var was a band-aid. The CLI should pass `--no-local` or similar to the server, or the server should infer it from context. Clean up the mechanism.

- [ ] **T04: Verify end-to-end** `est:10m`
  Run `node bin/habbo-dashboard.mjs AventusM/tennis-rr-web` and verify: correct repo polled, no stale agents, ADO sync works, kanban refreshes.

## Definition of Done

- CLI arg `owner/repo` reliably overrides `.env` GITHUB_REPO
- Package source files match root source files
- No env var workarounds
- All 442 tests pass
