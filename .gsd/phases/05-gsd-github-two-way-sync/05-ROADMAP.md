# M005: GSD↔GitHub Two-Way Sync

**Vision:** GSD state and GitHub issues never drift again: closing/reopening an issue updates GSD, and GSD slice transitions comment/close the linked issue — loop-safe in both directions, linked by the M00X/S0X title-prefix convention the board already follows. (S01-S04 were the retired OMO scope, skipped per D011; S05-S07 are the replacement sync scope.)

## Success Criteria

- GitHub issue close/reopen updates GSD exactly once
- GSD slice transitions comment/close the linked issue exactly once
- No oscillation: one hop each way, then stop; full round-trip converges

## Slices

- [ ] **S05: GitHub→GSD webhook branch** `risk:medium` `depends:[]`
  > After this: Close a scratch M00X/S0X-titled issue on GitHub; GSD records validation evidence (or flags the slice) within the webhook debounce window.

- [ ] **S06: GSD→GitHub hook reactions** `risk:medium` `depends:[S05]`
  > After this: Skip/complete a GSD slice; the linked GitHub issue receives a bot comment (and closes on completion) within seconds.

- [ ] **S07: Backfill + UAT round-trip** `risk:low` `depends:[S06]`
  > After this: One-time bidirectional reconcile report, then a live close→sync→reopen→sync round-trip on a scratch issue with both sides agreeing at each step.

## Boundary Map

Not provided.
<!-- gsd:state-version=93:0 -->
