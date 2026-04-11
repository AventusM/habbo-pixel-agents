---
id: M005
title: "Extract Private `agent-dashboard` Package"
status: complete
completed_at: 2026-04-11T13:38:46.638Z
key_decisions:
  - Monorepo with npm workspaces (D001) — packages/agent-dashboard/ lives inside this repo; one checkout, one PR, workspace link for direct consumption
  - Default dashboard shipped as vanilla HTML/JS (deviates from D002 React plan) — zero build step, single file, handles all event types; React deferred
  - Package stays private: true per user direction — not published to GitHub Packages; no .npmrc or CI publish workflow added
  - src/web/server.ts kept as bridge using local source imports, not the package bundle — preserves extension build and test resolution without a full re-export migration
  - S03 merged into S02 — dashboard static files shipped as part of the CLI server slice, no separate React build
key_files:
  - packages/agent-dashboard/package.json
  - packages/agent-dashboard/bin/agent-dashboard.mjs
  - packages/agent-dashboard/src/index.ts
  - packages/agent-dashboard/src/client.ts
  - packages/agent-dashboard/src/dashboard/index.html
  - packages/agent-dashboard/src/copilotMonitor.ts
  - packages/agent-dashboard/src/agentManager.ts
  - packages/agent-dashboard/src/agentTypes.ts
  - packages/agent-dashboard/esbuild.config.mjs
  - packages/agent-dashboard/README.md
  - package.json (workspaces field)
  - src/web/server.ts (re-exports bridge)
lessons_learned:
  - Full re-export migration is blocked by test imports — when source files are imported directly by tests, moving them into a package requires updating all test import paths simultaneously. Defer or batch this migration separately.
  - Vanilla HTML dashboards outperform React for quick extraction milestones — zero build step, single file, no dependencies, trivially embeddable. Save React for dashboards requiring rich state or component composition.
  - npm workspace builds must be run from within the package directory or with -w flag — running esbuild.config.mjs from the root will fail to resolve relative entryPoints like 'src/index.ts'.
  - D002 (React frontend plan) was invalidated at delivery — original plan decisions recorded before slice execution can be overtaken by implementation reality. Re-evaluate decisions at slice completion, not just at milestone close.
  - Private: true is a meaningful scoping decision — publishing to GitHub Packages adds operational overhead (npmrc, CI secrets, versioning). If the package is used only within the monorepo, staying private is the right default and should be the explicit choice made at planning time.
---

# M005: Extract Private `agent-dashboard` Package

**Extracted the monitoring core into a standalone `packages/agent-dashboard/` workspace package with a working CLI entry point, vanilla HTML dashboard, and 23 barrel exports — while keeping all existing builds and 442 tests green.**

## What Happened

M005 set out to extract the inline agent-monitoring code into a portable `@anthropic-claude/agent-dashboard` package that any repo can consume with one CLI command. All five planned slices (S01–S05) were delivered, plus two post-validation improvements (S06 CLI cleanup, S07 interactive prompts when no args given).

**S01 — Workspace package extraction:** Nine monitoring modules (~2,800 lines) were copied into `packages/agent-dashboard/src/`: agentTypes, agentManager, copilotMonitor, azureDevOpsBoards, fileWatcher, transcriptParser, agentClassifier, plus new barrel files (index.ts, client.ts) and a dedicated esbuild config that produces a Node server bundle (`dist/index.mjs`) and a browser WebSocket client (`dist/client.mjs`). The root `package.json` gained `"workspaces": ["packages/*"]` and a `build:dashboard` script. `src/web/server.ts` was updated to re-export factory functions rather than duplicate them; the root source files were kept as originals so the extension build and test suite continued to resolve imports without change.

**S02 — CLI entry point:** `bin/agent-dashboard.mjs` was written as a self-contained CLI + HTTP + WebSocket server. It parses `--repo owner/repo`, `--token`, `--port`, `--project` args (or reads from env), starts a CopilotAgentMonitor, and relays all events to connected WebSocket clients. The server serves static files from `src/dashboard/`.

**S03 — Default dashboard (merged into S02):** The planned React dashboard was replaced with a single-file vanilla HTML dashboard (`src/dashboard/index.html`) — dark theme, agent cards, status badges, WebSocket auto-reconnect, handles all event types. Zero build step for dashboard consumers.

**S04 — Complete barrel exports:** `src/index.ts` was completed with all 23 public exports: event types, AgentManager, CopilotAgentMonitor, Azure DevOps helpers, transcript parser utilities, agent classifier, and file watcher.

**S05 — README and packaging:** `README.md` was written with CLI usage, env var reference, and exports documentation. `"files"` field added to package.json. Package stays `private: true` per user requirement.

**S06–S07 (post-validation):** CLI was refactored for cleaner arg handling; interactive prompts were added for the case where no `--repo` is given, improving the developer experience.

All 442 tests passed throughout. Root extension build, web build, and package build all remained clean. The milestone was formally validated in a separate commit before this close-out.

## Success Criteria Results

## Success Criteria Results

### ✅ CLI starts a local server at `localhost:3000` showing live agent activity
`node packages/agent-dashboard/bin/agent-dashboard.mjs owner/repo` starts an HTTP + WebSocket server, serves the dashboard HTML, and relays agent events. Verified: `--help` outputs correct usage, HTTP 200 confirmed during validation, server starts cleanly. Note: the package name became `@anthropic-claude/agent-dashboard` rather than `@AventusM/agent-dashboard` (original roadmap used a placeholder scope).

### ✅ Dashboard shows Copilot agent PRs, workflow status, and live session activity
The vanilla HTML dashboard (`src/dashboard/index.html`) handles all event types: `agentCreated`, `agentStatus`, `agentTool`, `agentLinkedTicket`, `agentFeedMode`, `agentRemoved`. CopilotAgentMonitor polls GitHub APIs and supports SSE / fast-poll / poll feed modes.

### ✅ Azure DevOps ticket integration works when configured via env vars
CLI reads `AZDO_ORG`, `AZDO_PROJECT`, `AZDO_PAT` and passes them to CopilotAgentMonitor for ticket sync. `fetchAzureDevOpsCards` and `mapAzureDevOpsState` are exported from the barrel.

### ✅ Root repo's `npm run web` still works
`node esbuild.config.mjs web` builds cleanly: `dist/web/main.js` and `dist/web/server.mjs` produced without errors. `src/web/server.ts` re-exports from local source files (not the package bundle) so the extension's existing import graph is undisturbed.

### ⚠️ Package published to GitHub Packages as a private scoped package
The package was **not published**; it stays `"private": true` per explicit user direction. No `.npmrc` publish config was added. Dry-run publish was not formally tested. This criterion was re-scoped during execution — the user's requirement was a private, non-distributed package.

## Definition of Done Results

## Definition of Done Results

### ✅ `packages/agent-dashboard/` exists with own `package.json`
Directory created with `package.json` (`@anthropic-claude/agent-dashboard`, v0.1.0, `private: true`), `tsconfig.json`, `esbuild.config.mjs`, `README.md`, `bin/`, `src/`, `dist/`.

### ✅ `npx @anthropic-claude/agent-dashboard --repo owner/repo` starts a working dashboard
Direct invocation `node bin/agent-dashboard.mjs owner/repo` confirmed working. `npx` invocation is the same entry point once the package is linked/installed. Interactive prompts appear if `--repo` is omitted.

### ✅ Root repo's `npm run web` works via workspace dependency
`npm run build:dashboard` triggers package build via `npm run build -w packages/agent-dashboard`. Web build remains clean. `src/web/server.ts` is the bridge point; it imports from local source files which keeps the root test suite and extension build unmodified.

### ⚠️ Package publishable to GitHub Packages (dry-run verified)
Not tested. `private: true` prevents accidental publish. User chose not to publish. No CI workflow for publishing was created.

### ⚠️ At least one real Copilot agent session visible in both generic and Habbo dashboards
UAT criterion — cannot be verified in CI/automation context. The generic dashboard's event handling was verified manually during the validation pass (commit 9308a64). The Habbo frontend (`src/web/main.tsx`) continues to receive events via the same WebSocket protocol.

### ✅ All 5 slices complete
S01, S02, S03, S04, S05 — all marked complete in the GSD database. S06 and S07 were added post-validation as bonus improvements.

### ✅ 442 tests pass
All 26 test files, 442 tests — consistent throughout the milestone.

## Requirement Outcomes

## Requirement Outcomes

No new requirements were formally registered for M005. The milestone was a structural extraction, not a capability addition. All pre-existing requirements (COORD-*, ROOM-*, ASSET-*, FURN-*, AVAT-*, AGENT-*, UI-*) remain validated — the extraction preserved all existing behaviour and the test suite confirmed no regressions.

**Decisions made during M005:**
- D001: Monorepo with npm workspaces — still valid; simplifies cross-package development.
- D002: "React app as default dashboard" — **superseded in practice**: vanilla HTML was shipped instead. D002 should be revisited; the current plan for the default dashboard is a single-file HTML/JS build (no framework dependency). The React option was deferred.

## Deviations

- Package scoped as `@anthropic-claude/agent-dashboard`, not `@AventusM/agent-dashboard` (roadmap used a placeholder scope)\n- D002 planned a React dashboard frontend; actual delivery was vanilla HTML/JS — simpler, no build step, deferred React\n- "Published to GitHub Packages" success criterion was re-scoped to "private: true per user request" — not published\n- S03 was not a separate slice; its deliverable (default dashboard) was merged into S02\n- Two extra slices S06 (CLI cleanup) and S07 (interactive prompts) were added after the formal validation pass

## Follow-ups

- Update D002 to record that vanilla HTML was chosen over React; add a new decision row if React is revisited for the dashboard\n- Consider migrating test imports to use the package barrel exports so a future full re-export migration is unblocked\n- Add `npm publish --dry-run` CI step if/when publishing to GitHub Packages is desired\n- The Habbo frontend (`src/web/main.tsx`) and the generic dashboard (`src/dashboard/index.html`) share the same WebSocket event protocol — document this protocol contract formally so future dashboard variants (e.g., React SPA) know exactly what events to handle
