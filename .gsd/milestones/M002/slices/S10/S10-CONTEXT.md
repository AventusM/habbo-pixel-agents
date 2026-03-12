# Phase 17: Bugfixes & Wishlist - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning
**Source:** Direct user feedback after Phase 14.1 execution

<domain>
## Phase Boundary

This phase addresses three issues identified during visual testing of Phase 14.1 (avatar facial features) plus a UI improvement for the avatar builder modal. All items are incremental fixes to existing systems.

</domain>

<decisions>
## Implementation Decisions

### Bug: Stray particle when avatars face sideways
- When avatars are in sideways position (directions 1, 3, 5), a small pixel/particle appears approximately one tile away from the avatar
- Must investigate root cause in face rendering offset calculations in `src/isoAvatarRenderer.ts`
- The face sprite offsets (e.g., x:-37 for eyes at dir 1) differ significantly from body offsets (x:-18 for head) — the TILE_W_HALF correction may interact differently
- Debug with `DEBUG_AVATAR_PARTS = true` to trace actual sprite positions

### Bug: Sideways face detail insufficient
- Face sprites exist for all visible directions (1, 2, 3) with varying detail levels
- Direction 1 (3/4 view): eyes 4-6px, mouth 8x11px
- Direction 2 (front): eyes 10x9px, mouth 6x10px
- Direction 3 (near-profile): eyes 14-18px wide, mouth 6x6px
- All 11 eye styles (setIds 1-11) have sprites for all 3 directions
- Investigate whether sprites render correctly at all sideways angles, or if offset/tinting issues make them invisible

### Feature: Avatar editor as non-blocking inline panel
- Currently: left-clicking an avatar opens AvatarBuilderModal as full-screen fixed overlay (`position: fixed`, z-index 1000)
- Currently: the click handler at RoomCanvas.tsx:562-565 opens the modal and returns immediately, blocking click-to-move
- Desired: avatar editor panel rendered below LayoutEditorPanel, not as a modal
- Desired: clicking an avatar should NOT block manual moving — editor should be non-blocking

### Claude's Discretion
- Technical approach for converting modal to inline panel
- How to handle the click interaction change (e.g., double-click vs single-click for editor, or a dedicated edit button)
- Whether to keep wardrobe functionality in the inline panel or simplify

</decisions>

<specifics>
## Specific Ideas

- The face rendering code at isoAvatarRenderer.ts:634-655 handles ey/fc parts with direction filtering
- Face offset data from converted hh_human_face.json: eyes dir 1 offset x:-37,y:61; dir 2 offset x:-33,y:62; dir 3 offset x:-26,y:58
- Body head offset for comparison: dir 1 x:-18,y:73; dir 2 x:-20,y:74
- AvatarBuilderModal.tsx is a self-contained React component at 559 lines
- LayoutEditorPanel is rendered above the canvas in RoomCanvas.tsx:812
- The avatar click handler is in the handleClick function around RoomCanvas.tsx:548-565

</specifics>

<deferred>
## Deferred Ideas / Backlog

### Avatar Builder fixes (from Phase 16 verification)
- Avatar Builder Role Outfits tab needs polish — currently "ok" but needs further work
- Role outfit presets use simple color-differentiated shirts; consider adding more visual variety per team
- Avatar Builder modal UX needs review (tab switching, outfit preview rendering quality)

### Furniture rendering improvements
- Native Habbo furniture frame states (on/off) require additive blending (`globalCompositeOperation: 'lighter'`) in the sprite renderer — currently using canvas overlay glow as workaround
- Lamp glow layers (hc_lmp b/c frames 1+) and TV screen layers (tv_flat b/e) have dark pixel data meant for additive compositing
- Section furniture layout is simplified (1 lamp per section) — restore full themed furniture (desks, chairs, bookshelves, server racks) when room size supports it without overcrowding
- Room "small" template is too cramped for full furniture sets — consider making "medium" the default or improving furniture placement spacing

### Layout editor
- Old in-webview LayoutEditorPanel is hidden (`{false && ...}`) but not removed — clean up when sidebar controls are stable
- Sidebar furniture preview rotation works but some items with complex source chains may not preview perfectly

</deferred>

---

*Phase: 17-bugfixes-and-wishlist*
*Context gathered: 2026-03-07 via direct user feedback*
