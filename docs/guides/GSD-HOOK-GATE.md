# GSD Hook Gate — Spec (warn-first)

Status: draft, not implemented
Owner: M007 / S05
Related: `AGENTS.md` (Workflow), D018, `scripts/hooks/guard-gsd-db.mjs`, `.opencode/plugin/role-feed.ts`

## Purpose

Enforce the GSD process rules that neither ESLint nor abide/JEV can see. abide's compiler buckets
"is it about the conversation or the process rather than the code?" as `unenforceable` because JEV
only sees diffs — but a hook sees the session's tool calls. This gate answers one question:

> Did this session consult GSD before it started changing implementation files?

## Non-goals

- Not a merge gate; not a substitute for GSD state discipline.
- Does not validate what the GSD context says (task ids, plan quality) — only that GSD was consulted.
- Does not gate docs, `.gsd/**`, or read-only tools.

## Signals

| Signal | Meaning | Source |
| --- | --- | --- |
| A: GSD context seen | A `gsd_gsd_*` MCP call happened in this session within the TTL | `tool.execute.after` (opencode), `postToolUse` (Copilot/Claude) |
| B: implementation edit | `Write`/`Edit` (and `Bash` write patterns) touching an enforced path | `tool.execute.before` / `preToolUse` |

Gate: **if B and not A → warn or block** (mode-dependent).

## State

- Per-session file: `.gsd/runtime/gsd-gate/<sessionId>.json` (`runtime/` is gitignored).
- Fields: `sessionId`, `gsdSeenAt` (ISO), `warnedAt[]`, `modeOverride`.
- Best-effort writes; tolerate races. Fallback session key when a harness has no session id:
  `pid-<pid>` with a short TTL.
- TTL for signal A: 30 minutes default, configurable.

## Configuration

`.gsd/gate.config.json` (committed):

```json
{
  "mode": "warn",
  "ttlMinutes": 30,
  "enforcePaths": ["src/**", "tests/**", "scripts/**", "packages/**"],
  "exemptPaths": ["docs/**", "*.md", ".gsd/**", ".github/**"],
  "bypassEnv": "GSD_GATE"
}
```

- `mode`: `warn` (default) or `block`.
- `GSD_GATE=off` bypasses the gate for one command/session (explicit, logged).

## Modes

- **warn** — allow the edit; append a `gsd-gate` line to `.gsd/hooks-feed.jsonl`; surface a message
  where the harness supports it (best-effort). Use this for the first week.
- **block** — deny the edit with a reason: "Run GSD first: `gsd_gsd_progress` to orient, then
  `gsd_gsd_plan_*` to attach the change, or set `GSD_GATE=off` to bypass."

## Per-harness wiring

| Harness | Hook point | File | Deny mechanism |
| --- | --- | --- | --- |
| opencode | `tool.execute.before` (B) + `tool.execute.after` (A) | new `.opencode/plugin/gsd-gate.ts` | throw an `Error` from the before hook |
| Copilot | `preToolUse` | `.github/hooks/project-hooks.json` + new `scripts/hooks/guard-gsd-gate.mjs` | exit 2 with stderr reason (same contract as `guard-gsd-db.mjs`) |
| Claude Code | `PreToolUse` (add) | `.claude/settings.json` + same script | exit 2 blocks; `bypassPermissions` does not bypass hooks |

The shared script reuses the `guard-gsd-db.mjs` stdin contract:
`{ tool_name, tool_input: { command? | file_path? | ... } }`.

Tool-name matching for signal A (verify per harness at implementation):

- opencode: `gsd_gsd_progress`-style names → match `/^gsd_/`.
- Copilot / Claude: `mcp__gsd__gsd_progress`-style names → match `/gsd/i`.

## Rollout

1. Implement the script + opencode plugin in `warn` mode; run one week; review
   `.gsd/hooks-feed.jsonl` for false positives.
2. Flip `mode` to `block` for `src/**` only; keep warn for the rest.
3. Extend to Copilot and Claude Code after opencode behavior is validated.
4. Rollback: set `mode: "warn"`, or remove the hook entry. The gate never modifies code or state.

## Risks and open questions

- Session-id availability differs per harness; the fallback key must not collide across concurrent
  sessions.
- Hooks run per tool call; the script must stay fast (local file IO only, well under the 15s timeout).
- Avoid false positives on intentional non-GSD edits (hotfixes) — warn-first plus `GSD_GATE=off`.
- Complementary to `guard-gsd-db.mjs`: that one guards the state database; this one guards process
  context. Both can live in `preToolUse`.
- Whether opencode's `tool.execute.before` receives MCP tool calls for the gate's signal A — verify
  during implementation (if not, record signal A from `tool.execute.after` only).
