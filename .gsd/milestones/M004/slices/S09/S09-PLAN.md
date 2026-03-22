# S09 Plan — Live Session Activity in Speech Bubbles

## Goal

Replace the generic commit-message-based speech bubble text (`Coding... (last: "Initial plan")`) with real-time activity from the Copilot session logs API, showing what the agent is actually doing — reading files, running tests, searching code, editing files.

## Tasks

- [x] **T01: Integrate Copilot sessions API** `est:1h`
  - Discover the `api.githubcopilot.com/agents/sessions` endpoints (session list + SSE logs)
  - Resolve Copilot session UUID per PR via the sessions list API
  - Fetch the SSE log stream and parse the last tool call
  - Format tool calls into human-readable display strings (same pattern as `transcriptParser.ts`)
  - Graceful fallback to phase + PR title when the session API is unavailable (401/403)

## Verification

- Build passes (`node esbuild.config.mjs`)
- All 373 existing tests pass (`npx vitest run`)
- Display text now shows tool-level activity: "Reading isoSpriteCache.ts", "Running tests", etc.
