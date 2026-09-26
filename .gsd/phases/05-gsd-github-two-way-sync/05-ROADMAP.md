# M005: GSD↔GitHub Two-Way Sync

**Vision:** GSD state and GitHub issues never drift again: closing/reopening an issue updates GSD, and GSD slice transitions comment/close the linked issue — loop-safe in both directions, linked by the M00X/S0X title-prefix convention the board already follows. (S01-S04 were the retired OMO scope, skipped per D011; S05-S07 are the replacement sync scope.)

## Success Criteria

- GitHub issue close/reopen updates GSD exactly once
- GSD slice transitions comment/close the linked issue exactly once
- No oscillation: one hop each way, then stop; full round-trip converges

## Slices

## Boundary Map

Not provided.
<!-- gsd:state-version=99:0 -->
