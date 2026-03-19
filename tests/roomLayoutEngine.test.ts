// tests/roomLayoutEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateFloorTemplate,
  getSectionForTeam,
  getTemplateSize,
  TEMPLATE_SIZES,
} from '../src/roomLayoutEngine.js';
import { parseHeightmap } from '../src/isoTypes.js';

describe('roomLayoutEngine', () => {
  describe('template generation', () => {
    it('small template produces a 15x15 heightmap', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      expect(rows.length).toBe(15);
      for (const row of rows) {
        expect(row.length).toBe(15);
      }
      expect(t.totalWidth).toBe(15);
      expect(t.totalHeight).toBe(15);
    });

    it('medium template produces a 19x19 heightmap', () => {
      const t = generateFloorTemplate('medium');
      const rows = t.heightmap.split('\n');
      expect(rows.length).toBe(19);
      for (const row of rows) {
        expect(row.length).toBe(19);
      }
    });

    it('large template produces a 25x25 heightmap', () => {
      const t = generateFloorTemplate('large');
      const rows = t.heightmap.split('\n');
      expect(rows.length).toBe(25);
      for (const row of rows) {
        expect(row.length).toBe(25);
      }
    });

    it('all templates have exactly 4 sections', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        expect(t.sections.length).toBe(4);
      }
    });
  });

  describe('section boundaries', () => {
    it('each section originTile is within heightmap bounds', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (const s of t.sections) {
          expect(s.originTile.x).toBeGreaterThanOrEqual(0);
          expect(s.originTile.y).toBeGreaterThanOrEqual(0);
          expect(s.originTile.x + s.widthTiles).toBeLessThanOrEqual(t.totalWidth);
          expect(s.originTile.y + s.heightTiles).toBeLessThanOrEqual(t.totalHeight);
        }
      }
    });

    it('no two sections overlap', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (let i = 0; i < t.sections.length; i++) {
          for (let j = i + 1; j < t.sections.length; j++) {
            const a = t.sections[i];
            const b = t.sections[j];
            const overlapX = a.originTile.x < b.originTile.x + b.widthTiles &&
              a.originTile.x + a.widthTiles > b.originTile.x;
            const overlapY = a.originTile.y < b.originTile.y + b.heightTiles &&
              a.originTile.y + a.heightTiles > b.originTile.y;
            expect(overlapX && overlapY).toBe(false);
          }
        }
      }
    });

    it('all sections share a single teleport tile in bottom-left', () => {
      const t = generateFloorTemplate('small');
      const firstTp = t.sections[0].teleportTile;
      for (const s of t.sections) {
        expect(s.teleportTile).toBeDefined();
        expect(s.teleportTile.x).toBe(firstTp.x);
        expect(s.teleportTile.y).toBe(firstTp.y);
      }
      // Only one teleport booth furniture across all sections
      const boothCount = t.sections.flatMap(s => s.furniture).filter(f => f.name === 'ads_cltele').length;
      expect(boothCount).toBe(1);
    });

    it('each section has exactly 3 desk tiles', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (const s of t.sections) {
          expect(s.deskTiles.length).toBe(3);
        }
      }
    });

    it('each section has 3 desk and 3 chair furniture items', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (const s of t.sections) {
          const desks = s.furniture.filter(f => f.name === 'hc_dsk');
          const chairs = s.furniture.filter(f => f.name === 'hc_chr');
          expect(desks.length).toBe(3);
          expect(chairs.length).toBe(3);
        }
      }
    });

    it('chairs are at deskTile positions and desks diagonally NE (x-1, y-1)', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (const s of t.sections) {
          const chairs = s.furniture.filter(f => f.name === 'hc_chr');
          const desks = s.furniture.filter(f => f.name === 'hc_dsk');
          for (let i = 0; i < 3; i++) {
            // Chair at deskTile position
            expect(chairs[i].tileX).toBe(s.deskTiles[i].x);
            expect(chairs[i].tileY).toBe(s.deskTiles[i].y);
            // Desk diagonally NE (x-1, y-1)
            expect(desks[i].tileX).toBe(s.deskTiles[i].x - 1);
            expect(desks[i].tileY).toBe(s.deskTiles[i].y - 1);
          }
        }
      }
    });

    it('all desk and chair furniture on walkable tiles', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        const rows = t.heightmap.split('\n');
        for (const s of t.sections) {
          for (const f of s.furniture) {
            if (f.name === 'hc_dsk' || f.name === 'hc_chr') {
              expect(rows[f.tileY][f.tileX]).toBe('0');
            }
          }
        }
      }
    });

    it('idle tiles do not overlap desk or chair positions', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (const s of t.sections) {
          const occupied = new Set<string>();
          for (const f of s.furniture) {
            if (f.name === 'hc_dsk' || f.name === 'hc_chr') {
              occupied.add(`${f.tileX},${f.tileY}`);
            }
          }
          for (const tile of s.idleTiles) {
            expect(occupied.has(`${tile.x},${tile.y}`)).toBe(false);
          }
        }
      }
    });
  });

  describe('dividers and doorways', () => {
    it('divider tiles are walkable in the heightmap (no void gaps)', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      for (const d of t.dividerTiles) {
        expect(rows[d.y][d.x]).toBe('0');
      }
    });

    it('doorway tiles are walkable in the heightmap', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      for (const d of t.doorwayTiles) {
        expect(rows[d.y][d.x]).toBe('0');
      }
    });

    it('divider zone is continuous floor (no void gaps between sections)', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        const rows = t.heightmap.split('\n');
        const cfg = TEMPLATE_SIZES[size];
        const divStart = cfg.border + cfg.usable;
        const divEnd = divStart + cfg.divider - 1;
        // All tiles in the divider zone should be walkable
        for (let y = cfg.border; y < cfg.total - cfg.border; y++) {
          for (let x = divStart; x <= divEnd; x++) {
            expect(rows[y][x]).toBe('0');
          }
        }
        for (let x = cfg.border; x < cfg.total - cfg.border; x++) {
          for (let y = divStart; y <= divEnd; y++) {
            expect(rows[y][x]).toBe('0');
          }
        }
      }
    });
  });

  describe('heightmap validity', () => {
    it('parseHeightmap produces valid TileGrid without throwing', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        expect(() => parseHeightmap(t.heightmap)).not.toThrow();
        const grid = parseHeightmap(t.heightmap);
        expect(grid.width).toBe(t.totalWidth);
        expect(grid.height).toBe(t.totalHeight);
      }
    });

    it('all tiles are either 0 or x (no heights > 0)', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (const ch of t.heightmap) {
          if (ch !== '\n') {
            expect(['0', 'x']).toContain(ch);
          }
        }
      }
    });

    it('all edge tiles are walkable (no void border)', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      // Top and bottom rows are walkable
      for (let x = 0; x < t.totalWidth; x++) {
        expect(rows[0][x]).toBe('0');
        expect(rows[t.totalHeight - 1][x]).toBe('0');
      }
      // Left and right columns are walkable
      for (let y = 0; y < t.totalHeight; y++) {
        expect(rows[y][0]).toBe('0');
        expect(rows[y][t.totalWidth - 1]).toBe('0');
      }
    });
  });

  describe('smart size selection', () => {
    it('getTemplateSize(4) returns small', () => {
      expect(getTemplateSize(4)).toBe('small');
    });

    it('getTemplateSize(12) returns medium', () => {
      expect(getTemplateSize(12)).toBe('medium');
    });

    it('getTemplateSize(20) returns large', () => {
      expect(getTemplateSize(20)).toBe('large');
    });

    it('boundary values: 8 is small, 9 is medium, 16 is medium, 17 is large', () => {
      expect(getTemplateSize(8)).toBe('small');
      expect(getTemplateSize(9)).toBe('medium');
      expect(getTemplateSize(16)).toBe('medium');
      expect(getTemplateSize(17)).toBe('large');
    });
  });

  describe('getSectionForTeam', () => {
    it('finds each team section', () => {
      const t = generateFloorTemplate('small');
      expect(getSectionForTeam(t, 'planning')?.team).toBe('planning');
      expect(getSectionForTeam(t, 'core-dev')?.team).toBe('core-dev');
      expect(getSectionForTeam(t, 'infrastructure')?.team).toBe('infrastructure');
      expect(getSectionForTeam(t, 'support')?.team).toBe('support');
    });

    it('returns undefined for unknown team', () => {
      const t = generateFloorTemplate('small');
      expect(getSectionForTeam(t, 'nonexistent' as any)).toBeUndefined();
    });
  });
});
