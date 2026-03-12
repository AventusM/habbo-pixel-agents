# T01: 04-furniture-rendering 01

**Slice:** S04 — **Milestone:** M001

## Description

Validate furniture asset availability and implement single-tile furniture rendering with the chair as the first working example.

Purpose: Establish the furniture rendering pipeline (sprite lookup → anchor offset → drawImage) and validate all 8 required furniture types exist in the asset source before implementing multi-tile or batch rendering.

Output: Working chair rendering in all 4 directions, integrated into depth-sort pipeline, with asset validation checklist confirming all 8 furniture types are available.

## Must-Haves

- [ ] "Chair (1×1 furniture) renders at correct screen position with direction support"
- [ ] "Furniture sprites use correct atlas frame keys matching {name}_{size}_{layer}_{direction}_{frame} format"
- [ ] "Furniture renderables integrate into existing depth-sort pipeline without Z-fighting"
- [ ] "All 8 required furniture types exist in asset source before implementation begins"

## Files

- `src/isoFurnitureRenderer.ts`
- `tests/isoFurnitureRenderer.test.ts`
- `assets/spritesheets/furniture_atlas.json`
- `assets/spritesheets/furniture_atlas.png`
