---
id: Q12
title: "Full-room rendering at any viewport + parallel asset loading"
type: quick
status: implemented (see Q12-SUMMARY.md)
created: 2026-09-06
files_modified:
  - src/RoomCanvas.tsx
  - src/web/main.tsx
  - src/webview.tsx
---

# Q12: Full-room rendering + load speed

See Q12-SUMMARY.md — buffer sized to the room's world extent (not the viewport),
camera navigates the buffer, Nitro assets load in parallel.
