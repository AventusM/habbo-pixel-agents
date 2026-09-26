# S01 Summary — Role outfits render at spawn

**Milestone:** M006
**Slice:** S01
**Status:** done-in-fact — delivered via direct `feat(M006/S01)` commits on `gsd/m006-s01-role-outfits-render-at-spawn` (T01–T05), gate + full sweep green. Task rows left pending canonical completion (no running Attempt; D018 constraint). Sealed as skipped with delivery reasons per the D014 precedent.

## What happened

Role outfits are now resolved at the single spawn chokepoint and driven by the agent's team, replacing the renderer's hardcoded variant palette on the Nitro path.

- **T01** `698a391` — `src/avatarManager.ts` imports `getRolePreset` and sets `outfit: getRolePreset(team ?? 'core-dev', variant)` on the `AvatarSpec` built in **both** `spawnAvatar` and `spawnAvatarAt`; added a once-per-agent debug `console.debug` of the first-sight `agentId → team → shirt` resolution.
- **T02** `2223eb8` — `tests/avatarManager.test.ts`: four TeamSection shirt colors pairwise distinct; `spawnAvatarAt` matches `spawnAvatar`; same team+variant resolves identically; undefined team deterministically falls back to the `core-dev` preset (never `undefined`); variant changes skin while preserving the team shirt. `tests/avatarOutfitConfig.test.ts`: `getRolePreset` returns an equal-but-independent object per call; `ROLE_OUTFIT_PRESETS` shirt colors pairwise distinct.
- **T03** `4a17224` — locked the backend split: `src/pixelLabAvatarRenderer.ts` gains the task-mandated NOTE comment at the `getAtlasForTeam`/`createRenderable` boundary (role outfits are Nitro-only; PixelLab selects sprites by team). `tests/isoAvatarRenderer.test.ts` proves the Nitro draw path tints parts with `spec.outfit` colors and uses outfit setIds in frame keys, falls back to the variant palette without an outfit, and that the PixelLab renderable makes **identical atlas/frame lookups** with and without `spec.outfit`.
- **T04** `2d73be7` — `tests/roleOutfitLineup.test.ts` enumerates the four TeamSection roles plus the unclassified/variant fallback through `getRolePreset`, asserts pairwise-distinct outfits that are role-derived (not the renderer fallback palette), and writes the machine-checkable artifact `.gsd/exec/role-outfit-lineup.json`.
- **T05** `a69ebea` — reuse evaluation `.gsd/phases/06-role-based-character-editor/06-01-RESEARCH.md` + decision **D032** (scope `m006-role-outfits`): build the editor in-repo on the internal presets/catalog; no external Habbo figure editor is licence- or format-compatible; S01 wires the **4 TeamSection roles** and named-role expansion to the vision's 8 roles is out of scope unless the owner re-opens it.

## Evidence (closeout sweep)

- `npx vitest run` → 55 files, **732 tests passed**.
- `npx tsc --noEmit` → **exit 0**.
- `node esbuild.config.mjs` → **exit 0** (extension + webview + web; assets copied).
- `npx eslint` clean on every changed file (one pre-existing `no-explicit-any` warning in `tests/isoAvatarRenderer.test.ts`, unrelated to this slice).
- Structural lineup artifact: `.gsd/exec/role-outfit-lineup.json` (`planning #3B5998`, `core-dev #5BD55B`, `infrastructure #FF8C00`, `support #9B5BD5`, plus a distinct fallback skin).

## Visual proof note (NEEDS-HUMAN)

The slice's proof level is "unit + visual (screenshot of all roles side by side)". The extension host cannot be launched in the headless continuation-lane environment, so the side-by-side screenshot was **not** captured and is recorded as **NEEDS-HUMAN**. The structural distinctness test (`tests/roleOutfitLineup.test.ts`) plus the Nitro tint draw-path test are the executable proof until a human captures the debug-grid screenshot via `habbo-pixel-agents.debugSpawn`.

## Forward Intelligence

### What the next slice should know
- S02 builds the editor on `OutfitConfig` + `FIGURE_CATALOG` and must reuse `createNitroAvatarRenderable` for a WYSIWYG preview (see D032).
- The role model is the 4 `TeamSection` values; do not introduce an 8-value enum without an owner re-open.

### What's fragile
- The Nitro/PixelLab split is intentional and locked by T03; PixelLab avatars ignore `spec.outfit` by design.
- The `getRolePreset` result shares the `parts` reference with `ROLE_OUTFIT_PRESETS[team]`; only `colors` is cloned per call.
