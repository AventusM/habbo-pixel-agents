# T02: 16-agent-factory-workflow 02

**Slice:** S09 — **Milestone:** M002

## Description

Build the room layout engine that generates 2x2 section grid templates with visual dividers and doorways.

Purpose: The multi-section floor is the spatial foundation for team zones. Without it, agents have no sections to be assigned to.
Output: `roomLayoutEngine.ts` with template generation for 3 sizes, and tests.

## Must-Haves

- [ ] "Three template sizes (small/medium/large) produce valid heightmaps"
- [ ] "Each template has 4 sections in a 2x2 grid with open doorways"
- [ ] "Section boundaries include teleport booth tile positions"
- [ ] "Generated heightmaps are all flat elevation (height 0)"

## Files

- `src/roomLayoutEngine.ts`
- `tests/roomLayoutEngine.test.ts`
