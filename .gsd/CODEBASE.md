# Codebase Map

Generated: 2026-09-11T19:51:44Z | Files: 213 | Described: 0/213
<!-- gsd:codebase-meta {"generatedAt":"2026-09-11T19:51:44Z","fingerprint":"0f57fa31524f2fccda1e39a3b6979172362d0101","fileCount":213,"truncated":false} -->

### (root)/
- `.env.example`
- `.gitignore`
- `.nvmrc`
- `CLAUDE.md`
- `esbuild.config.mjs`
- `LICENSE`
- `mault-verify-initialize.sh`
- `opencode.json`
- `package-lock.json`
- `package.json`
- `README.md`
- `Screen Recording 2026-03-01 at 17.02.28.mov`
- `tsconfig.json`
- `vitest.config.ts`
- `vscode-app-1772316428453.log`

### .github/
- `.github/copilot-instructions.md`

### .github/ISSUE_TEMPLATE/
- `.github/ISSUE_TEMPLATE/asset-pipeline.yml`
- `.github/ISSUE_TEMPLATE/gsd-phase.yml`

### .github/agents/
- `.github/agents/asset-pipeline.agent.md`
- `.github/agents/gsd-phase.agent.md`
- `.github/agents/visual-regression.agent.md`

### .github/copilot/
- `.github/copilot/mcp.json`

### .github/hooks/
- `.github/hooks/project-hooks.json`

### .github/instructions/
- `.github/instructions/asset-pipeline.instructions.md`
- `.github/instructions/gsd-phase.instructions.md`
- `.github/instructions/rendering.instructions.md`

### .github/workflows/
- `.github/workflows/ci.yml`
- `.github/workflows/copilot-agent-monitor.yml`
- `.github/workflows/copilot-setup-steps.yml`
- `.github/workflows/demo-pages.yml`
- `.github/workflows/release.yml`

### .mault/
- `.mault/audit-config.json`
- `.mault/canary-log.json`
- `.mault/machine-info.json`
- `.mault/verify-initialize.proof`

### .mault/reference/initialize/
- `.mault/reference/initialize/core-canary-files.md`
- `.mault/reference/initialize/gold-fullstack.yaml`
- `.mault/reference/initialize/gold-python.yaml`
- `.mault/reference/initialize/gold-typescript.yaml`
- `.mault/reference/initialize/verify-script.sh`

### .opencode/plugin/
- `.opencode/plugin/role-feed.ts`

### assets/pixellab/
- `assets/pixellab/beanie-hoodie-guy.json`
- `assets/pixellab/habbo-inspiration-new.json`
- `assets/pixellab/pl-core-dev.json`
- `assets/pixellab/pl-infrastructure.json`
- `assets/pixellab/pl-planning.json`
- `assets/pixellab/pl-support.json`
- `assets/pixellab/rd-eval-char.json`

### assets/sounds-source/
- `assets/sounds-source/.gitkeep`
- `assets/sounds-source/notification.wav`

### assets/spritesheets/
- `assets/spritesheets/avatar_atlas.json`
- `assets/spritesheets/chair_atlas.json`
- `assets/spritesheets/furniture_atlas.json`

### bin/
- `bin/habbo-dashboard.mjs`

### docs/
- `docs/mault.yaml`

### docs/agent-hooks/
- `docs/agent-hooks/INVESTIGATION.md`

### docs/architecture/
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/module-graph.md`

### docs/guides/
- `docs/guides/COPILOT-AGENT-MONITOR.md`
- `docs/guides/HOSTED-DEPLOYMENT.md`
- `docs/guides/LOCAL-TAILNET-ACCESS.md`
- `docs/guides/MAULT-AI-CODER-GUIDE.md`

### docs/img/
- `docs/img/does-anyone-know-the-name-of-this-character-from-habbo-v0-7fujm5oi6zja1.webp`

### docs/slides/
- `docs/slides/habbo-pixel-agents-overview.marp.md`

### packages/agent-dashboard/
- `packages/agent-dashboard/esbuild.config.mjs`
- `packages/agent-dashboard/package.json`
- `packages/agent-dashboard/README.md`
- `packages/agent-dashboard/tsconfig.json`

### packages/agent-dashboard/bin/
- `packages/agent-dashboard/bin/agent-dashboard.mjs`

### packages/agent-dashboard/src/
- `packages/agent-dashboard/src/agentClassifier.ts`
- `packages/agent-dashboard/src/agentManager.ts`
- `packages/agent-dashboard/src/agentTypes.ts`
- `packages/agent-dashboard/src/azureDevOpsBoards.ts`
- `packages/agent-dashboard/src/client.ts`
- `packages/agent-dashboard/src/copilotMonitor.ts`
- `packages/agent-dashboard/src/fileWatcher.ts`
- `packages/agent-dashboard/src/index.ts`
- `packages/agent-dashboard/src/server.ts`
- `packages/agent-dashboard/src/transcriptParser.ts`
- `packages/agent-dashboard/src/wsClient.ts`

### packages/agent-dashboard/src/dashboard/
- `packages/agent-dashboard/src/dashboard/index.html`

### scripts/
- `scripts/configure.mjs`
- `scripts/convert-audio-to-ogg.sh`
- `scripts/convert-cortex-to-nitro.mjs`
- `scripts/create-ado-template.sh`
- `scripts/download-habbo-assets.mjs`
- `scripts/fix-spritesheet-bleed.mjs`
- `scripts/generate-arch-graph.mjs`
- `scripts/generate-avatar-placeholders.sh`
- `scripts/generate-placeholder-sprites.mjs`
- `scripts/generate-placeholders.sh`
- `scripts/gsd-mcp-proxy.mjs`
- `scripts/obtain-habbo-sounds.md`
- `scripts/pack-pixellab-furniture.mjs`
- `scripts/pack-pixellab-sprites.mjs`
- `scripts/pack-rd-sprites.mjs`
- `scripts/register-webhook.mjs`
- `scripts/web-server.mjs`

### scripts/exp/
- `scripts/exp/hook-record.mjs`
- `scripts/exp/PROBE.md`
- `scripts/exp/schema.json`
- `scripts/exp/translate-loop.mjs`

### scripts/hooks/
- `scripts/hooks/gsd-event-hook.mjs`
- `scripts/hooks/guard-gsd-db.mjs`
- `scripts/hooks/room-tool-feed.mjs`

### src/
- *(50 files: 46 .ts, 4 .tsx)*

### src/render/
- `src/render/CanvasStage.ts`
- `src/render/layers.ts`
- `src/render/roomBounds.ts`
- `src/render/sceneRenderer.ts`

### src/state/
- `src/state/agentStore.ts`
- `src/state/appMode.ts`
- `src/state/cameraStore.ts`
- `src/state/kanbanStore.ts`
- `src/state/store.ts`

### src/web/
- `src/web/copilotMonitor.ts`
- `src/web/demoData.ts`
- `src/web/index.html`
- `src/web/main.tsx`
- `src/web/server.ts`
- `src/web/wsClient.ts`

### tests/
- *(43 files: 43 .ts)*
