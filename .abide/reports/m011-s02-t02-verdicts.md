# M011/S02 T02 — plugin loads + intercepts everywhere (main + worktrees)

Date: 2026-09-28. Outcome: **no repo code change required** — interception
already works in both locations from tracked files on this machine; the
per-checkout machine-setup step was verified reproducible instead.

## Machine-setup verification (the "fix or document" candidate)

- Ran `abide init opencode --project` inside the fresh worktree
  (`/tmp/gsd-m011s02-probe`, detached at origin/main `ce067bc`).
- Result: `✓ TypeSafe key found in /Users/antonmoroz/.abide/.env`,
  `✓ hook self-test passed`, rubric present (16 rules), and the regenerated
  `.opencode/plugins/abide.js` is **byte-identical** (`diff` → IDENTICAL) to
  the tracked file.
- Conclusion: fresh checkouts inherit a working hook from tracked files alone;
  `abide init opencode` per checkout is the documented repair path for machines
  where `~/.local/share/abide` is absent (absolute `file://` re-export), and it
  reproduces the committed file exactly. No `.gitignore` tuning: `git status
  --porcelain` in main costs 0.03s, so no snapshot-cost justification.

## Main-checkout probe (re-run, agent Write → live plugin hook)

Fresh probe `probe-abide-t02.ts`, intercepted at Write time (0.98 / 0.97 act).
Quoted `.abide/events.jsonl` lines:

```json
{"kind":"check","at":"2026-09-28T22:23:55.309Z","phase":"edit","sessionId":"ses_f15e576e9ffeBHyRkoOY4hDxnm","promptId":"msg_0ea1aa1c8001CWky75bn3w6sEx","files":["probe-abide-t02.ts"],"rules":7,"latencyMs":953,"modelLatencyMs":944,"usage":{"inputTokens":1457,"outputTokens":154,"costUsd":0.00006119400000000001},"verdicts":[{"ruleId":"no-new-object-in-memo-props","probability":0.03,"band":"clear"},{"ruleId":"no-derived-state-effect","probability":0.12,"band":"clear"},{"ruleId":"no-listener-without-cleanup","probability":0.08,"band":"clear"},{"ruleId":"no-fetch-in-components","probability":0.98,"band":"act"},{"ruleId":"lazy-loading-fallback","probability":0.02,"band":"clear"},{"ruleId":"no-children-clone-for-state","probability":0.01,"band":"clear"},{"ruleId":"no-app-logic-in-components","probability":0.05,"band":"clear"}],"blocked":true}
{"kind":"check","at":"2026-09-28T22:23:56.375Z","phase":"edit","sessionId":"ses_f15e576e9ffeBHyRkoOY4hDxnm","promptId":"msg_0ea1aa1c8001CWky75bn3w6sEx","files":["probe-abide-t02.ts"],"rules":7,"latencyMs":833,"modelLatencyMs":822,"usage":{"inputTokens":1457,"outputTokens":154,"costUsd":0.00006119400000000001},"verdicts":[{"ruleId":"no-new-object-in-memo-props","probability":0.03,"band":"clear"},{"ruleId":"no-derived-state-effect","probability":0.11,"band":"clear"},{"ruleId":"no-listener-without-cleanup","probability":0.09,"band":"clear"},{"ruleId":"no-fetch-in-components","probability":0.97,"band":"act"},{"ruleId":"lazy-loading-fallback","probability":0.02,"band":"clear"},{"ruleId":"no-children-clone-for-state","probability":0.02,"band":"clear"},{"ruleId":"no-app-logic-in-components","probability":0.05,"band":"clear"}],"blocked":true}
```

## Fresh-worktree probe (re-run, true hook path, no skip)

Same probe bytes driven through the exact hook binary the plugin shells out to
(`abide-hook.js post-tool-use`, `cwd` = worktree): `decision:block`, 0.98 act.
Quoted worktree `.abide/events.jsonl` line:

```json
{"kind":"check","at":"2026-09-28T22:24:00.405Z","phase":"edit","sessionId":"ses_probe_m011s02_t02","promptId":"msg_probe_t02","files":["probe-abide-t02.ts"],"rules":7,"latencyMs":1007,"modelLatencyMs":997,"usage":{"inputTokens":1299,"outputTokens":154,"costUsd":0.00005455800000000001},"verdicts":[{"ruleId":"no-new-object-in-memo-props","probability":0.03,"band":"clear"},{"ruleId":"no-derived-state-effect","probability":0.13,"band":"clear"},{"ruleId":"no-listener-without-cleanup","probability":0.05,"band":"clear"},{"ruleId":"no-fetch-in-components","probability":0.98,"band":"act"},{"ruleId":"lazy-loading-fallback","probability":0.02,"band":"clear"},{"ruleId":"no-children-clone-for-state","probability":0.01,"band":"clear"},{"ruleId":"no-app-logic-in-components","probability":0.05,"band":"clear"}],"blocked":true}
```

No `skip` entry; no error entry. Probe files removed from both checkouts after
capture. T02 verify satisfied: check verdict quoted for main and worktree.
