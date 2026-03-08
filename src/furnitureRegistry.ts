// src/furnitureRegistry.ts
// Single source of truth for the furniture catalog.
// Classic Habbo Hotel 2000-2005 era items verified against cortex-assets.

import type { SpriteCache } from './isoSpriteCache.js';

/** Category for grouping furniture in the UI */
export type FurnitureCategory =
  | 'habboclub'
  | 'fun'
  | 'office'
  | 'section';

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
 * Full furniture catalog — classic Habbo Hotel 2000-2005 era.
 * Each entry's `id` doubles as the Nitro asset name.
 */
export const FURNITURE_CATALOG: FurnitureEntry[] = [
  // Habbo Club (hc_) — Members-only exclusive furniture
  { id: 'hc_chr',       displayName: 'HC Chair',         category: 'habboclub' },
  { id: 'hc_tbl',       displayName: 'HC Table',         category: 'habboclub' },
  { id: 'hc_dsk',       displayName: 'HC Desk',          category: 'habboclub' },
  { id: 'hc_lmp',       displayName: 'HC Lamp',          category: 'habboclub' },
  { id: 'hc_bkshlf',    displayName: 'HC Bookshelf',     category: 'habboclub' },
  { id: 'hc_crpt',      displayName: 'HC Carpet',        category: 'habboclub' },
  { id: 'hc_djset',     displayName: 'HC DJ Turntable',  category: 'habboclub' },
  { id: 'hc_wall_lamp', displayName: 'HC Wall Lamp',     category: 'habboclub' },

  // Fun & Games
  { id: 'edice',            displayName: 'Dice',         category: 'fun' },
  { id: 'edicehc',          displayName: 'HC Dice',      category: 'fun' },
  { id: 'club_sofa',        displayName: 'Club Sofa',    category: 'fun' },
  { id: 'CF_1_coin_bronze', displayName: 'Bronze Coin',  category: 'fun' },
  { id: 'CF_5_coin_silver', displayName: 'Silver Coin',  category: 'fun' },
  { id: 'CF_10_coin_gold',  displayName: 'Gold Coin',    category: 'fun' },

  // Section-themed furniture
  { id: 'country_gate',     displayName: 'Teleport Booth',   category: 'section' },
  { id: 'tv_flat',          displayName: 'Flat Screen TV',    category: 'section' },
  { id: 'shelves_armas',    displayName: 'Server Rack',       category: 'section' },
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
  habboclub: 'Habbo Club',
  fun: 'Fun & Games',
  office: 'Office',
  section: 'Section Furniture',
};

/** Furniture IDs that act as teleport booths */
const TELEPORT_IDS = new Set(['country_gate']);

/**
 * Check if a furniture ID is a teleport booth.
 */
export function isTeleportBooth(furnitureId: string): boolean {
  return TELEPORT_IDS.has(resolveAssetName(furnitureId));
}

/**
 * Get furniture tile dimensions from Nitro metadata at runtime.
 * When direction is 2 or 4 (90° rotation), width and height are swapped.
 * Falls back to 1x1 if metadata is unavailable.
 */
export function getFurnitureDimensions(
  name: string,
  spriteCache: SpriteCache,
  direction: number = 0,
): { widthTiles: number; heightTiles: number } {
  const assetName = resolveAssetName(name);
  const metadata = spriteCache.getNitroMetadata(assetName);
  let w = 1;
  let h = 1;
  if (metadata?.logic?.dimensions) {
    [w, h] = metadata.logic.dimensions;
  }
  // Directions 2 and 4 are 90° rotated — swap width and height
  if (direction === 2 || direction === 4) {
    return { widthTiles: h, heightTiles: w };
  }
  return { widthTiles: w, heightTiles: h };
}

/** Furniture IDs that are chair-type (sittable) */
const CHAIR_IDS = new Set([
  'exe_chair',
  'hc_chr',
  'chair_norja',
  'chair_polyfon',
  'greek_c19_chair',
  'club_sofa',
]);

/** Furniture IDs that are flat/walkable (rugs, mats) */
const RUG_IDS = new Set([
  'exe_rug',
  'hc_crpt',
]);

/**
 * Check if a furniture ID is a chair-type item (sittable).
 */
export function isChairType(furnitureId: string): boolean {
  return CHAIR_IDS.has(resolveAssetName(furnitureId));
}

/**
 * Check if a furniture item is walkable (avatars can stand on it).
 * Chairs (sittable) and rugs/mats are walkable.
 */
export function isWalkableFurniture(furnitureId: string): boolean {
  const id = resolveAssetName(furnitureId);
  return CHAIR_IDS.has(id) || RUG_IDS.has(id);
}

/**
 * Get the supported Habbo directions for a furniture item.
 * Reads from Nitro metadata logic.directions.
 * Falls back to [0, 2, 4, 6] if metadata is unavailable.
 */
export function getSupportedDirections(
  name: string,
  spriteCache: SpriteCache,
): number[] {
  const assetName = resolveAssetName(name);
  const metadata = spriteCache.getNitroMetadata(assetName);
  if (metadata?.logic?.directions && metadata.logic.directions.length > 0) {
    return metadata.logic.directions;
  }
  return [0, 2, 4, 6];
}
