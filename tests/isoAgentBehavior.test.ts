// tests/isoAgentBehavior.test.ts
// Tests for BFS pathfinding integration with isometric avatar rendering

import { describe, it, expect, beforeEach } from 'vitest';
import {
  pathToIsometricPositions,
  drawParentChildLine,
  updateAvatarAlongPath,
  type TilePath,
  type IsometricPosition,
} from '../src/isoAgentBehavior.js';
import type { AvatarSpec } from '../src/isoAvatarRenderer.js';

describe('pathToIsometricPositions', () => {
  it('converts single-step path correctly', () => {
    const path: TilePath = [
      { tileX: 2, tileY: 3, tileZ: 0 },
    ];

    const result = pathToIsometricPositions(path);

    expect(result).toHaveLength(1);
    expect(result[0].screenX).toBe((2 - 3) * 32); // -32
    expect(result[0].screenY).toBe((2 + 3) * 16); // 80
    expect(result[0].direction).toBe(2); // Default SE direction
  });

  it('handles multi-step path with direction changes', () => {
    const path: TilePath = [
      { tileX: 2, tileY: 2, tileZ: 0 }, // Start
      { tileX: 3, tileY: 2, tileZ: 0 }, // Move right (dx=1, dy=0) → direction 2 (SE)
      { tileX: 4, tileY: 2, tileZ: 0 }, // Move right again → direction 2
      { tileX: 5, tileY: 3, tileZ: 0 }, // Move SE (dx=1, dy=1) → direction 3 (S)
    ];

    const result = pathToIsometricPositions(path);

    expect(result).toHaveLength(4);

    // First position should face direction to second position (SE)
    expect(result[0].direction).toBe(2);

    // Second position should face direction to third position (SE)
    expect(result[1].direction).toBe(2);

    // Third position should face direction to fourth position (S)
    expect(result[2].direction).toBe(3);

    // Last position should use previous direction (S)
    expect(result[3].direction).toBe(3);
  });

  it('uses previous direction for last step', () => {
    const path: TilePath = [
      { tileX: 2, tileY: 2, tileZ: 0 },
      { tileX: 2, tileY: 3, tileZ: 0 }, // Move down (dy=1) → direction 4 (SW)
      { tileX: 2, tileY: 4, tileZ: 0 }, // Move down again → direction 4
    ];

    const result = pathToIsometricPositions(path);

    expect(result).toHaveLength(3);
    expect(result[2].direction).toBe(4); // Last step uses previous direction (SW)
  });

  it('handles empty path gracefully', () => {
    const result = pathToIsometricPositions([]);
    expect(result).toHaveLength(0);
  });
});

describe('drawParentChildLine', () => {
  let mockCtx: any;

  beforeEach(() => {
    // Create minimal canvas context mock
    mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeStyle: '',
      lineWidth: 0,
    };
  });

  it('calls ctx.stroke to draw line', () => {
    let strokeCalled = false;
    mockCtx.stroke = () => { strokeCalled = true; };

    const parent: AvatarSpec = {
      id: 'parent',
      tileX: 2, tileY: 2, tileZ: 0,
      direction: 2, variant: 0, state: 'idle', frame: 0,
      lastUpdateMs: 0, nextBlinkMs: 0, blinkFrame: 0, spawnProgress: 0,
    };

    const child: AvatarSpec = {
      id: 'child',
      tileX: 5, tileY: 5, tileZ: 0,
      direction: 2, variant: 0, state: 'idle', frame: 0,
      lastUpdateMs: 0, nextBlinkMs: 0, blinkFrame: 0, spawnProgress: 0,
    };

    drawParentChildLine(mockCtx, parent, child);

    expect(strokeCalled).toBe(true);
  });
});

describe('updateAvatarAlongPath', () => {
  it('sets walk state when progress < 1.0', () => {
    const path: IsometricPosition[] = [
      { screenX: 0, screenY: 0, direction: 2 },
      { screenX: 64, screenY: 32, direction: 2 },
    ];

    const spec: AvatarSpec = {
      id: 'avatar',
      tileX: 2, tileY: 2, tileZ: 0,
      direction: 0, variant: 0, state: 'idle', frame: 0,
      lastUpdateMs: 0, nextBlinkMs: 0, blinkFrame: 0, spawnProgress: 0,
    };

    // Progress 50% through path (1000ms elapsed of 2000ms total)
    updateAvatarAlongPath(spec, path, 1000, 0, 2000);

    expect(spec.state).toBe('walk');
  });

  it('sets idle state when progress >= 1.0', () => {
    const path: IsometricPosition[] = [
      { screenX: 0, screenY: 0, direction: 2 },
      { screenX: 64, screenY: 32, direction: 2 },
    ];

    const spec: AvatarSpec = {
      id: 'avatar',
      tileX: 2, tileY: 2, tileZ: 0,
      direction: 0, variant: 0, state: 'walk', frame: 0,
      lastUpdateMs: 0, nextBlinkMs: 0, blinkFrame: 0, spawnProgress: 0,
    };

    // Progress 100% through path (2000ms elapsed of 2000ms total)
    updateAvatarAlongPath(spec, path, 2000, 0, 2000);

    expect(spec.state).toBe('idle');
  });

  it('updates direction from path', () => {
    const path: IsometricPosition[] = [
      { screenX: 0, screenY: 0, direction: 4 }, // SW direction
      { screenX: 64, screenY: 32, direction: 4 },
    ];

    const spec: AvatarSpec = {
      id: 'avatar',
      tileX: 2, tileY: 2, tileZ: 0,
      direction: 0, variant: 0, state: 'idle', frame: 0,
      lastUpdateMs: 0, nextBlinkMs: 0, blinkFrame: 0, spawnProgress: 0,
    };

    updateAvatarAlongPath(spec, path, 500, 0, 2000);

    expect(spec.direction).toBe(4); // Should update to path direction
  });

  it('handles empty path gracefully', () => {
    const spec: AvatarSpec = {
      id: 'avatar',
      tileX: 2, tileY: 2, tileZ: 0,
      direction: 0, variant: 0, state: 'idle', frame: 0,
      lastUpdateMs: 0, nextBlinkMs: 0, blinkFrame: 0, spawnProgress: 0,
    };

    // Should not crash or throw
    updateAvatarAlongPath(spec, [], 1000, 0, 2000);

    expect(spec.state).toBe('idle'); // Unchanged
  });
});
