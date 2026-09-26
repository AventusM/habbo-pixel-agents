// tests/debugSurfacesModel.test.ts
// M009/S03 — pure view-model proof for the editor debug surfaces: the four
// role-outfit rows resolve through the spawn resolver, the spritesheet cells
// enumerate directions × poses deterministically, and specs carry the chosen
// role outfit into the shared Nitro path.

import { describe, it, expect } from 'vitest';
import {
  DEBUG_DIRECTION_SETS,
  DEBUG_POSES,
  DEBUG_ROLE_OPTIONS,
  DEFAULT_DEBUG_DIRECTION_SET_ID,
  DEFAULT_DEBUG_ROLE,
  ROLE_MATRIX_COLUMNS,
  ROLE_OUTFIT_ROWS,
  buildDebugAvatarSpec,
  buildSpritesheetCells,
  findRoleOutfitRow,
  getDebugDirectionSet,
} from '../src/debugSurfacesModel.js';
import { ROLE_OUTFIT_PRESETS, getRolePreset } from '../src/avatarOutfitConfig.js';

const signature = (outfit: (typeof ROLE_OUTFIT_ROWS)[number]['outfit']): string =>
  JSON.stringify([outfit.gender, outfit.parts, outfit.colors]);

describe('debug surfaces model (M009/S03)', () => {
  it('covers the four roles in editor order with labels', () => {
    expect(DEBUG_ROLE_OPTIONS.map((option) => option.id)).toEqual([
      'planning',
      'core-dev',
      'infrastructure',
      'support',
    ]);
    for (const option of DEBUG_ROLE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
    expect(DEBUG_ROLE_OPTIONS.map((option) => option.id)).toContain(DEFAULT_DEBUG_ROLE);
  });

  it('resolves each role outfit through the spawn resolver with distinct outfits', () => {
    expect(ROLE_OUTFIT_ROWS).toHaveLength(4);
    for (const row of ROLE_OUTFIT_ROWS) {
      expect(row.outfit).toEqual(getRolePreset(row.role, 0));
      expect(row.outfit.colors.shirt).toBe(ROLE_OUTFIT_PRESETS[row.role].colors.shirt);
    }
    const signatures = ROLE_OUTFIT_ROWS.map((row) => signature(row.outfit));
    expect(new Set(signatures).size).toBe(ROLE_OUTFIT_ROWS.length);
  });

  it('looks up a role row by id and falls back to the first row', () => {
    expect(findRoleOutfitRow('support').role).toBe('support');
    expect(findRoleOutfitRow('support').label).toBe('Support');
    const unknown = 'nope' as unknown as (typeof ROLE_OUTFIT_ROWS)[number]['role'];
    expect(findRoleOutfitRow(unknown)).toBe(ROLE_OUTFIT_ROWS[0]);
  });

  it('exposes stable direction sets and resolves them by id', () => {
    const all = getDebugDirectionSet(DEFAULT_DEBUG_DIRECTION_SET_ID);
    expect(all.id).toBe('all');
    expect([...all.directions]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const cardinal = getDebugDirectionSet('cardinal');
    expect([...cardinal.directions]).toEqual([0, 2, 4, 6]);
    expect(getDebugDirectionSet('missing')).toBe(DEBUG_DIRECTION_SETS[0]);
  });

  it('builds one unique spritesheet cell per direction and pose', () => {
    const directions = getDebugDirectionSet('cardinal').directions;
    const cells = buildSpritesheetCells(directions, DEBUG_POSES);
    expect(cells).toHaveLength(directions.length * DEBUG_POSES.length);
    expect(new Set(cells.map((cell) => cell.id)).size).toBe(cells.length);
    expect(cells[0]).toEqual({ id: '0:idle', direction: 0, state: 'idle', frame: 0 });
    expect(cells[1]).toEqual({ id: '0:walk-0', direction: 0, state: 'walk', frame: 0 });
    expect(DEBUG_POSES.map((pose) => pose.frame)).toEqual([0, 0, 1, 2, 3]);
  });

  it('carries the chosen role outfit into the debug spec, and omits it when absent', () => {
    const outfit = ROLE_OUTFIT_PRESETS['support'];
    const spec = buildDebugAvatarSpec('cell', 4, 'walk', 2, outfit);
    expect(spec).toMatchObject({
      id: 'cell',
      direction: 4,
      variant: 0,
      state: 'walk',
      frame: 2,
      outfit,
    });
    const bare = buildDebugAvatarSpec('cell', 0, 'idle', 0);
    expect(bare).toMatchObject({ direction: 0, state: 'idle', frame: 0, variant: 0 });
    expect('outfit' in bare).toBe(false);
  });

  it('exposes a small role-matrix column set mixing idle and walk poses', () => {
    expect(ROLE_MATRIX_COLUMNS.length).toBeGreaterThan(0);
    expect(ROLE_MATRIX_COLUMNS.some((column) => column.state === 'idle')).toBe(true);
    expect(ROLE_MATRIX_COLUMNS.some((column) => column.state === 'walk')).toBe(true);
    expect(new Set(ROLE_MATRIX_COLUMNS.map((column) => column.id)).size).toBe(
      ROLE_MATRIX_COLUMNS.length,
    );
  });
});
