# M006/S01 — Character editor reuse evaluation (T05)

**Scope:** Before S02 builds the character editor, decide whether to build it in-repo or reuse an
external candidate, and reconcile the role granularity named in the milestone vision against the
code's role model.

**Context:** The repo already ships `OutfitConfig`, a curated `FIGURE_CATALOG`, the color palettes
(`SKIN_PALETTE`/`HAIR_PALETTE`/`CLOTHING_PALETTE`), `ROLE_OUTFIT_PRESETS`/`getRolePreset`, and a
Canvas 2D renderer that composes 13 Nitro figure layers (`hrb, bd, lh, lg, sh, ch, ls, rh, rs, hd,
ey, fc, hr`) from per-item Nitro JSON+PNG using frame keys like `h_std_ch_2110_0_0`. The PixelLab
backend is a separate single-sprite path and is out of scope for the editor.

## Internal foundation (baseline)

The internal path is already a working editor data model: catalog + palettes + `OutfitConfig` →
`outfitToFigureParts()` → the live renderer. S02's preview can reuse the existing
`createNitroAvatarRenderable` pipeline so the preview is WYSIWYG with the room by construction. No
external dependency is needed for correctness; only convenience UI primitives are optional.

## External candidates evaluated

| Candidate | License | What it provides | Nitro-aware? | Fit verdict |
| --- | --- | --- | --- | --- |
| `billsonnn/nitro-react` avatar editor | **None** (no LICENSE; dep `@nitrots/nitro-renderer` is GPL-3.0) | Full figure-editor UI: category models, figure-string parser, wardrobe, direction preview | Yes (exact Nitro figure model) | **Reference only — licence-blocked.** Do not lift code or assets. |
| `@nitrots/nitro-renderer` | **GPL-3.0** | `AvatarRenderManager`, figuredata types, Nitro asset pipeline | Yes | **No** — GPL + PixiJS, incompatible with a permissive embed and the Canvas-2D/per-item-JSON model. |
| `Bopified/Retrosprite` | **MIT** | Nitro asset editor/converter (SWF→Nitro JSON, spritesheet packing) | Partial (assets, not figures) | Useful MIT patterns for Nitro JSON/spritesheet tooling; **not** a figure editor. |
| `alfredsaveron/habbo-imager` | **MIT** | React pick-parts/colours → figure string; renders via remote imager API | No local Nitro rendering | Closest MIT figure-editor UX; remote-API render model does not match local Canvas 2D. |
| `OmegaCreations/CharaKit` (`react-avatar-maker`) | **MIT** | Generic layered-avatar React component (zIndex, pixelScale, export) | No (fixed-grid spritesheet) | Best generic shell if one were needed; would still mount our own renderer inside. |
| `DracoBlue/retro-antlitz-kartei` | **MIT** | Compact "pick parts + colours + shareable code" editor UX | No (own 32×40 sprites) | Good UX reference; not directly reusable. |
| `react-colorful` | **MIT** | 2.8 KB hooks color picker, a11y, no deps | N/A (generic) | Optional if freeform colour is needed; curated palettes may make swatch buttons sufficient. |
| `@radix-ui/react-select` | **MIT** | Headless accessible select | N/A (generic) | Optional for preset dropdowns; repo currently ships zero UI deps. |
| `react-color` | MIT | Legacy picker | N/A | **No** — unmaintained since 2022. |
| LPC toolkit / SpriteBat / spritebrew / SpriteLab | GPL/AGPL | LPC/AI sprite editors | No | **No** — different asset model, copyleft. |

## Non-fits

Server-side imagers (`nitro-imager`, `docker-imager`, `Orion-Server/avatar-imaging`,
`Quackster/Avatara`) are render-only, wrong-stack (C#), or unlicensed/GPL — no editor UI.
`@nitrots/nitro-renderer` and Nitro_Render_V3 are GPL + PixiJS and require `.nitro` bundles, which
this repo deliberately does not use.

## Decision

Build the editor **in-repo** on the existing internal presets/catalog, reusing the
`createNitroAvatarRenderable` preview pipeline and the established form patterns. No external Habbo
figure editor is licence-compatible or format-compatible. Optional generic primitives
(`react-colorful`, `@radix-ui/react-select`) may be adopted in S02 only if needed, each replacing,
not duplicating, an internal control.

**Role granularity:** the milestone vision names 8 roles (Atlas, Sisyphus, Prometheus, Hephaestus,
core-dev, planning, infrastructure, support) while the code's role model is the 4 `TeamSection`
values. S01 wires the **4 TeamSection roles**; named-role expansion is **out of scope** unless the
owner re-opens it. Do not invent an 8-value role enum.
