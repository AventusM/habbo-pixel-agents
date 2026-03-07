// src/avatarOutfitConfig.ts
// Outfit configuration types, curated clothing catalog, color palettes, and default presets
// for the avatar builder UI. This module defines the data foundation consumed by the
// renderer (Plan 02) and builder modal (Plan 03).

// ---- Types ----

/** Body part types matching the 11-layer figure composition system */
export type PartType = "hrb" | "bd" | "lh" | "lg" | "sh" | "ch" | "ls" | "rh" | "rs" | "hd" | "hr";

/** Per-avatar outfit definition */
export interface OutfitConfig {
  gender: 'M' | 'F';
  parts: {
    hair: { asset: string; setId: number };
    shirt: { asset: string; setId: number };
    pants: { asset: string; setId: number };
    shoes: { asset: string; setId: number };
  };
  colors: {
    skin: string;   // hex color
    hair: string;
    shirt: string;
    pants: string;
    shoes: string;
  };
}

/** Catalog item for the clothing selector UI */
export interface CatalogItem {
  id: string;
  asset: string;        // cortex-assets figure name
  setId: number;         // Habbo setId for frame key construction
  partType: PartType;    // which body slot (hr, ch, lg, sh)
  category: 'hair' | 'tops' | 'bottoms' | 'shoes' | 'accessories';
  gender: 'M' | 'F' | 'U';
  displayName: string;
}

// ---- Curated Catalog ----

export const FIGURE_CATALOG: CatalogItem[] = [
  // Hair (5+ styles)
  { id: 'hair-m-yo',              asset: 'Hair_M_yo',             setId: 2096, partType: 'hr', category: 'hair', gender: 'M', displayName: 'Classic' },
  { id: 'hair-u-messy-1',         asset: 'Hair_U_Messy',          setId: 2071, partType: 'hr', category: 'hair', gender: 'U', displayName: 'Messy' },
  { id: 'hair-u-messy-2',         asset: 'Hair_U_Messy',          setId: 2072, partType: 'hr', category: 'hair', gender: 'U', displayName: 'Messy Alt' },
  { id: 'hair-f-bob',             asset: 'Hair_F_Bob',            setId: 2073, partType: 'hr', category: 'hair', gender: 'F', displayName: 'Bob' },
  { id: 'hair-u-multi-colour',    asset: 'Hair_U_Multi_Colour',   setId: 2074, partType: 'hr', category: 'hair', gender: 'U', displayName: 'Multi Colour' },

  // Tops (7+ items)
  { id: 'shirt-m-tshirt-plain',   asset: 'Shirt_M_Tshirt_Plain',  setId: 2050, partType: 'ch', category: 'tops', gender: 'M', displayName: 'T-Shirt' },
  { id: 'shirt-f-tshirt-plain',   asset: 'Shirt_F_Tshirt_Plain',  setId: 2051, partType: 'ch', category: 'tops', gender: 'F', displayName: 'T-Shirt' },
  { id: 'shirt-f-tshirt-sleeved', asset: 'Shirt_F_Tshirt_Sleeved', setId: 2052, partType: 'ch', category: 'tops', gender: 'F', displayName: 'Sleeved Tee' },
  { id: 'shirt-m-tshirt-sleeved', asset: 'Shirt_M_Tshirt_Sleeved', setId: 2053, partType: 'ch', category: 'tops', gender: 'M', displayName: 'Sleeved Tee' },
  { id: 'shirt-f-cardigan',       asset: 'Shirt_F_Cardigan',      setId: 2054, partType: 'ch', category: 'tops', gender: 'F', displayName: 'Cardigan' },
  { id: 'shirt-m-cardigan',       asset: 'Shirt_M_Cardigan',      setId: 2055, partType: 'ch', category: 'tops', gender: 'M', displayName: 'Cardigan' },
  { id: 'shirt-f-punk-shirt',     asset: 'Shirt_F_Punk_Shirt',    setId: 2056, partType: 'ch', category: 'tops', gender: 'F', displayName: 'Punk Shirt' },

  // Bottoms (4+ items)
  { id: 'trousers-u-skinny-jeans', asset: 'Trousers_U_Skinny_Jeans', setId: 2097, partType: 'lg', category: 'bottoms', gender: 'U', displayName: 'Skinny Jeans' },
  { id: 'trousers-u-straight',     asset: 'Trousers_U_Sraight',     setId: 2098, partType: 'lg', category: 'bottoms', gender: 'U', displayName: 'Straight Jeans' },
  { id: 'trousers-u-runway',       asset: 'Trousers_U_runway',      setId: 2099, partType: 'lg', category: 'bottoms', gender: 'U', displayName: 'Runway Pants' },
  { id: 'trousers-f-leather-skirt', asset: 'Trousers_F_Leather_skirt', setId: 2100, partType: 'lg', category: 'bottoms', gender: 'F', displayName: 'Leather Skirt' },

  // Shoes (2+ items)
  { id: 'shoes-u-slipons',        asset: 'Shoes_U_Slipons',       setId: 2044, partType: 'sh', category: 'shoes', gender: 'U', displayName: 'Slip-ons' },
  { id: 'shoes-f-schoolshoes',    asset: 'Shoes_F_Schoolshoes',   setId: 2101, partType: 'sh', category: 'shoes', gender: 'F', displayName: 'School Shoes' },

  // Accessories (2+ items — optional slots)
  { id: 'hat-u-sombrero',         asset: 'Hat_U_sombrero',        setId: 2102, partType: 'hr', category: 'accessories', gender: 'U', displayName: 'Sombrero' },
  { id: 'hat-u-urban',            asset: 'Hat_U_urban',           setId: 2103, partType: 'hr', category: 'accessories', gender: 'U', displayName: 'Urban Hat' },
];

// ---- Color Palettes ----

/** Skin tone palette (8 swatches, realistic range) */
export const SKIN_PALETTE = [
  '#FCEBD6', '#F5D6C3', '#EFCFB1', '#D4A574',
  '#C49060', '#9E6B4A', '#7D5238', '#5C3A1E',
];

/** Hair color palette (12 swatches, naturals + fun) */
export const HAIR_PALETTE = [
  '#1A1A1A', '#4A3728', '#8B6914', '#C4651A', '#D4A017', '#E0E0E0',
  '#D55B5B', '#5B9BD5', '#5BD55B', '#9B5BD5', '#FF69B4', '#FF8C00',
];

/** Clothing color palette (16 swatches) */
export const CLOTHING_PALETTE = [
  '#FFFFFF', '#CCCCCC', '#666666', '#333333',
  '#D55B5B', '#FF8C00', '#D5D55B', '#5BD55B',
  '#5B9BD5', '#3B5998', '#9B5BD5', '#4B0082',
  '#8B4513', '#556B2F', '#800020', '#2C2C2C',
];

// ---- Default Presets ----

/**
 * 8 default outfit presets for visual variety.
 * New agents are assigned presets via `variant % DEFAULT_PRESETS.length`.
 * First 6 match the original VARIANT_OUTFITS color scheme.
 */
export const DEFAULT_PRESETS: OutfitConfig[] = [
  // 0: Blue outfit, brown hair (male)
  {
    gender: 'M',
    parts: {
      hair:  { asset: 'Hair_M_yo', setId: 2096 },
      shirt: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
    },
    colors: { skin: '#EFCFB1', hair: '#4A3728', shirt: '#5B9BD5', pants: '#3B5998', shoes: '#2C2C2C' },
  },
  // 1: Red outfit, black hair (male)
  {
    gender: 'M',
    parts: {
      hair:  { asset: 'Hair_U_Messy', setId: 2071 },
      shirt: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
    },
    colors: { skin: '#D4A574', hair: '#1A1A1A', shirt: '#D55B5B', pants: '#333333', shoes: '#5C3A1E' },
  },
  // 2: Green outfit, ginger hair (male)
  {
    gender: 'M',
    parts: {
      hair:  { asset: 'Hair_U_Messy', setId: 2072 },
      shirt: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
    },
    colors: { skin: '#F5D6C3', hair: '#C4651A', shirt: '#5BD55B', pants: '#4A7023', shoes: '#8B6914' },
  },
  // 3: Purple outfit, purple hair (male)
  {
    gender: 'M',
    parts: {
      hair:  { asset: 'Hair_M_yo', setId: 2096 },
      shirt: { asset: 'Shirt_M_Cardigan', setId: 2055 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
    },
    colors: { skin: '#EFCFB1', hair: '#8B6DB0', shirt: '#9B5BD5', pants: '#4B0082', shoes: '#2C2C2C' },
  },
  // 4: Orange outfit, blonde hair (male)
  {
    gender: 'M',
    parts: {
      hair:  { asset: 'Hair_U_Messy', setId: 2071 },
      shirt: { asset: 'Shirt_M_Tshirt_Sleeved', setId: 2053 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
    },
    colors: { skin: '#D4A574', hair: '#D4A017', shirt: '#D5A05B', pants: '#8B4513', shoes: '#654321' },
  },
  // 5: Yellow outfit, white hair (male)
  {
    gender: 'M',
    parts: {
      hair:  { asset: 'Hair_U_Messy', setId: 2072 },
      shirt: { asset: 'Shirt_M_Tshirt_Plain', setId: 2050 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
    },
    colors: { skin: '#F5D6C3', hair: '#E0E0E0', shirt: '#D5D55B', pants: '#556B2F', shoes: '#696969' },
  },
  // 6: Pink outfit, bob hair (female)
  {
    gender: 'F',
    parts: {
      hair:  { asset: 'Hair_F_Bob', setId: 2073 },
      shirt: { asset: 'Shirt_F_Tshirt_Plain', setId: 2051 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_F_Schoolshoes', setId: 2101 },
    },
    colors: { skin: '#FCEBD6', hair: '#FF69B4', shirt: '#D55B5B', pants: '#333333', shoes: '#2C2C2C' },
  },
  // 7: Teal outfit, multi-colour hair (female)
  {
    gender: 'F',
    parts: {
      hair:  { asset: 'Hair_U_Multi_Colour', setId: 2074 },
      shirt: { asset: 'Shirt_F_Cardigan', setId: 2054 },
      pants: { asset: 'Trousers_U_Skinny_Jeans', setId: 2097 },
      shoes: { asset: 'Shoes_U_Slipons', setId: 2044 },
    },
    colors: { skin: '#C49060', hair: '#5B9BD5', shirt: '#5B9BD5', pants: '#3B5998', shoes: '#333333' },
  },
];

// ---- Helper Functions ----

/**
 * Get catalog items filtered by gender and grouped by category.
 * Includes 'U' (unisex) items for both genders.
 */
export function getCatalogByCategory(gender: 'M' | 'F'): Map<string, CatalogItem[]> {
  const result = new Map<string, CatalogItem[]>();
  for (const item of FIGURE_CATALOG) {
    if (item.gender !== gender && item.gender !== 'U') continue;
    const existing = result.get(item.category) || [];
    existing.push(item);
    result.set(item.category, existing);
  }
  return result;
}

/**
 * Get catalog items for a specific slot/category and gender.
 * Convenience filter combining category + gender matching.
 */
export function getCatalogForSlot(category: string, gender: 'M' | 'F'): CatalogItem[] {
  return FIGURE_CATALOG.filter(
    (item) => item.category === category && (item.gender === gender || item.gender === 'U')
  );
}

/**
 * Get the default preset for a variant index.
 * Wraps around for variant values exceeding preset count.
 */
export function getDefaultPreset(variant: number): OutfitConfig {
  return DEFAULT_PRESETS[variant % DEFAULT_PRESETS.length];
}

/**
 * Convert an OutfitConfig into the FIGURE_PARTS format the renderer expects.
 * Body parts (bd, lh, rh, hd) always map to hh_human_body setId 1.
 * Hair maps hr AND hrb. Shirt maps ch, ls, AND rs. Pants maps lg. Shoes maps sh.
 */
export function outfitToFigureParts(outfit: OutfitConfig): Record<PartType, { asset: string; setId: number }> {
  return {
    bd:  { asset: 'hh_human_body', setId: 1 },
    lh:  { asset: 'hh_human_body', setId: 1 },
    rh:  { asset: 'hh_human_body', setId: 1 },
    hd:  { asset: 'hh_human_body', setId: 1 },
    hr:  { asset: outfit.parts.hair.asset, setId: outfit.parts.hair.setId },
    hrb: { asset: outfit.parts.hair.asset, setId: outfit.parts.hair.setId },
    ch:  { asset: outfit.parts.shirt.asset, setId: outfit.parts.shirt.setId },
    ls:  { asset: outfit.parts.shirt.asset, setId: outfit.parts.shirt.setId },
    rs:  { asset: outfit.parts.shirt.asset, setId: outfit.parts.shirt.setId },
    lg:  { asset: outfit.parts.pants.asset, setId: outfit.parts.pants.setId },
    sh:  { asset: outfit.parts.shoes.asset, setId: outfit.parts.shoes.setId },
  };
}

/**
 * Get the list of unique asset names required to render an outfit.
 * Used for lazy loading — only load assets that are actually needed.
 */
export function getRequiredAssets(outfit: OutfitConfig): string[] {
  const assets = new Set<string>();
  assets.add('hh_human_body'); // always needed
  assets.add(outfit.parts.hair.asset);
  assets.add(outfit.parts.shirt.asset);
  assets.add(outfit.parts.pants.asset);
  assets.add(outfit.parts.shoes.asset);
  return [...assets];
}
