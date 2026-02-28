# Features Research

## Table Stakes (must preserve from pixel-agents)

These features from the original pixel-agents extension must survive the flat-to-isometric
rendering swap unchanged. Only the draw calls change; logic stays identical.

| Feature | Original behaviour | Isometric implementation note |
|---|---|---|
| Character-per-agent mapping | Each Claude Code terminal session spawns one character | Map terminal ID -> isometric avatar; spawn on door tile |
| Animation states | walk / idle / type / read / waiting | Map to Habbo action codes: wlk / std / wav (type analogue) / std+gesture (read) / std+speech bubble (waiting) |
| Office layout editor | Paint tiles, place/rotate furniture, per-tile HSB colour | Keep tile grid as the underlying data model; render each tile as 64x32 isometric diamond |
| 6 character palette variants | Six distinct colour palettes per character | Map each palette to a Habbo figure-code colour group (skin tone + clothing set) |
| Sub-agent parent/child visualisation | Lines or indicators linking parent to child agents | Render a pixel-line drawn in isometric screen space from parent avatar foot to child avatar foot |
| Matrix spawn/despawn effects | Cascading pixel effect on spawn/despawn | Cascade from top of avatar sprite downward; reuse screen-space pixel column approach |
| BFS pathfinding on tile grid | BFS finds walkable path between tiles | BFS is purely logical on the tile grid; isometric view has no impact on the algorithm itself |
| Notification sounds | Audio cues for agent events | No change — audio subsystem is render-layer independent |
| Persistent layouts | Room layout saved to disk | Serialise as heightmap string (Habbo format: "0"-"9" for height, "x" for void, door coordinates) plus furniture manifest |

---

## Habbo Room Visual Requirements

### Isometric Projection

Habbo uses a 2:1 isometric projection (not true dimetric; the tile top face is a rhombus where
width:height = 2:1). The mathematical constants confirmed across multiple open-source renderers
(shroom, bobba_client, scuti-renderer, nitro-renderer) are:

```
TILE_WIDTH       = 64 px   (full tile width measured at the widest horizontal point)
TILE_HEIGHT      = 32 px   (full tile height = half of width, the 2:1 ratio)
TILE_WIDTH_HALF  = 32 px
TILE_HEIGHT_HALF = 16 px
```

Coordinate projection from grid (map.x, map.y) to screen (screen.x, screen.y):

```
screen.x = (map.x - map.y) * TILE_WIDTH_HALF
screen.y = (map.x + map.y) * TILE_HEIGHT_HALF
```

Reverse (screen -> map, floating point):

```
map.x = screen.x / TILE_WIDTH  + screen.y / TILE_HEIGHT
map.y = screen.y / TILE_HEIGHT - screen.x / TILE_WIDTH
```

### Floor Tiles

- Each walkable tile is drawn as a filled 64x32 rhombus (diamond shape).
- Tiles support per-tile elevation (height level 0-9 in Habbo heightmap notation). Each height
  unit raises the tile's screen.y by TILE_HEIGHT_HALF (16 px), creating stair steps.
- Tile shading: the top face is the lightest; the left-facing side face is medium; the
  right-facing side face is the darkest. Classic Habbo uses a fixed 3-tone shading rather than
  dynamic lighting.
- Tile floor texture: a flat colour or pixel-pattern fill with a 1 px dark outline. In the
  pixel-agents context a plain mid-grey fill is sufficient; per-tile HSB colour from the existing
  layout editor maps directly onto this fill.
- Void (un-walkable) tiles: simply not drawn; the underlying panel background shows through.

### Wall Structure

Habbo rooms have two wall surfaces visible from the camera: the left wall (runs along the X axis)
and the right wall (runs along the Y axis). A third surface (corner pillar) appears where they meet.

```
WALL_HEIGHT      = ~115 px (varies by room setting; Habbo's UI exposes a slider;
                             a sensible default for the extension is 3.5 * TILE_HEIGHT = 112 px)
WALL_THICKNESS   = 8 px    (the narrow front face of each wall strip)
FLOOR_THICKNESS  = 8 px    (the underside ledge of the floor visible at the room edge)
```

- Left wall: drawn along the top-left edge of the room. Each wall strip is 32 px wide (one
  TILE_WIDTH_HALF) and WALL_HEIGHT tall.
- Right wall: drawn along the top-right edge of the room. Mirror of left wall in screen space.
- Corner pillar: a single vertical strip at the intersection point.
- Wall shading: left wall is lighter than right wall (simulating a light source from the
  upper-left). Classic Habbo uses approximately 20% brightness difference between the two planes.
- Wall items (posters, windows, clocks): anchored to a specific (x or y) wall column at a
  specific height offset. Left-wall items use x-axis index; right-wall items use y-axis index.

### Furniture Placement Rules

- Every floor furni occupies one or more tiles declared in a size matrix (e.g., 1x1, 2x1, 2x2).
- Furni renders with its anchor point (usually the back-bottom corner of its bounding box) at the
  tile's screen position.
- Furni can be rotated in 90-degree increments (directions 0, 2, 4, 6 in the Habbo 0-7 system
  where only cardinal directions apply to most furniture).
- Furni can be stacked vertically; each furniture item has a declared height in half-tile units
  (stored as z-offset). The Stack Magic Tile exposes z from 0.0 to 40.0 in 0.5 increments.
- Wall items have no z stacking; they layer by y-position on the wall surface.

### Depth Sorting (Z-Ordering)

Habbo uses a painter's-algorithm approach: draw everything back-to-front based on a computed
sort key. The primary sort key for an object at grid position (x, y, z) is:

```
sortKey = x + y + z * epsilon
```

where epsilon is a small fraction ensuring tall stacked items still sort above their tile.
For multi-tile furni, the sort key uses the furni's maximum (x + y) corner.

For objects occupying the same tile, secondary sort order is:
1. Floor tile (lowest)
2. Floor furni (by z-height, ascending)
3. Avatars (above furni at their tile's z-height)
4. Speech bubbles / name tags (always on top)

The general algorithm used by shroom and bobba_client is:

```
renderList.sort((a, b) => {
  const aKey = a.tileX + a.tileY + a.tileZ * 0.001
  const bKey = b.tileX + b.tileY + b.tileZ * 0.001
  return aKey - bKey
})
```

For pixel-agents this simplifies further because there is no user-placed furniture with
arbitrary stacking: furniture is pre-authored in the layout editor, enabling a single static
sort pass at layout load time. Avatars re-sort on every move step.

For multi-tile objects that overlap on screen, correct ordering requires topological sort
(dependency graph where "A must be drawn before B" edges are established by checking axis-
aligned bounding box overlap in isometric space). For the pixel-agents scope (small room,
limited furniture, no user stacking), the simple x+y+z key is sufficient.

### Room Layout Data Format

Habbo heightmap string format (adopted from retro emulators):

```
"00000"   <- row 0, 5 tiles wide, all at height 0
"01110"   <- row 1, centre three tiles at height 1 (one step up)
"x0000"   <- 'x' = void tile (no floor drawn, no walking)
```

Door is specified as a separate (x, y, direction) tuple. Direction uses the Habbo 0-7 scheme.

---

## Avatar Animation Structure

### Direction System

Habbo avatars support 8 facing directions numbered 0-7 clockwise starting from north-east:

```
Direction  Facing (from camera)
0          North-East  (away-right diagonal)
1          East         (right)
2          South-East  (toward-right diagonal)  <- most common "front" view
3          South        (toward camera, full front)
4          South-West  (toward-left diagonal)
5          West         (left)
6          North-West  (away-left diagonal)
7          North        (away from camera, full back)
```

Body direction and head direction are independent parameters, allowing the head to look
at something while the body faces a different way (e.g., standing south but head turning west).

In the classic Habbo isometric view only directions 2, 4, 6, 0 (the four diagonals) are used
for walking; cardinal directions (1, 3, 5, 7) are used for sitting, laying, and waving.

### Action / Posture Codes

| Habbo action code | Meaning | Pixel-agents mapping |
|---|---|---|
| `std` | Standing (idle) | idle state |
| `wlk` / `mv` | Walking | walk state |
| `sit` | Sitting on furniture | (not used; agents don't sit) |
| `lay` | Laying flat | (not used) |
| `wav` | Waving | type state (active tool call) |
| `respect` | Respect gesture | (optional: celebrate / task complete) |
| `blow` | Blowing kiss | (not used) |
| `laugh` | Laughing | (optional: idle variant) |

### Gesture / Expression Codes

These modify only the face layer and stack with posture actions:

| Code | Expression |
|---|---|
| `std` | Neutral |
| `sml` | Smile |
| `sad` | Sad |
| `srp` | Surprised |
| `agr` | Angry / nervous |
| `spk` | Speaking (mouth open) |
| `lol` | Blank (no face) |

Pixel-agents mapping suggestion:
- idle -> `std` gesture
- type (active) -> `sml` or `spk` gesture
- read (search tool) -> `srp` gesture
- waiting (speech bubble) -> `std` gesture
- error / blocked -> `sad` or `agr` gesture

### Frame Counts per Action

Exact frame counts are stored in the client-side `HabboAvatarActions.xml` / `animations.json`
asset files. Based on reverse-engineering documentation and open-source imager implementations:

| Action | Approximate frame count | Notes |
|---|---|---|
| `std` | 1 | Single static frame; eye blink is overlaid as a separate 3-frame sub-animation at random intervals |
| `wlk` | 4 | Four-frame walk cycle per direction (heel-strike, mid, toe-off, float) |
| `wav` | 3 | Three-frame arm raise-hold-lower |
| `sit` | 1 | Static |
| `lay` | 1 | Static |
| `respect` | ~8 | Bow animation |
| Blink overlay | 3 | Frames: open, half, closed; triggered randomly every ~5-10 s |

For the pixel-agents custom sprite approach (not using live Habbo assets): implement as
simple frame loops. A 4-frame walk cycle at 250 ms per frame (4 fps) replicates the classic
Habbo look. Idle adds a blink every 5-8 seconds via a 3-frame eye overlay.

### Body Part Layer Composition

Each avatar is composited from independently rendered layers in a specific z-order (back to front).
Based on the Habbo figure rendering specification:

```
Layer order (back -> front, i.e., render in this sequence):
  1. Body / torso (hd - head+body skin)
  2. Legs (lg)
  3. Shoes (sh)
  4. Shirt / chest (ch)
  5. Jacket / overlay (cc)
  6. Belt (wa)
  7. Head face (hd face portion)
  8. Hair back part (hr - back layer)
  9. Eyewear (ea)
 10. Hat (ha) / head accessory (he)
 11. Hair front part (hrb when hat is worn)
 12. Face accessory / mask (fa)
 13. Carry item if any (crr)
```

For a simplified custom pixel avatar (not using Habbo SWF assets), this collapses to:
body silhouette -> clothing colour -> head -> hair -> hat/accessory.

### File Naming Convention (for Habbo SWF/Nitro assets if sourced)

```
{library}_{size}_{action}_{partType}_{partId}_{direction}_{frame}

Example: hh_human_hair_h_std_hr_4_2_0
  library  = hh_human_hair
  size     = h (full size) or sh (small/zoomed-out)
  action   = std | wlk | wav | sit | lay
  partType = hd | hr | ch | lg | sh | ha | cc | ea | wa | fa | he
  partId   = numeric part variant ID
  direction = 0-7
  frame    = 0-based frame index
```

---

## Habbo-Specific UI Enhancements

### Speech Bubbles (Authentic v14 Style)

Classic Habbo speech bubbles (visible in the Flash client ca. 2005-2010) are:

- A white rounded rectangle with a 1-2 px dark border.
- A small downward-pointing triangular tail on the bottom-left or bottom-centre anchored to
  just above the avatar's head.
- Text inside uses a small sans-serif bitmap font (Volter/Goldfish at 9 pt, or similar pixel font).
- The bubble auto-sizes horizontally to fit text (capped at ~200 px wide); wraps to a second
  line if needed.
- A "..." (ellipsis) variant appears when the avatar is typing but has not yet sent a message.
  This is a narrower fixed-width bubble with three animated dots.
- Bubble fades/disappears after ~4 seconds of no new text.

Pixel-agents mapping:
- waiting state -> "..." bubble above avatar head (agent is paused, awaiting input, or in a
  long tool call with no output yet).
- speech bubble text -> show the last agent log line or tool name, truncated to ~30 chars.

### Name Tags

Classic Habbo name tags are a simple 1-line label rendered directly above the avatar in screen
space (not isometric space — they always face the camera):

- Dark semi-transparent pill/rectangle background.
- White or yellow text with the avatar/agent name.
- Optionally a small coloured dot indicating status (online = green, busy = yellow, away = grey).

For pixel-agents: show the terminal session name or agent ID. Status dot maps to:
- green = idle
- yellow = active (tool running)
- grey = waiting
- red = error

### Badges

Classic Habbo displayed 1-5 small 40x40 px badge icons below the name tag on a character
info popup (not permanently floating). For pixel-agents this is optional scope:
- A single badge icon could show the current active tool category (file ops, web search, code,
  etc.) as a small 16x16 icon above the name tag.

### Room UI Chrome (classic v14 style elements worth adapting)

| Habbo element | Description | Pixel-agents adaptation |
|---|---|---|
| Chat log panel | Scrolling list of speech at bottom of screen | VS Code output panel — not duplicated in canvas |
| Navigator (room list) | List of rooms to enter | Not applicable (single-room experience) |
| Console / friend list | Right-side slide-out panel | Not applicable |
| Tile highlight | Yellow highlight on tile under cursor | Keep from pixel-agents layout editor |
| Furni rotation indicator | Arrow UI when placing furniture | Keep from pixel-agents layout editor |
| Room enter animation | Avatar walks in from door | Spawn at door tile, walk to first idle position |

### Typing Indicator ("..." bubble)

When an agent is running a tool call that has not yet returned:
- Show a compact speech bubble with three animated dots cycling (. -> .. -> ...) at ~500 ms
  per step.
- This directly replaces the pixel-agents "waiting" speech bubble state with an authentic
  Habbo-style visual.

---

## Differentiators vs Scope Boundaries

### Worth Adding (in scope, adds authenticity without bloat)

| Feature | Rationale |
|---|---|
| Classic 64x32 isometric tile grid | Core visual identity; technically straightforward using Canvas 2D transforms |
| Two-tone wall shading (left lighter, right darker) | Takes ~10 lines of canvas code; makes the room look authentic immediately |
| Painter's-algorithm depth sort (x+y key) | Required for correct visual overlap; simple to implement for a fixed-layout room |
| 4-frame walk cycle per 8 directions | Makes agents feel alive; 4 frames x 8 dirs x ~6 body parts = 192 sprites if custom-drawn |
| Idle blink overlay (3-frame, random interval) | High payoff: single blink animation makes idle avatars feel inhabited |
| "..." speech bubble for waiting state | Directly replicates Habbo's in-progress typing visual; trivial to implement |
| Name tag with status dot | Functional (identifies agent) + authentic (matches Habbo style) |
| Stair tiles (height > 0) | Heightmap already supports multi-level; rendering stairs adds visual depth to complex layouts |
| Per-tile HSB floor colour (from existing editor) | Already exists in data model; just maps to isometric tile fill colour |
| Door tile with enter animation | Spawn effect: avatar walks from door tile to first position; uses existing BFS pathfinder |

### Authentic but Avoid (scope creep / diminishing returns)

| Feature | Reason to defer |
|---|---|
| Live Habbo SWF/Nitro asset pipeline | Licence risk; asset extraction complexity; custom pixel sprites are simpler and sufficient |
| Full 13-layer body-part composition | Overkill for a monitoring tool; a 3-4 layer simplified avatar is visually equivalent at this scale |
| Carry item animations (crr/drk) | No natural agent-state mapping; adds sprite complexity for no clarity gain |
| Group badge system | No multi-user context in a local VS Code extension |
| Wired automation furniture | Habbo-specific game mechanic; irrelevant to agent monitoring |
| Furniture animation (multi-frame furni) | Adds asset complexity; static furniture sprites are fine for the office layout |
| Wall item placement in editor | Useful but adds UI complexity; defer to post-MVP |
| Room effects (confetti, snowfall, etc.) | Decorative only; the matrix spawn/despawn effect from pixel-agents already covers celebratory moments |
| Chat log scrollback in canvas | VS Code already provides the terminal output; duplicating it in canvas is redundant |
| Dynamic lighting | Habbo uses flat shading; dynamic lighting breaks the aesthetic and adds render cost |

### Scope Boundary Statement

The rendering layer change is a drop-in replacement: the agent model, state machine, BFS
pathfinder, layout editor data model, sound system, and persistence layer are untouched.
The only new code is:

1. An isometric coordinate math module (screen <-> grid projection).
2. A depth-sort pass replacing the flat row-major render order.
3. Isometric tile and wall draw routines (Canvas 2D path fills).
4. An avatar sprite system with 8 directions x 4 walk frames + 1 idle + 3 blink overlay frames
   (either custom pixel art or sourced from a freely-licensed Habbo-compatible asset set).
5. Authentic speech bubble renderer (rounded rect + tail + bitmap font).
6. Name tag renderer (pill background + text + status dot).

Everything else is a direct port of existing pixel-agents code.
