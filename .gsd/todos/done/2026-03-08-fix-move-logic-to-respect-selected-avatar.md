---
created: 2026-03-08T19:08:29.046Z
title: Fix move logic to respect selected avatar
area: ui
files:
  - src/RoomCanvas.tsx
---

## Problem

When moving a habbo avatar, the move logic picks the closest avatar to the target tile rather than the one the user has currently selected. This means if you select avatar A but click near avatar B, avatar B moves instead. The move action should always apply to the selected avatar regardless of proximity to the target tile.

## Solution

Fix the move handler to use the currently selected avatar ID instead of finding the nearest avatar to the clicked tile. The selection state should drive which avatar gets moved.
