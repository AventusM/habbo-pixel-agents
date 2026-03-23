---
id: S01
parent: M005
milestone: M005
provides:
  - packages/agent-dashboard/ with all monitoring modules
  - npm workspace wiring
  - Server-side barrel exports (23 functions/types)
requires: []
affects:
  - root package.json (workspaces field)
  - src/web/server.ts (re-exports from package)
key_files:
  - packages/agent-dashboard/package.json
  - packages/agent-dashboard/src/index.ts
  - packages/agent-dashboard/esbuild.config.mjs
  - src/web/server.ts
key_decisions:
  - Monorepo with npm workspaces — simplest dev workflow
  - Root source files kept as originals (full re-export migration deferred)
  - src/web/server.ts is the single bridge point importing from package
patterns_established:
  - Package builds independently via node esbuild.config.mjs
  - Server entry (dist/index.mjs) and client entry (dist/client.mjs) are separate bundles
observability_surfaces:
  - Package build outputs: "✓ Server bundle built" / "✓ Client bundle built"
drill_down_paths:
  - .gsd/milestones/M005/slices/S01/S01-PLAN.md
duration: 25m
verification_result: passed
completed_at: 2026-03-23
---

# S01–S05: Extract Monitoring Core and Ship CLI

**Extracted monitoring core into `packages/agent-dashboard/`, wired npm workspaces, built CLI entry point with standalone dashboard, and verified end-to-end.**

## What Happened

### S01: Workspace Package
Copied 9 monitoring modules (~2,800 lines) into `packages/agent-dashboard/src/`. Fixed import paths (copilotMonitor and server used `../` paths). Created barrel exports for server-side (index.ts, 23 exports) and browser-side (client.ts, WebSocket client). Added esbuild config with dual Node/browser builds. Wired root `package.json` with `"workspaces": ["packages/*"]`. Updated `src/web/server.ts` to re-export from the package.

### S02: CLI Entry Point
Built `bin/agent-dashboard.mjs` — a standalone HTTP + WebSocket server that parses `--repo owner/repo`, `--token`, `--port`, `--project` args. Serves static dashboard files, starts CopilotAgentMonitor, relays events over WebSocket. Created default dashboard as single-file HTML with dark theme, agent cards, status badges, WebSocket auto-reconnect.

### S03: (Merged into S02)
The generic dashboard shipped as vanilla HTML/JS in S02 — no React needed. Single file, zero build step, handles all event types.

### S04: Complete Barrel Exports
Added all public functions to the package barrel: `isAgentCompleted`, `mapAzureDevOpsState`, `formatToolStatus`, `parseLastToolCall`, etc. Total 23 exports from the server bundle.

### S05: Packaging
Added README with CLI usage, env vars, exports reference. Added `files` field. Package stays `private: true` per user requirement.

## Verification

- Package builds independently: `node esbuild.config.mjs` → dist/index.mjs + dist/client.mjs
- Root extension build: `node esbuild.config.mjs` → clean
- Root web build: `node esbuild.config.mjs web` → clean
- All 442 tests pass (26 test files)
- CLI --help works, missing args shows error, server starts and serves HTTP 200

## Files Created/Modified

- `packages/agent-dashboard/` — entire new package directory
- `packages/agent-dashboard/bin/agent-dashboard.mjs` — CLI entry point
- `packages/agent-dashboard/src/dashboard/index.html` — default dashboard
- `packages/agent-dashboard/README.md` — usage documentation
- `package.json` — workspaces field, build:dashboard script
- `src/web/server.ts` — re-exports from package

## Known Limitations

- Root source files are not yet re-exported from the package (extension build + tests need them)
- CLI requires pre-built dist/ — no auto-build on first run
- Dashboard is vanilla HTML — functional but basic compared to the Habbo frontend
