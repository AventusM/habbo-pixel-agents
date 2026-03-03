# Phase 10: Avatar Polish & Bug Fixes

## Context

Phase 9 (v2 Avatar Movement) delivered working agent-driven avatars with pathfinding, idle wander, and click-to-move. Several rough edges remain: name tags show raw UUIDs instead of "Claude 1", despawning avatars never get removed (bug), speech bubbles show raw state strings, and agents face random directions at desks.

This phase is a focused polish pass — no new features, just fixing bugs and improving the existing avatar experience.

---

## Tasks

### 1. Fix despawn bug (critical)
**Files**: `src/isoAvatarRenderer.ts`

`removeAvatar` in avatarManager is gated on `spawnProgress <= 0`, but `updateAvatarAnimation` only ADDS to `spawnProgress` — it never decrements for despawning avatars. Despawned avatars stay in the pool forever.

**Fix**: In `updateAvatarAnimation`, when `state === 'despawning'`, decrement `spawnProgress` toward 0 instead of incrementing toward 1. When it reaches 0, the existing check in `avatarManager.tick()` will remove it.

### 2. Show "Claude N" instead of UUID in name tags
**Files**: `src/isoAvatarRenderer.ts` (AvatarSpec type), `src/avatarManager.ts`, `src/RoomCanvas.tsx`

- Add `displayName?: string` to `AvatarSpec`
- In `RoomCanvas.tsx` `agentCreated` handler: pass `msg.terminalName` through to `spawnAvatar`
- In `avatarManager.ts` `spawnAvatar`: accept and store `displayName`
- In `RoomCanvas.tsx` nametag rendering: use `avatar.displayName || avatar.id`

### 3. Add name truncation safety
**File**: `src/isoNameTagRenderer.ts`

Pass `maxWidth` (e.g., 120px) to `fillText()` as a safety guard for any unexpectedly long names.

### 4. Clean up speech bubble text
**File**: `src/RoomCanvas.tsx`

- Skip bubble rendering during `spawning`/`despawning` states
- Clear `agentToolTextRef` entry when agent status goes `idle`
- Remove fallback to `avatar.state` string — let `isWaiting: true` handle the idle `...` animation

### 5. Face desk on arrival
**Files**: `src/RoomCanvas.tsx`, `src/avatarManager.ts`

- Add direction to `DESK_TILES`: `{ x: 5, y: 3, dir: 0 }` etc.
- Add optional `arrivalDirection` to `moveAvatarTo()` signature
- On path completion in `tick()`, apply `arrivalDirection` if provided

### 6. Cap speech bubble height
**File**: `src/isoBubbleRenderer.ts`

Limit wrapped text to 3 lines max. Truncate with "..." if text overflows.

---

## Files Summary

| Task | Files |
|------|-------|
| 1 | `src/isoAvatarRenderer.ts` |
| 2 | `src/isoAvatarRenderer.ts`, `src/avatarManager.ts`, `src/RoomCanvas.tsx` |
| 3 | `src/isoNameTagRenderer.ts` |
| 4 | `src/RoomCanvas.tsx` |
| 5 | `src/RoomCanvas.tsx`, `src/avatarManager.ts` |
| 6 | `src/isoBubbleRenderer.ts` |

## Verification

1. Start extension → avatar spawns with animation, then goes idle
2. Name tag shows "Claude 1" (not UUID)
3. No bubble visible during spawn animation
4. Idle bubble shows animated "..." only (no "idle" text)
5. Start Claude session → agent walks to desk, faces correct direction on arrival
6. End session → avatar plays despawn animation and disappears
7. Long tool text wraps but caps at 3 lines
8. `npm test` passes