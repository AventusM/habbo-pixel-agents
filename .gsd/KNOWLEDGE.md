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
