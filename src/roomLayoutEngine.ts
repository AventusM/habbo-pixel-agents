// src/roomLayoutEngine.ts
// Room layout template engine for generating multi-section floor plans
// Produces heightmap strings compatible with parseHeightmap from isoTypes.ts

import type { TeamSection } from './agentTypes.js';
import type { FurnitureSpec } from './isoFurnitureRenderer.js';
import type { HsbColor } from './isoTypes.js';

/** Layout info for a single team section within the floor template */
export interface SectionLayout {
  team: TeamSection;
  originTile: { x: number; y: number };
  widthTiles: number;
  heightTiles: number;
  teleportTile: { x: number; y: number };
  furniture: FurnitureSpec[];
  deskTiles: { x: number; y: number; dir: number }[];
  idleTiles: { x: number; y: number }[];
}

/** Complete floor template with sections, dividers, and doorways */
export interface FloorTemplate {
  size: 'small' | 'medium' | 'large';
  totalWidth: number;
  totalHeight: number;
  heightmap: string;
  sections: SectionLayout[];
  dividerTiles: { x: number; y: number }[];
  doorwayTiles: { x: number; y: number }[];
}

/** Template size definitions */
export const TEMPLATE_SIZES = {
  small: { total: 9, usable: 4, border: 0, divider: 1 },
  medium: { total: 11, usable: 5, border: 0, divider: 1 },
  large: { total: 13, usable: 6, border: 0, divider: 1 },
} as const;

/** Section assignments in 2x2 grid order */
const SECTION_TEAMS: TeamSection[] = [
  'planning',       // top-left
  'core-dev',       // top-right
  'infrastructure', // bottom-left
  'support',        // bottom-right
];

/**
 * Generate a floor template with 4 team sections in a 2x2 grid.
 * All tiles are at height 0 (flat elevation). Dividers are void tiles
 * with doorway openings at midpoints between sections.
 */
export function generateFloorTemplate(size: 'small' | 'medium' | 'large'): FloorTemplate {
  const cfg = TEMPLATE_SIZES[size];
  const total = cfg.total;
  const border = cfg.border;
  const divider = cfg.divider;
  const usable = cfg.usable;

  // Section dimensions: border + usable + divider/2 per side
  // total = border + usable + divider + usable + border
  // Verify: 1 + 8 + 2 + 8 + 1 = 20 (small) -- correct

  // Build the heightmap grid: all void initially
  const grid: string[][] = [];
  for (let y = 0; y < total; y++) {
    grid[y] = [];
    for (let x = 0; x < total; x++) {
      grid[y][x] = 'x';
    }
  }

  // Walkable region boundaries (inside border)
  const walkStart = border;
  const walkEnd = total - border - 1;

  // Divider strip positions (center of the grid)
  const divStart = border + usable; // first divider column/row
  const divEnd = divStart + divider - 1; // last divider column/row

  // Fill walkable tiles (all at height 0)
  for (let y = walkStart; y <= walkEnd; y++) {
    for (let x = walkStart; x <= walkEnd; x++) {
      // Default walkable
      grid[y][x] = '0';
    }
  }

  // Divider tiles are walkable but mark section boundaries (no void gaps)
  const dividerTiles: { x: number; y: number }[] = [];
  for (let y = walkStart; y <= walkEnd; y++) {
    for (let x = divStart; x <= divEnd; x++) {
      dividerTiles.push({ x, y }); // vertical divider zone
    }
  }
  for (let x = walkStart; x <= walkEnd; x++) {
    for (let y = divStart; y <= divEnd; y++) {
      if (x < divStart || x > divEnd) {
        dividerTiles.push({ x, y }); // horizontal divider zone
      }
    }
  }

  // Doorway tiles sit on the divider zone (all walkable, no void to bridge)
  const doorwayTiles: { x: number; y: number }[] = [];
  const filteredDividers = dividerTiles;

  // Section origins (top-left corner of each usable area)
  const sectionOrigins = [
    { x: border, y: border },                 // top-left (planning)
    { x: divEnd + 1, y: border },             // top-right (core-dev)
    { x: border, y: divEnd + 1 },             // bottom-left (infrastructure)
    { x: divEnd + 1, y: divEnd + 1 },         // bottom-right (support)
  ];

  // Build section layouts
  const sections: SectionLayout[] = SECTION_TEAMS.map((team, i) => {
    const origin = sectionOrigins[i];

    // Teleport tile: corner of section nearest to divider (1 tile from divider)
    const teleportTile = {
      x: i % 2 === 0 ? origin.x + usable - 1 : origin.x,
      y: i < 2 ? origin.y + usable - 1 : origin.y,
    };

    // Desk tiles: interior positions away from dividers
    const deskTiles = generateDeskTiles(origin, usable);

    // Idle/wander tiles: remaining interior positions
    const idleTiles = generateIdleTiles(origin, usable, teleportTile, deskTiles);

    const sectionLayout: SectionLayout = {
      team,
      originTile: origin,
      widthTiles: usable,
      heightTiles: usable,
      teleportTile,
      furniture: [],
      deskTiles,
      idleTiles,
    };
    // Only place teleport booth at each section's spawn point
    sectionLayout.furniture = [{
      name: 'ads_cltele',
      tileX: teleportTile.x,
      tileY: teleportTile.y,
      tileZ: 0,
      direction: 2,
    }];

    return sectionLayout;
  });

  // Build heightmap string
  const heightmap = grid.map(row => row.join('')).join('\n');

  return {
    size,
    totalWidth: total,
    totalHeight: total,
    heightmap,
    sections,
    dividerTiles: filteredDividers,
    doorwayTiles,
  };
}

/**
 * Generate section-themed furniture specs for a team section.
 * Each section gets a teleport booth plus team-appropriate items.
 */
export function getSectionFurniture(
  team: TeamSection,
  section: SectionLayout,
): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  const { originTile, widthTiles: w, heightTiles: h, teleportTile, deskTiles } = section;

  // Every section gets a teleport booth at the teleport tile
  specs.push({
    name: 'country_gate',
    tileX: teleportTile.x,
    tileY: teleportTile.y,
    tileZ: 0,
    direction: 2,
  });

  switch (team) {
    case 'planning':
      // Conference table at center area
      specs.push({
        name: 'hc_tbl',
        tileX: originTile.x + Math.floor(w / 2),
        tileY: originTile.y + Math.floor(h / 2),
        tileZ: 0,
        direction: 0,
      });
      // Bookshelf along one wall
      specs.push({
        name: 'hc_bkshlf',
        tileX: originTile.x + 1,
        tileY: originTile.y,
        tileZ: 0,
        direction: 2,
      });
      // Chairs around table
      for (let i = 0; i < Math.min(deskTiles.length, 3); i++) {
        specs.push({
          name: 'hc_chr',
          tileX: deskTiles[i].x,
          tileY: deskTiles[i].y,
          tileZ: 0,
          direction: (deskTiles[i].dir as 0 | 2 | 4 | 6),
        });
      }
      break;

    case 'core-dev':
      // Workstations at desk positions
      for (const desk of deskTiles) {
        specs.push({
          name: 'hc_dsk',
          tileX: desk.x,
          tileY: desk.y,
          tileZ: 0,
          direction: (desk.dir as 0 | 2 | 4 | 6),
        });
      }
      // TV monitor on first desk
      if (deskTiles.length > 0) {
        specs.push({
          name: 'tv_flat',
          tileX: deskTiles[0].x,
          tileY: deskTiles[0].y + 1,
          tileZ: 0,
          direction: 2,
        });
      }
      // Lamp at corner
      specs.push({
        name: 'hc_lmp',
        tileX: originTile.x + w - 1,
        tileY: originTile.y + h - 1,
        tileZ: 0,
        direction: 0,
      });
      break;

    case 'infrastructure':
      // Server racks along walls
      specs.push({
        name: 'shelves_armas',
        tileX: originTile.x + 1,
        tileY: originTile.y,
        tileZ: 0,
        direction: 2,
      });
      specs.push({
        name: 'shelves_armas',
        tileX: originTile.x + 3 < originTile.x + w ? originTile.x + 3 : originTile.x + 2,
        tileY: originTile.y,
        tileZ: 0,
        direction: 2,
      });
      // Status lamps at corners
      specs.push({
        name: 'hc_lmp',
        tileX: originTile.x,
        tileY: originTile.y + h - 1,
        tileZ: 0,
        direction: 0,
      });
      specs.push({
        name: 'hc_lmp',
        tileX: originTile.x + w - 1,
        tileY: originTile.y + h - 1,
        tileZ: 0,
        direction: 0,
      });
      break;

    case 'support':
      // Reference bookshelves along walls
      specs.push({
        name: 'hc_bkshlf',
        tileX: originTile.x + 1,
        tileY: originTile.y,
        tileZ: 0,
        direction: 2,
      });
      specs.push({
        name: 'hc_bkshlf',
        tileX: originTile.x + 3 < originTile.x + w ? originTile.x + 3 : originTile.x + 2,
        tileY: originTile.y,
        tileZ: 0,
        direction: 2,
      });
      // Diagnostic station chairs at desk positions
      for (const desk of deskTiles) {
        specs.push({
          name: 'hc_chr',
          tileX: desk.x,
          tileY: desk.y,
          tileZ: 0,
          direction: (desk.dir as 0 | 2 | 4 | 6),
        });
      }
      break;
  }

  return specs;
}

/** Generate desk tile positions in the interior of a section */
function generateDeskTiles(
  origin: { x: number; y: number },
  usable: number,
): { x: number; y: number; dir: number }[] {
  const desks: { x: number; y: number; dir: number }[] = [];
  // Place desks in the interior (2 tiles from edges)
  const inset = Math.min(2, Math.floor(usable / 3));
  const count = Math.max(2, Math.floor(usable / 3));

  for (let i = 0; i < count; i++) {
    desks.push({
      x: origin.x + inset + i * 2,
      y: origin.y + inset,
      dir: 2, // facing south-east
    });
  }
  return desks;
}

/** Generate idle/wander tile positions avoiding teleport and desk tiles */
function generateIdleTiles(
  origin: { x: number; y: number },
  usable: number,
  teleportTile: { x: number; y: number },
  deskTiles: { x: number; y: number; dir: number }[],
): { x: number; y: number }[] {
  const occupied = new Set<string>();
  occupied.add(`${teleportTile.x},${teleportTile.y}`);
  for (const d of deskTiles) {
    occupied.add(`${d.x},${d.y}`);
  }

  const tiles: { x: number; y: number }[] = [];
  // Fill center area with idle tiles
  const inset = 1;
  for (let dy = inset; dy < usable - inset; dy++) {
    for (let dx = inset; dx < usable - inset; dx++) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (!occupied.has(`${x},${y}`)) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/** Look up a section by team name */
export function getSectionForTeam(
  template: FloorTemplate,
  team: TeamSection,
): SectionLayout | undefined {
  return template.sections.find(s => s.team === team);
}

/** Select template size based on agent count */
export function getTemplateSize(agentCount: number): 'small' | 'medium' | 'large' {
  if (agentCount <= 12) return 'small';
  if (agentCount <= 24) return 'medium';
  return 'large';
}

/** HSB colors for each team section (soft pastels that look good as floor tiles) */
const SECTION_COLORS: Record<TeamSection, HsbColor> = {
  'planning':       { h: 220, s: 30, b: 85 },  // soft blue
  'core-dev':       { h: 145, s: 30, b: 80 },  // soft green
  'infrastructure': { h: 35,  s: 30, b: 85 },  // soft amber
  'support':        { h: 280, s: 25, b: 85 },  // soft purple
};

/** Divider strip color (neutral grey, slightly darker) */
const DIVIDER_COLOR: HsbColor = { h: 0, s: 0, b: 70 };

/**
 * Build a tileColorMap that colors each section's tiles differently.
 * Divider tiles get a neutral color to visually separate sections.
 */
export function buildSectionColorMap(template: FloorTemplate): Map<string, HsbColor> {
  const map = new Map<string, HsbColor>();

  // Color each section's tiles
  for (const section of template.sections) {
    const color = SECTION_COLORS[section.team];
    for (let dy = 0; dy < section.heightTiles; dy++) {
      for (let dx = 0; dx < section.widthTiles; dx++) {
        const key = `${section.originTile.x + dx},${section.originTile.y + dy}`;
        map.set(key, color);
      }
    }
  }

  // Color divider tiles
  for (const d of template.dividerTiles) {
    const key = `${d.x},${d.y}`;
    map.set(key, DIVIDER_COLOR);
  }

  return map;
}
