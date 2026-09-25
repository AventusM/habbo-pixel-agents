# S02 Summary — Fresh AGENTS.md: curated enforceable rules + positive-form GSD mandate

**Milestone:** M007
**Slice:** S02
**Status:** done-in-fact (task rows pending per D018 precedent)

## What happened
- Extracted the Instructions sections from all 16 curated skills; distilled 9 diff-observable rules.
- Authored `AGENTS.md` (91 lines) as the canonical agent ruleset: positive-form GSD workflow (5 steps + D018 fallback note), 3 ESLint-tier rules, 9 abide/JEV-tier rules, guidance pointer to `.agents/skills`, terminal-output safety, furniture pipeline, enforcement map.
- Reworded the CLAUDE.md GSD section from prohibition to positive steps and added the D018 fallback convention.
- Verified: CLAUDE.md contains 0 instances of "Do NOT implement"; AGENTS.md contains 8 "must not" bullets + 1 "must render" rule (9 JEV rules total).

## Rule delegation map (final)
| Rule | Bucket | Enforced by |
| --- | --- | --- |
| GSD workflow steps | unenforceable (process) | hook gate (S05 spec) |
| Hooks top-level only | lint | ESLint react-hooks (S03) |
| Dependency arrays complete | lint | ESLint react-hooks (S03) |
| typescript-eslint recommended | lint | ESLint (S03) |
| No fresh literals in memoized-component props | model | JEV (S04 trial) |
| No inline literal as Context.Provider value | model | JEV |
| No useEffect that only derives render state | model | JEV |
| Listener/timer/subscription needs cleanup | model | JEV |
| No allocations in per-frame render path | model (scoped) | JEV |
| No fetch/XHR/WS inside components | model (scoped) | JEV |
| No extension-host imports in webview/web | model (scoped; eslint no-restricted-imports is a possible later upgrade) | JEV |
| Dynamic import needs loading fallback | model | JEV |
| No Children.map/cloneElement state injection | model | JEV |
| Terminal output safety | deferred (counting) + guidance | guidance/manual |
| Furniture pipeline | deferred (repo context) | guidance/manual |

## Curation notes
- `ai-ui-patterns` is Next.js/Vercel-AI-SDK-oriented; kept as guidance only, no rules extracted.
- `react-composition-2026` and `react-render-optimization` carry long-form instructions; rules derived conservatively.
- No React Compiler in this repo, so no "compiler handles memoization" rule.
- No react-window dependency, so virtual-list guidance stays advisory.

## Evidence
- `grep -c "Do NOT implement" CLAUDE.md` -> 0
- `grep -c "must not" AGENTS.md` -> 8 (+1 "must render" rule)
- `wc -l AGENTS.md` -> 91
