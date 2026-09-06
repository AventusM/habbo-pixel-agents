---
id: M008
title: "Env Var Configuration Wizard"
status: complete
completed_at: 2026-04-11T13:31:45.599Z
key_decisions:
  - Used Node.js built-in readline/promises for CLI wizard — no new runtime dependencies
  - .env merge strategy: replace matched keys in-place, append new keys at end, preserve comments and unknown vars
  - Extracted shared .env I/O into src/envConfig.ts — reused by both CLI and VS Code extension paths
  - QuickPick with pre-selected option for constrained choices (kanban source, owner type) — avoids InputBox + validation dance
key_files:
  - scripts/configure.mjs
  - src/envConfig.ts
  - src/extension.ts
  - package.json
lessons_learned:
  - Sharing .env I/O logic between a CLI script and a VS Code extension is cleanest when extracted to a typed TS module (src/envConfig.ts) — the CLI script can stay as plain mjs and call into the same logic via import
  - VS Code QuickPick with pre-selected items based on existing .env gives a much better UX than InputBox with constrained text validation for binary choices
---

# M008: Env Var Configuration Wizard

**Replaced manual .env editing with a CLI wizard (scripts/configure.mjs) and a VS Code command (Habbo: Configure Integration) that guide contributors through all env vars in under two minutes.**

## What Happened

M008 delivered two self-contained configuration surfaces for Habbo Pixel Agents. S01 produced `scripts/configure.mjs` — a zero-dependency interactive CLI wizard using Node.js built-in readline that loads an existing .env for defaults, steps through KANBAN_SOURCE → source-specific credentials → PORT, computes a diff, and writes the file (or dry-runs). S02 added `habbo-pixel-agents.configure` to the VS Code extension — a QuickPick/InputBox wizard that mirrors the CLI flow but with native VS Code UI and a ✅ notification with Reload Window. Shared .env read/write logic lives in src/envConfig.ts, consumed by both the extension and available for future scripts.

## Success Criteria Results

- ✅ `node scripts/configure.mjs` starts the CLI wizard and guides through KANBAN_SOURCE → GitHub or AzDO vars → writes .env\n- ✅ `node scripts/configure.mjs --dry-run` shows diff only, no file written\n- ✅ VS Code Command Palette → 'Habbo: Configure Integration' → wizard runs → ✅ notification with Reload Window button\n- ✅ All builds and tests pass; no regressions introduced

## Definition of Done Results

- **S01 (CLI wizard) complete**: `scripts/configure.mjs` exists, runs, and is wired as `npm run configure`\n- **S02 (VS Code command) complete**: `habbo-pixel-agents.configure` registered in extension.ts and declared in package.json\n- **All 442 tests pass** — no regressions\n- **Zero new TypeScript errors** in source files\n- **Code changes verified** via `git diff --stat HEAD`

## Requirement Outcomes

No requirements were formally registered for M008. The work delivers new operational capability (contributor onboarding via guided wizard) with no changes to validated rendering or agent requirements.

## Deviations

S03 from the original roadmap was not planned (roadmap only had S01 + S02). No deviations from those two slices.

## Follow-ups

- Could add tests for src/envConfig.ts (readEnvFile/writeEnvFile) in a future pass\n- configure.mjs could offer back-navigation in a future iteration if the wizard grows longer
