// tests/avatarManager.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { AvatarManager } from '../src/avatarManager.js';
import { parseHeightmap } from '../src/isoTypes.js';
import type { TileGrid } from '../src/isoTypes.js';

function makeGrid(heightmap: string): TileGrid {
  return parseHeightmap(heightmap);
}

const OPEN_GRID = makeGrid([
  '00000',
  '00000',
  '00000',
  '00000',
  '00000',
].join('\n'));

describe('AvatarManager', () => {
  let manager: AvatarManager;

  beforeEach(() => {
    manager = new AvatarManager();
  });

  describe('spawnAvatar', () => {
    it('spawns avatar on walkable tile', () => {
      const avatar = manager.spawnAvatar('agent1', 0, OPEN_GRID);

      expect(avatar).not.toBeNull();
      expect(avatar!.id).toBe('agent1');
      expect(avatar!.variant).toBe(0);
      expect(avatar!.state).toBe('spawning');
      expect(manager.size).toBe(1);
    });

    it('returns existing avatar if already spawned', () => {
      const first = manager.spawnAvatar('agent1', 0, OPEN_GRID);
      const second = manager.spawnAvatar('agent1', 1, OPEN_GRID);

      expect(first).toBe(second);
      expect(manager.size).toBe(1);
    });

    it('returns null on all-void grid', () => {
      const voidGrid = makeGrid('xxx\nxxx');
      const avatar = manager.spawnAvatar('agent1', 0, voidGrid);
      expect(avatar).toBeNull();
    });
  });

  describe('despawnAvatar', () => {
    it('sets avatar to despawning state', () => {
      manager.spawnAvatar('agent1', 0, OPEN_GRID);
      manager.despawnAvatar('agent1');

      const avatar = manager.getAvatar('agent1');
      expect(avatar!.state).toBe('despawning');
    });

    it('does nothing for unknown agent', () => {
      manager.despawnAvatar('unknown');
      expect(manager.size).toBe(0);
    });
  });

  describe('moveAvatarTo', () => {
    it('starts path following to target tile', () => {
      const avatar = manager.spawnAvatar('agent1', 0, OPEN_GRID);
      // Force to idle state at a known position
      avatar!.state = 'idle';
      avatar!.tileX = 0;
      avatar!.tileY = 0;
      avatar!.tileZ = 0;

      const moved = manager.moveAvatarTo('agent1', 4, 4, OPEN_GRID);
      expect(moved).toBe(true);
      expect(manager.isMoving('agent1')).toBe(true);
    });

    it('returns false for same tile', () => {
      const avatar = manager.spawnAvatar('agent1', 0, OPEN_GRID);
      avatar!.state = 'idle';

      const moved = manager.moveAvatarTo('agent1', avatar!.tileX, avatar!.tileY, OPEN_GRID);
      expect(moved).toBe(false);
    });

    it('returns false for unreachable tile', () => {
      const grid = makeGrid([
        '0xxx0',
        'xxxxx',
        '0xxx0',
      ].join('\n'));

      const avatar = manager.spawnAvatar('agent1', 0, grid);
      if (!avatar) return; // May spawn on left or right

      avatar.state = 'idle';
      // Try to reach the other isolated tile
      const targetX = avatar.tileX === 0 ? 4 : 0;
      const targetY = avatar.tileY === 0 ? 2 : 0;

      const moved = manager.moveAvatarTo('agent1', targetX, targetY, grid);
      expect(moved).toBe(false);
    });

    it('returns false while spawning', () => {
      manager.spawnAvatar('agent1', 0, OPEN_GRID);
      // Avatar starts in 'spawning' state
      const moved = manager.moveAvatarTo('agent1', 4, 4, OPEN_GRID);
      expect(moved).toBe(false);
    });
  });

  describe('tick', () => {
    it('advances avatar along path', () => {
      const avatar = manager.spawnAvatar('agent1', 0, OPEN_GRID);
      avatar!.state = 'idle';
      avatar!.tileX = 0;
      avatar!.tileY = 0;
      avatar!.tileZ = 0;

      manager.moveAvatarTo('agent1', 2, 0, OPEN_GRID);

      // Advance time partway through first step
      const startTime = Date.now();
      manager.tick(startTime + 125); // Half of 250ms step

      expect(avatar!.state).toBe('walk');
      expect(avatar!.screenOffsetX).not.toBe(0);
    });

    it('completes path and sets idle', () => {
      const avatar = manager.spawnAvatar('agent1', 0, OPEN_GRID);
      avatar!.state = 'idle';
      avatar!.tileX = 0;
      avatar!.tileY = 0;
      avatar!.tileZ = 0;

      manager.moveAvatarTo('agent1', 1, 0, OPEN_GRID);

      // Advance well past path duration (2 steps * 250ms = 500ms)
      manager.tick(Date.now() + 1000);

      expect(avatar!.state).toBe('idle');
      expect(avatar!.tileX).toBe(1);
      expect(avatar!.tileY).toBe(0);
      expect(avatar!.screenOffsetX).toBe(0);
      expect(avatar!.screenOffsetY).toBe(0);
      expect(manager.isMoving('agent1')).toBe(false);
    });
  });

  describe('getAvatarAtTile', () => {
    it('finds avatar at tile', () => {
      const avatar = manager.spawnAvatar('agent1', 0, OPEN_GRID);
      const found = manager.getAvatarAtTile(avatar!.tileX, avatar!.tileY);
      expect(found).toBe(avatar);
    });

    it('returns null for empty tile', () => {
      manager.spawnAvatar('agent1', 0, OPEN_GRID);
      // Very unlikely to be at 99,99
      const found = manager.getAvatarAtTile(99, 99);
      expect(found).toBeNull();
    });
  });
});
