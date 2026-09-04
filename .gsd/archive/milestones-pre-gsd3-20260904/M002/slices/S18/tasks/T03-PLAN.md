# T03: 17.8-remove-copyrighted-habbo-characters 03

**Slice:** S18 — **Milestone:** M002

## Description

Full codebase audit for leftover Habbo figure references and UAT verification.

Purpose: Per user requirements, a full codebase audit after removal is mandatory to catch any remaining figure-related imports, references, or dead code paths. This plan also includes a human verification checkpoint to confirm the room view renders correctly with team-specific characters and the legend panel.

Output: Clean codebase with zero Habbo figure/character references. Visual verification of room rendering.

## Must-Haves

- [ ] "No remaining references to deleted Habbo figure files anywhere in the codebase"
- [ ] "No dead imports or orphaned references to figure/outfit/builder code"
- [ ] "All tests pass (pre-existing failures excluded)"
- [ ] "Room view renders agents with correct team-specific PixelLab characters"
- [ ] "Character legend panel is visible and correctly maps teams to characters"
