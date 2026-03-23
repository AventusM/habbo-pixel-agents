---
id: M002
title: "Polish & Extended Features"
status: complete
started: 2025-03-01
completed: 2026-03-23
slices_total: 22
slices_passed: 17
slices_deferred: 5
validation_verdict: needs-attention
---

# M002: Polish & Extended Features — Summary

## What Was Delivered

Expanded the v1 isometric renderer into a full-featured agent visualization:

- **Furniture catalog** — 28+ curated items across 5 categories with data-driven registry
- **Avatar builder UI** — modal with category tabs, gender toggle, color palettes, wardrobe presets, extension-host persistence
- **Facial features** — eyes and mouth via `hh_human_face` asset, 13-layer figure composition
- **Chair layer splitting** — seat/backrest at different depth values for correct avatar sorting
- **Room walls & kanban notes** — full-perimeter wall panels with shared baseline, GitHub Projects sticky notes
- **Agent factory with 4 team sections** — classification pipeline, 2×2 section grid (3 room sizes), camera pan/zoom, teleport effects
- **Azure DevOps Boards integration** — WIQL+workitemsbatch REST API, kanban source toggle alongside GitHub Projects
- **PixelLab character integration** — generation API wired into renderer
- **Larger rooms** — 15×15 / 19×19 / 25×25 templates with multi-row desk placement
- **Section furniture** — 2 desk+chair combos per team section
- **Agent lifecycle fixes** — discovery dedup, parent filtering, meta.json authority, auto-despawn on completion, selected avatar movement
- **Visual bug fixes** — stray pixel elimination, walking animation clipping, right-click movement

## Deferred (5 slices)

- S05: Volter font as default
- S08: Performance optimization
- S18: Remove copyrighted Habbo characters (PixelLab generation works, full replacement deferred)
- S19: Architecture documentation
- S20: Architecture refactor

## Final State

- 373 tests across 25 files, all passing
- 57 requirements validated, 0 active
- 6 cosmetic type errors in test files only (non-blocking)

## Attention Items

1. Copyrighted cortex-assets remain as default fallback — track for future milestone
2. Test-file type drift should be cleaned in housekeeping
