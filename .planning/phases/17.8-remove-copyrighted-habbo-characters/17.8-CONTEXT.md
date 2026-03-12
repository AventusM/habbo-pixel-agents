# Phase 17.8: Remove Copyrighted Habbo Character Content - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate all copyrighted Habbo character/figure assets and rendering code (cortex-assets figures, multi-layer avatar composition, avatar builder clothing catalog), replacing fully with PixelLab-generated characters. Habbo furniture assets are retained. This is a removal and replacement phase — no new capabilities are added.

</domain>

<decisions>
## Implementation Decisions

### Removal boundary
- Remove ALL figure-related code: isoAvatarRenderer, multi-layer composition logic, figure asset conversion scripts
- Split download-habbo-assets script to keep furniture downloads, remove figure downloads
- Delete converted figure assets from repo entirely (assets/habbo/figures/) — do not keep in gitignored location
- Clean up shared types (NitroAssetData in isoSpriteCache, etc.) — audit and remove figure-specific fields/branches, keep only what furniture needs

### PixelLab character defaults
- Fixed character appearance per agent type — each agent type gets its own unique, visually distinguishable PixelLab character
- Pre-generated static assets committed to repo — no runtime PixelLab API dependency
- Habbo-inspired pixel art style — retro isometric aesthetic but with original non-copyrighted designs
- Generate all agent-type-specific characters as part of this phase (don't assume 17.7 covers all types)

### Avatar builder replacement
- Remove avatar builder UI entirely — no user customization needed since characters are fixed per agent type
- Full cleanup of all routes, navigation links, menu entries, and UI references to the avatar builder
- Delete all clothing/figure catalog data regardless of format
- Add a character legend panel — small UI showing which character appearance maps to which agent type
- Room view remains the primary way users see agent characters

### Migration approach
- Claude's discretion on removal order (clean sweep vs incremental) — pick safest approach
- Normal commit deletes — no git history cleanup (BFG can be done later if repo size matters)
- Full codebase audit after removal — grep/scan for any remaining figure-related imports, references, or dead code paths
- **CRITICAL: UAT and test verification required** — all tests must pass, nothing should break. Follow test statuses closely throughout the removal process

### Claude's Discretion
- Removal order (single sweep vs incremental steps)
- Exact PixelLab character designs/prompts per agent type
- Character legend panel placement and design

</decisions>

<specifics>
## Specific Ideas

- Characters should be visually distinguishable at a glance — different enough that you can tell agent types apart in the room
- The character legend panel maps agent type → character appearance so users understand what they're seeing
- UAT is absolutely required — this phase touches critical rendering paths and must not break existing functionality
- Test statuses must be monitored throughout to catch regressions early

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17.8-remove-copyrighted-habbo-characters*
*Context gathered: 2026-03-12*
