## Linked slice issue

Closes #<n> (M000/S00: <slice title>)

## Outcome evidence

Every outcome ID must match an outcome ID from the linked issue — an outcome
mismatch refuses the merge (parity rule).

| Outcome | Evidence |
| ------- | -------- |
| O-1 | <commit SHA + what it proves> |
| O-2 | <commit SHA + what it proves> |

## Verification

- `npx vitest run` — <pass / notes>
- `npx tsc --noEmit` — <clean / notes>
- `npm run lint` — <when ts/tsx changed>

## abide/JEV compliance

One row per governed rule from `.abide/rubric.json` that scopes the changed
files. Bands come from the committed Q15 handoff report
(`.abide/reports/*-<headSha8>.{json,md}`) — never self-reported. `flag` is
advisory; `act` blocks. Whole-file findings identical on `origin/main` are
advisory; only diff-level bands block.

| Rule | Where applied | Band | Evidence |
| ---- | ------------- | ---- | -------- |
| <rule id> | <files / outcomes> | clear | <handoff report path or `abide check` ref> |

Verdict: <clear | empty (reason) | unverified (why, quoted)>

<!-- gsd-meta
milestone: M000
slice: S00
parent: main
stacked-on:
outcomes: O-1,O-2
human-merge: false
-->
