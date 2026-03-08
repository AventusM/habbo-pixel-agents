---
phase: quick-fix
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/roomLayoutEngine.ts
autonomous: true
requirements: [QUICK-01]
must_haves:
  truths:
    - "Teleport booths are visible in all room sections"
    - "country_gate furniture renders correctly with direction 0"
  artifacts:
    - path: "src/roomLayoutEngine.ts"
      provides: "country_gate placement with valid direction"
      contains: "direction: 0"
  key_links:
    - from: "src/roomLayoutEngine.ts"
      to: "assets/habbo/furniture/country_gate.json"
      via: "direction must be in logic.directions [0, 6]"
      pattern: "direction: 0"
---

<objective>
Fix invisible teleport booths caused by country_gate being placed with direction 2, which is not in its supported directions [0, 6].

Purpose: country_gate furniture silently renders nothing when given an unsupported direction. Changing from 2 to 0 makes booths visible.
Output: Single line change in roomLayoutEngine.ts
</objective>

<execution_context>
@/Users/antonmoroz/.claude/get-shit-done/workflows/execute-plan.md
@/Users/antonmoroz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/roomLayoutEngine.ts (line 178: `direction: 2` must become `direction: 0`)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change country_gate direction from 2 to 0</name>
  <files>src/roomLayoutEngine.ts</files>
  <action>
In `getSectionFurniture()` (around line 178), change the country_gate furniture spec's `direction` from `2` to `0`.

The country_gate asset only supports directions [0, 6] (per its JSON metadata). Direction 2 causes silent render failure — no sprites exist for that direction so nothing is drawn.
  </action>
  <verify>
    <automated>npx vitest run tests/roomLayoutEngine.test.ts 2>&1 | tail -5</automated>
  </verify>
  <done>country_gate direction is 0, existing roomLayoutEngine tests pass, teleport booths will render visibly</done>
</task>

</tasks>

<verification>
- `grep -n "direction:" src/roomLayoutEngine.ts` shows direction 0 for country_gate
- All existing tests pass: `npx vitest run tests/roomLayoutEngine.test.ts`
</verification>

<success_criteria>
country_gate furniture placed with direction 0 (a supported direction), making teleport booths visible in all room sections.
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-invisible-teleport-booths-change-cou/1-SUMMARY.md`
</output>
