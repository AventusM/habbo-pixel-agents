// tests/isoPathfinding.test.ts
// Tests for BFS pathfinding

import { describe, it, expect } from 'vitest';
import { findPath, getRandomWalkableTile, isTileOccupied, computeBlockedTiles } from '../src/isoPathfinding.js';
import { parseHeightmap } from '../src/isoTypes.js';
import type { AvatarSpec } from '../src/isoAvatarRenderer.js';

function makeGrid(heightmap: string) {
  return parseHeightmap(heightmap);
}

describe('findPath', () => {
  it('finds straight-line path on open grid', () => {
    const grid = makeGrid([
      '00000',
      '00000',
      '00000',
    ].join('\n'));

    const path = findPath(grid, 0, 0, 4, 0);

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(2);
    expect(path![0]).toEqual({ tileX: 0, tileY: 0, tileZ: 0 });
    expect(path![path!.length - 1]).toEqual({ tileX: 4, tileY: 0, tileZ: 0 });
  });

  it('finds path around L-shaped wall', () => {
    const grid = makeGrid([
      '00000',
      '0xxx0',
      '0x000',
      '00000',
    ].join('\n'));

    const path = findPath(grid, 0, 0, 4, 2);

    expect(path).not.toBeNull();
    // Path must go around the wall
    expect(path!.length).toBeGreaterThan(3);
    expect(path![0]).toEqual({ tileX: 0, tileY: 0, tileZ: 0 });
    expect(path![path!.length - 1]).toEqual({ tileX: 4, tileY: 2, tileZ: 0 });

    // Verify all steps are walkable
    for (const step of path!) {
      const tile = grid.tiles[step.tileY][step.tileX];
      expect(tile).not.toBeNull();
    }
  });

  it('returns null for surrounded (unreachable) tile', () => {
    const grid = makeGrid([
      '00000',
      '0xxx0',
      '0x0x0',
      '0xxx0',
      '00000',
    ].join('\n'));

    const path = findPath(grid, 0, 0, 2, 2);
    expect(path).toBeNull();
  });

  it('returns single-step path when start equals destination', () => {
    const grid = makeGrid([
      '000',
      '000',
    ].join('\n'));

    const path = findPath(grid, 1, 1, 1, 1);

    expect(path).not.toBeNull();
    expect(path!).toHaveLength(1);
    expect(path![0]).toEqual({ tileX: 1, tileY: 1, tileZ: 0 });
  });

  it('prevents diagonal corner-cutting', () => {
    // Wall pattern where diagonal would cut through corners:
    //  0 0 0
    //  0 x 0
    //  0 0 0
    // Diagonal from (0,0) to (2,2) should NOT cut through the wall at (1,1)
    // ...but (1,1) is blocked, so the diagonal from (0,0) to (2,2) won't matter
    // since (0,0)→(1,1) diagonal is blocked anyway. Use a different pattern:
    //  0 0 0
    //  x x 0
    //  0 0 0
    // Path from (0,0) to (0,2): can't go diagonal (0,0)→(1,1) since (0,1) is x
    const grid = makeGrid([
      '000',
      'xx0',
      '000',
    ].join('\n'));

    const path = findPath(grid, 0, 0, 0, 2);

    expect(path).not.toBeNull();
    // Must go right first since direct diagonal is blocked by corner-cutting rule
    // (0,0) can't go to (1,1) because (0,1) is blocked
    // Path should go (0,0) → (1,0) → (2,0) → ... → (0,2)
    for (const step of path!) {
      const tile = grid.tiles[step.tileY][step.tileX];
      expect(tile).not.toBeNull();
    }
    // Verify no adjacent steps cut a corner
    for (let i = 1; i < path!.length; i++) {
      const prev = path![i - 1];
      const curr = path![i];
      const dx = curr.tileX - prev.tileX;
      const dy = curr.tileY - prev.tileY;
      // If diagonal, both cardinals must be walkable
      if (dx !== 0 && dy !== 0) {
        expect(grid.tiles[prev.tileY][prev.tileX + dx]).not.toBeNull();
        expect(grid.tiles[prev.tileY + dy][prev.tileX]).not.toBeNull();
      }
    }
  });

  it('returns null when start tile is void', () => {
    const grid = makeGrid([
      'x00',
      '000',
    ].join('\n'));

    const path = findPath(grid, 0, 0, 2, 0);
    expect(path).toBeNull();
  });

  it('returns null when end tile is void', () => {
    const grid = makeGrid([
      '00x',
      '000',
    ].join('\n'));

    const path = findPath(grid, 0, 0, 2, 0);
    expect(path).toBeNull();
  });

  it('preserves tile height in path steps', () => {
    const grid = makeGrid([
      '012',
      '345',
    ].join('\n'));

    const path = findPath(grid, 0, 0, 2, 1);
    expect(path).not.toBeNull();
    // Last step should have height 5
    expect(path![path!.length - 1].tileZ).toBe(5);
  });

  it('routes around furniture-blocked tiles', () => {
    // Open grid with furniture blocking the middle
    const grid = makeGrid([
      '00000',
      '00000',
      '00000',
    ].join('\n'));

    const blocked = new Set(['1,1', '2,1', '3,1']);

    const path = findPath(grid, 0, 1, 4, 1, blocked);

    expect(path).not.toBeNull();
    // Path must go around the blocked tiles (row 0 or row 2)
    for (const step of path!) {
      if (step.tileX >= 1 && step.tileX <= 3) {
        expect(step.tileY).not.toBe(1);
      }
    }
  });

  it('returns null when destination is blocked by furniture', () => {
    const grid = makeGrid([
      '000',
      '000',
    ].join('\n'));

    const blocked = new Set(['2,0']);
    const path = findPath(grid, 0, 0, 2, 0, blocked);
    expect(path).toBeNull();
  });

  it('handles 20x20 grid within performance bounds', () => {
    const row = '0'.repeat(20);
    const rows = Array(20).fill(row);
    const grid = makeGrid(rows.join('\n'));

    const start = performance.now();
    const path = findPath(grid, 0, 0, 19, 19);
    const elapsed = performance.now() - start;

    expect(path).not.toBeNull();
    expect(elapsed).toBeLessThan(50); // < 50ms (generous for CI/parallel runners)
  });
});

describe('getRandomWalkableTile', () => {
  it('returns a walkable tile', () => {
    const grid = makeGrid([
      'x0x',
      '0x0',
    ].join('\n'));

    const tile = getRandomWalkableTile(grid);
    expect(tile).not.toBeNull();
    // Should be one of: (1,0), (0,1), (2,1)
    expect(grid.tiles[tile!.tileY][tile!.tileX]).not.toBeNull();
  });

  it('excludes furniture-blocked tiles', () => {
    const grid = makeGrid([
      '000',
      '000',
    ].join('\n'));

    const blocked = new Set(['0,0', '1,0', '2,0', '0,1', '2,1']);
    // Only (1,1) is unblocked
    const tile = getRandomWalkableTile(grid, blocked);
    expect(tile).not.toBeNull();
    expect(tile!.tileX).toBe(1);
    expect(tile!.tileY).toBe(1);
  });

  it('returns null for all-void grid', () => {
    const grid = makeGrid([
      'xxx',
      'xxx',
    ].join('\n'));

    const tile = getRandomWalkableTile(grid);
    expect(tile).toBeNull();
  });
});

describe('computeBlockedTiles', () => {
  it('blocks single-tile furniture positions', () => {
    const blocked = computeBlockedTiles(
      [{ name: 'exe_light', tileX: 3, tileY: 4, tileZ: 0, direction: 0 }],
      [],
    );
    expect(blocked.has('3,4')).toBe(true);
    expect(blocked.has('0,0')).toBe(false);
  });

  it('blocks full footprint of multi-tile furniture', () => {
    const blocked = computeBlockedTiles(
      [],
      [{ name: 'desk', tileX: 1, tileY: 2, tileZ: 0, direction: 0, widthTiles: 3, heightTiles: 2 }],
    );
    // All 6 tiles in the 3×2 footprint
    expect(blocked.has('1,2')).toBe(true);
    expect(blocked.has('2,2')).toBe(true);
    expect(blocked.has('3,2')).toBe(true);
    expect(blocked.has('1,3')).toBe(true);
    expect(blocked.has('2,3')).toBe(true);
    expect(blocked.has('3,3')).toBe(true);
    // Outside footprint
    expect(blocked.has('0,2')).toBe(false);
    expect(blocked.has('4,2')).toBe(false);
  });
});

describe('isTileOccupied', () => {
  const makeAvatar = (id: string, tileX: number, tileY: number): AvatarSpec => ({
    id,
    tileX,
    tileY,
    tileZ: 0,
    direction: 2,
    variant: 0,
    state: 'idle',
    frame: 0,
    lastUpdateMs: 0,
    nextBlinkMs: 0,
    blinkFrame: 0,
    spawnProgress: 0,
  });

  it('returns true when avatar occupies tile', () => {
    const avatars = [makeAvatar('a1', 3, 4)];
    expect(isTileOccupied(3, 4, avatars)).toBe(true);
  });

  it('returns false when tile is empty', () => {
    const avatars = [makeAvatar('a1', 3, 4)];
    expect(isTileOccupied(5, 5, avatars)).toBe(false);
  });

  it('returns false with no avatars', () => {
    expect(isTileOccupied(3, 4, [])).toBe(false);
  });
});
