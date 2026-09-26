// tests/outfitPersistence.test.ts
// M006/S03 T01 — versioned localStorage persistence for per-role outfit drafts:
// round-trip save→load, corrupt JSON → null, wrong version → null, unknown role
// keys ignored, partial drafts rejected, throwing storage → null.

import { describe, it, expect } from 'vitest';
import {
  OUTFIT_STORAGE_KEY,
  OUTFIT_STORAGE_VERSION,
  isValidOutfitDraft,
  loadOutfitDrafts,
  parseOutfitDraftsFile,
  saveOutfitDrafts,
  serializeOutfitDrafts,
  type OutfitStorage,
} from '../src/state/outfitPersistence.js';
import { ROLE_OUTFIT_PRESETS } from '../src/avatarOutfitConfig.js';
import type { OutfitConfig } from '../src/avatarOutfitConfig.js';

/** In-memory Storage fake (vitest runs in node: no DOM localStorage). */
function makeMemoryStorage(initial: Record<string, string> = {}): OutfitStorage & {
  data: Record<string, string>;
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

function throwingStorage(): OutfitStorage {
  return {
    getItem(): string | null {
      throw new Error('denied');
    },
    setItem(): void {
      throw new Error('denied');
    },
  };
}

const validDraft: OutfitConfig = {
  ...ROLE_OUTFIT_PRESETS['planning'],
  parts: {
    hair: { ...ROLE_OUTFIT_PRESETS['planning'].parts.hair },
    shirt: { ...ROLE_OUTFIT_PRESETS['planning'].parts.shirt },
    pants: { ...ROLE_OUTFIT_PRESETS['planning'].parts.pants },
    shoes: { ...ROLE_OUTFIT_PRESETS['planning'].parts.shoes },
  },
  colors: { ...ROLE_OUTFIT_PRESETS['planning'].colors, shirt: '#123456' },
};

describe('outfitPersistence round-trip', () => {
  it('saves and loads per-role drafts under the namespaced key', () => {
    const storage = makeMemoryStorage();
    saveOutfitDrafts({ planning: validDraft }, storage);
    expect(Object.hasOwn(storage.data, OUTFIT_STORAGE_KEY)).toBe(true);
    const loaded = loadOutfitDrafts(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!['planning']).toEqual(validDraft);
  });

  it('loads independent clones: mutating the result never touches stored JSON', () => {
    const storage = makeMemoryStorage();
    saveOutfitDrafts({ planning: validDraft }, storage);
    const first = loadOutfitDrafts(storage)!;
    first['planning']!.colors.shirt = '#000000';
    const second = loadOutfitDrafts(storage)!;
    expect(second['planning']!.colors.shirt).toBe('#123456');
  });

  it('stamps the current schema version on save', () => {
    const storage = makeMemoryStorage();
    saveOutfitDrafts({ planning: validDraft }, storage);
    const payload = JSON.parse(storage.data[OUTFIT_STORAGE_KEY]);
    expect(payload.version).toBe(OUTFIT_STORAGE_VERSION);
  });
});

describe('outfitPersistence corrupt and missing storage', () => {
  it('returns null when nothing was saved', () => {
    expect(loadOutfitDrafts(makeMemoryStorage())).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    const storage = makeMemoryStorage({ [OUTFIT_STORAGE_KEY]: '{not-json' });
    expect(loadOutfitDrafts(storage)).toBeNull();
  });

  it('returns null for a wrong schema version', () => {
    const storage = makeMemoryStorage({
      [OUTFIT_STORAGE_KEY]: JSON.stringify({
        version: OUTFIT_STORAGE_VERSION + 99,
        drafts: { planning: validDraft },
      }),
    });
    expect(loadOutfitDrafts(storage)).toBeNull();
  });

  it('returns null for a non-object payload', () => {
    const storage = makeMemoryStorage({ [OUTFIT_STORAGE_KEY]: '[1,2,3]' });
    expect(loadOutfitDrafts(storage)).toBeNull();
  });

  it('returns null when storage itself is null (non-browser context)', () => {
    expect(loadOutfitDrafts(null)).toBeNull();
  });

  it('returns null when storage throws (private mode / blocked access)', () => {
    expect(loadOutfitDrafts(throwingStorage())).toBeNull();
  });

  it('never throws when saving to throwing storage', () => {
    expect(() => saveOutfitDrafts({ planning: validDraft }, throwingStorage())).not.toThrow();
  });

  it('save to null storage is a silent no-op', () => {
    expect(() => saveOutfitDrafts({ planning: validDraft }, null)).not.toThrow();
  });
});

describe('outfitPersistence role and draft validation', () => {
  it('ignores unknown role keys on save and load', () => {
    const storage = makeMemoryStorage();
    saveOutfitDrafts(
      { planning: validDraft, 'design-lead': validDraft } as Record<string, OutfitConfig>,
      storage,
    );
    const payload = JSON.parse(storage.data[OUTFIT_STORAGE_KEY]);
    expect(Object.keys(payload.drafts)).toEqual(['planning']);
    // Unknown keys already in storage are ignored on load too.
    payload.drafts['design-lead'] = validDraft;
    storage.data[OUTFIT_STORAGE_KEY] = JSON.stringify(payload);
    const loaded = loadOutfitDrafts(storage)!;
    expect(Object.keys(loaded)).toEqual(['planning']);
  });

  it('rejects partial drafts: invalid roles are dropped, valid roles survive', () => {
    const partial = { ...validDraft, colors: { ...validDraft.colors } } as Record<string, unknown>;
    delete (partial['colors'] as Record<string, unknown>)['shirt'];
    const storage = makeMemoryStorage({
      [OUTFIT_STORAGE_KEY]: JSON.stringify({
        version: OUTFIT_STORAGE_VERSION,
        drafts: {
          planning: validDraft,
          'core-dev': partial,
        },
      }),
    });
    const loaded = loadOutfitDrafts(storage)!;
    expect(loaded['planning']).toEqual(validDraft);
    expect(loaded['core-dev']).toBeUndefined();
  });

  it('isValidOutfitDraft rejects bad gender, bad parts, and bad colors', () => {
    expect(isValidOutfitDraft({ ...validDraft, gender: 'X' })).toBe(false);
    expect(
      isValidOutfitDraft({
        ...validDraft,
        parts: { ...validDraft.parts, hair: { asset: '', setId: 1 } },
      }),
    ).toBe(false);
    expect(
      isValidOutfitDraft({
        ...validDraft,
        parts: { ...validDraft.parts, hair: { asset: 'Hair_M_yo', setId: Number.NaN } },
      }),
    ).toBe(false);
    expect(
      isValidOutfitDraft({ ...validDraft, colors: { ...validDraft.colors, shirt: 'red' } }),
    ).toBe(false);
    expect(isValidOutfitDraft(null)).toBe(false);
    expect(isValidOutfitDraft('planning')).toBe(false);
  });
});

describe('outfitPersistence file round-trip (issue #108 outcome 2)', () => {
  it('serialize→parse round-trips every draft through the versioned envelope', () => {
    const file = serializeOutfitDrafts({
      planning: validDraft,
      'core-dev': { ...validDraft, colors: { ...validDraft.colors, shirt: '#ABCDEF' } },
    });
    expect(JSON.parse(file).version).toBe(OUTFIT_STORAGE_VERSION);
    const parsed = parseOutfitDraftsFile(file);
    expect(parsed).not.toBeNull();
    expect(parsed!['planning']).toEqual(validDraft);
    expect(parsed!['core-dev']!.colors.shirt).toBe('#ABCDEF');
  });

  it('an export file loads through the storage path unchanged', () => {
    const storage = makeMemoryStorage();
    const file = serializeOutfitDrafts({ planning: validDraft });
    storage.data[OUTFIT_STORAGE_KEY] = file;
    expect(loadOutfitDrafts(storage)!['planning']).toEqual(validDraft);
  });

  it('returns null for a corrupt file', () => {
    expect(parseOutfitDraftsFile('{not-json')).toBeNull();
  });

  it('returns null for a wrong schema version', () => {
    expect(
      parseOutfitDraftsFile(
        JSON.stringify({ version: OUTFIT_STORAGE_VERSION + 99, drafts: { planning: validDraft } }),
      ),
    ).toBeNull();
  });

  it('returns null for a non-object payload', () => {
    expect(parseOutfitDraftsFile('[1,2,3]')).toBeNull();
    expect(parseOutfitDraftsFile('null')).toBeNull();
  });

  it('applies valid roles and drops invalid ones from a mixed file', () => {
    const partial = { ...validDraft, colors: { ...validDraft.colors } } as Record<string, unknown>;
    delete (partial['colors'] as Record<string, unknown>)['shirt'];
    const parsed = parseOutfitDraftsFile(
      JSON.stringify({
        version: OUTFIT_STORAGE_VERSION,
        drafts: { planning: validDraft, 'core-dev': partial, 'design-lead': validDraft },
      }),
    )!;
    expect(parsed['planning']).toEqual(validDraft);
    expect(parsed['core-dev']).toBeUndefined();
    expect(Object.keys(parsed)).toEqual(['planning']);
  });
});
