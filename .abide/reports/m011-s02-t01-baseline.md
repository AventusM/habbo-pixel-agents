# M011/S02 T01 baseline — plugin + credential state (main + worktree)

Date: 2026-09-28. Presence-only credential evidence; no secret values recorded.

## 1. Plugin resolution

- `.opencode/plugins/abide.js` is tracked (`git ls-files` confirms) and present
  in both the main checkout and a fresh worktree (`git worktree add
  /tmp/gsd-m011s02-probe origin/main` → `.opencode/plugins/abide.js` present).
- Content: generated re-export of absolute
  `file:///Users/antonmoroz/.local/share/abide/packages/cli/opencode/abide.mjs`
  ("written by `abide init opencode`"). Target exists (8105 bytes, 2026-09-25).
  Fragility: absolute machine-local path — fresh machines need the setup step
  (see T02). Hook shells out to `node
  ~/.local/share/abide/packages/cli/dist/abide-hook.js <post-tool-use|…>`
  with the OpenCode event as JSON payload; that binary is what writes
  `.abide/events.jsonl`.

## 2. Credential state (presence only)

- `~/.abide/.env` exists (mode 600): names present =
  `TYPESAFE_AI_API_KEY`, `TYPESAFE_AI_BASE_URL`, `TYPESAFE_AI_MODEL_ID`.
  Machine-global source → worktree-resilient.
- Repo-root `.env` (untracked, gitignored): `TYPESAFE_AI_API_KEY`,
  `TYPESAFE_AI_BASE_URL`, `TYPESAFE_AI_MODEL_ID` names present among other keys.
- `TYPESAFE_AI_API_KEY` / `AI_GATEWAY_API_KEY` absent from process env.
- `abide report` judges successfully in both checkouts → credentials resolve
  in both (worktree via the global file; it has no `.env` of its own).

## 3. Main-checkout probe (agent Write tool → live plugin hook)

Probe `probe-abide-t01.ts` (hook-shaped `useProbeRemoteCards` with raw
`fetch`, i.e. a deliberate no-fetch-in-components violation). The edit was
intercepted at Write time with two `act` repair messages (0.97, 0.98) and
produced 2 `check` entries in main `.abide/events.jsonl` (blocked:true):

```json
{"kind":"check","at":"2026-09-28T22:21:26.743Z","phase":"edit","sessionId":"ses_f15e576e9ffeBHyRkoOY4hDxnm","promptId":"msg_0ea1aa1c8001CWky75bn3w6sEx","files":["probe-abide-t01.ts"],"rules":7,"latencyMs":854,"modelLatencyMs":844,"usage":{"inputTokens":1454,"outputTokens":154,"costUsd":0.000061068},"verdicts":[{"ruleId":"no-new-object-in-memo-props","probability":0.03,"band":"clear"},{"ruleId":"no-derived-state-effect","probability":0.1,"band":"clear"},{"ruleId":"no-listener-without-cleanup","probability":0.1,"band":"clear"},{"ruleId":"no-fetch-in-components","probability":0.97,"band":"act"},{"ruleId":"lazy-loading-fallback","probability":0.02,"band":"clear"},{"ruleId":"no-children-clone-for-state","probability":0.02,"band":"clear"},{"ruleId":"no-app-logic-in-components","probability":0.06,"band":"clear"}],"blocked":true}
{"kind":"check","at":"2026-09-28T22:21:27.728Z","phase":"edit","sessionId":"ses_f15e576e9ffeBHyRkoOY4hDxnm","promptId":"msg_0ea1aa1c8001CWky75bn3w6sEx","files":["probe-abide-t01.ts"],"rules":7,"latencyMs":786,"modelLatencyMs":777,"usage":{"inputTokens":1454,"outputTokens":154,"costUsd":0.000061068},"verdicts":[{"ruleId":"no-new-object-in-memo-props","probability":0.03,"band":"clear"},{"ruleId":"no-derived-state-effect","probability":0.11,"band":"clear"},{"ruleId":"no-listener-without-cleanup","probability":0.07,"band":"clear"},{"ruleId":"no-fetch-in-components","probability":0.98,"band":"act"},{"ruleId":"lazy-loading-fallback","probability":0.02,"band":"clear"},{"ruleId":"no-children-clone-for-state","probability":0.02,"band":"clear"},{"ruleId":"no-app-logic-in-components","probability":0.06,"band":"clear"}],"blocked":true}
```

## 4. Fresh-worktree probe

- CLI path: `abide check probe-abide-t01.ts` in the worktree judges correctly
  (7 rules, 1 call, 0.98 no-fetch-in-components, "1 to repair") BUT writes no
  `.abide/events.jsonl` in the worktree — CLI verdicts surface on stdout only
  (confirmed in main too: events line count unchanged 1256 across a CLI run).
  Events are written by the agent hook path, not the CLI.
- True hook path: piping a Write-shaped payload (real probe file content,
  `cwd` = worktree) into the exact hook binary the plugin shells out to
  (`abide-hook.js post-tool-use`) returns `decision:block` (0.98 act) and
  appends a `check` entry to the worktree `.abide/events.jsonl` — no skip:

```json
{"kind":"check","at":"2026-09-28T22:22:56.157Z","phase":"edit","sessionId":"ses_probe_m011s02_t01b","promptId":"msg_probe2","files":["probe-abide-t01.ts"],"rules":7,"latencyMs":930,"modelLatencyMs":920,"usage":{"inputTokens":1296,"outputTokens":154,"costUsd":0.00005443200000000001},"verdicts":[{"ruleId":"no-new-object-in-memo-props","probability":0.02,"band":"clear"},{"ruleId":"no-derived-state-effect","probability":0.12,"band":"clear"},{"ruleId":"no-listener-without-cleanup","probability":0.06,"band":"clear"},{"ruleId":"no-fetch-in-components","probability":0.98,"band":"act"},{"ruleId":"lazy-loading-fallback","probability":0.02,"band":"clear"},{"ruleId":"no-children-clone-for-state","probability":0.01,"band":"clear"},{"ruleId":"no-app-logic-in-components","probability":0.05,"band":"clear"}],"blocked":true}
```

(Caveat: the first hook-path attempt passed `content:"x"` and correctly
returned all-clear 0.02–0.05 — the judge judges the payload content, so probes
must carry the real file bytes. Re-run above uses real bytes.)

## 5. Notes for T02

- `git status --porcelain` in main: 0.03s — no snapshot-cost problem now, so
  no `.gitignore` tuning justified.
- Recent `turn`-phase skips in main events ("git could not snapshot the working
  tree in time", 22:00–22:20Z) look transient; edit-phase checks are unaffected.
- Probe files removed after evidence capture; worktree
  `/tmp/gsd-m011s02-probe` kept for T02 re-runs, then removed.
