# Phase 17.3: Fix Move Logic to Respect Selected Avatar - Research

**Researched:** 2026-03-08
**Domain:** Avatar selection and right-click movement in RoomCanvas
**Confidence:** HIGH

## Summary

The bug is fully diagnosed from source code inspection. When right-clicking to move an avatar, the code checks `selectionManagerRef.current.selectedAvatarId` to prefer the selected avatar. However, `selectAvatar()` is **never called anywhere in RoomCanvas.tsx** -- only `deselectAvatar()` is called (on agent despawn at line 374 and on empty-space click at line 1156). This means `selectedAvatarId` is always null, so the right-click move handler always falls through to the "find nearest idle/walk avatar" sort, moving whichever avatar is closest to the target tile rather than the one the user intended.

The fix requires two changes: (1) call `selectionManagerRef.current.selectAvatar(clickedAvatar.id)` when the user left-clicks on an avatar, and (2) ensure the selection highlight renders correctly (it already does -- `drawSelectionHighlight` reads `selectedAvatarId` at line 856).

**Primary recommendation:** Add `selectAvatar()` call in the left-click avatar handler so right-click movement uses the selected avatar.

## Architecture Patterns

### Current Click Flow (Broken)

```
Left-click on avatar:
  -> popup card / builder toggle
  -> NO selectAvatar() call  <-- BUG: selection never set

Right-click on tile:
  -> check selectedAvatarId (always null)
  -> falls through to "find nearest" sort  <-- BUG: wrong avatar moves

Right-click on chair:
  -> same pattern, same bug
```

### Fixed Click Flow

```
Left-click on avatar:
  -> selectAvatar(clickedAvatar.id)  <-- FIX
  -> avatar.isSelected = true         <-- FIX (for renderer)
  -> deselect all other avatars       <-- FIX
  -> popup card / builder toggle (unchanged)

Right-click on tile:
  -> check selectedAvatarId (now correctly set)
  -> uses selected avatar if idle/walk
  -> falls through to nearest only if no selection or selected is busy

Selection highlight:
  -> already works (drawSelectionHighlight reads selectedAvatarId)
```

### Key Code Locations

| File | Lines | Purpose |
|------|-------|---------|
| `src/RoomCanvas.tsx` | 1121-1160 | Left-click handler (needs selectAvatar call) |
| `src/RoomCanvas.tsx` | 1162-1279 | Right-click handler (already checks selectedAvatarId) |
| `src/RoomCanvas.tsx` | 1193-1207 | Chair sit: prefers selected, falls back to nearest |
| `src/RoomCanvas.tsx` | 1252-1266 | Tile move: prefers selected, falls back to nearest |
| `src/RoomCanvas.tsx` | 854-862 | Selection highlight rendering (already works) |
| `src/avatarSelection.ts` | 1-28 | AvatarSelectionManager class (already complete) |
| `tests/avatarSelection.test.ts` | 1-51 | Unit tests for selection manager (already passing) |

### Selection State Sync

The `AvatarSpec` interface has an `isSelected` boolean (defined in `isoAvatarRenderer.ts:80`) and `AvatarSelectionManager` tracks `selectedAvatarId`. Both need to stay in sync:
- When selecting: set `avatar.isSelected = true` and `selectAvatar(id)`
- When deselecting: set all `avatar.isSelected = false` and `deselectAvatar()`

The deselection side already works (line 1156-1159). Only the selection side is missing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar selection state | New selection system | Existing `AvatarSelectionManager` | Already built and tested, just not wired up |

## Common Pitfalls

### Pitfall 1: Forgetting to Deselect Other Avatars
**What goes wrong:** Multiple avatars with `isSelected = true` causing visual confusion
**How to avoid:** When selecting an avatar, loop through all avatars and set `isSelected = false` first, then set the target's `isSelected = true`

### Pitfall 2: Selection Persisting After Avatar Despawn
**What goes wrong:** Selected avatar despawns, stale selection ID remains
**How to avoid:** Already handled -- line 374 calls `deselectAvatar()` on despawn

### Pitfall 3: Selected Avatar in Non-Movable State
**What goes wrong:** User selects a typing/sitting avatar, then right-clicks to move
**How to avoid:** Already handled -- the right-click handler checks `target.state !== 'idle' && target.state !== 'walk'` and falls through to nearest if the selected avatar is busy (lines 1201, 1257)

## Code Examples

### Fix: Add Selection on Left-Click (src/RoomCanvas.tsx ~line 1127)

```typescript
if (clickedAvatar) {
  // Select this avatar
  selectionManagerRef.current.selectAvatar(clickedAvatar.id);
  for (const avatar of avatarManager.getAvatars()) {
    avatar.isSelected = (avatar.id === clickedAvatar.id);
  }

  // If avatar is sitting, stand it up
  if (clickedAvatar.state === 'sit') {
    // ... existing code unchanged
  }
  // ... rest of popup/builder logic unchanged
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/avatarSelection.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-17.3 | selectAvatar called on left-click sets selectedAvatarId | unit | `npx vitest run tests/avatarSelection.test.ts -x` | Existing tests sufficient |
| BUG-17.3 | Right-click uses selected avatar for movement | manual-only | Visual verification: select avatar, right-click tile, correct avatar moves | N/A |

### Wave 0 Gaps
None -- existing test infrastructure covers the selection manager. The actual integration (click handler wiring) is best verified manually since RoomCanvas is a React component with canvas interactions.

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of `src/RoomCanvas.tsx` (lines 1121-1279)
- Direct source code inspection of `src/avatarSelection.ts`
- `tests/avatarSelection.test.ts` confirming selection manager API

## Metadata

**Confidence breakdown:**
- Bug diagnosis: HIGH - root cause confirmed by code inspection (selectAvatar never called)
- Fix approach: HIGH - existing infrastructure already supports selection, just needs wiring
- Risk assessment: HIGH - minimal change, no architectural impact

**Research date:** 2026-03-08
**Valid until:** N/A (bugfix, not version-dependent)