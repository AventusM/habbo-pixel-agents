# habbo-pixel-agents

## What This Is

A VS Code extension that visualises Claude Code AI agents as animated characters inhabiting a classic Habbo Hotel (v14-era) isometric room. Each Claude Code terminal spawns a distinct character that walks around, sits at desks, and animates based on agent activity in real-time. It is a fork of [pixel-agents](https://github.com/pablodelucca/pixel-agents) with the flat top-down pixel art rendering layer replaced by Habbo Hotel's 2.5D isometric visual style.

## Core Value

Claude Code agents should feel like they're working together in a recognisable Habbo Hotel room — the isometric 2.5D aesthetic must be faithful to the classic v14 era.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Isometric tile grid replaces flat top-down tile grid
- [ ] Classic Habbo v14-era floor and wall tiles rendered correctly
- [ ] Character sprites use Habbo-styled isometric figures (6-variant palette system preserved)
- [ ] All existing agent behaviours retained (walk, idle, type/read, speech bubbles, matrix spawn/despawn)
- [ ] BFS pathfinding adapted to isometric coordinate system
- [ ] Furniture rendering in isometric projection (desk, chair at minimum for agents to sit)
- [ ] Full furniture catalog parity with pixel-agents (all 8 furniture types)
- [ ] Incremental expansion toward full Habbo furni catalog (post-V1 phases)
- [ ] Habbo Hotel classic sound effects replace existing notification chimes
- [ ] Volter/Goldfish font available as an option (Sulake-owned — licensing footnote required)
- [ ] Alternative open-source pixel font used as default
- [ ] Asset pipeline via Nitro project for Habbo sprite extraction
- [ ] Office layout editor works with isometric grid
- [ ] Per-tile colour customisation preserved (HSB system)
- [ ] Sub-agent parent/child visualisation preserved
- [ ] All agent logic, JSONL watching, and Claude Code integration unchanged

### Out of Scope

- VS Code marketplace publishing — personal tool only, no marketplace listing
- Modern Habbo X aesthetic — classic v14 hotel look only
- Custom avatar builder — palette variant system sufficient for V1
- Multiplayer / networked rooms — single-user local extension
- Full Habbo furni catalog in V1 — incremental post-V1 milestone

## Context

**Base project:** [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)
- TypeScript + React 19 + Canvas 2D API (VS Code webview)
- Agent monitoring via JSONL transcript file watching (no Claude Code modification)
- Current rendering: flat top-down grid, 32×32 pixel characters, walls.png tileset
- Sprite system: palette-based colorisation, 6 character variants, 4-direction animation

**Asset pipeline:** [Nitro project](https://github.com/billsonnn/nitro-react) — modern TypeScript Habbo client that handles isometric rendering and SWF-based asset extraction. Most directly relevant to this stack.

**Reference emulator:** [Kepler](https://github.com/Quackster/Kepler) — Java v14 Habbo Hotel emulator. Useful for furnidata/figuredata schema reference.

**Fonts:** [Goldfish](https://github.com/eonu/goldfish) — Volter and Volter Bold, official Habbo Hotel pixel fonts by Sulake. Available as TTF/WOFF/WOFF2. Sulake-owned; licensing must be noted clearly if used.

**Rendering change required:** The current Canvas 2D renderer uses simple top-down drawing. Habbo's isometric 2.5D requires a coordinate transform:
```
screen_x = (tile_col - tile_row) * (TILE_WIDTH / 2)
screen_y = (tile_col + tile_row) * (TILE_HEIGHT / 2)
```
Z-sort, pathfinding, and character state machines continue to apply — they feed into a different projection. `renderer.ts` and `spriteData.ts` are the primary files changing.

## Constraints

- **Tech stack**: TypeScript + React + Canvas 2D — must stay within VS Code webview constraints
- **Compatibility**: Must work as a drop-in replacement for pixel-agents; all existing agent monitoring behaviour preserved
- **Assets**: Isometric sprites must be extracted/sourced via Nitro pipeline; no manual pixel art creation
- **Licensing**: Volter/Goldfish fonts are Sulake IP — if used, a licensing disclaimer is required
- **Scope**: Personal tool — no marketplace compliance requirements for V1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork pixel-agents rather than rewrite | All agent logic, JSONL watching, and Claude Code integration are correct and stable — only the rendering layer changes | — Pending |
| Nitro pipeline for assets | Modern TypeScript Habbo client, handles isometric rendering and SWF asset loading — most compatible with project stack | — Pending |
| Classic v14 aesthetic | Target the Kepler-era hotel look; Nitro supports this | — Pending |
| Preserve 6-variant palette system for characters | Avoids building a full Habbo figure compositor in V1; characters feel varied without full avatar system | — Pending |
| Open-source font as default, Volter as optional | Sulake owns Volter — default must be license-clean; Volter offered as opt-in with disclaimer | — Pending |
| Habbo sounds replace notification chimes | Authentic classic hotel audio contributes to the overall aesthetic goal | — Pending |
| Incremental furniture catalog post-V1 | Full Habbo furni catalog is extensive; V1 proves the rendering approach with 8 core pieces | — Pending |

---
*Last updated: 2026-02-28 after initialization*
