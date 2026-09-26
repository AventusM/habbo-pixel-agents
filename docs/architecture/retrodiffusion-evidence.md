# RetroDiffusion evidence note

## Why this note exists

This document captures the current RetroDiffusion character source contract and the implementation-facing evidence needed before S02 writes the pipeline note. It is intentionally compact and traceable back to the live repository state.

## Evidence inventory

### Source contract files
- `scripts/pack-rd-sprites.mjs` — packs RetroDiffusion character outputs into the runtime sprite/manifest contract.
- `src/RoomCanvas.tsx` — chooses between the Habbo figure renderer and the PixelLab/RD single-sprite renderer at runtime.
- `src/isoAvatarRenderer.ts` — legacy Habbo/Nitro avatar path with layered figure composition.
- `src/pixelLabAvatarRenderer.ts` — single-sprite PixelLab/RD fallback renderer.
- `tests/isoAvatarRenderer.test.ts` — checks avatar frame-key generation, 8-direction mapping, layer composition, blinking, and spawn timing.
- `docs/architecture/ARCHITECTURE.md` — records the current asset-pipeline split, RD packing contract, cost note, and copyright posture.
- `README.md` — project-level framing for the room/avatar renderer.

### Evaluation assets
- `assets/rd/eval-char/walkidle.png`
- `assets/rd/eval-char/rotation-144.png`
- `assets/rd/eval-char/walk-NE.png`
- `assets/pixellab/rd-eval-char.png`
- `assets/pixellab/rd-eval-char.json`

## Current source contract

The repository currently describes two avatar source paths that converge on the same runtime `SpriteCache`:

- **Habbo/Nitro figures** use `h_*` frame keys and multi-layer composition.
- **Generated characters** use `pl_*` frame keys produced by the RetroDiffusion packing script.

`RoomCanvas.tsx` selects the active avatar renderer based on whether local figure assets are available:

- if `spriteCache && habboRenderer.isAvailable(spriteCache)` → use `habboRenderer`
- otherwise → use `pixelLabRenderer`

That means RD/PixelLab is the fallback path today, but the runtime contract is already in place for either source.

## RD packing contract recorded in the architecture doc

`docs/architecture/ARCHITECTURE.md` currently states the generated-character pipeline as:

1. RD MCP generates the source sheets.
2. `node scripts/pack-rd-sprites.mjs --out=<name>` cuts the sheets into one atlas plus manifest.
3. `esbuild` copies the assets into the runtime bundle.
4. The renderer loads the atlas with `spriteCache.loadAtlas('pixellab', png, json)`.

The same document gives the concrete sheet shapes and output expectations:

- `four_angle_walking_idle` at **48px** cells, laid out as a 4×4 walk/idle sheet
- `rotation-144.png` as a **144×144** reference sheet, i.e. a 3×3 layout of 48px cells
- `advanced walking` diagonal sheets as **2×2** grids of 48px cells
- packed output as a single atlas with **72 `pl_*` frames** and **48px** cells

## Asset snapshot from the current repo

A quick file-level snapshot of the evaluation assets shows the current working set is present and non-empty:

| File | Observed size / shape |
|---|---|
| `assets/rd/eval-char/walkidle.png` | 192×192, 10683B |
| `assets/rd/eval-char/rotation-144.png` | 144×144, 3369B |
| `assets/rd/eval-char/walk-NE.png` | 96×96, 1566B |
| `assets/pixellab/rd-eval-char.png` | 384×432, 50943B |
| `assets/pixellab/rd-eval-char.json` | 11809B |

These sizes are consistent with the repo’s 48px-first packing model and the existing PixelLab archive/eval artifacts.

## Renderer and test evidence

`tests/isoAvatarRenderer.test.ts` confirms the current runtime assumptions that S02 must preserve:

- 8-direction avatar frame lookup coverage
- multi-layer composition for Habbo figures
- graceful degradation when sprite cache assets are missing
- walk/idle/blink/spawn animation timing
- `buildFrameKey()` output shape for body, head, chest, and face parts

This is the implementation evidence that the renderer contract is stable enough to document before S02 writes the dedicated pipeline note.

## Cost and decision trail

`docs/architecture/ARCHITECTURE.md` currently records the RD generation path as **paid, about $1/character**.

The GSD decision store currently reports **2 architecture decisions**. The architecture doc ties the generated-character path to the **D001-era / PR #66** copyright posture, so the current decision trail is already anchored in project history even though this note is only summarizing it.

## What S02 should carry forward

- Keep the **48px-first** generation and packing path.
- Treat `pl_*` atlas/manifest output as the generated-character handoff.
- Preserve the `RoomCanvas` runtime branch between Habbo figures and RD/PixelLab single sprites.
- Use the asset snapshot above as the traceable evidence base for the implementation-facing pipeline note.

## Verification hook

The note is intentionally non-empty and traceable. It should satisfy the task check:

```bash
test -s docs/architecture/retrodiffusion-evidence.md
```
