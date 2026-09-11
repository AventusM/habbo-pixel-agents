# zeroshot probe (M004/S01/T01) — output shape and blockers

- Date: 2026-09-11
- zeroshot: 7.0.1; config `conductor-bootstrap` (2 agents); default provider `opencode`; default isolation `worktree`; default delivery `none`
- Probe input: plain-text read-only task ("List the top-level files ... Do not modify any files."), `--provider opencode`
- Raw log: `/tmp/zeroshot-probe.log`; cluster DB: `~/.zeroshot/astral-core-17.db` (table `messages`: topic/sender/content_text)

## Update — opencode-go is blocked for zeroshot/CLI (2026-09-11)

- `zeroshot --provider opencode --model opencode-go/deepseek-flash` is rejected by zeroshot's own validation (provider `opencode` only allows `opencode/*`, `google/*`, `openai/*`; no `opencode-go`).
- Direct CLI `opencode run --model opencode-go/deepseek-flash` fails with a gateway `UnknownError` (not credits, not transient; reproduced twice).
- The gsd-loop (Paseo) `opencode-go/deepseek-flash` path works, so opencode-go is healthy via Paseo but not via the local opencode CLI or zeroshot.
- Consequence: the zeroshot arm cannot run opencode-go models until the CLI/gateway is fixed or zeroshot supports them. T01 remains blocked on a funded, working model.

## Observed cluster structure

- Roles seen: `junior-conductor`, `senior-conductor`, `state-snapshotter`, `system`
- Task lifecycle events (per attempt): `ISSUE_OPENED -> TASK_ID_ASSIGNED -> PROCESS_SPAWNED -> TASK_FAILED|...`, plus `RETRY_SCHEDULED`; cluster ends with `CLUSTER_FAILED` after 3 attempts
- Config `conductor-bootstrap` = 2 agents; `senior-conductor` listens for `CONDUCTOR_ESCALATE` and validation failures

## Blocker 1 — worktree disk gate

- `zeroshot run` (worktree) requires 10GB free; host had ~4.1GB. `zeroshot gc` freed only orphaned DB files.
- Workaround used: `--no-isolation` (safe here: read-only probe; `git status` confirmed clean).
- Implication for S02: the dispatch harness cannot rely on zeroshot worktree isolation on this host until disk is freed; document and gate.

## Blocker 2 — Opencode provider has no credits (root cause)

- All 3 attempts failed with `Provider opencode failed (unknown; unknown-retryable)`.
- Direct CLI test shows the cause: the default model is `openai/gpt-5.6-sol` (OpenRouter) and the account cannot afford it ("can only afford 266" of 32000 tokens).
- Local opencode auth has: anthropic, github-copilot, zai-coding-plan, cerebras, fireworks-ai, openrouter, opencode-go. Funded model unknown without spending.
- Open question for owner: fund OpenRouter, or pick a funded opencode model via zeroshot `--model`, or switch the probe provider (Claude/Copilot).

## Log locations for the translators

- Cluster message bus: `~/.zeroshot/<cluster>.db`, table `messages` (topic, sender, content_text)
- Run stdout: captured per invocation (no central run log found)
- No successful-run artifact shape captured yet (blocked on credits)
