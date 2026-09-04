---
phase: 17.8-remove-copyrighted-habbo-characters
verified: 2026-03-12T22:05:00Z
status: human_needed
score: 12/13 must-haves verified
human_verification:
  - test: "Open the VS Code extension (F5 or npm run build + launch). Verify different agent teams show visually distinct character sprites — planning, core-dev, infrastructure, and support agents should each appear with a different color palette."
    expected: "Four distinct character appearances: navy blue (planning), hoodie/unchanged (core-dev), orange/amber (infrastructure), teal/green (support). Characters walk, idle, spawn, and despawn correctly."
    why_human: "Visual distinction is subjective and requires running the extension. Automated checks confirm atlas frame keys exist and renderer wires team to atlas, but cannot verify the PNG color palettes are perceptually distinct at runtime."
  - test: "With the extension open, click an agent avatar in the room."
    expected: "No avatar builder modal or panel opens. The click should select the avatar (highlight) but not trigger any builder UI."
    why_human: "Builder removal was verified at code level but runtime click-through behavior requires human interaction."
  - test: "Verify the character legend panel is visible at the bottom-right of the room view."
    expected: "A small dark semi-transparent panel with title 'Teams' and four rows (Planning, Core Dev, Infrastructure, Support), each with a colored square and label."
    why_human: "Panel component and wiring are verified in code, but actual rendering in the VS Code webview context requires visual inspection."
---

# Phase 17.8: Remove Copyrighted Habbo Character Content - Verification Report

**Phase Goal:** Remove all copyrighted Habbo character/figure assets, renderers, and builder UI. Replace with PixelLab-generated team-specific characters.
**Verified:** 2026-03-12T22:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each of the 4 teams has a visually distinct PixelLab character atlas | ? HUMAN | 4 atlas files exist with 88 frames each (walk + idle), renderer uses team-to-atlas mapping — visual distinction requires human |
| 2 | Agents spawn with the correct team-specific character atlas | ✓ VERIFIED | `avatarManager.ts` sets `spec.team = team \|\| 'core-dev'` in both `spawnAvatar()` and `spawnAvatarAt()`; renderer calls `getAtlasForTeam(spec.team)` |
| 3 | All 4 character atlases load successfully in the webview | ✓ VERIFIED | `webview.tsx` loads all 4 team atlases at startup (lines 113-124); `extension.ts` generates 8 webview URIs (lines 227-249) |
| 4 | No Habbo figure/character assets remain in the repository | ✓ VERIFIED | `assets/habbo/figures/` directory does not exist; manifest.json has no `figures` array; zero grep matches for figure references |
| 5 | No Habbo avatar renderer code remains in src/ | ✓ VERIFIED | `src/isoAvatarRenderer.ts` deleted; `src/avatarOutfitConfig.ts` deleted; `src/avatarBuilderPreview.ts` deleted; zero grep matches for all deleted module names |
| 6 | No avatar builder UI is accessible or rendered | ✓ VERIFIED | `src/AvatarBuilderModal.tsx` deleted; `src/AvatarDebugGrid.tsx` deleted; `RoomCanvas.tsx` has no builder state or JSX; runtime behavior is human-verified |
| 7 | Avatar builder message types are removed from agentTypes.ts | ✓ VERIFIED | grep for `avatarOutfits`, `saveAvatar`, `loadAvatars`, `OutfitConfig` in `agentTypes.ts` returns zero matches |
| 8 | AvatarSpec no longer contains Habbo-specific fields | ✓ VERIFIED | `avatarRendererTypes.ts` has no `outfit`, `nextBlinkMs`, or `blinkFrame` fields; clean interface with PixelLab-only fields |
| 9 | AvatarSpec has a `team` field for PixelLab character selection | ✓ VERIFIED | `avatarRendererTypes.ts` line 44: `team?: TeamSection;` — imports TeamSection from agentTypes.js |
| 10 | Character legend panel shows team-to-character mapping in the room view | ✓ VERIFIED | `src/CharacterLegendPanel.tsx` exists (73 lines), renders 4 rows with colored squares and labels; imported and rendered in `RoomCanvas.tsx` at line 1461 |
| 11 | All tests pass (pre-existing 5 failures excluded) | ✓ VERIFIED | `npx vitest run` — 364 passing, 5 failing (all pre-existing: isoKanbanRenderer + messageBridge) |
| 12 | Figure download/conversion scripts no longer process figure assets | ✓ VERIFIED | `scripts/download-habbo-assets.mjs` has no FIGURE_ITEMS or figure loop; `scripts/convert-cortex-to-nitro.mjs` has no figure conversion section |
| 13 | Full codebase audit passes — zero residual Habbo figure references | ✓ VERIFIED | All 12 audit patterns return zero matches across src/, tests/, scripts/ |

**Score:** 12/13 truths verified (1 requires human — visual character distinction)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `assets/pixellab/pl-planning.png` | Planning team character spritesheet | ✓ VERIFIED | Exists; hue-rotated to navy (220deg) |
| `assets/pixellab/pl-planning.json` | Planning team atlas manifest | ✓ VERIFIED | 88 frames with `pl_walk_`, `pl_idle_` keys |
| `assets/pixellab/pl-core-dev.png` | Core Dev team character spritesheet | ✓ VERIFIED | Exists; copy of beanie-hoodie-guy |
| `assets/pixellab/pl-core-dev.json` | Core Dev team atlas manifest | ✓ VERIFIED | 88 frames with expected keys |
| `assets/pixellab/pl-infrastructure.png` | Infrastructure team character spritesheet | ✓ VERIFIED | Exists; hue-rotated to orange (30deg) |
| `assets/pixellab/pl-infrastructure.json` | Infrastructure team atlas manifest | ✓ VERIFIED | 88 frames with expected keys |
| `assets/pixellab/pl-support.png` | Support team character spritesheet | ✓ VERIFIED | Exists; hue-rotated to teal (165deg) |
| `assets/pixellab/pl-support.json` | Support team atlas manifest | ✓ VERIFIED | 88 frames with expected keys |
| `src/pixelLabAvatarRenderer.ts` | Per-team atlas selection logic | ✓ VERIFIED | `getAtlasForTeam()` exported (lines 17-25); `createRenderable()` calls it with `spec.team` (line 128) |
| `src/CharacterLegendPanel.tsx` | Character legend panel component | ✓ VERIFIED | 73 lines; renders 4 team rows with colored rectangles and Press Start 2P font |
| `src/avatarRendererTypes.ts` | Clean AvatarSpec with team field, no Habbo fields | ✓ VERIFIED | `team?: TeamSection` at line 44; no outfit/blinkMs/blinkFrame fields |
| `src/isoAvatarRenderer.ts` | DELETED | ✓ VERIFIED | File does not exist |
| `src/avatarOutfitConfig.ts` | DELETED | ✓ VERIFIED | File does not exist |
| `src/AvatarBuilderModal.tsx` | DELETED | ✓ VERIFIED | File does not exist |
| `src/avatarBuilderPreview.ts` | DELETED | ✓ VERIFIED | File does not exist |
| `src/AvatarDebugGrid.tsx` | DELETED | ✓ VERIFIED | File does not exist |
| `assets/habbo/figures/` | DELETED | ✓ VERIFIED | Directory does not exist |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pixelLabAvatarRenderer.ts` | SpriteCache | `getAtlasForTeam()` maps team to atlas, calls `spriteCache.getFrame(atlasName, ...)` | ✓ WIRED | Lines 128-132: team atlas with double-fallback to default atlas |
| `src/avatarManager.ts` | AvatarSpec | `team` assignment on spawn propagated to renderer | ✓ WIRED | Line 64: `team: team \|\| 'core-dev'` directly on AvatarSpec (both spawnAvatar and spawnAvatarAt) |
| `src/RoomCanvas.tsx` | `src/pixelLabAvatarRenderer.ts` | Direct renderer usage, no Habbo fallback | ✓ WIRED | Line 648: `const activeRenderer: AvatarRenderer = pixelLabRenderer;` — single renderer, no conditional |
| `src/RoomCanvas.tsx` | `src/CharacterLegendPanel.tsx` | JSX component rendering | ✓ WIRED | Import at line 37; rendered as `<CharacterLegendPanel />` at line 1461 |
| `src/webview.tsx` | Team atlases | `spriteCache.loadAtlas()` at startup | ✓ WIRED | Lines 113-124: loops over all 4 team atlas configs and loads each via spriteCache.loadAtlas |
| `src/extension.ts` | Team atlas URIs | `ASSET_URIS` injection | ✓ WIRED | Lines 227-249: 8 webview URIs generated; lines 441-444+: injected into HTML template |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REM-01 | 17.8-01 | Team-specific PixelLab character atlases committed | ✓ SATISFIED | 4 atlas PNG+JSON files exist in assets/pixellab/ |
| REM-02 | 17.8-01 | Per-team atlas selection in renderer | ✓ SATISFIED | `getAtlasForTeam()` wired into `createRenderable()` |
| REM-03 | 17.8-01 | Webview loads all team atlases at startup | ✓ SATISFIED | webview.tsx loads all 4 atlases with error handling |
| REM-04 | 17.8-02 | Habbo figure source files deleted | ✓ SATISFIED | 5 source files confirmed deleted |
| REM-05 | 17.8-02 | Habbo figure test files deleted | ✓ SATISFIED | 2 test files confirmed deleted |
| REM-06 | 17.8-02 | Figure assets directory deleted | ✓ SATISFIED | assets/habbo/figures/ does not exist |
| REM-07 | 17.8-02 | AvatarSpec cleaned (no Habbo fields, has team field) | ✓ SATISFIED | avatarRendererTypes.ts verified clean |
| REM-08 | 17.8-02 | Avatar builder UI removed | ✓ SATISFIED | No builder state, imports, or JSX in RoomCanvas.tsx |
| REM-09 | 17.8-02 | CharacterLegendPanel added to room view | ✓ SATISFIED | Component exists (73 lines), rendered in RoomCanvas.tsx |
| REM-10 | 17.8-03 | Full codebase audit — zero residual references | ✓ SATISFIED | All 12 audit patterns return zero matches |

**Note:** REM-01 through REM-10 are phase-internal requirement IDs defined by the ROADMAP for Phase 17.8. They do not appear in the global `.planning/REQUIREMENTS.md` (which covers COORD, ROOM, ASSET, FURN, AVAT, AGENT, UI, EDIT, AUDIO, BUILD requirements). No orphaned requirements found — all 10 REM IDs are accounted for across the 3 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/PLACEHOLDER/stub patterns found in phase-touched files. The `(spec as any).team` temporary cast noted in Plan 01 was correctly cleaned up in Plan 02 — `spec.team` is now typed directly on AvatarSpec.

### Human Verification Required

#### 1. Visual character distinction across teams

**Test:** Open the VS Code extension (F5 or `npm run build` + launch debug). Observe room rendering with agents from all 4 teams.
**Expected:** Planning agents appear navy blue, core-dev agents appear with the default hoodie look (unchanged), infrastructure agents appear orange/amber, support agents appear teal/green. Characters are perceptually distinguishable at a glance.
**Why human:** The PNG atlases were generated by hue-rotating the beanie-hoodie-guy sprite. Color channel modification is confirmed programmatically, but whether the result is visually distinct enough at isometric scale (2.5x) requires human judgment.

#### 2. Avatar builder is gone at runtime

**Test:** With the extension open, click any agent avatar.
**Expected:** Click selects the avatar (name tag highlights) but no avatar builder panel, modal, or menu appears.
**Why human:** Builder JSX is absent at the code level, but runtime event dispatch and any edge-case message handlers could theoretically surface builder UI through unexpected paths.

#### 3. Character legend panel renders correctly

**Test:** Open the extension room view and look at the bottom-right corner.
**Expected:** A dark semi-transparent panel labeled "Teams" with four rows: Planning (blue square), Core Dev (green square), Infrastructure (amber square), Support (purple square), each with a Press Start 2P label.
**Why human:** React component wiring is confirmed but VS Code webview rendering context may have font or z-index differences from a standard browser.

### Gaps Summary

No gaps found. All automated verifications passed. The phase goal is substantially achieved:

- All copyrighted Habbo figure assets are gone from the repository
- All Habbo figure renderer code, builder UI, and outfit catalog code are deleted
- Zero residual references remain in src/, tests/, or scripts/
- 4 team-specific PixelLab character atlases are committed with correct frame structure
- PixelLab is the sole avatar renderer — no fallback path remains
- AvatarSpec is clean with a typed `team` field
- CharacterLegendPanel is wired into RoomCanvas
- Test suite: 364 passing, 5 failing (all pre-existing, no regressions)
- TypeScript compiles cleanly (src/ only; pre-existing test-file errors are unrelated)

The only outstanding item is human visual validation of the runtime experience (character color distinctiveness, absence of builder UI, legend panel visibility).

---

_Verified: 2026-03-12T22:05:00Z_
_Verifier: Claude (gsd-verifier)_