# Project Instructions

## Workflow

All implementation tasks MUST go through the GSD workflow:

1. **Step mode**: Use `/gsd` or `/gsd next` to execute one unit at a time
2. **Auto mode**: Use `/gsd auto` to research, plan, execute, and commit autonomously
3. **Discussion**: Use `/gsd discuss` alongside auto mode for architecture decisions
4. **Status**: Use `/gsd status` or `Ctrl+Alt+G` for progress dashboard

Do NOT implement features directly without going through GSD. This applies to all new features, bug fixes, and refactoring work — regardless of size.

## PixelLab Furniture Pipeline

To replace a Habbo furniture sprite with a PixelLab-generated image:

1. Drop the PixelLab PNG into `assets/pixellab/furniture/`
2. Run `node scripts/pack-pixellab-furniture.mjs assets/pixellab/furniture/<name>.png <furniture-id>` 
3. Run `node esbuild.config.mjs` to copy into dist

Options: `--bottom-offset=N` (default 9), `--dimensions=WxHxD`, `--directions=N,...`, `--no-shadow`, `--no-icon`, `--dry-run`.

Source assets live in `assets/habbo/furniture/` (the build copies from there to `dist/webview-assets/furniture/`). Originals are backed up as `.orig` on first replacement.

## Project State

- **State files**: `.gsd/` directory (PROJECT.md, STATE.md, DECISIONS.md, REQUIREMENTS.md)
- **Milestones**: `.gsd/milestones/M001/` (v1 complete), `.gsd/milestones/M002/` (v2 in progress)
- **Quick fixes**: `.gsd/quick/` (Q01-Q05, migrated from legacy `.planning/quick/`)
- **Todos**: `.gsd/todos/` (done + pending)
- **Archive**: `.gsd/archive/` (v1 roadmap and config, read-only reference)
