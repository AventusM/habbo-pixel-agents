# ARCHITECTURE — Habbo Pixel Agents

Visualizes AI coding agent activity (GitHub Copilot coding agents, Claude Code
sessions) as animated Habbo Hotel–style avatars in a 2D isometric pixel-art room,
rendered on HTML Canvas. Each active agent appears as a character that walks,
sits, and speaks via speech bubbles showing its current tool call; wall sticky
notes mirror a kanban board (GitHub Projects v2 or Azure DevOps Boards).

Node 22+ / TypeScript / ESM. npm workspaces: `packages/*`. Tested with Vitest,
type-checked with `tsc --noEmit`, linted with ESLint.

## Main components

### Data collection (Node side)

- `src/agentManager.ts` — discovers Claude Code sessions by watching JSONL
  transcript files under the Claude project directory; `fileWatcher.ts`,
  `transcriptParser.ts`, and `agentClassifier.ts` parse and classify agent
  role/subagent type; emits lifecycle events (`agentCreated/Status/Tool/…`).
- `src/web/copilotMonitor.ts` — polls the GitHub REST API for Copilot coding
  agent activity (PRs authored by Copilot, workflow runs, sessions API logs).
  Three feed modes: SSE, fast-poll, standard poll.
- `src/githubProjects.ts`, `src/azureDevOpsBoards.ts` — fetch kanban cards from
  GitHub Projects v2 and Azure DevOps Boards. Provider selection is driven by
  the `KANBAN_SOURCE` env var / `habboPixelAgents.kanbanSource` setting in
  `scripts/web-server.mjs` and `src/extension.ts`; `boardSource.ts`
  (`classifyBoardSource`) classifies the board *delivery* path instead
  (webhook vs ETag probe vs demo). Web server relays cards over WebSocket; the
  extension polls directly.
- `src/agentTypes.ts` — the `ExtensionMessage` protocol: the single message
  union every host uses to feed the room.

### Hosts / entry points

Three thin host shells aggregate external data and dispatch the same event
protocol into the room:

1. **VS Code extension** — `src/extension.ts` (`activate()`), bundled by
   `esbuild.config.mjs` to `dist/extension.cjs` (main in `package.json`).
   Contributes the `habbo-pixel-agents.*` commands and an Activity Bar webview
   view (`orchestrationPanel.ts`, HTML from `orchestrationPanelHtml.ts`).
   `src/webview.tsx` is the webview entry; `messageBridge.ts` relays
   `postMessage` between the room panel and the orchestration sidebar.
2. **Standalone web** — `node scripts/web-server.mjs` serves `dist/web/` via
   HTTP and runs a WebSocket server (`ws`) that streams agent/kanban events from
   the Node side to browsers; client side is `src/web/main.tsx` +
   `src/web/wsClient.ts`. The compiled server module is
   `dist/web/server.mjs` (bundled from `src/web/server.ts`).
3. **Demo driver** — `src/web/demoData.ts` schedules synthetic agents and cards
   for offline browsing (forced with `?demo`, fallback after ~5s idle).

Other entry points: `bin/habbo-dashboard.mjs` (npm `bin`, interactive launcher
that forks the web server) and `npm run configure` →
`scripts/configure.mjs` (interactive wizard that writes/updates `.env`,
loading any existing file and preserving unknown vars; the variable set is
documented in `.env.example`).
`packages/agent-dashboard/` republishes the agent-monitoring core
(`agentManager`, `copilotMonitor`, `azureDevOpsBoards`, event types) as
`@anthropic-claude/agent-dashboard` for external consumers.

### In-browser room (React + Canvas)

- `src/RoomCanvas.tsx` — per-frame render loop (rAF): tick (avatar BFS paths
  from `avatarManager.ts`, idle wander from `idleWander.ts`, teleport effects),
  then a throttled draw pass that blits cached world-space layers and draws
  dynamic elements.
- Isometric renderers: `isometricMath.ts` (tile math), `isoTileRenderer.ts` /
  `isoWallRenderer.ts` (pre-rendered room layer), `isoKanbanRenderer.ts`
  (cached sticky-note layer), `isoFurnitureRenderer.ts` (`furnitureRegistry.ts`
  catalog), `isoAvatarRenderer.ts` (Nitro figure parts) or
  `pixelLabAvatarRenderer.ts` (generated sprite atlases) via `isoSpriteCache.ts`
  (runtime `SpriteCache`), plus `isoBubbleRenderer.ts`, `isoNameTagRenderer.ts`,
  `isoOrchestrationOverlay.ts`, `isoPathfinding.ts`, `cameraController.ts`.
- React layer: `src/state/` zustand stores (`agentStore`, `kanbanStore`,
  `cameraStore`, `uiStore`, …), `src/hooks/` custom hooks (room input, editor,
  camera follow, HUD), `src/components/` panels (character editor, room stage,
  debug surfaces), `src/render/` (`sceneRenderer.ts`, `CanvasStage.ts`,
  `layers.ts`).
- `src/bus.ts` — typed message bus with stateful replay so events emitted
  before listeners attach are replayed to late subscribers.

## Key external dependencies & services

- **GitHub REST API** (token via `GITHUB_TOKEN`) — Copilot agent PRs/workflow
  runs/sessions; **GitHub Actions** workflow (`docs/guides/COPILOT-AGENT-MONITOR.md`)
  syncs Copilot PR events; optional webhook delivery (`WEBHOOK_SECRET`,
  `scripts/register-webhook.mjs`) instead of ETag probing.
- **`gh` CLI** — required for the GitHub Projects board: `src/githubProjects.ts`
  shells out to `gh api graphql` (`execFileSync`) to fetch cards, and
  `scripts/web-server.mjs` falls back to `gh auth token` when `GITHUB_TOKEN`
  is unset. Without an authenticated `gh`, the kanban wall comes up empty.
- **GitHub Projects v2** and **Azure DevOps Boards** (`AZDO_*`) — kanban wall.
- **Claude Code** — agent sessions detected via local JSONL transcript files.
- Assets: committed `assets/pixellab`, `assets/rd`, `assets/spritesheets`;
  original Habbo furniture/figures downloaded from the CakeChloe/cortex-assets
  GitHub repo by `scripts/download-habbo-assets.mjs` and converted to the Nitro
  per-item format by `scripts/convert-cortex-to-nitro.mjs` (gitignored under
  `assets/habbo/`). Custom characters generated with RetroDiffusion
  (`scripts/pack-rd-sprites.mjs`); PixelLab PNGs packed for furniture.
- Deployment: everything is Node/ESM plus the browser. No Dockerfile or compose
  file is checked in, but Docker Compose is a documented optional deployment
  (`docs/guides/LOCAL-TAILNET-ACCESS.md` §8). Process-tools under `scripts/`
  (abide/JEV judged diffs, GSD sync) are workflow tooling, not runtime
  dependencies.
- Deeper docs live in `docs/architecture/` (`ARCHITECTURE.md`, `module-graph.md`
  via `npm run arch:graph`); this file is the concise root-level summary.

## Build & checks

- `node esbuild.config.mjs` builds four bundles: extension (CJS, node),
  webview (IIFE, browser), standalone web app, and web server (ESM, node),
  copying sprite/audio assets into `dist/`.
- `npm test` (Vitest, suites under `tests/` with `tests/setup.ts`),
  `npx tsc --noEmit`, `npm run lint` (eslint), `npm run arch:graph`
  (madge-based module graph).
- Runtime state/GSD: `.gsd/` SQLite store; enforcement rubric `.abide/rubric.json`.
