---
applyTo: "assets/**,scripts/pack-pixellab-furniture.mjs,src/furnitureRegistry.ts"
---

# Asset Pipeline Instructions

## Pack Script Reference

```bash
node scripts/pack-pixellab-furniture.mjs <input-png> <furniture-id> [options]
```

The script converts a PixelLab PNG into a Nitro-compatible spritesheet (PNG + JSON) that `loadNitroAsset()` consumes.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--bottom-offset=N` | 9 | Pixels below tile center for sprite bottom. Floor items: 5-11. |
| `--dimensions=WxHxD` | 1x1x1 | Tile footprint (width x height x depth) |
| `--directions=N,...` | 0 | Comma-separated Habbo directions |
| `--no-shadow` | false | Skip shadow diamond generation |
| `--no-icon` | false | Skip icon generation |
| `--dry-run` | false | Print what would be written without writing |

### Output Files
- `assets/habbo/furniture/<furniture-id>.png` — spritesheet
- `assets/habbo/furniture/<furniture-id>.json` — Nitro metadata

Existing files are backed up as `.orig` on first replacement.

## Furniture Registry

After packing, register the item in `src/furnitureRegistry.ts`:

```typescript
// Add to FURNITURE_CATALOG array:
{ id: 'new_item_id', displayName: 'New Item', category: 'habboclub' },

// If sittable, add to CHAIR_IDS:
const CHAIR_IDS = new Set([..., 'new_item_id']);

// If walkable (rug/mat), add to RUG_IDS:
const RUG_IDS = new Set([..., 'new_item_id']);
```

Categories: `habboclub`, `fun`, `office`, `section`

## Determining Options

- **bottom-offset**: Most floor items use 5-11. Taller items use lower values. Wall items use negative values.
- **dimensions**: Check the issue description. Most items are 1x1x1. Sofas might be 3x1x1.
- **directions**: Single-facing items: `0`. Rotatable items: `0,2,4,6`. Check if the source PNG shows multiple angles.

## Validation

After all changes:
1. `node esbuild.config.mjs` — build must succeed
2. `npx vitest run` — all tests must pass
