---
applyTo: ".gsd/**"
---

# GSD Phase Instructions

## Before Starting

Always read these files first:
- `.gsd/PROJECT.md` — project vision, constraints, validated requirements
- `.gsd/REQUIREMENTS.md` — all requirements with statuses and IDs
- `.gsd/DECISIONS.md` — 100+ architectural decisions to follow
- `.gsd/milestones/Mxxx/Mxxx-ROADMAP.md` — current milestone roadmap

## Directory Structure

Create slice directories under the correct milestone:

```
.gsd/milestones/Mxxx/slices/Sxx/
  Sxx-PLAN.md        # Goal, must-haves, tasks, files
  tasks/
    T01-PLAN.md      # Task specification
    T01-SUMMARY.md   # Completion details
  Sxx-SUMMARY.md     # YAML frontmatter + narrative (after completion)
  Sxx-UAT.md         # Verification report (after completion)
```

## Plan Format (Sxx-PLAN.md)

```markdown
# Sxx: Title

**Goal:** One-sentence deliverable
**Demo:** What the user can observe when done

## Must-Haves

- Acceptance criterion 1
- Acceptance criterion 2

## Tasks

- [ ] **T01: task-name** `est:Nm`
  - Why: purpose
  - Files: `path/to/file.ts`
  - Do: detailed action
  - Verify: how to check
  - Done when: success criterion

## Files Likely Touched

- `src/relevant-file.ts`
```

## Summary Format (Sxx-SUMMARY.md)

```yaml
---
id: Sxx
parent: Mxxx
milestone: Mxxx
provides:
  - what this slice delivers
requires:
  - slice: Syy
    provides: what was needed from the dependency
affects: []
key_files:
  - src/modified-file.ts
key_decisions:
  - Decision made during implementation
patterns_established:
  - Reusable pattern introduced
observability_surfaces:
  - none
drill_down_paths: []
duration: Nm
verification_result: passed
completed_at: YYYY-MM-DD
---

# Sxx: Title

**Summary sentence.**

## What Happened

Narrative of what was implemented.

## Verification

Test results summary.

## Files Created/Modified

- `src/file.ts` — what changed

## Forward Intelligence

### What the next slice should know
- Key context for future work

### What's fragile
- Edge cases or limitations
```

## UAT Format (Sxx-UAT.md)

```markdown
# Sxx: Title — UAT

**Milestone:** Mxxx
**Written:** YYYY-MM-DD

## UAT Type

- UAT mode: artifact-driven | runtime
- Why this mode is sufficient: explanation

## Smoke Test

Run `npx vitest run tests/relevant.test.ts` — all tests pass.

## Test Cases

### 1. Test case name

1. Steps to verify
2. **Expected:** outcome

## Failure Signals

- What would indicate a problem

## Requirements Proved By This UAT

- REQ-ID — requirement description
```

## Commit Convention

- `feat(Mxxx/Sxx): description` — one atomic commit per task
- Always run `npx vitest run` before committing
- Always run `node esbuild.config.mjs` to verify build

## Rules

- Always create PLAN before implementing
- Always create SUMMARY + UAT after completing
- Never skip UAT
- Never modify completed slices
- Ask before adding new requirements to REQUIREMENTS.md
- Ask before modifying DECISIONS.md
