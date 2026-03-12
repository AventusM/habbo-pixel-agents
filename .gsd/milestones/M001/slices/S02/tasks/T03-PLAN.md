# T03: 02-static-room-rendering 03

**Slice:** S02 — **Milestone:** M001

## Description

Wire `isoTileRenderer.ts` into a React component (`RoomCanvas.tsx`) and a VS Code extension entry point (`extension.ts` + `webview.tsx`). This plan implements the React lifecycle, StrictMode-safe rAF loop, OffscreenCanvas compositing, heightmap change detection, and esbuild bundling — producing a demo-able VS Code webview.

Purpose: Deliver the visible end state of Phase 2 — a VS Code webview panel that renders a correct isometric room from a heightmap string and can be visually verified.

Output: `RoomCanvas.tsx`, `extension.ts`, `webview.tsx`. Verified by loading the extension in VS Code and visually inspecting the rendered room.

## Must-Haves

- [ ] "A React component renders a canvas that shows the isometric room geometry from a Habbo heightmap string"
- [ ] "The requestAnimationFrame loop self-terminates when the component unmounts — no ghost loop survives React StrictMode double-mount"
- [ ] "All mutable render state (offscreenCanvas, cameraOrigin, running flag, rafId) lives in useRef — no useState in the render loop"
- [ ] "When the heightmap prop changes, the OffscreenCanvas is regenerated and the room updates on the next frame"
- [ ] "The rAF loop composites the OffscreenCanvas to the main canvas via a single drawImage call per frame"
- [ ] "The webview entry point wires RoomCanvas with a demo heightmap string so the rendered room is visible on webview load"

## Files

- `src/RoomCanvas.tsx`
- `src/extension.ts`
- `src/webview.tsx`
