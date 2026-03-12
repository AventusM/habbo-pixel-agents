# T04: 16-agent-factory-workflow 04

**Slice:** S09 — **Milestone:** M002

## Description

Expand the furniture catalog with section-themed items and implement the teleport booth spawn/despawn effect.

Purpose: Sections need distinct themed furniture to feel like team zones. The teleport booth is the spawn/despawn point per user decision.
Output: Extended furniture catalog, teleport flash effect, new cortex-asset downloads, section furniture placement in layout templates.

## Must-Haves

- [ ] "Section-themed furniture items are registered in the catalog"
- [ ] "Teleport booth (country_gate) renders at section spawn points"
- [ ] "Teleport flash effect animates on spawn/despawn"
- [ ] "New furniture assets are downloaded from cortex-assets"

## Files

- `src/furnitureRegistry.ts`
- `src/teleportEffect.ts`
- `src/roomLayoutEngine.ts`
- `scripts/download-habbo-assets.mjs`
- `tests/teleportEffect.test.ts`
