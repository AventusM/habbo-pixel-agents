# gsd-loop lane prompts (repo copies)

These files mirror the prompts of the Paseo scheduled tasks that run the GSD loop
lanes for this repository. They are versioned here so changes are reviewable in
git. The scheduled task prompt remains the runtime source until a sync check
exists (tracked by M010/S03).

| Lane | Paseo schedule | Cadence | Repo copy |
| --- | --- | --- | --- |
| build | `400a674a` (paused) | `*/15` Europe/Berlin | `loop/build.md` |
| review+merge | `21e18102` (active) | `*/20` Europe/Helsinki | `loop/review.md` |
| continue | `3c444d26` (paused) | hourly (FAST `*/10` mid-slice) | `loop/continue.md` |
| planner | `663556fb` (trigger-only, paused) | manual — user fires it | `loop/planner.md` |
| human gates digest | `43803fa5` (trigger-only) | manual | `loop/digest.md` |

## Rules

- Every lane change lands in BOTH the Paseo schedule and its repo copy; update the
  "Last synced" note below in the same change.
- These are repo-specific lane prompts, NOT the upstream gsd-loop playbooks. The
  gsd-loop skills only treat `loop/*.md` as canonical when the repository
  identifies as the gsd-loop source (`README.md` starts with `# gsd-loop`), which
  this repo does not.
- Never edit a prompt to weaken a guard without recording a decision (D-series).

## Last synced

2026-09-27 — review+merge v3: `0b` issue-reconcile sweep, `7b` post-merge issue
sync, and the HUMAN APPROVAL ("ok") rule (a fresh approval comment — postdating
the head commit, never a `gsd-loop`/`GSD:` comment — lifts `gsd:escalated` /
"Human merge only" / stacked-delivery gates; it never clears `gsd:blocked`).
2026-09-27 — continue v2: `2b` PLAN SYNC (D035 — publish planned slices as
`M00X/S0Y` issues, idempotent, cap 8/pass). New planner lane `663556fb`
(trigger-only): interviews the owner, plans milestones with the GSD tools,
commits the plan artifacts to main, and hands off issue publication to the
worker lane.
