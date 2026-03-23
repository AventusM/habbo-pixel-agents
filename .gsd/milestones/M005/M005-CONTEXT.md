# M005 — Extract Private `agent-dashboard` Package

## Goal

Extract the generic agent-monitoring core from this repo into a standalone private npm package (`@AventusM/agent-dashboard` or similar) that any repo can use to get a real-time web dashboard showing coding agent activity.

## Scope

**In scope:**
- Extract monitoring core into a separate `packages/agent-dashboard/` directory (monorepo approach) or a sibling repo
- Package includes: event protocol, GitHub/Copilot polling, Azure DevOps polling, local JSONL agent watcher, WebSocket relay server, browser WS client
- Ship a generic (non-Habbo) default dashboard frontend — simple, functional, no isometric rendering
- CLI entry point: `npx @AventusM/agent-dashboard --repo owner/repo`
- Private npm package (GitHub Packages or npm with restricted access)
- This repo becomes a consumer of the extracted package (Habbo skin on top of generic monitoring)

**Out of scope:**
- Public distribution / open source
- GitHub App / webhook integration (Path 2)
- New monitoring capabilities beyond what exists today
- Habbo rendering changes

## Constraints

- Private package — published to GitHub Packages or private npm registry, not public npm
- Zero breaking changes to this repo's existing `npm run web` workflow
- The `ExtensionMessage` protocol in `agentTypes.ts` is the extraction boundary
- Monitoring core has zero coupling to Habbo rendering (verified: 3,075 lines, imports only Node builtins + each other)

## Key Decisions Needed

1. **Package location**: monorepo (`packages/agent-dashboard/`) vs separate repository
2. **Registry**: GitHub Packages vs private npm
3. **Default frontend**: minimal HTML/CSS/JS vs lightweight React app
4. **How this repo consumes the package**: npm dependency vs git submodule vs workspace link

## Files to Extract

| File | Lines | Role |
|------|-------|------|
| `src/agentTypes.ts` | 96 | Event protocol types |
| `src/agentManager.ts` | 612 | Local JSONL agent watcher |
| `src/fileWatcher.ts` | 110 | File system watcher |
| `src/transcriptParser.ts` | 136 | JSONL transcript parser |
| `src/agentClassifier.ts` | 137 | Agent role classifier |
| `src/azureDevOpsBoards.ts` | 222 | Azure DevOps polling |
| `src/web/copilotMonitor.ts` | 1,391 | GitHub/Copilot polling + SSE |
| `src/web/server.ts` | 83 | Server factory |
| `src/web/wsClient.ts` | 120 | Browser WebSocket client |
| `scripts/web-server.mjs` | 305 | HTTP + WebSocket server |
| **Total** | **~3,212** | |

## Dependencies

- Runtime: `dotenv`, `ws`
- Dev: `typescript`, `esbuild`, `@types/node`, `@types/ws`
- No React dependency in the core package (React is only for the Habbo frontend)
