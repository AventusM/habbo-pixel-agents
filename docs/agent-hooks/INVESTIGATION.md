# Agent hooks investigation — deterministic automation per agent role

> M003/S07 prototype investigation (2026-09-08). Premise (owner): deterministic,
> hook-driven agentic development (as practiced via Mault.ai) is where the
> industry is converging. Question: what hooks are worth adopting **per agent
> role** in this project?

## 1. Agent roles in this project

| Role family | Concrete roles | Where they live |
|---|---|---|
| Room team agents | planning, core-dev, infrastructure, support (Alice/Bob-style) | `src/web/demoData.ts`, agent transcripts watched by `agentManager` |
| GSD workflow roles | planner (plan-*), executor (task execution), reviewer (validate/complete) | `.gsd/` event stream, GSD CLI |
| Copilot agent roles | asset-pipeline, visual-regression | `.github/agents/*.md`, `copilot-agent-monitor.yml` |
| (Adjacent) host roles | CI bot (demo-pages), sync workflows | `.github/workflows/` |

## 2. Hook surface inventory (all verified on this machine)

| Surface | Events observable | Actions possible | Already in use |
|---|---|---|---|
| **Claude Code hooks** (user `~/.claude/settings.json`) | SessionStart, UserPromptSubmit, PostToolUse, Stop, StopFailure, SessionEnd, Notification; matcher-scoped; stdin JSON with full tool input/response | stdout JSON control (block/ask/suppress), arbitrary commands, exit-code decisions | **Yes** — `gsd-check-update.js` (SessionStart), `gsd-context-monitor.js` (PostToolUse), paseo integration (Stop/StopFailure/UserPromptSubmit) |
| **GSD event stream** | `.gsd/event-log.jsonl` — every GSD mutation `{v, cmd, params, ts, actor, hash, session_id}`; also `workflow_domain_events` table + `journal_query` | arbitrary reaction scripts; the event log is authoritative + ordered | No — written but unread |
| **Agent JSONL transcripts** | per-agent tool calls, outputs, timestamps (the room's agent bubbles/HUD feed from these via `fs.watch`) | any file-watch reaction | Yes — `agentManager` (visualization only) |
| **Mault detectors** (`.mault/`) | repo genesis: audit-config, canary-log, reference/initialize | detector-style repo guards | Dormant (excluded from docs/specs in commit 77318d4) |
| **Git hooks** | pre-commit/pre-push | block/transform | None configured |
| **GitHub Actions** | PR/issue/projects events (pull_request_target, issues, workflow_dispatch) | comment, label, dispatch, board sync | Yes — `copilot-agent-monitor.yml`, `demo-pages.yml` |

Key insight: **the enforcement primitives already exist and half of them are
already running** — what's missing is role-aware reaction logic pointed at
project-specific goals.

## 3. Role × hook matrix (value rating: ★)

| Role | Hook (surface → event) | Deterministic action | Value |
|---|---|---|---|
| GSD planner | Claude Code PostToolUse → Edit/Write touching `.gsd/` without a plan artifact | warn + link the owning slice (prevents "orphan edits" like pre-GSD3) | ★★★ |
| GSD executor | GSD event stream → `task-complete` | auto-comment the mirrored GitHub issue with evidence | ★★★ |
| GSD reviewer | GSD event stream → `validate-milestone` | run typecheck + suite + post result as gate evidence | ★★★ |
| GSD planner | Claude Code Stop hook → session ended with uncommitted slice work | reminder + `git status` digest | ★★ |
| Room core-dev | PostToolUse → vitest/typecheck commands | cache last-green commit; flag the room bubble when red | ★★ |
| Room asset-pipeline (Copilot role) | PostToolUse → `pack-*` / `esbuild.config` touched | auto-run pack scripts + flag stale dist | ★★★ (this session ran these by hand repeatedly) |
| Room visual-regression (Copilot role) | PostToolUse → render-relevant files changed | queue screenshot diff | ★★ |
| Room infrastructure | PostToolUse → deploy files touched | validate workflow YAML + dry-run build | ★★ |
| Room team agents (any) | JSONL watcher (existing) | already visualized; hook adds role-tagged feed (prototype 2) | ★ |
| CI bot | Actions `pull_request` | already wired (demo-pages) | n/a |

## 4. Prototypes (both working — see `scripts/hooks/`)

**P1 — `gsd-event-hook.mjs`** (GSD planner/executor/reviewer path): tails
`.gsd/event-log.jsonl`, maps GSD commands to role reactions
(`plan-* → planner/room-notify`, `task/slice-complete → executor/board-update`,
`validate/complete-milestone → reviewer/gate-check`), appends structured events
to `.gsd/hooks-feed.jsonl`. Verified live against the real event log (slice/task
planning events mapped correctly).

**P2 — `room-tool-feed.mjs`** (room team roles + Copilot roles): a Claude Code
PostToolUse hook reading the hook JSON contract from stdin, tagging with
`AGENT_ROLE`, matching role-specific triggers (`asset-pipeline` fires on
`pack-*`/esbuild commands; `visual-regression` on vitest/screenshot;
`core-dev` on vitest/typecheck), feeding role-tagged events while suppressing
conversational noise (`suppressOutput: true`). Verified: Write captured,
pack-command trigger matched, Read suppressed.

Shared feed contract: `.gsd/hooks-feed.jsonl` (gitignored via `.gsd` rules) —
a single append-only stream any consumer (room web-server, status chip, board
updater) can tail. This mirrors the room's existing JSONL-watcher pattern.

## 5. Verdict per role

| Role | Verdict | Rationale |
|---|---|---|
| GSD executor/reviewer | **ADOPT** | Highest value-per-effort: event log already structured; auto-comment + gate evidence removes manual steps we did by hand this week (issue ticking, evidence collection) |
| Room asset-pipeline | **ADOPT** | Every asset change this session required manual pack+build; the trigger regex is trivial and the action deterministic |
| GSD planner | **ADOPT (light)** | Orphan-edit guard only; heavy enforcement would fight the GSD workflow |
| Room visual-regression / infrastructure | **DEFER** | Real value, but depends on S06 (hosted backend) for meaningful triggers; revisit after deployment exists |
| Room team agents (visualization) | **DEFER** | Room already shows tool activity; role-tagged feed adds color, not capability |
| Mault detectors | **DEFER** | Dormant since genesis; the Claude Code hooks + GSD stream cover the same goals with less machinery |

## 6. Recommended follow-up (not in this slice)

A small adoption slice: wire P1 into the web-server (feed → WS → status
chip/board), add project-level `.claude/settings.json` with the
asset-pipeline + executor hooks, and adopt the gate-evidence hook for GSD
milestones. Estimated small; depends on nothing.

## 7. Risks

- Hook scripts run with full agent permissions — keep them read+append-only
  on `.gsd/hooks-feed.jsonl` (both prototypes comply)
- Claude Code hooks are user-level first, project-level second — project
  `.claude/settings.json` hooks apply to every agent in this repo (including
  Copilot Coding Agent? — no: hooks are local-machine only; Copilot agents
  need Actions-based equivalents)
- Feed file grows unbounded — rotation needed at adoption time
