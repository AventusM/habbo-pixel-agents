---
status: complete
phase: 12-room-walls-kanban-notes
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md
started: 2026-03-06T20:20:00Z
updated: 2026-03-06T21:45:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 7
name: Polling Updates
expected: |
  After the configured poll interval, newly added or status-changed cards on the GitHub Projects board are reflected on the wall sticky notes without reloading.
result: pass

## Tests

### 1. Wall Panels Render Behind Floor
expected: Room shows full-height isometric wall panels on left and back edges. Walls behind floor tiles. Corner post visible at back corner.
result: pass

### 2. Sticky Notes on Walls
expected: Colored sticky notes appear on both left and right walls, following the wall's isometric angle (skewed). Notes on left wall slant differently from notes on right wall. Notes have folded bottom-right corners.
result: pass

### 3. Demo Cards Display Without Config
expected: Without GitHub Projects settings configured, 6 demo sticky notes appear on walls (Setup CI, Auth flow, Dark mode, Unit tests, API docs, Deploy v2) with different colors per status.
result: pass

### 4. Click to Expand Note
expected: Clicking a wall sticky note opens a centered overlay panel with semi-transparent backdrop, showing the full title, status badge, and "click to close" hint.
result: pass

### 5. Click to Close Expanded Note
expected: Clicking anywhere while a note is expanded closes the overlay and returns to normal room view.
result: pass

### 6. GitHub Projects Sync (Live)
expected: With VS Code settings configured (owner, ownerType, projectNumber, pollIntervalSeconds), real kanban cards from a GitHub Projects board replace the demo cards on the walls.
result: pass

### 7. Polling Updates
expected: After the configured poll interval, newly added or status-changed cards on the GitHub Projects board are reflected on the wall sticky notes without reloading.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
