// tests/outfitStore.test.ts
// M006/S02 T01 — the role outfit draft store: per-role independent drafts, the
// role switch surface, color/part mutations and reset, plus the stable-reference
// selectors the editor hook reads through useStoreValue.

import { describe, it, expect } from 'vitest';
import {
  OutfitStore,
  outfitStore,
  selectActiveOutfit,
  selectActiveRole,
  selectDrafts,
  TEAM_SECTIONS,
} from '../src/state/outfitStore.js';
import {
  DEFAULT_PRESETS,
  FIGURE_CATALOG,
  ROLE_OUTFIT_PRESETS,
} from '../src/avatarOutfitConfig.js';
import type { TeamSection } from '../src/agentTypes.js';

const hairCatalogItem = FIGURE_CATALOG.find((i) => i.category === 'hair')!;
const shirtCatalogItem = FIGURE_CATALOG.find((i) => i.category === 'tops')!;

describe('OutfitStore seeding', () => {
  it('seeds one draft per TeamSection that equals its preset', () => {
    const store = new OutfitStore();
    for (const team of TEAM_SECTIONS) {
      expect(store.drafts[team]).toEqual(ROLE_OUTFIT_PRESETS[team]);
    }
    expect(store.activeRole).toBe('planning');
    expect(Object.keys(store.drafts).sort()).toEqual([...TEAM_SECTIONS].sort());
  });

  it('seeds drafts as independent clones, not preset references', () => {
    const store = new OutfitStore();
    for (const team of TEAM_SECTIONS) {
      expect(store.drafts[team].parts).not.toBe(ROLE_OUTFIT_PRESETS[team].parts);
      expect(store.drafts[team].colors).not.toBe(ROLE_OUTFIT_PRESETS[team].colors);
    }
  });
});

describe('OutfitStore mutations never leak into shared presets or siblings', () => {
  it('editing one role leaves ROLE_OUTFIT_PRESETS, DEFAULT_PRESETS and other drafts intact', () => {
    const store = new OutfitStore();
    const rolePresetsBefore = JSON.parse(JSON.stringify(ROLE_OUTFIT_PRESETS));
    const defaultPresetsBefore = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    const siblingBefore = JSON.parse(JSON.stringify(store.drafts['support']));

    store.setColor('shirt', '#123456');
    store.setColor('hair', '#ABCDEF');
    store.setHair(hairCatalogItem);

    expect(ROLE_OUTFIT_PRESETS).toEqual(rolePresetsBefore);
    expect(DEFAULT_PRESETS).toEqual(defaultPresetsBefore);
    expect(store.drafts['support']).toEqual(siblingBefore);
    expect(store.drafts['planning'].colors.shirt).toBe('#123456');
    expect(store.drafts['planning'].colors.hair).toBe('#ABCDEF');
  });
});

describe('OutfitStore selectors', () => {
  it('exposes module-scope selectors over state', () => {
    const store = new OutfitStore();
    const state = store.get();
    expect(selectActiveRole(state)).toBe('planning');
    expect(selectDrafts(state)).toBe(state.drafts);
    expect(selectActiveOutfit(state)).toBe(state.drafts['planning']);
  });

  it('selectActiveOutfit keeps a stable reference until a mutation, then changes', () => {
    const store = new OutfitStore();
    const before = selectActiveOutfit(store.get());
    expect(selectActiveOutfit(store.get())).toBe(before);
    store.setColor('shirt', '#010203');
    const after = selectActiveOutfit(store.get());
    expect(after).not.toBe(before);
    expect(after.colors.shirt).toBe('#010203');
  });

  it('subscribeSelector fires with the selected value on change only', () => {
    const store = new OutfitStore();
    const seen: TeamSection[] = [];
    store.subscribeSelector(selectActiveRole, (role) => seen.push(role));
    store.selectRole('core-dev');
    store.selectRole('core-dev');
    store.selectRole('support');
    expect(seen).toEqual(['planning', 'core-dev', 'support']);
  });
});

describe('OutfitStore role switching has no cross-role bleed', () => {
  it('switching roles shows each role its own current draft', () => {
    const store = new OutfitStore();
    store.selectRole('core-dev');
    store.setColor('shirt', '#00FF00');
    store.selectRole('support');
    expect(store.activeOutfit.colors.shirt).toBe(ROLE_OUTFIT_PRESETS['support'].colors.shirt);
    store.selectRole('core-dev');
    expect(store.activeOutfit.colors.shirt).toBe('#00FF00');
  });

  it('selectRole is a no-op when the role is already active', () => {
    const store = new OutfitStore();
    const before = store.get();
    store.selectRole('planning');
    expect(store.get()).toBe(before);
  });
});

describe('OutfitStore catalog-part replacement', () => {
  it('setHair and setShirt copy the catalog asset/setId into the matching slot', () => {
    const store = new OutfitStore();
    store.setHair(hairCatalogItem);
    store.setShirt(shirtCatalogItem);
    expect(store.activeOutfit.parts.hair).toEqual({
      asset: hairCatalogItem.asset,
      setId: hairCatalogItem.setId,
    });
    expect(store.activeOutfit.parts.shirt).toEqual({
      asset: shirtCatalogItem.asset,
      setId: shirtCatalogItem.setId,
    });
  });

  it('setColor no-ops when the value is unchanged', () => {
    const store = new OutfitStore();
    const before = store.get();
    store.setColor('shirt', ROLE_OUTFIT_PRESETS['planning'].colors.shirt);
    expect(store.get()).toBe(before);
  });
});

describe('OutfitStore resetRole', () => {
  it('re-seeds the given role from its preset after edits', () => {
    const store = new OutfitStore();
    store.setColor('shirt', '#000000');
    store.resetRole('planning');
    expect(store.activeOutfit).toEqual(ROLE_OUTFIT_PRESETS['planning']);
    expect(store.activeOutfit.parts).not.toBe(ROLE_OUTFIT_PRESETS['planning'].parts);
  });
});

describe('outfitStore singleton', () => {
  it('is exported and starts on the planning role', () => {
    expect(outfitStore).toBeInstanceOf(OutfitStore);
    expect(outfitStore.activeRole).toBe('planning');
  });
});
