# Project Instructions

## Workflow

All implementation tasks MUST go through the GSD workflow:

1. **Always use the GSD MCP server first** (`gsd_gsd_*` tools). It is the SQLite-authoritative interface — never parse markdown projections as your source of truth.
2. **State**: use `gsd_gsd_progress`, `gsd_gsd_query`, or `gsd_gsd_roadmap` to orient; use `gsd_gsd_doctor` if state looks wrong
3. **Planning**: use `gsd_gsd_plan_milestone` / `gsd_gsd_plan_slice` / `gsd_gsd_plan_task`
4. **Execution**: use `gsd_gsd_task_complete` per task, then `gsd_gsd_slice_complete` per slice
5. **Milestones**: use `gsd_gsd_validate_milestone` then `gsd_gsd_complete_milestone`

The `/gsd` slash commands (`/gsd`, `/gsd next`, `/gsd auto`, `/gsd status`) are for the human in the TUI. Agents should drive GSD through the MCP tools directly.

Do NOT implement features directly without going through GSD. This applies to all new features, bug fixes, and refactoring work — regardless of size.

## PixelLab Furniture Pipeline

To replace a Habbo furniture sprite with a PixelLab-generated image:

1. Drop the PixelLab PNG into `assets/pixellab/furniture/`
2. Run `node scripts/pack-pixellab-furniture.mjs assets/pixellab/furniture/<name>.png <furniture-id>` 
3. Run `node esbuild.config.mjs` to copy into dist

Options: `--bottom-offset=N` (default 9), `--dimensions=WxHxD`, `--directions=N,...`, `--no-shadow`, `--no-icon`, `--dry-run`.

Source assets live in `assets/habbo/furniture/` (the build copies from there to `dist/webview-assets/furniture/`). Originals are backed up as `.orig` on first replacement.

## Terminal Output Safety

The pi TUI crashes if any single output line exceeds the terminal width (~144 chars). To avoid this:

- **Never output wide JSON or data structures** directly to stdout. Pipe through `head -c 5000` or use `JSON.stringify(obj, null, 2)` with short values.
- **Wrap debug scripts** with `console.log` calls that keep each line under 120 chars — break arrays/objects across lines.
- **Prefer `npx vitest`** (already formatted) over raw `npx tsx -e` for verification.
- When using inline scripts (`npx tsx -e`, `node -e`), format output with newlines — never dump arrays or objects on a single line.

## Project State

- **Framework**: GSD Pi (`@opengsd/gsd-pi`) v1.18+ — SQLite-authoritative state (`.gsd/gsd.db`) with markdown projections; migrated from legacy markdown-only GSD 2 on 2026-09-04
- **State files**: `.gsd/` directory (PROJECT.md, DECISIONS.md, REQUIREMENTS.md, KNOWLEDGE.md); runtime DB is gitignored
- **Legacy history**: `.gsd/archive/milestones-pre-gsd3-20260904/` (M001–M008 from GSD 2 era, read-only reference — all complete except M007/S02)
- **Quick fixes**: `.gsd/quick/` (Q01-Q05, migrated from legacy `.planning/quick/`)
- **Todos**: `.gsd/todos/` (done + pending)
- **Diagnostics**: `gsd_gsd_doctor` (MCP) validates DB/projection integrity; `/gsd doctor` is the TUI equivalent; `gsd headless query` for non-interactive state snapshot

### GSD migration notes (2026-09-04)

- Legacy markdown import into the new DB was blocked by 222 `requires-user` diagnoses (`.planning`-era artifacts); v1.18.0 ships no resolution surface for them
- Resolution: legacy state archived (git commit `73ca36e`), project restarted on a clean DB
- Next step: re-register M007 (PixelLab Character Import) — S01 was complete (PR #48), S02 "Wire into renderer & calibrate" was pending
