# T01: 17.8-remove-copyrighted-habbo-characters 01

**Slice:** S18 — **Milestone:** M002

## Description

Generate 4 team-specific PixelLab characters and wire per-team atlas selection into the renderer.

Purpose: Before removing Habbo avatar code, all 4 teams must have distinct PixelLab characters so that removal leaves zero visual gaps. Each team gets a unique character: planning (suit/clipboard look), core-dev (hoodie/laptop — existing beanie-hoodie-guy works here), infrastructure (hard hat/tool-belt look), support (headset/help-desk look).

Output: 4 committed character spritesheets in assets/pixellab/, updated pixelLabAvatarRenderer.ts with per-team atlas selection, updated webview.tsx to load all atlases.

## Must-Haves

- [ ] "Each of the 4 teams (planning, core-dev, infrastructure, support) has a visually distinct PixelLab character"
- [ ] "Agents spawn with the correct team-specific character atlas"
- [ ] "All 4 character atlases load successfully in the webview"

## Files

- `assets/pixellab/pl-planning.png`
- `assets/pixellab/pl-planning.json`
- `assets/pixellab/pl-core-dev.png`
- `assets/pixellab/pl-core-dev.json`
- `assets/pixellab/pl-infrastructure.png`
- `assets/pixellab/pl-infrastructure.json`
- `assets/pixellab/pl-support.png`
- `assets/pixellab/pl-support.json`
- `src/pixelLabAvatarRenderer.ts`
- `src/avatarManager.ts`
- `src/webview.tsx`
- `src/extension.ts`
