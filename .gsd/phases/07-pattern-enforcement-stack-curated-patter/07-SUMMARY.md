---
id: M007
title: "Pattern-enforcement stack: curated patterns.dev skills + enforceable rules (ESLint + abide JEV) for agent-written code"
status: complete
completed_at: 2026-09-26T08:46:51.237Z
key_decisions:
  - D019 enforcement layering (skills → ESLint → abide/JEV → hook gate)
  - D020 OpenCode Zen JEV backend for abide
  - D021 refactor convention rule no-app-logic-in-components
key_files:
  - AGENTS.md
  - .abide/rubric.json
  - .agents/skills/
  - skills-lock.json
  - eslint.config.js
  - docs/guides/GSD-HOOK-GATE.md
lessons_learned:
  - Bookkeeping drift recurs when delivery bypasses slice execution; the M005 two-way sync is the structural fix.
  - A rule that never fires reads as good news — prove rules by staging a violation before trusting them.
---

# M007: Pattern-enforcement stack: curated patterns.dev skills + enforceable rules (ESLint + abide JEV) for agent-written code

**Four-layer pattern-enforcement stack (skills → ESLint → abide/JEV → hook-gate spec) delivered and exercised live; slices sealed as skipped per D014.**

## What Happened

Delivered over five commits: S01 curated 16 patterns.dev skills (+README, skills-lock.json, opencode.json skills.paths); S02 made AGENTS.md the canonical rules file with CLAUDE.md as an import shim; S03 wired the ESLint gate (eslint.config.js; 0 errors) and cleared existing violations; S04 stood up the abide/JEV trial on OpenCode Zen (D020); S05 recorded the cross-harness hook-gate spec. The stack was verified live on 2026-09-26: a staged violating edit was blocked in-turn by the OpenCode plugin (0.98) and by `abide check` (0.97, exit 1), repaired in-turn, and re-checked clean; the D021 refactoring-convention rule was added to AGENTS.md and the rubric and fired at 0.89 on its violation shape. Bookkeeping: slices S01–S05 sealed as skipped with per-slice delivery reasons (D014 precedent — delivery ran outside GSD slice execution); task rows cascaded to skipped. Follow-ups: abide calibrate for the new rule; revisit the Zen endpoint when npm ships base-URL support (D020).

## Success Criteria Results

S01–S05 criteria met; see .gsd/phases/07-pattern-enforcement-stack-curated-patter/07-VALIDATION.md (verdict pass).

## Definition of Done Results

All five slice artifacts in-tree; enforcement exercised end-to-end live 2026-09-26 (abide intercept + repair; ESLint exit 0; rubric validates 16 rules / 10 JEV).

## Requirement Outcomes

Not provided.

## Deviations

Delivery ran via direct commits, not GSD slice execution; slices sealed as skipped with delivery reasons (D014 drift), tasks cascaded to skipped.

## Follow-ups

abide calibrate for no-app-logic-in-components; revisit Zen endpoint when npm ships base-URL support (D020).
