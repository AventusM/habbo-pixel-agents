# M009 browser smoke — 2026-09-27 (HEAD f644a65)

**How:** local `node scripts/web-server.mjs` (:3000, `/health` 200) + Paseo
browser tab (id `2d27add7-…`) on `/` and `/?editor=1`.

**Observed:**
- `document.title` = "Habbo Room", `readyState` = complete, 1 canvas mounted.
- A11y snapshot: Kanban filter, "Character Editor" button, "🟢 Connected",
  `board: probe`, `figures: local` — room boots and connects on both routes.
- 13 console entries + 30 network entries read; screenshot captured at
  1280x800. No navigation failure, no blank page.
- Unit/runtime gates same HEAD: vitest 69 files / 898 tests passed,
  `tsc --noEmit` exit 0, `npm run lint` 0 errors (86 pre-existing warnings),
  `node esbuild.config.mjs` exit 0.

**Covers:** S01 (web editor entry reachable via `?editor=1` deep link + room
loads with no VS Code), S02/S03 (same build that carries the merged S02/S03
commits; slice acceptance already recorded owner-side on #138/#139).
