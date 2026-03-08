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
    it('small template produces a 20x20 heightmap', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      expect(rows.length).toBe(20);
      for (const row of rows) {
        expect(row.length).toBe(20);
      }
      expect(t.totalWidth).toBe(20);
      expect(t.totalHeight).toBe(20);
    });

    it('medium template produces a 28x28 heightmap', () => {
      const t = generateFloorTemplate('medium');
      const rows = t.heightmap.split('\n');
      expect(rows.length).toBe(28);
      for (const row of rows) {
        expect(row.length).toBe(28);
      }
    });

    it('large template produces a 36x36 heightmap', () => {
      const t = generateFloorTemplate('large');
      const rows = t.heightmap.split('\n');
      expect(rows.length).toBe(36);
      for (const row of rows) {
        expect(row.length).toBe(36);
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

    it('each section has at least 1 teleport tile', () => {
      const t = generateFloorTemplate('small');
      for (const s of t.sections) {
        expect(s.teleportTile).toBeDefined();
        expect(s.teleportTile.x).toBeGreaterThanOrEqual(s.originTile.x);
        expect(s.teleportTile.y).toBeGreaterThanOrEqual(s.originTile.y);
      }
    });

    it('each section has at least 2 desk tiles', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        for (const s of t.sections) {
          expect(s.deskTiles.length).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });

  describe('dividers and doorways', () => {
    it('divider tiles are void in the heightmap', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      for (const d of t.dividerTiles) {
        expect(rows[d.y][d.x]).toBe('x');
      }
    });

    it('doorway tiles are walkable in the heightmap', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      for (const d of t.doorwayTiles) {
        expect(rows[d.y][d.x]).toBe('0');
      }
    });

    it('has at least 1 doorway per divider line', () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const t = generateFloorTemplate(size);
        // At least doorways on both vertical and horizontal dividers
        const verticalDoorways = t.doorwayTiles.filter(d => {
          const cfg = TEMPLATE_SIZES[size];
          const divStart = cfg.border + cfg.usable;
          const divEnd = divStart + cfg.divider - 1;
          return d.x >= divStart && d.x <= divEnd;
        });
        const horizontalDoorways = t.doorwayTiles.filter(d => {
          const cfg = TEMPLATE_SIZES[size];
          const divStart = cfg.border + cfg.usable;
          const divEnd = divStart + cfg.divider - 1;
          return d.y >= divStart && d.y <= divEnd;
        });
        expect(verticalDoorways.length).toBeGreaterThanOrEqual(1);
        expect(horizontalDoorways.length).toBeGreaterThanOrEqual(1);
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

    it('border tiles are void (x perimeter)', () => {
      const t = generateFloorTemplate('small');
      const rows = t.heightmap.split('\n');
      // Top and bottom rows
      for (let x = 0; x < t.totalWidth; x++) {
        expect(rows[0][x]).toBe('x');
        expect(rows[t.totalHeight - 1][x]).toBe('x');
      }
      // Left and right columns
      for (let y = 0; y < t.totalHeight; y++) {
        expect(rows[y][0]).toBe('x');
        expect(rows[y][t.totalWidth - 1]).toBe('x');
      }
    });
  });

  describe('smart size selection', () => {
    it('getTemplateSize(8) returns small', () => {
      expect(getTemplateSize(8)).toBe('small');
    });

    it('getTemplateSize(16) returns medium', () => {
      expect(getTemplateSize(16)).toBe('medium');
    });

    it('getTemplateSize(30) returns large', () => {
      expect(getTemplateSize(30)).toBe('large');
    });

    it('boundary values: 12 is small, 13 is medium, 24 is medium, 25 is large', () => {
      expect(getTemplateSize(12)).toBe('small');
      expect(getTemplateSize(13)).toBe('medium');
      expect(getTemplateSize(24)).toBe('medium');
      expect(getTemplateSize(25)).toBe('large');
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
