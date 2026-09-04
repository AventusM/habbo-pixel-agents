# T01: 12-room-walls-kanban-notes 01

**Slice:** S04 — **Milestone:** M002

## Description

Replace per-tile wall strips with full room-perimeter wall panels that extend to a shared baseline, plus a back corner post where the two walls meet.

Purpose: Current wall strips leave visible gaps between tiles at different heights and look like thin edges rather than proper room walls. Full wall panels create the authentic Habbo Hotel room enclosure.

Output: `src/isoWallRenderer.ts` with wall geometry functions; updated `preRenderRoom` to call wall panels; unit tests.

## Must-Haves

- [ ] "Room displays full-height wall panels along left and right edges instead of short strips"
- [ ] "Back corner post fills the junction where left and right walls meet"
- [ ] "Wall panels extend to a shared baseline so no gaps appear between tiles at different heights"
- [ ] "Existing room rendering (floor tiles, furniture, avatars) is unaffected"

## Files

- `src/isoWallRenderer.ts`
- `src/isoTileRenderer.ts`
- `tests/isoWallRenderer.test.ts`
