# S01: Extract Monitoring Core Into Workspace Package

## Objective

Move the monitoring modules (agentTypes, agentManager, copilotMonitor, etc.) into `packages/agent-dashboard/` and wire npm workspaces so the root repo consumes them. Existing `npm run web` must still work.

## Tasks

- [ ] **T01: Scaffold workspace package** `est:15m`
  Create `packages/agent-dashboard/` with `package.json`, `tsconfig.json`, and directory structure. Add npm workspace config to root `package.json`.

- [ ] **T02: Copy monitoring modules** `est:20m`
  Copy the monitoring source files into the package's `src/`. Adjust imports. Set up exports map in `package.json`.

- [ ] **T03: Package builds independently** `est:15m`
  Add esbuild config for the package. Verify `npm run build` in the package produces working output.

- [ ] **T04: Root repo consumes via workspace link** `est:20m`
  Update root `web-server.mjs` and esbuild config to import from the workspace package. Verify `npm run web` still works.

- [ ] **T05: Verification** `est:10m`
  Build the full project, run existing tests, verify no regressions.

## Risks

- Import path resolution between workspace packages and esbuild bundling
- The `web-server.mjs` dynamic import of `dist/web/server.mjs` needs to resolve the new package location

## Definition of Done

- `packages/agent-dashboard/` exists with its own `package.json`
- Package builds independently
- Root repo's `npm run web` works via workspace dependency
- Existing tests pass
