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
import { OUTFIT_STORAGE_KEY, OUTFIT_STORAGE_VERSION } from '../src/state/outfitPersistence.js';
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

describe('OutfitStore persistence hydration (M006/S03 T02)', () => {
  function makeMemoryStorage(initial: Record<string, string> = {}): {
    data: Record<string, string>;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  } {
    return {
      data: { ...initial },
      getItem(key: string): string | null {
        return Object.hasOwn(this.data, key) ? this.data[key] : null;
      },
      setItem(key: string, value: string): void {
        this.data[key] = value;
      },
    };
  }

  function savedStorageFor(drafts: Record<string, unknown>): ReturnType<typeof makeMemoryStorage> {
    const storage = makeMemoryStorage();
    storage.data[OUTFIT_STORAGE_KEY] = JSON.stringify({ version: OUTFIT_STORAGE_VERSION, drafts });
    return storage;
  }

  it('uses hydrated drafts when storage holds valid data', () => {
    const edited = {
      ...ROLE_OUTFIT_PRESETS['support'],
      colors: { ...ROLE_OUTFIT_PRESETS['support'].colors, shirt: '#010203' },
    };
    const store = new OutfitStore(savedStorageFor({ support: edited }));
    expect(store.drafts['support']).toEqual(edited);
    expect(store.drafts['planning']).toEqual(ROLE_OUTFIT_PRESETS['planning']);
  });

  it('falls back to presets per role when storage is corrupt', () => {
    const storage = makeMemoryStorage({ [OUTFIT_STORAGE_KEY]: '{broken' });
    const store = new OutfitStore(storage);
    for (const team of TEAM_SECTIONS) {
      expect(store.drafts[team]).toEqual(ROLE_OUTFIT_PRESETS[team]);
    }
  });

  it('saves updated drafts after setColor and resetRole', () => {
    const storage = makeMemoryStorage();
    const store = new OutfitStore(storage);
    store.setColor('shirt', '#0A0B0C');
    const afterColor = JSON.parse(storage.data[OUTFIT_STORAGE_KEY]);
    expect(afterColor.drafts['planning'].colors.shirt).toBe('#0A0B0C');
    store.resetRole('planning');
    const afterReset = JSON.parse(storage.data[OUTFIT_STORAGE_KEY]);
    expect(afterReset.drafts['planning']).toEqual(ROLE_OUTFIT_PRESETS['planning']);
  });

  it('round-trips through a fresh store: saved drafts win on rehydrate', () => {
    const storage = makeMemoryStorage();
    const first = new OutfitStore(storage);
    first.selectRole('core-dev');
    first.setShirt(shirtCatalogItem);
    const second = new OutfitStore(storage);
    expect(second.drafts['core-dev'].parts.shirt).toEqual({
      asset: shirtCatalogItem.asset,
      setId: shirtCatalogItem.setId,
    });
  });
});
