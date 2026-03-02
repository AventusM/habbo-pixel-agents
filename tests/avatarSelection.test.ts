// tests/avatarSelection.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { AvatarSelectionManager } from '../src/avatarSelection.js';

describe('AvatarSelectionManager', () => {
  let manager: AvatarSelectionManager;

  beforeEach(() => {
    manager = new AvatarSelectionManager();
  });

  it('starts with no selection', () => {
    expect(manager.selectedAvatarId).toBeNull();
  });

  it('selects an avatar', () => {
    manager.selectAvatar('agent1');
    expect(manager.selectedAvatarId).toBe('agent1');
    expect(manager.isSelected('agent1')).toBe(true);
  });

  it('deselects an avatar', () => {
    manager.selectAvatar('agent1');
    manager.deselectAvatar();
    expect(manager.selectedAvatarId).toBeNull();
    expect(manager.isSelected('agent1')).toBe(false);
  });

  it('replaces selection when selecting different avatar', () => {
    manager.selectAvatar('agent1');
    manager.selectAvatar('agent2');
    expect(manager.selectedAvatarId).toBe('agent2');
    expect(manager.isSelected('agent1')).toBe(false);
    expect(manager.isSelected('agent2')).toBe(true);
  });

  it('isSelected returns false for non-selected avatar', () => {
    manager.selectAvatar('agent1');
    expect(manager.isSelected('agent2')).toBe(false);
  });

  it('deselect is idempotent', () => {
    manager.deselectAvatar();
    expect(manager.selectedAvatarId).toBeNull();
    manager.selectAvatar('agent1');
    manager.deselectAvatar();
    manager.deselectAvatar();
    expect(manager.selectedAvatarId).toBeNull();
  });
});
