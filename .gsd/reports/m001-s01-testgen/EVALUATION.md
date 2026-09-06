# M001/S01 Evaluation — RetroDiffusion as primary pixel-art source

Date: 2026-09-05 · Author: agent (GLM-5.3-flash via opencode) · Status: **RECOMMEND ADOPT**

## 1. Capability comparison (RetroDiffusion vs PixelLab)

| Capability | PixelLab (legacy, unavailable) | RetroDiffusion (live) |
|---|---|---|
| 8-direction character sheets | Native (104×104, walk+idle 4f/dir, one export) | No single equivalent — compose from sets |
| 8-dir rotation set | — | `rd_animation__8_dir_rotation`, 80×80 fixed, **supports reference images** |
| 4-dir walk+idle set | Native | `rd_animation__four_angle_walking_idle`, 48×48 fixed, **exactly our legacy format**, no refs |
| Per-frame animation from a sprite | — | `rd_advanced_animation__walking/idle/jump/crouch/attack`, input image 32–256px |
| Base character generation | Good | `rd_pro__default` 12–256px, **supports up to 9 reference images** |
| Image→pixel-art conversion | — | `rd_pro__pixelate` (input image + refs) |
| Sprite repair | — | `fix_pixel_art` (free), pixel_correction, palette tools (free–$0.01) |
| Availability | **DOWN** (service unreachable) | Live, v2.14, pay-per-image |

## 2. Shortlisted styles for the Habbo pipeline

1. `rd_pro__default` — base character at 48px or 104px, reference-image consistency
2. `rd_animation__four_angle_walking_idle` — 48×48 walk+idle, matches legacy pack format exactly
3. `rd_animation__8_dir_rotation` — 80×80, 8-direction set with reference guidance
4. `rd_advanced_animation__walking` / `__idle` — per-direction refinement from a base frame (32–256px)

## 3. Cost model (measured via estimate_inference_cost, free calls)

| Generation | Size | Cost |
|---|---|---|
| Base character, rd_pro__default ×4 variants | 104×104 | $0.72 ($0.18/img) |
| 8-dir rotation set | 80×80 | $0.25 |
| 4-dir walk+idle set | 48×48 | $0.07 |
| Advanced walking (per direction) | 104×104 | $0.14 |
| Advanced idle (per direction) | 104×104 | $0.14 |

**Per-character budget:**
- 48px path (legacy-parity): base $0.72 + 2× four_angle sets (8 dirs) $0.14 ≈ **$0.86**
- 104px path (PixelLab-parity): base $0.72 + 8-dir rotation $0.25 + 8× walk + 8× idle $2.24 ≈ **$3.21**

Current balance: ~$8.85 → ≈ 10 characters at 104px parity, or ~30+ at 48px. Prepaid, no
subscription; estimates always free.

## 4. Test generation (paid probe, $0.36)

- Style `rd_pro__default`, 104×104, ×2, remove_bg, seed 42
- Prompt: blocky cartoon hotel guest, oversized square head, blue t-shirt, jeans
- Result: **both variants strongly Habbo-like** — oversized head, small body, clean pixels,
  transparent background, native 104×104
- Evidence: `.gsd/reports/m001-s01-testgen/base-104-a.png`, `base-104-b.png`
- Gaps vs classic Habbo: shading is softer/stardew-like; palette consistency across future
  generations needs the reference-image workflow (and optionally a custom user style)

## 5. Pipeline design (generation → pack → render)

```
RD create_inference (hosted URLs)
  → download PNG(s) to assets/rd/<character>/
  → pack script (adapted from pack-pixellab-sprites.mjs):
      consumes RD outputs (base + rotation/walk/idle sets) OR a written
      frame-grid convention (num_images batches of N assets)
      emits spritesheet + manifest (pl_rot/pl_idle/pl_walk keys → renamed rd_*)
  → dist copy (esbuild) → webview renderer (frame-size calibration already needed for 104px)
```

Pack-script changes: input source switches from PixelLab export dir to a RD download dir;
manifest key scheme, frame-size flag and hash-stripping logic carry over.

## 6. Risks

- **Composition gap**: 8-dir × walk+idle at 104px requires multiple generations per
  character; consistency across runs must be proven with reference images (S02)
- **80×80 rotation set** is fixed-size — would need upscale/pad to 104 grid (free tools exist)
- **Cost at 104px** is ~4× the 48px path — recommend starting S02 at 48px parity

## 7. Decision

**ADOPT RetroDiffusion as the primary source of truth for generated character sprites.**
PixelLab remains archived; its pack-script manifest format is retained as the renderer
contract. S02 proves the pipeline end-to-end at 48px first (cheapest), then 104px parity.
