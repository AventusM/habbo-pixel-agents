# AGENTS.md — Habbo Pixel Agents

Canonical rules for AI agents working in this repository. Read this first.
`CLAUDE.md` and `.github/copilot-instructions.md` carry detailed project docs; where their wording
conflicts with this file, follow this file.

Pattern guidance is installed as agent skills in `.agents/skills/` (curated patterns.dev set) —
load the relevant skill before frontend work.

## Workflow: run every change through GSD

This applies to all new features, bug fixes, and refactoring — regardless of size.

1. **Orient with the GSD MCP server** (`gsd_gsd_*` tools). Read state from the SQLite-authoritative
   interface (`gsd_gsd_progress`, `gsd_gsd_query`, `gsd_gsd_roadmap`); treat markdown projections as
   generated views. Run `gsd_gsd_doctor` whenever state looks inconsistent.
2. **Plan before writing code** with `gsd_gsd_plan_milestone` / `gsd_gsd_plan_slice` /
   `gsd_gsd_plan_task`, or attach the change to the active slice/task.
3. **Record execution as you go**: `gsd_gsd_task_complete` per task, then `gsd_gsd_slice_complete`
   per slice.
4. **Close milestones through validation**: `gsd_gsd_validate_milestone`, then
   `gsd_gsd_complete_milestone`.
5. **When a canonical task cannot be closed mechanically** (no running attempt), record the outcome
   as a slice SUMMARY plus a decision and leave the task rows pending for the next auto pass; do not
   re-verify already-green evidence (precedent: D018).

Humans drive GSD from the TUI (`/gsd`, `/gsd next`, `/gsd auto`, `/gsd status`); agents use the MCP
tools directly.

## Enforced rules

Two enforcement tiers: **ESLint** (deterministic, every commit) and **abide/JEV** (judged per diff,
with in-turn repair). Every rule below is written as a concrete, diff-observable statement.

### ESLint tier (deterministic)

- Call React hooks only at the top level of components and custom hooks — never inside conditions,
  loops, or nested functions.
- List every referenced value in `useEffect`, `useCallback`, and `useMemo` dependency arrays.
- Follow the typescript-eslint recommended set (no unsafe `any` escapes, no unused variables).

### abide/JEV tier (judged per diff)

- A change must not add a newly created object, array, or function literal to the props of a
  memoized component.
- A change that adds a `Context.Provider` must not inline a newly created object, array, or
  function as its `value` prop.
- A change must not add a `useEffect` whose body only computes state that can be derived during
  render.
- A change must not add an event listener, timer, or subscription without a matching cleanup in
  the same hook or component.
- A change to the per-frame render path (`src/RoomCanvas.tsx` frame loop, `src/iso*Renderer*.ts`)
  must not allocate new objects, arrays, or closures inside the frame function.
- A change must not add `fetch`, XHR, or WebSocket calls inside React components — data flows
  through the existing clients (`src/web/wsClient.ts`, `src/githubProjects.ts`,
  `src/azureDevOpsBoards.ts`).
- A change must not import extension-host-only modules (Node builtins, `vscode`) into webview or
  web bundles.
- A change that adds a dynamically imported component (`React.lazy`, `import()`) must render a
  meaningful loading fallback while it loads.
- A change must not use `React.Children.map` with `cloneElement` to inject shared state into
  compound children — share state through context instead.

### Guidance tier (carried by skills, not enforced)

Broad pattern guidance lives in `.agents/skills/*/SKILL.md`: hooks, compound components, render
props, presentational/container split, render optimization, observer, mediator, factory, module,
dynamic import, bundle splitting, client-side rendering, virtual lists, AI UI. Load the relevant
skill before frontend work; guidance is advisory and reviewed in code review, not by JEV.

## Terminal output safety

- Keep every line of terminal output under ~140 characters.
- Format JSON with `JSON.stringify(obj, null, 2)`; pipe large output through `head -c 5000`.
- Prefer `npx vitest` for verification runs; with inline scripts (`node -e`, `npx tsx -e`), break
  arrays and objects across lines.

## Furniture pipeline

- Add or replace a sprite: drop the PNG in `assets/pixellab/furniture/`, run
  `node scripts/pack-pixellab-furniture.mjs <png> <furniture-id>`, register it in
  `src/furnitureRegistry.ts`, then run `node esbuild.config.mjs`. Options and conventions:
  `.github/copilot-instructions.md`.

## Project state

- **Framework**: GSD Pi (`@opengsd/gsd-pi`) v1.18+ — SQLite-authoritative state (`.gsd/gsd.db`) with markdown projections; runtime DB is gitignored.
- **State files**: `.gsd/` (PROJECT.md, DECISIONS.md, REQUIREMENTS.md, KNOWLEDGE.md); legacy history archived under `.gsd/archive/milestones-pre-gsd3-20260904/` (read-only).
- **Quick fixes**: `.gsd/quick/`; todos: `.gsd/todos/`.
- **Diagnostics**: `gsd_gsd_doctor` (MCP) or `gsd headless query` (non-interactive state snapshot).

## Enforcement map

| Rule class | Enforced by | Artifact |
| --- | --- | --- |
| Hooks rules and dependency arrays | ESLint (`react-hooks`) | `eslint.config.js`, CI |
| Diff-observable code-shape rules | abide/JEV | `.abide/rubric.json` (trial) |
| GSD process rules | hook gate (spec) | `docs/guides/GSD-HOOK-GATE.md` (pending) |
