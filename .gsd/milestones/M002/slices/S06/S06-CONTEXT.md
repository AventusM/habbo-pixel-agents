# Phase 14: Avatar Builder UI - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add avatar builder UI, clothing selection, and wardrobe customisation — building on the existing 11-layer Nitro figure composition. Users can click an agent's avatar in the room to open the builder, customise their look with clothing/color options, and save per-agent outfits. New agents spawn with randomised default looks from a preset pool.

</domain>

<decisions>
## Implementation Decisions

### Builder Interface
- Modal overlay on the room canvas (not a side panel or separate tab)
- Triggered by clicking an avatar in the room
- Live preview — avatar updates instantly as parts/colors change
- Fixed front-facing preview (single direction, classic Habbo builder style)

### Clothing & Parts Categories
- All four categories available: body & head shape, hair & face, tops & bottoms, accessories (hats, glasses, shoes, carried items)
- Options presented as an icon grid of small sprite previews (classic Habbo style)
- Curated set of ~20-40 items that look good together (not all available Habbo parts)
- Gender toggle (Male/Female) filters which parts are shown, like classic Habbo

### Wardrobe & Persistence
- Saved to local JSON file (e.g., `.habbo-agents/avatars.json` in project root) — can be committed to git
- Per-agent looks — each spawned agent (Claude 1, Claude 2...) can have a different saved appearance
- Wardrobe with presets — save multiple outfits per agent, switch between them
- New agents spawn with a random look from built-in default presets (visual variety out of the box)

### Color & Style
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

</decisions>

<specifics>
## Specific Ideas

- Classic Habbo avatar builder is the reference — gender toggle, icon grids, palette swatches
- Builds on existing 11-layer Nitro figure composition system already in the codebase
- Default presets should provide enough variety that a room with 3-4 agents looks visually distinct without customisation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-avatar-builder-ui*
*Context gathered: 2026-03-07*
