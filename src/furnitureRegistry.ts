// src/furnitureRegistry.ts
// Single source of truth for the furniture catalog.
// Replaces scattered NITRO_FURNITURE_MAP, FURNITURE_SPECS, and FURNITURE_TYPES.

import type { SpriteCache } from './isoSpriteCache.js';

/** Category for grouping furniture in the UI */
export type FurnitureCategory =
  | 'office'
  | 'bathroom'
  | 'outdoor'
  | 'classic'
  | 'decor';

/** Single entry in the furniture catalog */
export interface FurnitureEntry {
  /** Canonical ID used in code and saved layouts (= Nitro asset name) */
  id: string;
  /** Human-readable display name for UI */
  displayName: string;
  /** Category for dropdown grouping */
  category: FurnitureCategory;
}

/**
 * Full furniture catalog. Each entry's `id` doubles as the Nitro asset name.
 */
export const FURNITURE_CATALOG: FurnitureEntry[] = [
  // Office (exe_)
  { id: 'exe_chair',   displayName: 'Office Chair',    category: 'office' },
  { id: 'exe_table',   displayName: 'Office Desk',     category: 'office' },
  { id: 'exe_light',   displayName: 'Desk Lamp',       category: 'office' },
  { id: 'exe_plant',   displayName: 'Office Plant',    category: 'office' },
  { id: 'exe_globe',   displayName: 'Globe',           category: 'office' },
  { id: 'exe_sofa',    displayName: 'Office Sofa',     category: 'office' },
  { id: 'exe_rug',     displayName: 'Office Rug',      category: 'office' },
  { id: 'exe_copier',  displayName: 'Copy Machine',    category: 'office' },

  // Bathroom
  { id: 'bathroom_bath1',   displayName: 'Bathtub',    category: 'bathroom' },
  { id: 'bathroom_toilet1', displayName: 'Toilet',     category: 'bathroom' },

  // Outdoor (country_)
  { id: 'country_lantern',   displayName: 'Lantern',     category: 'outdoor' },
  { id: 'country_well',      displayName: 'Well',        category: 'outdoor' },
  { id: 'country_scarecrow', displayName: 'Scarecrow',   category: 'outdoor' },
  { id: 'country_gate',      displayName: 'Gate',        category: 'outdoor' },

  // Classic (greek_, bolly_table)
  { id: 'greek_c19_table', displayName: 'Greek Table', category: 'classic' },
  { id: 'greek_c19_chair', displayName: 'Greek Chair', category: 'classic' },
  { id: 'bolly_table',     displayName: 'Tropical Table', category: 'classic' },

  // Decorations (bolly_, bazaar_)
  { id: 'bolly_palm',        displayName: 'Palm Tree',      category: 'decor' },
  { id: 'bolly_swing',       displayName: 'Swing',          category: 'decor' },
  { id: 'bolly_fountain',    displayName: 'Fountain',       category: 'decor' },
  { id: 'bolly_vase',        displayName: 'Tropical Vase',  category: 'decor' },
  { id: 'bazaar_c17_pillow', displayName: 'Cushion',        category: 'decor' },
  { id: 'bazaar_c17_lamp',   displayName: 'Bazaar Lamp',    category: 'decor' },
  { id: 'bazaar_c17_curtain', displayName: 'Curtain',       category: 'decor' },
];

/**
 * Legacy alias map: old friendly names → canonical IDs.
 * Provides backward compatibility with saved layouts that used friendly names.
 */
export const LEGACY_ALIASES: Record<string, string> = {
  chair:      'exe_chair',
  desk:       'exe_table',
  lamp:       'exe_light',
  plant:      'exe_plant',
  bookshelf:  'exe_globe',
  computer:   'exe_copier',
  rug:        'exe_rug',
  whiteboard: 'exe_sofa',
};

// Build lookup map at module load time
const catalogById = new Map<string, FurnitureEntry>();
for (const entry of FURNITURE_CATALOG) {
  catalogById.set(entry.id, entry);
}

/**
 * Resolve any furniture name (legacy alias or canonical ID) to a Nitro asset name.
 * Returns the input unchanged if not found in catalog or aliases.
 */
export function resolveAssetName(name: string): string {
  const aliased = LEGACY_ALIASES[name];
  if (aliased) return aliased;
  return name;
}

/**
 * Get display name for a furniture item.
 */
export function getDisplayName(name: string): string {
  const id = resolveAssetName(name);
  const entry = catalogById.get(id);
  return entry ? entry.displayName : name;
}

/**
 * Get all furniture entries, grouped by category.
 */
export function getCatalogByCategory(): Map<FurnitureCategory, FurnitureEntry[]> {
  const grouped = new Map<FurnitureCategory, FurnitureEntry[]>();
  for (const entry of FURNITURE_CATALOG) {
    const list = grouped.get(entry.category) || [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  return grouped;
}

/** Category display labels for the UI */
export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  office: 'Office',
  bathroom: 'Bathroom',
  outdoor: 'Outdoor',
  classic: 'Classic',
  decor: 'Decorations',
};

/**
 * Get furniture tile dimensions from Nitro metadata at runtime.
 * Falls back to 1×1 if metadata is unavailable.
 */
export function getFurnitureDimensions(
  name: string,
  spriteCache: SpriteCache,
): { widthTiles: number; heightTiles: number } {
  const assetName = resolveAssetName(name);
  const metadata = spriteCache.getNitroMetadata(assetName);
  if (metadata?.logic?.dimensions) {
    const [w, h] = metadata.logic.dimensions;
    return { widthTiles: w, heightTiles: h };
  }
  return { widthTiles: 1, heightTiles: 1 };
}
