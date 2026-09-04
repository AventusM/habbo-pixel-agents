# Phase 14: Avatar Builder UI - Research

**Researched:** 2026-03-07
**Domain:** Avatar customisation UI, figure part catalog, wardrobe persistence
**Confidence:** HIGH

## Summary

Phase 14 adds an avatar builder modal overlay that lets users click an agent avatar and customise its appearance using clothing, hair, accessories, and color palettes. The existing codebase already has a complete 11-layer Nitro figure composition system (`isoAvatarRenderer.ts`) with per-part color tinting via Canvas multiply blend mode. The builder extends this by making the `FIGURE_PARTS` registry and `VARIANT_OUTFITS` color map dynamic and per-agent instead of hardcoded.

The core architecture is straightforward: a React modal component renders over the canvas, the avatar preview renders in a small dedicated canvas using the existing `drawTintedBodyPart()` machinery, and outfit selections are stored per-agent in a JSON file managed by the extension host. The asset pipeline already downloads and converts cortex-assets figures; it just needs more clothing items added to the `FIGURE_ITEMS` list.

**Primary recommendation:** Build the avatar builder as a React modal with an embedded Canvas preview, backed by a dynamic outfit configuration system that replaces the hardcoded `FIGURE_PARTS` and `VARIANT_OUTFITS` in `isoAvatarRenderer.ts`. Persistence goes through the extension host writing to a local JSON file.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Modal overlay on the room canvas (not a side panel or separate tab)
- Triggered by clicking an avatar in the room
- Live preview — avatar updates instantly as parts/colors change
- Fixed front-facing preview (single direction, classic Habbo builder style)
- All four categories available: body & head shape, hair & face, tops & bottoms, accessories (hats, glasses, shoes, carried items)
- Options presented as an icon grid of small sprite previews (classic Habbo style)
- Curated set of ~20-40 items that look good together (not all available Habbo parts)
- Gender toggle (Male/Female) filters which parts are shown, like classic Habbo
- Saved to local JSON file (e.g., `.habbo-agents/avatars.json` in project root) — can be committed to git
- Per-agent looks — each spawned agent (Claude 1, Claude 2...) can have a different saved appearance
- Wardrobe with presets — save multiple outfits per agent, switch between them
- New agents spawn with a random look from built-in default presets (visual variety out of the box)
- Habbo palette swatches — fixed color palette grid per category (authentic Habbo feel)
- Per-part colors — each clothing piece has its own color selection (shirt, pants, etc. independently)
- Separate skin tone palette (dedicated realistic range, distinct from clothing colors)
- Hair color gets its own palette including natural tones plus fun colors (blue, pink, green)

### Claude's Discretion
- Modal layout and dimensions
- Category tab/navigation design within the modal
- Number and composition of built-in default presets
- Exact palette colors (can reference Habbo's original palettes)
- How wardrobe preset switching UI works within the modal
- Icon grid sizing and spacing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | existing | Modal overlay + category tabs + icon grids | Already used for LayoutEditorPanel + RoomCanvas |
| Canvas 2D | built-in | Live avatar preview rendering | Reuses existing drawTintedBodyPart tinting pipeline |
| cortex-assets figures | master | Source figure spritesheets (hair, shirts, pants, shoes, accessories) | Already integrated via download + convert scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node fs (extension host) | built-in | Read/write avatars.json persistence file | Saving/loading outfit data |
| VS Code webview messaging | existing | Extension host <-> webview communication for save/load | Already used for agent events, kanban cards |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React modal | Pure Canvas UI | React is already used for LayoutEditorPanel; HTML/CSS gives proper text input, scroll, hover states for free |
| Local JSON file | VS Code globalState/workspaceState | JSON file is git-committable per user requirement; VS Code state is opaque storage |
| Embedded Canvas preview | drawImage to main canvas | Separate preview canvas avoids interference with room render loop |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── AvatarBuilderModal.tsx     # React modal component (UI chrome)
├── avatarBuilderPreview.ts    # Canvas preview renderer (reuses drawTintedBodyPart)
├── avatarOutfitConfig.ts      # Outfit type definitions, default presets, catalog registry
├── avatarPersistence.ts       # Extension-host-side: read/write .habbo-agents/avatars.json
├── isoAvatarRenderer.ts       # MODIFIED: accept dynamic OutfitConfig instead of hardcoded FIGURE_PARTS
├── avatarManager.ts           # MODIFIED: attach OutfitConfig per AvatarSpec
├── agentTypes.ts              # MODIFIED: new message types for builder open/save
└── extension.ts               # MODIFIED: handle avatar save/load messages
```

### Pattern 1: Dynamic Outfit Configuration
**What:** Replace the hardcoded `FIGURE_PARTS` and `VARIANT_OUTFITS` in `isoAvatarRenderer.ts` with a per-avatar `OutfitConfig` stored on the `AvatarSpec`.
**When to use:** Always — this is the core data model change.
**Example:**
```typescript
// Source: derived from existing FIGURE_PARTS + VARIANT_OUTFITS pattern
interface OutfitConfig {
  gender: 'M' | 'F';
  parts: {
    body: { asset: string; setId: number };    // hh_human_body setId 1
    head: { asset: string; setId: number };    // hh_human_body setId 1-4 (head shape)
    hair: { asset: string; setId: number };    // e.g., Hair_M_yo setId 2096
    shirt: { asset: string; setId: number };   // e.g., Shirt_M_Tshirt_Plain setId 2050
    pants: { asset: string; setId: number };   // e.g., Trousers_U_Skinny_Jeans setId 2097
    shoes: { asset: string; setId: number };   // e.g., Shoes_U_Slipons setId 2044
    hat?: { asset: string; setId: number };    // optional accessory slots
    glasses?: { asset: string; setId: number };
  };
  colors: {
    skin: string;     // hex color
    hair: string;
    shirt: string;
    pants: string;
    shoes: string;
  };
}
```

### Pattern 2: Canvas Preview Inside React Modal
**What:** The modal contains a small `<canvas>` element for the live avatar preview. React manages the UI chrome (tabs, grids, palette swatches). The preview canvas calls the same `drawTintedBodyPart()` function used by the main renderer.
**When to use:** For the live preview panel.
**Example:**
```typescript
// In AvatarBuilderModal.tsx
const previewCanvasRef = useRef<HTMLCanvasElement>(null);

useEffect(() => {
  const canvas = previewCanvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // Render avatar with current outfit config, direction 2 (front-facing)
  renderAvatarPreview(ctx, currentOutfit, spriteCache);
}, [currentOutfit]);
```

### Pattern 3: Extension Host Persistence via Message Passing
**What:** The webview sends outfit data to the extension host via `postMessage`. The extension host writes to `.habbo-agents/avatars.json` in the workspace root. On load, the extension host reads the file and sends data back.
**When to use:** For all save/load operations.
**Example:**
```typescript
// Webview -> extension host
vscodeApi.postMessage({ type: 'saveAvatar', agentId: 'abc', outfit: outfitConfig });

// Extension host
case 'saveAvatar': {
  const avatarsPath = path.join(workspaceDir, '.habbo-agents', 'avatars.json');
  // Read existing, merge, write back
}
```

### Pattern 4: Curated Figure Catalog
**What:** A static registry of ~20-40 clothing items with display metadata, organized by category and gender. Each entry maps to a cortex-assets figure name and setId.
**When to use:** For populating the icon grid and filtering by gender/category.
**Example:**
```typescript
interface CatalogItem {
  id: string;           // unique key
  asset: string;        // cortex-assets figure name (e.g., "Shirt_M_Tshirt_Plain")
  setId: number;        // Habbo setId (e.g., 2050)
  partType: PartType;   // which body slot (ch, lg, sh, hr, etc.)
  category: 'hair' | 'tops' | 'bottoms' | 'shoes' | 'accessories';
  gender: 'M' | 'F' | 'U'; // U = unisex
  displayName: string;
}

const FIGURE_CATALOG: CatalogItem[] = [
  { id: 'hair-m-yo', asset: 'Hair_M_yo', setId: 2096, partType: 'hr', category: 'hair', gender: 'M', displayName: 'Classic' },
  { id: 'hair-u-messy', asset: 'Hair_U_Messy', setId: 2071, partType: 'hr', category: 'hair', gender: 'U', displayName: 'Messy' },
  // ...
];
```

### Anti-Patterns to Avoid
- **Rendering preview in the main rAF loop:** The preview canvas should be independent. The main room render loop should not be aware of the builder UI at all. Render the preview on-demand when outfit changes, not every frame.
- **Storing outfit data in React state for the room renderer:** The room renderer reads from `AvatarSpec` via refs. Outfit config must be on the spec object, not in React state, to avoid stale closure bugs (ROOM-11 requirement).
- **Loading all cortex-assets figures at startup:** Only load assets that are actually selected. Use lazy loading when the builder opens — preload assets for the current outfit, load others as the user browses categories.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color tinting | Custom shader or pixel manipulation | Existing `drawTintedBodyPart()` with multiply blend | Already handles flip, offset, alpha masking correctly |
| Direction mirroring | Manual sprite flipping per preview | Existing `mapBodyDirection()` + XOR flip logic | Handles all 8 directions including mirrored sprites |
| Frame key construction | String concatenation ad-hoc | Existing `buildFrameKey()` function | Handles action states, setId mapping, direction mapping |
| Sprite loading | Custom fetch + decode | Existing `SpriteCache.loadNitroAsset()` | Handles ImageBitmap creation, manifest parsing, source chains |
| File persistence format | Custom binary format | Simple JSON with `JSON.parse`/`JSON.stringify` | User requirement says "can be committed to git" — needs to be human-readable |

**Key insight:** The existing `isoAvatarRenderer.ts` already contains all the rendering logic needed. The builder UI is purely additive — it provides a UI to configure what the renderer already knows how to draw.

## Common Pitfalls

### Pitfall 1: SetId Mismatch Between Catalog and Assets
**What goes wrong:** The catalog entry specifies a setId that doesn't match the actual asset's frame keys, causing invisible/missing parts.
**Why it happens:** Each cortex-assets figure file can contain multiple setIds (e.g., Hair_U_Messy has setIds 2071 and 2072). Using the wrong setId produces frame keys that don't exist in the asset.
**How to avoid:** Validate each catalog entry by checking that `h_std_{partType}_{setId}_2_0` exists in the asset's frame keys during development.
**Warning signs:** Parts rendering as invisible in the preview (no errors, just missing sprites).

### Pitfall 2: Gender-Specific Assets Missing Walk/Sit Frames
**What goes wrong:** A female-only shirt renders fine in idle but disappears during walk animation.
**Why it happens:** Some figure assets only have `h_std_*` frames and lack `h_wlk_*` or `h_sit_*` frames. The renderer falls back to std, but only if the fallback logic works correctly.
**How to avoid:** The existing renderer already has fallback: `if (!frame && (stateForFrame === 'walk' || stateForFrame === 'sit'))` tries idle. Verify this works for all new catalog items.
**Warning signs:** Clothing flickering during walk cycle.

### Pitfall 3: React Modal Not Receiving Canvas Events
**What goes wrong:** Clicking the avatar to open the builder also triggers tile click handling, causing the avatar to deselect or move.
**Why it happens:** The canvas `onClick` handler in `RoomCanvas.tsx` processes all clicks. When the modal is open, clicks on the modal should not propagate to the canvas.
**How to avoid:** The modal should be a React overlay `<div>` with `position: absolute` above the canvas. React's event system naturally prevents propagation. Add an `isBuilderOpen` ref that the canvas click handler checks early.
**Warning signs:** Clicking buttons in the builder causes avatars to move or deselect.

### Pitfall 4: Stale Outfit in Room Renderer
**What goes wrong:** Changing outfit in the builder doesn't update the avatar in the room.
**Why it happens:** Room renderer reads from `AvatarSpec` via ref, not React state. If outfit is stored in React state and not synced to the spec, the rAF loop sees stale data.
**How to avoid:** Store the outfit config directly on `AvatarSpec` and mutate it in place when the user saves. The rAF loop will pick up changes on the next frame.
**Warning signs:** Preview shows new outfit but room avatar stays old.

### Pitfall 5: Assets Not Loaded Before Preview Renders
**What goes wrong:** Preview canvas shows nothing because the selected clothing asset hasn't been loaded into the SpriteCache yet.
**Why it happens:** Only currently-used figure assets are loaded at startup (from `manifest.json`). New clothing items added to the catalog need their assets loaded first.
**How to avoid:** When the builder opens, check which assets are loaded via `spriteCache.hasNitroAsset()`. Load missing ones before rendering. Show a loading indicator if assets are still loading.
**Warning signs:** Empty preview canvas with no errors.

### Pitfall 6: Persistence File Race Conditions
**What goes wrong:** Two quick saves overwrite each other.
**Why it happens:** Async file write in extension host doesn't wait for previous write to complete.
**How to avoid:** Use synchronous `fs.writeFileSync` (acceptable for small JSON files) or queue writes. The kanban/layout patterns in the codebase use sync reads.
**Warning signs:** Lost outfit customisations after rapid saves.

## Code Examples

### Current Avatar Rendering Pipeline (how it works today)
```typescript
// Source: src/isoAvatarRenderer.ts lines 269-281
// Hardcoded part registry — THIS is what becomes dynamic
const FIGURE_PARTS: Record<PartType, { asset: string; setId: number }> = {
  bd: { asset: 'hh_human_body', setId: 1 },
  lh: { asset: 'hh_human_body', setId: 1 },
  rh: { asset: 'hh_human_body', setId: 1 },
  hd: { asset: 'hh_human_body', setId: 1 },
  hr: { asset: 'Hair_M_yo', setId: 2096 },
  hrb: { asset: 'Hair_M_yo', setId: 2096 },
  ch: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
  ls: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
  rs: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
  lg: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
  sh: { asset: 'Shoes_U_Slipons', setId: 2044 },
};
```

### Current Color Tinting (reuse as-is)
```typescript
// Source: src/isoAvatarRenderer.ts lines 316-359
// Per-variant hardcoded colors — THIS becomes dynamic per-agent
const VARIANT_OUTFITS: OutfitColors[] = [
  { skin: '#EFCFB1', hair: '#4A3728', shirt: '#5B9BD5', pants: '#3B5998', shoes: '#2C2C2C' },
  // ... 5 more variants
];
```

### Extension Host Message Pattern (existing pattern to follow)
```typescript
// Source: src/extension.ts lines 131-184
// This is how webview <-> extension host communication works
panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
  switch (msg.type) {
    case 'ready': { /* ... */ }
    case 'devCapture': { /* ... */ }
    // Add: case 'saveAvatar': { /* write to .habbo-agents/avatars.json */ }
    // Add: case 'loadAvatars': { /* read and send back */ }
  }
});
```

### Canvas Click Handler Pattern (existing, needs guard)
```typescript
// Source: src/RoomCanvas.tsx lines 538-555
// Currently: clicking an avatar toggles selection
// New: clicking an avatar while in view mode opens the builder
const clickedAvatar = avatarManager.getAvatarAtTile(tileX, tileY);
if (clickedAvatar) {
  // CURRENT: toggle selection
  // NEW: open builder modal for this avatar
}
```

## Asset Catalog Design

### Available Cortex-Assets Figures (already converted)
| Asset Name | SetId(s) | Parts | Gender |
|------------|----------|-------|--------|
| hh_human_body | 1-4, 999 | bd, lh, rh, hd | U |
| Hair_M_yo | 2096 | hr, hrb | M |
| Hair_U_Messy | 2071, 2072 | hr, hrb | U |
| Shirt_M_Tshirt_Plain | 2050 | ch, ls, rs | M |
| Trousers_U_Skinny_Jeans | 2097 | lg | U |
| Shoes_U_Slipons | 2044 | sh | U |

### Recommended Additional Downloads (to reach ~20-40 curated items)
Based on cortex-assets/figures directory listing:

**Hair (4 styles, 2 per gender):**
| Asset | Gender | Style |
|-------|--------|-------|
| Hair_F_Bob | F | Bob cut |
| Hair_U_Multi_Colour | U | Multi-colour |

**Shirts/Tops (8+ items):**
| Asset | Gender | Style |
|-------|--------|-------|
| Shirt_F_Tshirt_Plain | F | Plain tee |
| Shirt_F_Tshirt_Sleeved | F | Sleeved tee |
| Shirt_F_Cardigan | F | Cardigan |
| Shirt_M_Tshirt_Sleeved | M | Sleeved tee |
| Shirt_M_Cardigan | M | Cardigan |
| Shirt_F_Punk_Shirt | F | Punk shirt |

**Bottoms (3+ items):**
| Asset | Gender | Style |
|-------|--------|-------|
| Trousers_U_Sraight | U | Straight jeans |
| Trousers_U_runway | U | Runway pants |
| Trousers_F_Leather_skirt | F | Leather skirt |

**Shoes (1+ items):**
| Asset | Gender | Style |
|-------|--------|-------|
| Shoes_F_Schoolshoes | F | School shoes |

**Accessories:**
| Asset | Gender | Type |
|-------|--------|------|
| Hat_U_sombrero | U | Hat |
| Hat_U_urban | U | Hat |
| acc_eye_U_sunglasses* | U | Glasses |

**Total catalog estimate:** ~25-30 curated items across all categories.

### Recommended Color Palettes

**Skin Tones (8 swatches):**
```
#FCEBD6, #F5D6C3, #EFCFB1, #D4A574, #C49060, #9E6B4A, #7D5238, #5C3A1E
```

**Hair Colors (12 swatches — naturals + fun):**
```
#1A1A1A, #4A3728, #8B6914, #C4651A, #D4A017, #E0E0E0,  // naturals
#D55B5B, #5B9BD5, #5BD55B, #9B5BD5, #FF69B4, #FF8C00   // fun colors
```

**Clothing Colors (16 swatches):**
```
#FFFFFF, #CCCCCC, #666666, #333333,  // neutrals
#D55B5B, #FF8C00, #D5D55B, #5BD55B,  // warm/bright
#5B9BD5, #3B5998, #9B5BD5, #4B0082,  // cool
#8B4513, #556B2F, #800020, #2C2C2C   // earth/dark
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 6 variant outfits | Dynamic per-agent outfit config | Phase 14 | Each agent can have unique appearance |
| variant: 0-5 integer | OutfitConfig object on AvatarSpec | Phase 14 | Unlimited clothing combinations |
| No persistence | .habbo-agents/avatars.json | Phase 14 | Outfits survive extension reload |

**Deprecated/outdated:**
- `variant` field (0-5) on `AvatarSpec`: becomes a fallback index for agents without saved outfits. Default presets map variant indices to full `OutfitConfig` objects.
- `VARIANT_OUTFITS` array: replaced by per-agent outfit colors. Kept as default presets for backward compatibility.

## Data Flow Architecture

```
User clicks avatar in room
  → RoomCanvas.handleClick detects avatar tile
  → Opens AvatarBuilderModal (React state: isBuilderOpen=true)
  → Modal renders with current OutfitConfig from AvatarSpec
  → User changes parts/colors
  → Preview canvas re-renders via drawTintedBodyPart()
  → User clicks "Save"
  → Modal sends outfit to RoomCanvas
  → RoomCanvas updates AvatarSpec.outfit (ref mutation)
  → Room renderer picks up changes on next frame
  → RoomCanvas posts message to extension host: { type: 'saveAvatar', ... }
  → Extension host writes to .habbo-agents/avatars.json
```

## Open Questions

1. **Accessory layer rendering order**
   - What we know: Current 11 layers are hrb, bd, lh, rh, lg, sh, ch, ls, rs, hd, hr. Accessories (hats, glasses) need additional layers.
   - What's unclear: Exact z-order for hat (above hr), glasses (above hd, below hr), chest accessories.
   - Recommendation: Add hat layer after hr in render order. Glasses between hd and hr. Chest accessories between ch and hd. Verify visually.

2. **Walking/sitting animation for new clothing items**
   - What we know: Some cortex-assets figures have walk/sit frames, others only have std frames.
   - What's unclear: Which of the newly-downloaded items have animation frames.
   - Recommendation: The existing fallback in `createNitroAvatarRenderable` handles missing walk/sit frames gracefully (falls back to std). No special handling needed.

3. **Multiple setIds per asset file**
   - What we know: Hair_U_Messy contains setIds 2071 and 2072 (two distinct hairstyles in one file).
   - What's unclear: Whether all multi-setId assets represent genuinely distinct visual items.
   - Recommendation: Treat each setId as a separate catalog entry. The frame key already encodes setId, so the renderer handles this naturally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P14-01 | OutfitConfig type and default presets | unit | `npx vitest run tests/avatarOutfitConfig.test.ts -x` | Wave 0 |
| P14-02 | Dynamic FIGURE_PARTS from OutfitConfig | unit | `npx vitest run tests/isoAvatarRenderer.test.ts -x` | Exists (extend) |
| P14-03 | Persistence read/write JSON | unit | `npx vitest run tests/avatarPersistence.test.ts -x` | Wave 0 |
| P14-04 | Builder modal open/close state | unit | `npx vitest run tests/avatarBuilderModal.test.ts -x` | Wave 0 |
| P14-05 | Catalog filtering by gender | unit | `npx vitest run tests/avatarOutfitConfig.test.ts -x` | Wave 0 |
| P14-06 | Default preset assignment to variants | unit | `npx vitest run tests/avatarOutfitConfig.test.ts -x` | Wave 0 |
| P14-07 | Avatar preview rendering | manual-only | Visual verification | N/A |
| P14-08 | Full builder UI interaction flow | manual-only | Visual verification | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/avatarOutfitConfig.test.ts` — covers P14-01, P14-05, P14-06
- [ ] `tests/avatarPersistence.test.ts` — covers P14-03
- [ ] `tests/avatarBuilderModal.test.ts` — covers P14-04

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/isoAvatarRenderer.ts` — existing 11-layer composition, tinting, direction mapping
- Codebase analysis: `src/avatarManager.ts` — avatar lifecycle, variant assignment
- Codebase analysis: `src/RoomCanvas.tsx` — click handling, React patterns, ref-based render state
- Codebase analysis: `src/extension.ts` — message passing, file I/O patterns
- Codebase analysis: `scripts/download-habbo-assets.mjs` — asset download pipeline
- Codebase analysis: `assets/habbo/figures/` — existing converted figure assets, frame key format

### Secondary (MEDIUM confidence)
- [cortex-assets figuredata.json](https://github.com/CakeChloe/cortex-assets/blob/master/figuredata.json) — palette system, gender, set definitions
- [cortex-assets figuremap.json](https://github.com/CakeChloe/cortex-assets/blob/master/figuremap.json) — asset-to-setId mappings
- [cortex-assets figures directory](https://github.com/CakeChloe/cortex-assets) — available figure assets listing

### Tertiary (LOW confidence)
- Color palette values are educated approximations of Habbo's original palettes. Exact hex values should be verified visually.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entirely based on existing codebase patterns
- Architecture: HIGH — extends proven patterns (LayoutEditorPanel modal, message passing, ref-based state)
- Asset catalog: MEDIUM — cortex-assets directory listing verified, but individual asset quality/completeness not tested until download
- Pitfalls: HIGH — derived from hands-on codebase analysis and known rendering edge cases

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain, no external dependency changes expected)