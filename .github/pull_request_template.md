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

No hand-written section: `.github/workflows/abide-judge.yml` runs `abide audit`
on the changed files (head vs base) and posts the per-rule result as a sticky
comment on this PR. It is a ratchet — only rules that get worse than base block.
Wait for that comment before requesting review.

<!-- gsd-meta
milestone: M000
slice: S00
parent: main
stacked-on:
outcomes: O-1,O-2
human-merge: false
-->
