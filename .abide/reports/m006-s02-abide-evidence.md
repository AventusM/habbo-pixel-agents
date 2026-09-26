# M006/S02 — abide/JEV evidence for the changed files

- PR branch: `gsd/m006-s02-character-editor-ui`
- Reviewed head sha at evidence time: **`8edf245`** (slice seal commit; the report commits after it are report-only)
- Slice: M006/S02 (character editor UI with live preview), sealed as skipped with delivery reasons per the D014 precedent; issue #107 reconciled (comment-only).
- **Judge model: paid `jev-1.13`** (not the free tier).
- Q15 handoff tooling: **not merged** — `scripts/hooks/jeve-report.mjs` does not exist on `origin/main` (it lives only on the unmerged `gsd/q15-jeve-handoff` branch), so no Q15 `.abide/reports/*-<sha8>.{json,md}` pair could be produced. Per the #128 repair pattern the raw `abide check`/`abide audit` output is committed verbatim instead.

## Paid judge model (free tier was rate-limited)

The first attempt this pass used abide's default judge, the free tier `jev-1.13-free`, which the
gateway rejected with `429 FreeUsageLimitError` for every request — both the edit-phase hook and
manual runs. abide freezes its judge model from `TYPESAFE_AI_MODEL_ID` at import (default
`jev-1.13-free`), so a `.env` entry never reached it. The paid model is now pinned wherever abide
is invoked:

- `~/.local/bin/abide` (CLI wrapper) — `export TYPESAFE_AI_MODEL_ID=jev-1.13`
- `~/.config/opencode/plugins/abide.js` (the opencode hook, which spawns `dist/abide-hook.js` with
  this process env) — `process.env.TYPESAFE_AI_MODEL_ID = "jev-1.13"`

With the paid judge, `abide check` and `abide audit` both run (no 429).

## Result — edit check: 10 files, every governed rule `clear`

Raw output: `.abide/reports/m006-s02-abide-check.json` (produced from this branch's diff checked out
over `origin/main` in an isolated worktree).

| changed file | rules judged | verdict |
| --- | --- | --- |
| `src/RoomCanvas.tsx` | 9 | all `clear` (incl. `no-frame-allocations` 0.18, `no-app-logic-in-components` 0.18) |
| `src/components/AvatarPreview.tsx` | 8 | all `clear` |
| `src/components/CharacterEditorPanel.tsx` | 8 | all `clear` |
| `src/hooks/useCharacterEditor.ts` | 2 | all `clear` |
| `src/render/avatarPreview.ts` | 2 | all `clear` |
| `src/state/outfitStore.ts` | 2 | all `clear` |
| `tests/avatarPreview.test.ts` | 2 | all `clear` |
| `tests/characterEditorViewModel.test.ts` | 2 | all `clear` |
| `tests/components.test.ts` | 2 | all `clear` |
| `tests/outfitStore.test.ts` | 2 | all `clear` |

No `act` and no `blocked` bands at the diff level.

## Whole-file audit — RoomCanvas findings are pre-existing on `origin/main`

`abide audit` judges a whole file *"as if just written"* (a different lens; it includes code the
diff did not touch). It reports `act` for `no-frame-allocations` and `no-app-logic-in-components`
on `src/RoomCanvas.tsx` and `flag` for `no-listener-without-cleanup`.

These are **identical on `origin/main` without this change**, so they are pre-existing and advisory
(the review rule blocks only diff-level bands). Base comparison committed at
`.abide/reports/m006-s02-abide-audit-baseroomcanvas.json`:

| rule | `src/RoomCanvas.tsx` on `origin/main` | on this branch (diff adds only a hook call + overlay JSX) |
| --- | --- | --- |
| `no-app-logic-in-components` | act 0.94 | act (whole-file; diff `clear` 0.18) |
| `no-frame-allocations` | act 0.94 | act (whole-file; diff `clear` 0.18) |
| `no-listener-without-cleanup` | clear 0.32 | flag (whole-file; diff `clear` 0.08) |

Full audit: `.abide/reports/m006-s02-abide-audit.json` (files=10, `broken` only on `RoomCanvas` for
the two pre-existing rules).

## Deterministic evidence that also passed

| gate | command | result |
| --- | --- | --- |
| tests | `npx vitest run` | **762 passed** (58 files) |
| types | `npx tsc --noEmit` | **exit 0** |
| lint | `npm run lint` | **0 errors** (warnings only — pre-existing `no-explicit-any` backlog) |
| build | `node esbuild.config.mjs` | **exit 0** (extension + webview + web; assets copied) |

## How to reproduce

```bash
git worktree add --detach /tmp/m006s02-abide origin/main
git -C /tmp/m006s02-abide checkout gsd/m006-s02-character-editor-ui -- \
  src/state/outfitStore.ts tests/outfitStore.test.ts \
  src/hooks/useCharacterEditor.ts tests/characterEditorViewModel.test.ts \
  src/components/CharacterEditorPanel.tsx tests/components.test.ts \
  src/render/avatarPreview.ts src/components/AvatarPreview.tsx \
  tests/avatarPreview.test.ts src/RoomCanvas.tsx
cd /tmp/m006s02-abide && abide check --json
cd /tmp/m006s02-abide && abide audit <same files> --json
# base comparison
git worktree add --detach /tmp/m006s02-base origin/main
cd /tmp/m006s02-base && abide audit src/RoomCanvas.tsx --json
```
