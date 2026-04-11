# Knowledge

<!-- Append-only register of project-specific rules, patterns, and lessons learned.
     Read this at the start of every unit. Append when you discover a recurring issue,
     a non-obvious pattern, or a rule that future agents should follow. -->

## K001 — PixelLab furniture offset calibration

**Context:** M003 S01 — replacing hc_lmp with PixelLab oil lamp

Floor-standing furniture items in this project share a consistent `bottom_y ≈ 5–11` range (bolly_vase, exe_plant, original hc_lmp). When converting a PixelLab PNG to a Nitro spritesheet, calculate `offsetY = -(spriteHeight - bottomOffset)` where `bottomOffset` defaults to 9. The pack script handles this automatically. If the item visually floats or sinks on the tile, adjust `--bottom-offset=N`.

The analytical approach (matching bottom_y to existing furniture) worked on first attempt for hc_lmp, but hasn't been tested for multi-tile or wall-mounted items.

## K002 — PixelLab sprites are single-layer

**Context:** M003 S01

PixelLab generates static images — no animation frames, no separate body/glow/shade layers. Always set `layerCount: 1` in the Nitro JSON. If animated effects are needed (e.g., the original hc_lmp flame), they must come from overlay code in `isoFurnitureRenderer.ts`, not from the sprite itself.

## K003 — Glow overlay constants are per-furniture hardcoded

**Context:** M003 S01

The glow overlay in `isoFurnitureRenderer.ts` uses hardcoded Y-offset and radius values per furniture name (`hc_lmp` → screenY-15, r=48). When replacing a furniture item with a differently-sized PixelLab sprite, the glow constants must be recalibrated manually. This is a known maintenance burden if many lamps are replaced.

## K004 — dist/ is gitignored; assets/habbo/furniture/ is the source of truth

**Context:** M003 build pipeline

The build pipeline copies from `assets/habbo/furniture/` to `dist/webview-assets/furniture/`. The `dist/` directory is gitignored. The `pack-pixellab-furniture.mjs` script writes to `assets/habbo/furniture/`, and `esbuild.config.mjs` copies to dist. Never commit files directly to `dist/`.

## K005 — .env I/O is in src/envConfig.ts; use it for any future env-writing logic

**Context:** M008

`src/envConfig.ts` exports `readEnvFile(wsRoot)` and `writeEnvFile(wsRoot, updates)`. These parse and merge `.env` files in a way that preserves comments, blank lines, and keys not touched by the update. Any VS Code command or script that reads or writes `.env` should import from here rather than roll its own file I/O. The CLI wizard (`scripts/configure.mjs`) duplicates the logic in plain JS for zero-dependency use — keep the two in sync if the merge strategy ever changes.

## K006 — VS Code QuickPick pre-selection is better than InputBox for constrained choices

**Context:** M008 S02

For binary or small-set choices (e.g., kanban source, owner type), use `vscode.window.showQuickPick` with items that have `picked: true/false` based on the existing `.env` value. This gives the user a clear visual selection and avoids InputBox + `validateInput` for strings that must match an enum. Free-text fields (tokens, org names) still use `showInputBox` with `password: true` for secrets.

## K007 — npm workspace package esbuild must run from the package directory

**Context:** M005 S01

When running `esbuild.config.mjs` for a workspace package, the working directory matters. Running from the repo root causes "Could not resolve 'src/index.ts'" because esbuild resolves entryPoints relative to `process.cwd()`. Always run via `npm run build -w packages/agent-dashboard` (which sets cwd correctly) or `cd packages/agent-dashboard && node esbuild.config.mjs`. Never invoke a package's esbuild config directly from the repo root.

## K008 — Full re-export migration is blocked by test imports; defer or batch separately

**Context:** M005 S01

When extracting a package, tests that directly import from source files (`../agentManager.js`) prevent a clean re-export migration — they would all need updating at once. The pragmatic path: keep source files as originals, create the package with copies, and use a thin bridge file (`src/web/server.ts`) as the single import point for the package. Migrate test imports as a separate, dedicated task.

## K009 — Planning decisions made before slice execution should be re-evaluated at delivery

**Context:** M005 D002

D002 planned a React frontend for the dashboard. At delivery, vanilla HTML/JS was chosen (zero dependencies, no build step). The decision was recorded in DECISIONS.md before implementation began and was not updated. Future pattern: mark design-level decisions as "tentative" at planning time, and add a final row to DECISIONS.md at slice completion if the implementation diverged. Stale decisions mislead future agents.

## K010 — Vanilla HTML dashboards outperform React for "good enough" monitoring UIs

**Context:** M005 S02/S03

For dashboards that display incoming WebSocket events (agent cards, status badges, activity feed), a single vanilla HTML/JS file is faster to write, has zero dependencies, requires no build step, and is trivially embeddable via a static file server. Use React only when the dashboard requires rich component composition, complex state transitions, or reuse of existing React components from the project.
