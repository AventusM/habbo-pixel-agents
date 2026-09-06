# T01: 14-avatar-builder-ui 01

**Slice:** S06 — **Milestone:** M002

## Description

Define the outfit configuration type system, curated clothing catalog, color palettes, and default presets that form the data foundation for the avatar builder.

Purpose: All subsequent plans (renderer integration, builder UI) depend on these types and data structures. Establishing them first prevents the "scavenger hunt" anti-pattern.
Output: avatarOutfitConfig.ts with types, catalog, palettes, and presets; updated download script with new figure assets; unit tests.

## Must-Haves

- [ ] "OutfitConfig type defines per-avatar clothing and color selections"
- [ ] "Curated catalog of 25-30 items exists organized by category and gender"
- [ ] "Color palettes for skin, hair, and clothing are defined"
- [ ] "6+ default presets provide visual variety for new agents"
- [ ] "Download script includes all new figure assets"

## Files

- `src/avatarOutfitConfig.ts`
- `scripts/download-habbo-assets.mjs`
- `tests/avatarOutfitConfig.test.ts`
