# RetroDiffusion pipeline note

## Purpose

This note is the implementation-facing contract for S02. It turns the evidence in
`docs/architecture/retrodiffusion-evidence.md` into a concrete flow that S02 can
follow without re-deriving the avatar pipeline.

## Chosen source path

Use the current RetroDiffusion character contract already recorded in the repo:

- **Base source**: `rd_pro__default`
- **Walk/idle sheet**: `four_angle_walking_idle` at **48px** cells
- **Rotation sheet**: `8_dir_rotation` as the reference pose sheet consumed by the packer
- **Diagonal motion sheets**: `advanced walking` per diagonal direction

The important implementation rule is that the pipeline is **48px-first**.
The packer normalizes the source sheets into a 48px atlas grid, so the runtime
renderer never has to reason about the source sheet dimensions directly.

## Expected character cost

The current architecture note records RetroDiffusion generation as **about
$1/character**. That makes the pipeline suitable for character sets and eval
runs, but still expensive enough that we should keep the handoff deterministic
and avoid unnecessary re-packs.

## End-to-end flow

### 1. Generate or stage the RD sheets

The working set lives under `assets/rd/eval-char/`.
The current snapshot includes:

- `walkidle.png`
- `rotation-144.png`
- `walk-NE.png`

Those files are the source inputs for the pack step and the reference evidence
for the current state of the pipeline.

### 2. Pack into a single atlas + manifest

Run the packer:

```bash
node scripts/pack-rd-sprites.mjs assets/rd/eval-char --out=rd-eval-char
```

That command produces the runtime handoff in `assets/pixellab/`:

- `assets/pixellab/rd-eval-char.png`
- `assets/pixellab/rd-eval-char.json`

The packer emits a Texture Packer–style manifest with `pl_*` frame keys. The
current contract is:

- `pl_rot_{dir}` — static rotation frames
- `pl_idle_{dir}_{frame}` — 4-frame idle cycle
- `pl_walk_{dir}_{frame}` — 4-frame walk cycle

This is the **manifest/atlas handoff** S02 should preserve.

### 3. Copy into the runtime bundle

`esbuild.config.mjs` copies the committed RD atlas and manifest into the
runtime asset directories during the build. The runtime does not read directly
from `assets/rd/`; it reads the packed atlas and manifest that were copied into
bundle output.

### 4. Load at runtime

The room renderer resolves the avatar source in `src/RoomCanvas.tsx`:

- when local Habbo figure assets are available, use `habboRenderer`
- otherwise, use `pixelLabRenderer`

That means RD/PixelLab remains the fallback character path today, but the
runtime contract is already in place.

The generated-character renderer in `src/pixelLabAvatarRenderer.ts` then loads
frames from the `pixellab` atlas via `SpriteCache` and draws the scaled sprite
per frame.

## Runtime behavior to preserve

- `pixelLabRenderer.isAvailable()` checks for the packed atlas by frame key,
  not by source-sheet presence.
- `pixelLabRenderer` scales the source frame to a fixed on-screen height.
- `RoomCanvas.tsx` keeps the renderer selection branch between Habbo figures
  and RD/PixelLab single-sprite avatars.
- The pack script must keep emitting stable `pl_*` keys so the runtime loader
  and tests continue to match.

## Why this order matters

This pipeline keeps each stage narrow:

1. **RD generation** produces source art.
2. **Packing** converts source art into a deterministic atlas + manifest.
3. **Build copy** makes the assets available to the shipped app.
4. **Renderer** consumes only the packed contract.

That separation means S02 can work against a stable runtime surface without
having to know anything about how the sheets were authored.

## Handoff checklist for S02

- Keep the **48px-first** sheet contract.
- Treat `assets/pixellab/rd-eval-char.png` and `.json` as the generated-character handoff.
- Keep the `pl_*` manifest keys stable.
- Preserve the runtime branch in `RoomCanvas.tsx`.
- Do not reintroduce source-sheet assumptions into the renderer.
