# T02: 14-avatar-builder-ui 02

**Slice:** S06 — **Milestone:** M002

## Description

Wire the dynamic outfit configuration into the avatar renderer and persistence layer so each agent can have a unique appearance that survives extension reload.

Purpose: Replaces the hardcoded 6-variant system with per-agent OutfitConfig, enabling the builder UI (Plan 03) to actually change how avatars look.
Output: Modified renderer, avatarManager, extension host persistence, message types.

## Must-Haves

- [ ] "Avatar renderer accepts dynamic OutfitConfig instead of hardcoded FIGURE_PARTS"
- [ ] "Each avatar can have a unique outfit with independent clothing and colors"
- [ ] "Outfit data persists to .habbo-agents/avatars.json in workspace root"
- [ ] "New agents spawn with default preset outfits providing visual variety"
- [ ] "Extension host handles save/load avatar messages"

## Files

- `src/isoAvatarRenderer.ts`
- `src/avatarManager.ts`
- `src/agentTypes.ts`
- `src/extension.ts`
- `src/webview.tsx`
- `tests/isoAvatarRenderer.test.ts`
