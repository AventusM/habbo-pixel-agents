# GSD State

**Active Milestone:** M001: RetroDiffusion as Primary Pixel-Art Source
**Active Slice:** S01: Plan: RetroDiffusion as primary pixel-art source
**Phase:** planning
**Requirements Status:** 0 active · 0 validated · 0 deferred · 0 out of scope

## Milestone Registry
- 🔄 **M001:** RetroDiffusion as Primary Pixel-Art Source
- ⬜ **M002:** Restore Original Habbo Figure Avatar System
- ⬜ **M003:** Refactor: Architecture Map, Failure-Mode Hardening, Render Layers, State Store
- ⬜ **M004:** Experiment harness - any board issue via zeroshot or gsd-loop, visualized in the room

## Recent Decisions
- D002 (M003/S01 completion, 2026-09-06. Evidence: docs/architecture/ARCHITECTURE.md): Adopt composite target architecture: hexagonal boundaries + unidirectional typed store + immediate-mode layered renderer, organized by feature slice -> core/ (typed stores: agents, cards, camera, mode), render/ (CanvasStage + WorldLayers, pure draw fns), adapters/ (ws-client, extension-bridge, demo-driver), assets/, integrations/, hosts/. Rejected: ECS, Clean/Onion ceremony, event sourcing.
- D003 (M003/S07 investigation, 2026-09-08. Evidence: docs/agent-hooks/INVESTIGATION.md): Adopt agent hooks for the GSD executor/reviewer roles and the asset-pipeline role; defer visualization-role and Mault-style detectors -> Prototypes validated (scripts/hooks/gsd-event-hook.mjs + room-tool-feed.mjs): GSD event-log tail reacts to planner/executor/reviewer commands; Claude Code PostToolUse hook tags tool activity by AGENT_ROLE with role-specific triggers. Both feed .gsd/hooks-feed.jsonl (append-only, gitignored). Adoption slice next: wire feed -> web-server WS -> status chip, project-level .claude/settings.json hooks, gate-evidence automation for milestones.
- D004 (gsd-loop trial #84/PR #85 completed 2026-09-09; M003 S03-S06 pending): Route M003 remaining slices (S03, S04, S05, S06) through the gsd-loop label queue; quick fixes stay direct-dispatch -> Hybrid routing: GSD Pi remains the planning authority (milestone/slice plans, evidence, DECISIONS); each remaining M003 slice ALSO gets a gsd-loop contract issue (canonical ## Outcomes checkbox format) - human applies gsd:ready to release the build lane; builder opens the PR; reviewer posts a pinned verdict; human merges. Quick fixes (Q-style) stay direct-dispatch.
- D005 (Post-M003/S04 delivery review, 2026-09-10): Implementation of the typed app-state stores delivered in M003/S04 (agents, kanban, camera, app mode) -> Adopt zustand/vanilla (v5) as the store engine, replacing the hand-rolled Store<T> pub-sub in src/state/store.ts. Keep the typed domain stores as thin layers; preserve subscription semantics consumers rely on (immediate current-value delivery, camera object identity, no-op-safe updates).
- D006 (M003/S06 (#80) contract rewrite, 2026-09-10): M003/S06 delivery model for the live wall (public hosting vs local/tailnet access) -> Run the standalone web-server locally and expose it to the owner's own devices over a Tailscale tailnet (`tailscale serve`, HTTPS via the *.ts.net MagicDNS name) instead of deploying to a public/cloud host. Board updates default to the S05 ETag probe (~10s); an optional `tailscale funnel` exposes only /webhooks/github for ~1–2s updates with HMAC. Docker/compose becomes an optional alternative.

## Blockers
- None

## Next Action
Slice S01 has no DB tasks. Plan slice tasks before execution.
