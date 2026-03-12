---
id: S06
parent: M002
milestone: M002
provides:
  - OutfitConfig type defining per-avatar clothing and color selections
  - CatalogItem type and FIGURE_CATALOG with 28 curated items across 5 categories
  - Color palettes (SKIN_PALETTE, HAIR_PALETTE, CLOTHING_PALETTE)
  - 8 DEFAULT_PRESETS for visual variety on new agent spawn
  - outfitToFigureParts converter for renderer integration
  - getRequiredAssets for lazy asset loading
  - 14 new cortex-assets figure downloads (20 total figure assets)
  - Dynamic OutfitConfig-driven avatar rendering (replaces hardcoded FIGURE_PARTS when present)
  - buildFrameKey accepting custom figureParts for outfit-specific clothing setIds
  - AvatarManager assigns default preset outfits on spawn with saved outfit support
  - Extension host persistence for avatar outfits via .habbo-agents/avatars.json
  - saveAvatar/loadAvatars message types for webview-extension communication
  - AvatarBuilderModal React component with category tabs, gender toggle, icon grids, color palettes, preview canvas, wardrobe presets
  - renderAvatarPreview standalone function for drawing tinted avatar at direction 2
  - Click-to-open builder flow replacing avatar selection toggle
  - Outfit save flow persisting to extension host via postMessage
  - Canvas interaction blocking while builder modal is open
requires: []
affects: []
key_files: []
key_decisions:
  - "Replaced Shirt_F_Tshirt_Plain with Shirt_F_Schoolshirt (Tshirt_Plain has no JSON in cortex-assets)"
  - "All catalog setIds validated against actual converted asset frame keys"
  - "Multi-setId assets get separate catalog entries (e.g., Hair_U_Multi_Colour has 2068 and 2069)"
  - "Import PartType from avatarOutfitConfig.ts instead of duplicating locally in renderer"
  - "DEFAULT_FIGURE_PARTS and DEFAULT_VARIANT_OUTFITS renamed from originals as explicit fallback constants"
  - "AvatarManager stores savedOutfits map for late-spawning avatar outfit application"
  - "Standalone preview renderer duplicates tinting logic from isoAvatarRenderer.ts (intentional decoupling per research)"
  - "Avatar click opens builder instead of toggling selection (builder replaces selection as primary click action)"
  - "webview.tsx already had loadAvatars message from Plan 02 — no changes needed"
patterns_established:
  - "CatalogItem with asset+setId pattern for figure part selection"
  - "outfitToFigureParts converts high-level outfit to 11-part renderer record"
  - "Dynamic outfit rendering: spec.outfit present -> outfitToFigureParts, absent -> DEFAULT_FIGURE_PARTS"
  - "Extension persistence pattern: .habbo-agents/avatars.json read/write with mkdirSync fallback"
  - "Modal overlay pattern: fixed positioning with backdrop click-to-close and event propagation blocking"
  - "Preview canvas pattern: useEffect re-renders on outfit state change with lazy asset loading"
observability_surfaces: []
drill_down_paths: []
duration: 3min
verification_result: passed
completed_at: 2026-03-07
blocker_discovered: false
---
# S06: Avatar Builder Ui

**# Phase 14 Plan 01: Outfit Data Foundation Summary**

## What Happened

# Phase 14 Plan 01: Outfit Data Foundation Summary

**OutfitConfig type system with 28 curated clothing items, color palettes, 8 default presets, and 14 new cortex-assets figure downloads**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-07T10:04:32Z
- **Completed:** 2026-03-07T10:12:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- OutfitConfig and CatalogItem type system with full field definitions and helper functions
- 28 curated FIGURE_CATALOG items across 5 categories (hair, tops, bottoms, shoes, accessories) with validated setIds
- 8 DEFAULT_PRESETS providing visual variety (6 male + 2 female outfits)
- 14 new figure assets downloaded from cortex-assets and converted to Nitro format (20 total, 40 files)
- 24 unit tests covering catalog validation, gender filtering, preset wrapping, and part mapping (301 total tests passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create outfit config types, catalog, palettes, and default presets** - `f2cbce1` (feat)
2. **Task 2: Add new figure assets to download script** - `572f0c5` (feat)

## Files Created/Modified
- `src/avatarOutfitConfig.ts` - OutfitConfig/CatalogItem types, FIGURE_CATALOG (28 items), color palettes, DEFAULT_PRESETS (8), helper functions
- `tests/avatarOutfitConfig.test.ts` - 24 unit tests for catalog, filtering, presets, and conversions
- `scripts/download-habbo-assets.mjs` - Extended FIGURE_ITEMS with 14 new figure asset names

## Decisions Made
- Replaced `Shirt_F_Tshirt_Plain` with `Shirt_F_Schoolshirt` because the Tshirt_Plain directory in cortex-assets contains only a PNG (no JSON metadata), making it unconvertible
- All catalog setIds were validated against actual converted asset frame keys rather than using plan-estimated values
- Multi-setId assets receive separate catalog entries (Hair_U_Multi_Colour: 2068/2069, Shirt sleeved variants, Trousers_U_runway: 2149/2150, hats with variants)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shirt_F_Tshirt_Plain missing JSON in cortex-assets**
- **Found during:** Task 2 (downloading new figure assets)
- **Issue:** `Shirt_F_Tshirt_Plain` directory in CakeChloe/cortex-assets only contains a PNG, no JSON metadata file. Download returned HTTP 404 for the JSON.
- **Fix:** Replaced with `Shirt_F_Schoolshirt` which has both JSON and PNG. Updated catalog and preset references.
- **Files modified:** scripts/download-habbo-assets.mjs, src/avatarOutfitConfig.ts
- **Verification:** Download completes without errors, conversion succeeds
- **Committed in:** 572f0c5 (Task 2 commit)

**2. [Rule 1 - Bug] Catalog setIds did not match actual cortex-assets frame keys**
- **Found during:** Task 2 (verifying converted assets)
- **Issue:** Plan-estimated setIds (2051-2056, 2099-2103) were placeholders. Actual cortex-assets setIds differ significantly (e.g., Shirt_F_Cardigan uses 2123 not 2054, Shoes_F_Schoolshoes uses 2107 not 2101).
- **Fix:** Queried all converted JSON files to extract actual setIds from frame keys. Updated every catalog entry and default preset to use correct values.
- **Files modified:** src/avatarOutfitConfig.ts
- **Verification:** All 24 unit tests pass, 301 total tests pass
- **Committed in:** 572f0c5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes essential for correctness. Using wrong setIds would cause invisible/missing clothing parts. Catalog grew from 21 to 28 items due to multi-setId assets.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OutfitConfig type system ready for Plan 02 (renderer integration)
- All 20 figure assets downloaded and converted for Plan 03 (builder UI)
- outfitToFigureParts provides the bridge between OutfitConfig and the existing FIGURE_PARTS format in isoAvatarRenderer.ts

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 14-avatar-builder-ui*
*Completed: 2026-03-07*

# Phase 14 Plan 02: Renderer Integration and Persistence Summary

**Dynamic OutfitConfig wired into avatar renderer with per-agent outfit persistence via .habbo-agents/avatars.json**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T10:16:15Z
- **Completed:** 2026-03-07T10:19:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Avatar renderer uses dynamic OutfitConfig for clothing and colors when present, falls back to variant-based defaults when absent (backward compatible)
- buildFrameKey accepts custom figureParts parameter, enabling outfit-specific clothing setIds in frame key construction
- AvatarManager assigns default preset outfits on spawn and supports saved outfit restoration for late-spawning avatars
- Extension host reads/writes .habbo-agents/avatars.json for outfit persistence across reload
- New message types (saveAvatar, loadAvatars, avatarOutfits) enable webview-extension outfit communication
- 8 new tests covering dynamic outfit rendering, buildFrameKey with custom parts, and backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Make renderer use dynamic OutfitConfig and add persistence message types** - `6f6fc90` (feat)
2. **Task 2: Add outfit to avatar spawn flow and extension host persistence** - `6f677e2` (feat)

## Files Created/Modified
- `src/isoAvatarRenderer.ts` - Dynamic outfit rendering with outfitToFigureParts, renamed fallback constants, exported buildFrameKey
- `src/agentTypes.ts` - Added saveAvatar/loadAvatars WebviewMessage and avatarOutfits ExtensionMessage types
- `src/avatarManager.ts` - Default preset outfit on spawn, setAvatarOutfit, loadAvatarOutfits with savedOutfits map
- `src/extension.ts` - saveAvatar writes to .habbo-agents/avatars.json, loadAvatars reads and sends to webview
- `src/webview.tsx` - Sends loadAvatars after ready message
- `src/RoomCanvas.tsx` - Handles avatarOutfits message, applies to AvatarManager
- `tests/isoAvatarRenderer.test.ts` - 8 new tests for dynamic outfit, buildFrameKey, backward compatibility

## Decisions Made
- Imported PartType from avatarOutfitConfig.ts and removed the local duplicate in isoAvatarRenderer.ts to maintain a single source of truth
- Renamed FIGURE_PARTS to DEFAULT_FIGURE_PARTS and VARIANT_OUTFITS to DEFAULT_VARIANT_OUTFITS to make fallback behavior explicit
- AvatarManager stores a savedOutfits map so outfits loaded before an agent spawns are applied when the agent eventually spawns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All renderer and persistence infrastructure in place for Plan 03 (Avatar Builder UI modal)
- outfitToFigureParts bridge working, saveAvatar message type ready for builder modal save button
- 309 total tests passing (8 new)

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 14-avatar-builder-ui*
*Completed: 2026-03-07*

# Phase 14 Plan 03: Avatar Builder Modal UI Summary

**Avatar builder modal with live preview, clothing/color customization, gender toggle, wardrobe presets, and click-to-open/save flow wired into room canvas**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T10:22:40Z
- **Completed:** 2026-03-07T10:25:53Z
- **Tasks:** 2 (+ 1 auto-approved checkpoint)
- **Files modified:** 3

## Accomplishments
- AvatarBuilderModal component with 5 clothing categories, gender toggle, icon grid, skin/clothing color palettes, live preview canvas, and wardrobe preset slots
- Standalone avatarBuilderPreview renderer drawing tinted 11-layer avatar at direction 2 (front-facing)
- Click-on-avatar opens builder modal, save applies outfit immediately and persists to extension host
- Canvas interaction blocked while modal is open to prevent accidental tile/avatar clicks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create avatar preview renderer and builder modal component** - `2cb2d30` (feat)
2. **Task 2: Wire avatar click to open builder and handle outfit save flow** - `c0e1bc0` (feat)
3. **Task 3: Visual verification (auto-approved)** - No commit (checkpoint)

## Files Created/Modified
- `src/avatarBuilderPreview.ts` - Standalone preview renderer with tinted 11-layer composition at direction 2, PREVIEW_WIDTH/PREVIEW_HEIGHT constants
- `src/AvatarBuilderModal.tsx` - React modal with category tabs, gender toggle (M/F), icon grid (4-col), skin palette (8 swatches), hair palette (12), clothing palette (16), wardrobe slots (up to 4), save/cancel buttons
- `src/RoomCanvas.tsx` - Added isBuilderOpen state/ref, builder guard in handleClick, avatar click opens builder instead of toggling selection, handleBuilderSave/Close handlers, AvatarBuilderModal conditional render in JSX

## Decisions Made
- Preview renderer intentionally duplicates tinting logic from isoAvatarRenderer.ts rather than exporting the shared function, per research anti-pattern guidance — the preview is simpler (no spawn clipping, no walk animation) and decoupled from the room render loop
- Avatar click now opens the builder modal instead of toggling selection; selection manager is preserved for click-to-move scenarios (selected avatar walks to clicked tile)
- No changes to webview.tsx needed because Plan 02 already added the loadAvatars message after ready

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 (Avatar Builder UI) is now complete with all 3 plans delivered
- Full outfit customization pipeline operational: data types -> renderer integration -> builder UI
- 309 total tests passing (no regressions)

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 14-avatar-builder-ui*
*Completed: 2026-03-07*
