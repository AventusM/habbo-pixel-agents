# M007: Pattern-enforcement stack: curated patterns.dev skills + enforceable rules (ESLint + abide JEV) for agent-written code

**Vision:** Agent-written frontend code follows patterns.dev guidance, and the enforce-worthy subset is actually enforced: skills give in-context guidance at write time, ESLint enforces syntax-level rules deterministically in CI, and abide JEV judges the unlintable code-shape rules from each diff — plus a written spec for the GSD process rules neither layer can see. Work is project-local, no secrets in-repo, and everything is reversible.

## Success Criteria

- Curated patterns.dev skills installed under .opencode/skills/ and discoverable by opencode; refresh procedure documented
- Fresh AGENTS.md carries only concretely-shaped, diff-checkable rules plus the positive-form GSD workflow mandate; CLAUDE.md wording aligned; no contradictions
- ESLint (typescript-eslint + react-hooks) green on src/tests via npm run lint and wired into CI
- abide/JEV trial: project-local setup, rubric compiled from AGENTS.md, calibrated against git history, audit output reviewed; TypeSafe key placement documented
- GSD process hook-gate spec written (warn-first rollout, cross-harness hook wiring)

## Slices

## Boundary Map

Not provided.
<!-- gsd:state-version=86:0 -->
