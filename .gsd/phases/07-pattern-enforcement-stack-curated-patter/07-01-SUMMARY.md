# S01 Summary — Curated patterns.dev skills installed (OpenCode, project-pinned)

**Milestone:** M007
**Slice:** S01
**Status:** done-in-fact (task rows pending — canonical completion needs a running attempt; same constraint as D018. Reconcile via a future auto pass or the M005 two-way sync.)

## What happened
- Inspected the `skills` CLI: repeatable `-s` flags, `-a opencode` supported, `--copy` avoids symlinks, project scope is the `-y` default, comma-separated skill lists fail.
- Scratch test determined the OpenCode install target: project-level `.agents/skills/<skill>/SKILL.md` plus `skills-lock.json` at repo root.
- Installed the curated 16 skills with `--copy`:
  - React: hooks-pattern, compound-pattern, render-props-pattern, presentational-container-pattern, react-composition-2026, react-render-optimization, client-side-rendering, ai-ui-patterns
  - JS: observer-pattern, mediator-pattern, module-pattern, factory-pattern, js-performance-patterns, virtual-lists, dynamic-import, bundle-splitting
- Registered `.agents/skills` in `opencode.json` (`skills.paths`) so opencode discovery is deterministic.
- Added `.agents/skills/README.md` with update/reinstall/add/remove commands and curation rationale.

## Evidence
- `find .agents/skills -name SKILL.md | wc -l` → 16
- Frontmatter check: name matches folder + description present for all 16 skill dirs
- `opencode.json` parses; `skills.paths = [".agents/skills"]`
- `skills-lock.json` present at repo root

## Deviations
- Planned target `.opencode/skills`; the CLI's OpenCode target is `.agents/skills`. Compensated via `skills.paths`.
- First install attempt accidentally pulled all 58 skills (zsh does not word-split unquoted variables); cleaned `.agents/` + lockfile and reinstalled exactly 16.

## Pending
- Runtime listing in a live opencode session requires a restart (skills load at startup).
