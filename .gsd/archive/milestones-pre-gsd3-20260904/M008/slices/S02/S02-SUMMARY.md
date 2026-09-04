---
id: S02
parent: M008
milestone: M008
provides:
  - ["habbo-pixel-agents.configure VS Code command", "src/envConfig.ts shared .env helpers"]
requires:
  - slice: S01
    provides: scripts/configure.mjs and .env format reference
affects:
  []
key_files:
  - ["src/envConfig.ts", "src/extension.ts", "package.json"]
key_decisions:
  - ["Extracted .env logic to src/envConfig.ts — keeps extension.ts focused on VS Code concerns and makes the helpers testable", "QuickPick with pre-selected option for kanban source and owner type \u2014 avoids text input + validation for constrained choices"]
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-11T13:31:05.139Z
blocker_discovered: false
---

# S02: VS Code command wizard

**VS Code 'Habbo: Configure Integration' command — QuickPick/InputBox wizard writes .env with ✅ reload notification**

## What Happened

Added `habbo-pixel-agents.configure` VS Code command. The wizard uses QuickPick for kanban source and owner type, InputBox (with password masking) for tokens, and conditional branches for GitHub Projects vs Azure DevOps. Any Escape press aborts the whole flow silently. On success, writes .env via writeEnvFile and shows a ✅ notification with a Reload Window button. Shared .env I/O extracted to src/envConfig.ts.

## Verification

npx tsc --noEmit → zero errors in src files. npx vitest run → 442/442 pass. Command declared in package.json contributes.commands.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

Command runs at extension host process — no UI live-preview of .env during wizard. Acceptable for the use case.

## Follow-ups

None.

## Files Created/Modified

- `src/envConfig.ts` — New module — readEnvFile and writeEnvFile helpers shared by extension and CLI
- `src/extension.ts` — Added habbo-pixel-agents.configure command registration + import of envConfig
- `package.json` — Declared habbo-pixel-agents.configure in contributes.commands
