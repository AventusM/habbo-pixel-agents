# Phase 17: bugfixes-and-wishlist - Research

**Researched:** 2026-03-06
**Domain:** Isometric Canvas 2D rendering — sticky note wall placement logic
**Confidence:** HIGH

## Summary

Phase 17 is an ongoing bugfix and polish phase. The first item is: sticky notes (kanban cards rendered on room walls) should render on a single wall only, not spread across multiple walls. Currently, In Progress cards (small individual notes) are distributed across both the left wall and the right wall once the left wall runs out of capacity. The fix is to confine all small notes to a single wall surface.

The codebase is a VS Code extension webview using Canvas 2D rendering. All rendering is done in TypeScript with no external rendering library. The kanban note renderer lives entirely in `src/isoKanbanRenderer.ts`. There are no new dependencies to install. This phase is pure logic/rendering bugfixes with no stack changes.

**Primary recommendation:** Modify `drawKanbanNotes` in `src/isoKanbanRenderer.ts` to constrain small In Progress notes to the left wall only (or right wall only — pick one consistently). Update unit tests in `tests/isoKanbanRenderer.test.ts` to assert the single-wall constraint.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser built-in | All rendering | Already established in project |
| TypeScript | Project-defined | All source files | Project convention |
| Vitest | v3.x (project) | Unit tests | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | No new deps needed | This is a rendering logic fix |

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── isoKanbanRenderer.ts   # Sticky note rendering — THE file to change
tests/
├── isoKanbanRenderer.test.ts  # Tests to update
```

### Pattern 1: Kanban Note Distribution (Current — Buggy)
**What:** Small In Progress notes fill `leftSmallTiles` first, then overflow into `rightSmallTiles`.
**Problem:** This causes notes to appear on two different wall surfaces, which looks wrong visually.

Current code (lines 446-481 of `src/isoKanbanRenderer.ts`):
```typescript
const leftSmallTiles = hasLeftLarge ? leftEdge.filter((_, i) => i !== leftMidIdx) : leftEdge;
const rightSmallTiles = hasRightLarge ? rightEdge.filter((_, i) => i !== rightMidIdx) : rightEdge;

const smallCapacity = (leftSmallTiles.length + rightSmallTiles.length) * 2;
const ipCardsToShow = inProgressCards.slice(0, smallCapacity);
let cardIndex = 0;

for (const { tx, ty } of leftSmallTiles) { ... }  // fills left wall first
for (const { tx, ty } of rightSmallTiles) { ... } // overflows to right wall
```

### Pattern 2: Single-Wall Constraint (Fix)
**What:** Restrict small notes to only one wall. Left wall is the natural primary surface because it is already used for the large BACKLOG aggregate. The right wall hosts DONE. Keeping In Progress on the left wall groups "active" cards (Backlog + In Progress) on the left, and "completed" (Done) on the right.

**Example fix:**
```typescript
// Only use leftSmallTiles for In Progress — never overflow to right wall
const leftSmallTiles = hasLeftLarge
  ? leftEdge.filter((_, i) => i !== leftMidIdx)
  : leftEdge;

const smallCapacity = leftSmallTiles.length * 2;
const ipCardsToShow = inProgressCards.slice(0, smallCapacity);
let cardIndex = 0;

for (const { tx, ty } of leftSmallTiles) {
  if (cardIndex >= ipCardsToShow.length) break;
  for (let slot = 0; slot < 2; slot++) {
    if (cardIndex >= ipCardsToShow.length) break;
    const card = ipCardsToShow[cardIndex++];
    const pos = leftWallNotePosition(tx, ty, slot as 0 | 1, cameraOrigin);
    const isExpanded = card.id === expandedNoteId;
    drawStickyNote(ctx, pos.x, pos.y, card.title, card.status, 'left', isExpanded);
    const corners = computeSkewedCorners(pos.x, pos.y, NOTE_W, NOTE_H, 'left');
    noteHitAreas.push({ cardId: card.id, corners, wallSide: 'left' });
  }
}
// rightSmallTiles loop removed entirely
```

**Design rationale:**
- Left wall = Backlog (large) + In Progress (small) — "work to do and doing"
- Right wall = Done (large only) — "completed work"
- This is a natural Kanban spatial metaphor: left = incoming/active, right = done

### Anti-Patterns to Avoid
- **Overflow to second wall:** The original behavior — if In Progress cards exceed left wall capacity, they silently appear on the right wall. Visually confusing.
- **Removing the right wall entirely:** The right wall still shows the Done large aggregate note. Only small In Progress notes are removed from the right wall.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wall edge detection | Custom scan | Existing `leftEdge`/`rightEdge` logic | Already correct in `drawKanbanNotes` |
| Canvas skew transform | Custom matrix | Existing `ctx.transform(1, slope, 0, 1, ...)` pattern | Already working |
| Hit area computation | Custom quad test | Existing `computeSkewedCorners` + `pointInQuad` | Already working |

## Common Pitfalls

### Pitfall 1: Breaking the rightSmallTiles hit area tracking
**What goes wrong:** If the `rightSmallTiles` loop is removed but code that references `rightSmallTiles` variable is left in, TypeScript will not error (variable is simply unused) but behavior is correct. No risk here — the variable only appeared in the loop.
**How to avoid:** Delete the entire `rightSmallTiles` variable declaration and its loop body. Do not leave dead code.

### Pitfall 2: Test expects cross-wall distribution
**What goes wrong:** The existing test `respects capacity limit for In Progress notes on tiny grid` explicitly checks that 8 notes appear on a 2x2 grid (4 tiles × 2 slots = 8, using both walls). After the fix, only the left wall is used, so capacity drops to 2 left tiles × 2 slots = 4.
**How to avoid:** Update the test expectation to match the new single-wall capacity: `expect(smallNotes.length).toBe(4)` (for 2x2 grid with no large notes, left wall has 2 tiles × 2 slots = 4).

### Pitfall 3: `hasLeftLarge` mid-tile exclusion still needed
**What goes wrong:** When there IS a backlog aggregate note (hasLeftLarge = true), the middle left tile hosts the large note. Small notes must still skip that slot. The existing filter `leftEdge.filter((_, i) => i !== leftMidIdx)` must be kept.
**How to avoid:** Keep the `leftSmallTiles` filtering logic exactly as-is. Only remove `rightSmallTiles` and its loop.

### Pitfall 4: `smallCapacity` computation must change
**What goes wrong:** `smallCapacity` currently uses `(leftSmallTiles.length + rightSmallTiles.length) * 2`. After the fix, it must use only `leftSmallTiles.length * 2`. If not updated, `ipCardsToShow` may be a larger slice than the left wall can actually display, and the loop will simply stop early due to the `break` guards — no visual error, but it's misleading.
**How to avoid:** Update `smallCapacity = leftSmallTiles.length * 2` to match the actual drawing loop.

## Code Examples

### Current distribution logic (source: `src/isoKanbanRenderer.ts`, lines 446-481)
```typescript
const hasLeftLarge = backlogCards.length > 0 && leftEdge.length > 0;
const hasRightLarge = doneCards.length > 0 && rightEdge.length > 0;
const leftSmallTiles = hasLeftLarge ? leftEdge.filter((_, i) => i !== leftMidIdx) : leftEdge;
const rightSmallTiles = hasRightLarge ? rightEdge.filter((_, i) => i !== rightMidIdx) : rightEdge;

const smallCapacity = (leftSmallTiles.length + rightSmallTiles.length) * 2;
const ipCardsToShow = inProgressCards.slice(0, smallCapacity);
let cardIndex = 0;

for (const { tx, ty } of leftSmallTiles) { /* draws left */ }
for (const { tx, ty } of rightSmallTiles) { /* draws right — TO REMOVE */ }
```

### Fixed distribution logic
```typescript
const hasLeftLarge = backlogCards.length > 0 && leftEdge.length > 0;
const leftSmallTiles = hasLeftLarge ? leftEdge.filter((_, i) => i !== leftMidIdx) : leftEdge;

const smallCapacity = leftSmallTiles.length * 2;
const ipCardsToShow = inProgressCards.slice(0, smallCapacity);
let cardIndex = 0;

for (const { tx, ty } of leftSmallTiles) {
  if (cardIndex >= ipCardsToShow.length) break;
  for (let slot = 0; slot < 2; slot++) {
    if (cardIndex >= ipCardsToShow.length) break;
    const card = ipCardsToShow[cardIndex++];
    const pos = leftWallNotePosition(tx, ty, slot as 0 | 1, cameraOrigin);
    const isExpanded = card.id === expandedNoteId;
    drawStickyNote(ctx, pos.x, pos.y, card.title, card.status, 'left', isExpanded);
    const corners = computeSkewedCorners(pos.x, pos.y, NOTE_W, NOTE_H, 'left');
    noteHitAreas.push({ cardId: card.id, corners, wallSide: 'left' });
  }
}
// No rightSmallTiles loop
```

### Updated test: capacity on tiny grid
```typescript
it('respects capacity limit for In Progress notes on tiny grid', () => {
  // 2x2 grid: left edge has 2 tiles, no large note, capacity = 2 * 2 = 4
  // All 10 In Progress cards capped to 4 (left wall only)
  expect(smallNotes.length).toBe(4);
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v3.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/isoKanbanRenderer.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Ongoing | Small notes confined to left wall only | unit | `npx vitest run tests/isoKanbanRenderer.test.ts` | Exists, needs update |
| Ongoing | Right wall shows only large Done aggregate | unit | `npx vitest run tests/isoKanbanRenderer.test.ts` | Exists, needs new test |
| Ongoing | Existing tests still pass | unit | `npx vitest run` | Exists |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/isoKanbanRenderer.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- None — test file already exists at `tests/isoKanbanRenderer.test.ts`. Only test values need updating.

## Open Questions

1. **Should "In Progress" overflow be silently capped or shown differently?**
   - What we know: The left wall has finite capacity (tiles × 2 slots). If there are more In Progress cards than slots, excess are silently dropped.
   - What's unclear: Whether the user wants a visual indicator of overflow (e.g., "+N more" text on the last small note).
   - Recommendation: Keep the existing silent cap behavior for now. A "+N more" indicator can be a future wishlist item. The bug fix scope is just single-wall constraint.

2. **Should notes always go left (Backlog + In Progress) and right (Done only)?**
   - What we know: The design intent from Phase 12 research put Backlog on left, Done on right. In Progress going left is the logical extension.
   - What's unclear: Whether the user has seen this in action and prefers a different layout.
   - Recommendation: Implement left-wall-only for In Progress as the most coherent design. Document in plan as the chosen layout.

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `src/isoKanbanRenderer.ts` — lines 446-481 (distribution logic)
- Direct source code inspection: `tests/isoKanbanRenderer.test.ts` — test at line 155-177 (capacity test)
- Direct source code inspection: `src/isoWallRenderer.ts` — wall geometry definition
- Phase 12 plans: `.planning/phases/12-room-walls-kanban-notes/12-03-PLAN.md` — original design intent

### Secondary (MEDIUM confidence)
- N/A — this is an internal codebase fix with no external library involvement

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — source code confirms cross-wall distribution
- Fix approach: HIGH — minimal, targeted change in one function
- Test impact: HIGH — one test value must change, one new test should be added
- Rendering correctness: HIGH — removing the right-wall loop has no visual side effects on the right wall's large Done note

**Research date:** 2026-03-06
**Valid until:** Stable (this is internal code, not external dependency)