# S05 Summary — GSD hook gate spec

**Milestone:** M007
**Slice:** S05
**Status:** done-in-fact (task rows pending per D018 precedent)

## What happened
- Wrote `docs/guides/GSD-HOOK-GATE.md`: a warn-first spec for a cross-harness hook gate that requires GSD context (a `gsd_gsd_*` MCP call in-session within a TTL) before implementation edits.
- Grounded in the existing hook surfaces: `.opencode/plugin/role-feed.ts` (tool.execute.after feed), `.github/hooks/project-hooks.json` (Copilot preToolUse with the guard-gsd-db.mjs stdin/exit-2 contract), `.claude/settings.json` (PostToolUse), `scripts/hooks/guard-gsd-db.mjs` (deny contract).
- Covers: signals A/B, state file design (`.gsd/runtime/gsd-gate/<sessionId>.json`), config (`.gsd/gate.config.json`: mode warn|block, TTL, enforce/exempt paths, `GSD_GATE=off` bypass), per-harness wiring, warn-first rollout, risks and open questions.

## Evidence
- `docs/guides/GSD-HOOK-GATE.md` exists; sections reviewed against the four hook surfaces above.

## Notes
- Spec only; no code changes. Implementation remains a future slice.
