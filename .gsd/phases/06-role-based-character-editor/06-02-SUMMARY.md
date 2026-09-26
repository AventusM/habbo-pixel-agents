---
id: S02
parent: M006
milestone: M006
provides:
  - In-room character editor UI with a live WYSIWYG Nitro preview
  - outfitStore per-role draft state (independent clones of ROLE_OUTFIT_PRESETS)
  - useCharacterEditor hook + pure buildCharacterEditorView view model
  - CharacterEditorPanel presentational panel
  - AvatarPreview canvas + buildPreviewSpec/drawAvatarPreview pure helper
requires:
  - slice: S01
    provides: Role outfit resolution at spawn (ROLE_OUTFIT_PRESETS/getRolePreset on AvatarSpec.outfit)
affects:
  - src/RoomCanvas.tsx
key_files:
  - src/state/outfitStore.ts
  - src/hooks/useCharacterEditor.ts
  - src/components/CharacterEditorPanel.tsx
  - src/render/avatarPreview.ts
  - src/components/AvatarPreview.tsx
  - src/RoomCanvas.tsx
key_decisions:
  - buildPreviewSpec/drawAvatarPreview reuse createNitroAvatarRenderable so the editor preview renders through the exact path spawn uses
  - Drafts are independent clones (parts + colors) so edits never mutate ROLE_OUTFIT_PRESETS, DEFAULT_PRESETS, or a sibling draft
patterns_established:
  - Editor draft state lives in a src/state store read via useStoreValue with module-scope selectors; the panel is purely presentational (D021)
observability_surfaces:
  - console.debug('[outfitStore] ...') on role switch and every mutation
  - outfitStore.get()/subscribeSelector exposes the draft state (no new WS message types)
drill_down_paths: []
duration: 1 continuation pass
verification_result: passed
completed_at: 2026-09-26
---

# S02: Character editor UI with live preview

The in-room character editor ships: pick one of the four TeamSection roles, customize that role's outfit (shirt color plus hair style/color, catalog-driven), and watch the preview avatar update through the same Nitro path live avatars use. Switching roles shows each role's own draft with no cross-role bleed.

## What Happened

- **T01** `b26bb80` — `src/state/outfitStore.ts`: `OutfitStore` + singleton on `createStore`, `{ drafts, activeRole }`, seeded per role from independent clones of `ROLE_OUTFIT_PRESETS`; mutations `selectRole`/`setColor`/`setHair`/`setShirt`/`resetRole`; module-scope selectors `selectActiveRole`/`selectDrafts`/stable `selectActiveOutfit`; `console.debug` on role switch and mutation. `tests/outfitStore.test.ts` locks clone independence and no preset/sibling leakage.
- **T02** `6ce0d30` — `src/hooks/useCharacterEditor.ts`: reads `outfitStore` through `useStoreValue` (module-scope selectors), returns stable `useCallback` handlers, and exposes the pure `buildCharacterEditorView(state, palettes)` derivation. No JSX. `tests/characterEditorViewModel.test.ts` covers the derivation and the no-JSX/stable-handler contract.
- **T03** `a570915` — `src/components/CharacterEditorPanel.tsx`: purely presentational (role selector, shirt/hair swatches, hair-style selector, `children` preview slot), no store/client imports or app logic. `tests/components.test.ts` adds it to the purity guard and pins render/handler parity.
- **T04** `6886bc4` — `src/render/avatarPreview.ts` (`buildPreviewSpec`, `drawAvatarPreview`, `hasPreviewAssets`) + `src/components/AvatarPreview.tsx` (redraws on draft reference change, textual fallback when assets are absent). `tests/avatarPreview.test.ts` covers spec mapping, distinct drafts, and graceful degradation; `AvatarPreview.tsx` joins the purity guard.
- **T05** `64aaefa` — `src/RoomCanvas.tsx`: calls `useCharacterEditor()` at top level, renders a toggle plus `<CharacterEditorPanel>{<AvatarPreview/>}</CharacterEditorPanel>`, resolves `(window).spriteCache` defensively. Editor is a React-only overlay, entirely outside the per-frame render path.

## Verification

- `npx vitest run` → 58 files, **762 tests passed**.
- `npx tsc --noEmit` → **exit 0**.
- `npm run lint` → **0 errors** (warnings only, pre-existing `no-explicit-any` backlog).
- `node esbuild.config.mjs` → **exit 0** (extension + webview + web; assets copied).

## Visual proof note (NEEDS-HUMAN)

The slice proof level is "unit + visual (live preview screenshot)". The extension host cannot be launched in the headless continuation-lane environment, so the live/side-by-side preview screenshot is recorded **NEEDS-HUMAN** (same convention as S01). Reproducible steps: run the editor via `habbo-pixel-agents.debugSpawn` (or the "Character Editor" toggle) and observe the preview updating on shirt/hair edits. The pure tests plus the `createNitroAvatarRenderable` consumption test are the executable proof.

## JEV/abide status

The abide/JEV gateway returned `429 FreeUsageLimitError` for every edit judgment during this pass, so no fresh abide verdicts could be produced (see `.abide/reports/m006-s02-abide-evidence.md`, which records the raw failure verbatim rather than fabricating a verdict). Q15 handoff tooling (`scripts/hooks/jeve-report.mjs`) is **not merged** on `origin/main`.

## Forward Intelligence

### What the next slice should know
- S03 builds outfit persistence + restyle-of-live-agents on top of `outfitStore`; the editor already produces `OutfitConfig` drafts that the spawn path accepts.
- The preview reads `(window).spriteCache`; it falls back to "preview unavailable" until the Nitro figure assets load.

### What's fragile
- `outfitStore` is a module singleton; editor edits are live against the room's shared store (intended), so tests must construct fresh `new OutfitStore()` instances.
- `getRolePreset` (S01) clones only `colors`; the editor store additionally clones `parts`, and `selectActiveOutfit` identity is the change signal for the preview effect.
