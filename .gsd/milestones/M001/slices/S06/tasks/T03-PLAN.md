# T03: 06-ui-overlays 03

**Slice:** S06 — **Milestone:** M001

## Description

Bundle Press Start 2P font locally and configure webview HTML to load it before first render, ensuring pixel-crisp text rendering in speech bubbles and name tags with no FOUT (Flash of Unstyled Text).

Purpose: Authentic pixel-art aesthetic requires a pixel font. Loading font before canvas initialization prevents jarring visual flash when font switches from system fallback to pixel font.

Output: Press Start 2P font bundled, loaded via webview URI, and rendering in all UI overlays with no visual flash on load.

## Must-Haves

- [ ] "Press Start 2P font loads before first render (no FOUT)"
- [ ] "Font renders pixel-crisp at 8px size"
- [ ] "UI overlays always appear on top of all room elements"

## Files

- `src/extension.ts`
- `dist/webview-assets/PressStart2P-Regular.ttf`
- `package.json`
