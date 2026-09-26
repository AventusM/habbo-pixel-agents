// tests/characterEditorViewModel.test.ts
// M006/S02 T02 — the pure character-editor view model and the no-JSX / stable
// handler contract of useCharacterEditor.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  EDITOR_PALETTES,
  buildCharacterEditorView,
} from '../src/hooks/useCharacterEditor.js';
import { OutfitStore, TEAM_SECTIONS } from '../src/state/outfitStore.js';
import { FIGURE_CATALOG } from '../src/avatarOutfitConfig.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('buildCharacterEditorView', () => {
  it('derives roles, active role and the active outfit from store state', () => {
    const state = new OutfitStore().get();
    const view = buildCharacterEditorView(state, EDITOR_PALETTES);
    expect(view.roles).toBe(TEAM_SECTIONS);
    expect(view.activeRole).toBe('planning');
    expect(view.outfit).toBe(state.drafts['planning']);
  });

  it('follows a role switch to that role own draft', () => {
    const store = new OutfitStore();
    store.selectRole('infrastructure');
    const view = buildCharacterEditorView(store.get(), EDITOR_PALETTES);
    expect(view.activeRole).toBe('infrastructure');
    expect(view.outfit).toBe(store.drafts['infrastructure']);
  });

  it('offers only hair options whose gender matches the outfit (plus unisex)', () => {
    const store = new OutfitStore();
    const view = buildCharacterEditorView(store.get(), EDITOR_PALETTES);
    const gender = view.outfit.gender;
    const expected = FIGURE_CATALOG.filter(
      (i) => i.category === 'hair' && (i.gender === gender || i.gender === 'U'),
    );
    expect(view.hairOptions).toEqual(expected);
    expect(view.hairOptions.length).toBeGreaterThan(0);
    for (const item of view.hairOptions) {
      expect(item.category).toBe('hair');
    }
  });

  it('passes the palette arrays straight through', () => {
    const view = buildCharacterEditorView(new OutfitStore().get(), EDITOR_PALETTES);
    expect(view.hairColors).toBe(EDITOR_PALETTES.hairColors);
    expect(view.shirtColors).toBe(EDITOR_PALETTES.shirtColors);
    expect(view.skinColors).toBe(EDITOR_PALETTES.skinColors);
  });

  it('produces distinct outfits for distinct roles', () => {
    const state = new OutfitStore().get();
    const shirts = TEAM_SECTIONS.map(
      (role) => state.drafts[role].colors.shirt,
    );
    expect(new Set(shirts).size).toBe(TEAM_SECTIONS.length);
  });
});

describe('useCharacterEditor source contract (D021 container layer)', () => {
  const src = readFileSync(join(SRC, 'hooks', 'useCharacterEditor.ts'), 'utf8');

  it('reads the store through useStoreValue with stable handlers', () => {
    expect(src).toContain('useStoreValue(outfitStore');
    expect(src).toContain('useCallback');
    expect(src).toContain('buildCharacterEditorView');
  });

  it('contains no JSX and no useEffect state derivation', () => {
    expect(src).not.toMatch(/<[A-Za-z]/);
    expect(src).not.toMatch(/\buseEffect\b/);
  });
});
