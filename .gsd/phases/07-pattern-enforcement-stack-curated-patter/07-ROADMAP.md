# M007: Pattern-enforcement stack: curated patterns.dev skills + enforceable rules (ESLint + abide JEV) for agent-written code

**Vision:** Agent-written frontend code follows patterns.dev guidance, and the enforce-worthy subset is actually enforced: skills give in-context guidance at write time, ESLint enforces syntax-level rules deterministically in CI, and abide JEV judges the unlintable code-shape rules from each diff — plus a written spec for the GSD process rules neither layer can see. Work is project-local, no secrets in-repo, and everything is reversible.

## Success Criteria

- Curated patterns.dev skills installed under .opencode/skills/ and discoverable by opencode; refresh procedure documented
- Fresh AGENTS.md carries only concretely-shaped, diff-checkable rules plus the positive-form GSD workflow mandate; CLAUDE.md wording aligned; no contradictions
- ESLint (typescript-eslint + react-hooks) green on src/tests via npm run lint and wired into CI
- abide/JEV trial: project-local setup, rubric compiled from AGENTS.md, calibrated against git history, audit output reviewed; TypeSafe key placement documented
- GSD process hook-gate spec written (warn-first rollout, cross-harness hook wiring)

## Slices

- [ ] **S01: Curated patterns.dev skills installed (OpenCode, project-pinned)** `risk:low` `depends:[]`
  > After this: A new opencode session lists the curated skills and can load one; the refresh procedure is documented.

- [ ] **S02: Fresh AGENTS.md: curated enforceable rules + positive-form GSD mandate** `risk:medium` `depends:[S01]`
  > After this: AGENTS.md exists with ~10-20 curated rules, each either diff-checkable (JEV candidate) or explicitly delegated to ESLint; GSD mandate reads as positive steps; no contradictions with CLAUDE.md and copilot-instructions.

- [ ] **S03: ESLint gate (typescript-eslint + react-hooks) wired into CI** `risk:medium` `depends:[]`
  > After this: npm run lint exits 0 locally; CI runs it on PR and push; a deliberately bad hook call fails lint.

- [ ] **S04: abide JEV trial stood up (project-local, OpenCode)** `risk:high` `depends:[S02]`
  > After this: .abide/rubric.json present with calibrated rules; abide audit runs against the repo and reports banded verdicts; key placement documented for the user.

- [ ] **S05: Spec: GSD process hook gate (warn-first, cross-harness)** `risk:low` `depends:[]`
  > After this: A docs spec covers detection signals, state storage, warn and block modes, exemptions, per-harness hook wiring, and a warn-first rollout plan.

## Boundary Map

Not provided.
<!-- gsd:state-version=77:0 -->
