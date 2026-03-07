// tests/avatarOutfitConfig.test.ts
// Unit tests for outfit configuration types, catalog, palettes, and presets

import { describe, it, expect } from 'vitest';
import {
  FIGURE_CATALOG,
  SKIN_PALETTE,
  HAIR_PALETTE,
  CLOTHING_PALETTE,
  DEFAULT_PRESETS,
  getCatalogByCategory,
  getCatalogForSlot,
  getDefaultPreset,
  outfitToFigureParts,
  getRequiredAssets,
} from '../src/avatarOutfitConfig.js';
import type { PartType, CatalogItem, OutfitConfig } from '../src/avatarOutfitConfig.js';

describe('avatarOutfitConfig', () => {
  // ---- Catalog tests ----

  it('FIGURE_CATALOG has at least 20 items', () => {
    expect(FIGURE_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it('all catalog items have non-empty asset, displayName, and valid partType', () => {
    const validPartTypes: PartType[] = ['hrb', 'bd', 'lh', 'lg', 'sh', 'ch', 'ls', 'rh', 'rs', 'hd', 'hr'];
    for (const item of FIGURE_CATALOG) {
      expect(item.asset).toBeTruthy();
      expect(item.displayName).toBeTruthy();
      expect(item.id).toBeTruthy();
      expect(validPartTypes).toContain(item.partType);
      expect(['M', 'F', 'U']).toContain(item.gender);
      expect(['hair', 'tops', 'bottoms', 'shoes', 'accessories']).toContain(item.category);
      expect(item.setId).toBeGreaterThan(0);
    }
  });

  it('catalog has items in each category', () => {
    const categories = new Set(FIGURE_CATALOG.map((i) => i.category));
    expect(categories.has('hair')).toBe(true);
    expect(categories.has('tops')).toBe(true);
    expect(categories.has('bottoms')).toBe(true);
    expect(categories.has('shoes')).toBe(true);
    expect(categories.has('accessories')).toBe(true);
  });

  it('catalog has items for both genders and unisex', () => {
    const genders = new Set(FIGURE_CATALOG.map((i) => i.gender));
    expect(genders.has('M')).toBe(true);
    expect(genders.has('F')).toBe(true);
    expect(genders.has('U')).toBe(true);
  });

  // ---- Gender filtering tests ----

  it('getCatalogByCategory returns items for each category', () => {
    const catalog = getCatalogByCategory('M');
    expect(catalog.size).toBeGreaterThanOrEqual(4); // hair, tops, bottoms, shoes at minimum
    expect(catalog.has('hair')).toBe(true);
    expect(catalog.has('tops')).toBe(true);
    expect(catalog.has('bottoms')).toBe(true);
    expect(catalog.has('shoes')).toBe(true);
  });

  it('gender filtering excludes wrong-gender items but includes U', () => {
    const maleCatalog = getCatalogByCategory('M');
    const femaleCatalog = getCatalogByCategory('F');

    // Male catalog should not contain F-only items
    for (const [, items] of maleCatalog) {
      for (const item of items) {
        expect(item.gender).not.toBe('F');
      }
    }

    // Female catalog should not contain M-only items
    for (const [, items] of femaleCatalog) {
      for (const item of items) {
        expect(item.gender).not.toBe('M');
      }
    }

    // Both should include U items
    const maleHasUnisex = [...maleCatalog.values()].flat().some((i) => i.gender === 'U');
    const femaleHasUnisex = [...femaleCatalog.values()].flat().some((i) => i.gender === 'U');
    expect(maleHasUnisex).toBe(true);
    expect(femaleHasUnisex).toBe(true);
  });

  it('getCatalogForSlot filters by category and gender', () => {
    const maleHair = getCatalogForSlot('hair', 'M');
    expect(maleHair.length).toBeGreaterThan(0);
    for (const item of maleHair) {
      expect(item.category).toBe('hair');
      expect(['M', 'U']).toContain(item.gender);
    }

    const femaleShoes = getCatalogForSlot('shoes', 'F');
    expect(femaleShoes.length).toBeGreaterThan(0);
    for (const item of femaleShoes) {
      expect(item.category).toBe('shoes');
      expect(['F', 'U']).toContain(item.gender);
    }
  });

  // ---- Palette tests ----

  it('SKIN_PALETTE has 8 hex colors', () => {
    expect(SKIN_PALETTE).toHaveLength(8);
    for (const color of SKIN_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('HAIR_PALETTE has 12 hex colors', () => {
    expect(HAIR_PALETTE).toHaveLength(12);
    for (const color of HAIR_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('CLOTHING_PALETTE has 16 hex colors', () => {
    expect(CLOTHING_PALETTE).toHaveLength(16);
    for (const color of CLOTHING_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  // ---- Default presets tests ----

  it('DEFAULT_PRESETS has at least 6 presets', () => {
    expect(DEFAULT_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it('DEFAULT_PRESETS has exactly 8 presets', () => {
    expect(DEFAULT_PRESETS).toHaveLength(8);
  });

  it('each preset has valid structure', () => {
    for (const preset of DEFAULT_PRESETS) {
      expect(['M', 'F']).toContain(preset.gender);
      expect(preset.parts.hair.asset).toBeTruthy();
      expect(preset.parts.shirt.asset).toBeTruthy();
      expect(preset.parts.pants.asset).toBeTruthy();
      expect(preset.parts.shoes.asset).toBeTruthy();
      expect(preset.parts.hair.setId).toBeGreaterThan(0);
      expect(preset.parts.shirt.setId).toBeGreaterThan(0);
      expect(preset.parts.pants.setId).toBeGreaterThan(0);
      expect(preset.parts.shoes.setId).toBeGreaterThan(0);
      expect(preset.colors.skin).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.hair).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.shirt).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.pants).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.colors.shoes).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('presets include both male and female genders', () => {
    const genders = new Set(DEFAULT_PRESETS.map((p) => p.gender));
    expect(genders.has('M')).toBe(true);
    expect(genders.has('F')).toBe(true);
  });

  it('getDefaultPreset wraps around for variant > preset count', () => {
    const preset0 = getDefaultPreset(0);
    const presetWrapped = getDefaultPreset(DEFAULT_PRESETS.length);
    expect(presetWrapped).toEqual(preset0);

    const preset1 = getDefaultPreset(1);
    const presetWrapped1 = getDefaultPreset(DEFAULT_PRESETS.length + 1);
    expect(presetWrapped1).toEqual(preset1);
  });

  it('getDefaultPreset returns valid OutfitConfig for all variants 0-7', () => {
    for (let v = 0; v < 8; v++) {
      const preset = getDefaultPreset(v);
      expect(preset).toBeDefined();
      expect(preset.parts).toBeDefined();
      expect(preset.colors).toBeDefined();
    }
  });

  // ---- outfitToFigureParts tests ----

  it('outfitToFigureParts produces all 11 PartType entries', () => {
    const preset = getDefaultPreset(0);
    const parts = outfitToFigureParts(preset);

    const allPartTypes: PartType[] = ['hrb', 'bd', 'lh', 'lg', 'sh', 'ch', 'ls', 'rh', 'rs', 'hd', 'hr'];
    for (const pt of allPartTypes) {
      expect(parts[pt]).toBeDefined();
      expect(parts[pt].asset).toBeTruthy();
      expect(parts[pt].setId).toBeGreaterThan(0);
    }
  });

  it('outfitToFigureParts body parts always use hh_human_body', () => {
    const preset = getDefaultPreset(0);
    const parts = outfitToFigureParts(preset);

    expect(parts.bd.asset).toBe('hh_human_body');
    expect(parts.lh.asset).toBe('hh_human_body');
    expect(parts.rh.asset).toBe('hh_human_body');
    expect(parts.hd.asset).toBe('hh_human_body');
    expect(parts.bd.setId).toBe(1);
    expect(parts.lh.setId).toBe(1);
    expect(parts.rh.setId).toBe(1);
    expect(parts.hd.setId).toBe(1);
  });

  it('outfitToFigureParts maps hair to both hr and hrb', () => {
    const preset = getDefaultPreset(0);
    const parts = outfitToFigureParts(preset);

    expect(parts.hr.asset).toBe(preset.parts.hair.asset);
    expect(parts.hr.setId).toBe(preset.parts.hair.setId);
    expect(parts.hrb.asset).toBe(preset.parts.hair.asset);
    expect(parts.hrb.setId).toBe(preset.parts.hair.setId);
  });

  it('outfitToFigureParts maps shirt to ch, ls, and rs', () => {
    const preset = getDefaultPreset(0);
    const parts = outfitToFigureParts(preset);

    expect(parts.ch.asset).toBe(preset.parts.shirt.asset);
    expect(parts.ch.setId).toBe(preset.parts.shirt.setId);
    expect(parts.ls.asset).toBe(preset.parts.shirt.asset);
    expect(parts.rs.asset).toBe(preset.parts.shirt.asset);
  });

  it('outfitToFigureParts maps pants to lg and shoes to sh', () => {
    const preset = getDefaultPreset(0);
    const parts = outfitToFigureParts(preset);

    expect(parts.lg.asset).toBe(preset.parts.pants.asset);
    expect(parts.lg.setId).toBe(preset.parts.pants.setId);
    expect(parts.sh.asset).toBe(preset.parts.shoes.asset);
    expect(parts.sh.setId).toBe(preset.parts.shoes.setId);
  });

  // ---- getRequiredAssets tests ----

  it('getRequiredAssets returns unique asset names', () => {
    const preset = getDefaultPreset(0);
    const assets = getRequiredAssets(preset);

    // Should always include hh_human_body
    expect(assets).toContain('hh_human_body');

    // Should be unique
    const unique = new Set(assets);
    expect(unique.size).toBe(assets.length);
  });

  it('getRequiredAssets includes all outfit part assets', () => {
    const preset = getDefaultPreset(0);
    const assets = getRequiredAssets(preset);

    expect(assets).toContain(preset.parts.hair.asset);
    expect(assets).toContain(preset.parts.shirt.asset);
    expect(assets).toContain(preset.parts.pants.asset);
    expect(assets).toContain(preset.parts.shoes.asset);
  });

  it('getRequiredAssets deduplicates when parts share asset files', () => {
    // Create an outfit where multiple parts use the same asset
    const outfit: OutfitConfig = {
      gender: 'M',
      parts: {
        hair:  { asset: 'Hair_M_yo', setId: 2096 },
        shirt: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
        pants: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 }, // same as shirt (contrived)
        shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
      },
      colors: { skin: '#EFCFB1', hair: '#4A3728', shirt: '#5B9BD5', pants: '#3B5998', shoes: '#2C2C2C' },
    };

    const assets = getRequiredAssets(outfit);
    // hh_human_body, Hair_M_yo, Shirt_M_Tshirt_Plain (deduped), Shoes_U_Slipons = 4
    expect(assets).toHaveLength(4);
  });
});
