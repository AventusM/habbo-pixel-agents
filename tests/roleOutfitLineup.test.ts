// tests/roleOutfitLineup.test.ts
// Structural distinctness proof for role outfits resolved at spawn (M006/S01).
// Enumerates every role the spawn path can produce, resolves each through the
// same getRolePreset resolver avatarManager uses, and asserts pairwise-distinct
// outfits that are role-derived rather than the renderer's fallback palette.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getRolePreset, ROLE_OUTFIT_PRESETS, DEFAULT_PRESETS } from '../src/avatarOutfitConfig.js';
import type { OutfitConfig } from '../src/avatarOutfitConfig.js';
import type { TeamSection } from '../src/agentTypes.js';

interface RoleEntry {
  role: string;
  team: TeamSection;
  variant: number;
}

const ROLE_ENTRIES: RoleEntry[] = [
  { role: 'planning', team: 'planning', variant: 0 },
  { role: 'core-dev', team: 'core-dev', variant: 0 },
  { role: 'infrastructure', team: 'infrastructure', variant: 0 },
  { role: 'support', team: 'support', variant: 0 },
  { role: 'unclassified-fallback', team: 'core-dev', variant: 1 },
];

const colorsKey = (colors: OutfitConfig['colors']): string =>
  JSON.stringify([colors.skin, colors.hair, colors.shirt, colors.pants, colors.shoes]);

const signature = (outfit: OutfitConfig): string =>
  JSON.stringify([outfit.gender, outfit.parts, colorsKey(outfit.colors)]);

describe('role outfit lineup (M006/S01)', () => {
  const lineup = ROLE_ENTRIES.map((entry) => ({
    ...entry,
    outfit: getRolePreset(entry.team, entry.variant),
    expectedShirt: ROLE_OUTFIT_PRESETS[entry.team].colors.shirt,
  }));

  it('every spawnable role resolves to a pairwise-distinct outfit', () => {
    const signatures = lineup.map((entry) => signature(entry.outfit));
    expect(new Set(signatures).size).toBe(lineup.length);
  });

  it('every role outfit is role-derived, not the renderer fallback palette', () => {
    const fallbackPalette = DEFAULT_PRESETS.slice(0, 6).map((preset) => colorsKey(preset.colors));

    for (const entry of lineup) {
      expect(entry.outfit.colors.shirt).toBe(entry.expectedShirt);
      expect(entry.outfit.parts).toEqual(ROLE_OUTFIT_PRESETS[entry.team].parts);
      expect(fallbackPalette).not.toContain(colorsKey(entry.outfit.colors));
    }
  });

  it('writes a deterministic role-outfit-lineup.json artifact to .gsd/exec', () => {
    const dir = path.resolve(process.cwd(), '.gsd', 'exec');
    fs.mkdirSync(dir, { recursive: true });

    const artifact = {
      milestone: 'M006',
      slice: 'S01',
      roles: lineup.map((entry) => ({
        role: entry.role,
        team: entry.team,
        variant: entry.variant,
        shirt: entry.outfit.colors.shirt,
        skin: entry.outfit.colors.skin,
        signature: signature(entry.outfit),
      })),
    };

    const outPath = path.join(dir, 'role-outfit-lineup.json');
    fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

    const written = JSON.parse(fs.readFileSync(outPath, 'utf8')) as {
      roles: Array<{ role: string }>;
    };
    expect(written.roles).toHaveLength(lineup.length);
    expect(written.roles.map((role) => role.role)).toEqual(ROLE_ENTRIES.map((entry) => entry.role));
  });
});
