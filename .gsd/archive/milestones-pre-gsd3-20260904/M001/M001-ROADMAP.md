# M001: Habbo Isometric Drop-in Replacement

**Vision:** Replace the flat top-down pixel-art renderer with a faithful Habbo Hotel v14-era isometric 2.5D rendering layer while preserving all agent logic.

## Success Criteria

- All 8 furniture types render in correct isometric projection
- Avatars animate in 8 directions with walk cycles and idle blinks
- BFS pathfinding works unchanged with isometric coordinate output
- Layout editor works with isometric tile grid
- Audio plays Habbo classic sounds with silent fallback

## Slices

- [x] **S01: Coordinate Foundation** `risk:medium` `depends:[]`
  > After this: Bootstrap the Node/TypeScript/Vitest infrastructure and implement the pure isometric math module with a passing unit test suite that is the hard gate for all subsequent rendering phases.
- [x] **S02: Static Room Rendering** `risk:medium` `depends:[S01]`
  > After this: Define the pure data types and logic functions that the tile renderer (Plan 02) and React component (Plan 03) depend on.
- [x] **S03: Asset Pipeline** `risk:medium` `depends:[S02]`
  > After this: Build the sprite cache abstraction that loads PNG atlases as GPU-accelerated ImageBitmap objects and provides frame lookup API for furniture/avatar rendering.
- [x] **S04: Furniture Rendering** `risk:medium` `depends:[S03]`
  > After this: Validate furniture asset availability and implement single-tile furniture rendering with the chair as the first working example.
- [x] **S05: Avatar System** `risk:medium` `depends:[S04]`
  > After this: Create avatar renderer with 8-direction support, 3-4 layer sprite composition, and 6 palette variants using placeholder sprites for visual validation.
- [x] **S06: Ui Overlays** `risk:medium` `depends:[S05]`
  > After this: Create the speech bubble renderer using pure Canvas 2D APIs (no sprites) to display agent log lines, tool names, and waiting states above avatar heads.
- [x] **S07: Layout Editor Integration** `risk:medium` `depends:[S06]`
  > After this: Implement core mouse-to-tile conversion logic for the layout editor using the inverse isometric formula with z=0 assumption (Strategy B from Phase 1 research).
- [x] **S08: Audio** `risk:medium` `depends:[S07]`
  > After this: Create a robust audio manager module that handles Web Audio API initialization, audio loading with graceful codec failure handling, and one-shot sound playback.
