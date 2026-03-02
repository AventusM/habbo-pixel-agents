// tests/idleWander.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdleWanderManager } from '../src/idleWander.js';
import { AvatarManager } from '../src/avatarManager.js';
import { parseHeightmap } from '../src/isoTypes.js';

const OPEN_GRID = parseHeightmap([
  '00000',
  '00000',
  '00000',
  '00000',
  '00000',
].join('\n'));

describe('IdleWanderManager', () => {
  let wander: IdleWanderManager;
  let avatarManager: AvatarManager;

  beforeEach(() => {
    wander = new IdleWanderManager();
    avatarManager = new AvatarManager();
  });

  it('does not move avatar before timer expires', () => {
    const avatar = avatarManager.spawnAvatar('a1', 0, OPEN_GRID)!;
    avatar.state = 'idle';
    wander.startWandering('a1');

    const now = Date.now();
    // Tick immediately — timer should not have expired yet
    wander.tick(now, avatarManager, OPEN_GRID);

    // Avatar should not be moving (timer not expired)
    expect(avatarManager.isMoving('a1')).toBe(false);
  });

  it('moves idle avatar after timer expires', () => {
    const avatar = avatarManager.spawnAvatar('a1', 0, OPEN_GRID)!;
    avatar.state = 'idle';
    wander.startWandering('a1');

    // Tick far in the future (well past max wander delay)
    wander.tick(Date.now() + 20000, avatarManager, OPEN_GRID);

    // Avatar should be moving now
    expect(avatarManager.isMoving('a1')).toBe(true);
  });

  it('does not move avatar if not idle', () => {
    const avatar = avatarManager.spawnAvatar('a1', 0, OPEN_GRID)!;
    avatar.state = 'walk'; // Not idle
    wander.startWandering('a1');

    wander.tick(Date.now() + 20000, avatarManager, OPEN_GRID);

    expect(avatarManager.isMoving('a1')).toBe(false);
  });

  it('stops wandering when stopWandering is called', () => {
    const avatar = avatarManager.spawnAvatar('a1', 0, OPEN_GRID)!;
    avatar.state = 'idle';
    wander.startWandering('a1');
    wander.stopWandering('a1');

    wander.tick(Date.now() + 20000, avatarManager, OPEN_GRID);

    expect(avatarManager.isMoving('a1')).toBe(false);
  });

  it('handles multiple avatars independently', () => {
    const a1 = avatarManager.spawnAvatar('a1', 0, OPEN_GRID)!;
    const a2 = avatarManager.spawnAvatar('a2', 1, OPEN_GRID)!;
    a1.state = 'idle';
    a2.state = 'idle';
    wander.startWandering('a1');
    wander.startWandering('a2');

    wander.tick(Date.now() + 20000, avatarManager, OPEN_GRID);

    // Both should potentially be moving (depends on random tile selection)
    expect(avatarManager.isMoving('a1') || avatarManager.isMoving('a2')).toBe(true);
  });

  it('can restart wandering after stopping', () => {
    const avatar = avatarManager.spawnAvatar('a1', 0, OPEN_GRID)!;
    avatar.state = 'idle';

    wander.startWandering('a1');
    wander.stopWandering('a1');
    wander.startWandering('a1');

    wander.tick(Date.now() + 20000, avatarManager, OPEN_GRID);
    expect(avatarManager.isMoving('a1')).toBe(true);
  });
});
