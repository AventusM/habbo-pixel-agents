// tests/avatarRestyle.test.ts
// M006/S03 T03 — AvatarManager restyle API plus spawn-path draft resolution:
// restyle swaps the outfit reference on a live walking avatar without moving
// it, unknown ids are a no-op, applyRoleOutfit only touches the matching team,
// and spawn resolves the outfit from the outfitStore draft.

import { describe, it, expect, beforeEach } from 'vitest';
import { AvatarManager } from '../src/avatarManager.js';
import { parseHeightmap } from '../src/isoTypes.js';
import type { TileGrid } from '../src/isoTypes.js';
import { getRolePreset, type OutfitConfig } from '../src/avatarOutfitConfig.js';
import { outfitStore } from '../src/state/outfitStore.js';

function makeGrid(heightmap: string): TileGrid {
  return parseHeightmap(heightmap);
}

const OPEN_GRID = makeGrid(['00000', '00000', '00000', '00000', '00000'].join('\n'));

function editedOutfit(): OutfitConfig {
  const base = getRolePreset('planning', 0);
  return { ...base, colors: { ...base.colors, shirt: '#ABC123' } };
}

describe('AvatarManager restyleAvatar', () => {
  let manager: AvatarManager;

  beforeEach(() => {
    manager = new AvatarManager();
  });

  it('swaps the outfit reference on a live walking avatar in place', () => {
    const avatar = manager.spawnAvatar('walker', 0, OPEN_GRID)!;
    avatar.state = 'walk';
    avatar.direction = 4;
    avatar.tileX = 1;
    avatar.tileY = 2;
    const before = avatar.outfit;
    const next = editedOutfit();

    expect(manager.restyleAvatar('walker', next)).toBe(true);
    const after = manager.getAvatar('walker')!;
    expect(after.outfit).toBe(next);
    expect(after.outfit).not.toBe(before);
    expect(after.tileX).toBe(1);
    expect(after.tileY).toBe(2);
    expect(after.state).toBe('walk');
    expect(after.direction).toBe(4);
  });

  it('is a no-op returning false for an unknown agent id', () => {
    expect(manager.restyleAvatar('ghost', editedOutfit())).toBe(false);
    expect(manager.size).toBe(0);
  });
});

describe('AvatarManager applyRoleOutfit', () => {
  let manager: AvatarManager;

  beforeEach(() => {
    manager = new AvatarManager();
  });

  it('restyles only avatars of the matching team and returns the count', () => {
    manager.spawnAvatar('plan-1', 0, OPEN_GRID, undefined, undefined, 'planning');
    manager.spawnAvatar('plan-2', 1, OPEN_GRID, undefined, undefined, 'planning');
    manager.spawnAvatar('sup-1', 0, OPEN_GRID, undefined, undefined, 'support');
    const supportBefore = manager.getAvatar('sup-1')!.outfit;

    const next = editedOutfit();
    expect(manager.applyRoleOutfit('planning', next)).toBe(2);
    expect(manager.getAvatar('plan-1')!.outfit).toBe(next);
    expect(manager.getAvatar('plan-2')!.outfit).toBe(next);
    expect(manager.getAvatar('sup-1')!.outfit).toBe(supportBefore);
  });

  it('returns zero when no avatar of that team is live', () => {
    manager.spawnAvatar('sup-1', 0, OPEN_GRID, undefined, undefined, 'support');
    expect(manager.applyRoleOutfit('planning', editedOutfit())).toBe(0);
  });
});

describe('AvatarManager spawn resolves the store draft', () => {
  let manager: AvatarManager;

  beforeEach(() => {
    manager = new AvatarManager();
    outfitStore.selectRole('planning');
  });

  it('spawn uses the outfitStore draft outfit when the store has one', () => {
    outfitStore.setColor('shirt', '#ABC123');
    try {
      const avatar = manager.spawnAvatar('drafted', 0, OPEN_GRID, undefined, undefined, 'planning');
      expect(avatar!.outfit!.colors.shirt).toBe('#ABC123');
      // Live spec is a clone: later store edits do not alias into it.
      expect(avatar!.outfit).not.toBe(outfitStore.drafts['planning']);
    } finally {
      outfitStore.resetRole('planning');
    }
  });

  it('spawnAvatarAt resolves the draft outfit too', () => {
    outfitStore.setColor('shirt', '#ABC123');
    try {
      const avatar = manager.spawnAvatarAt('drafted-at', 0, 0, 0, 0, OPEN_GRID, undefined, 'planning');
      expect(avatar!.outfit!.colors.shirt).toBe('#ABC123');
    } finally {
      outfitStore.resetRole('planning');
    }
  });
});
