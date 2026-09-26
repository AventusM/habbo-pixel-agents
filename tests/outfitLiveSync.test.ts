// tests/outfitLiveSync.test.ts
// M006/S03 T04 — the live-sync derivation: only roles whose draft reference
// changed are pushed onto the manager; unchanged roles are never re-pushed,
// and identical snapshots push nothing.

import { describe, it, expect } from 'vitest';
import { diffOutfitDrafts, syncOutfitDrafts } from '../src/hooks/useOutfitLiveSync.js';
import { ROLE_OUTFIT_PRESETS, type OutfitConfig } from '../src/avatarOutfitConfig.js';
import type { TeamSection } from '../src/agentTypes.js';
import { TEAM_SECTIONS } from '../src/state/outfitStore.js';

function seedDrafts(): Record<TeamSection, OutfitConfig> {
  return {
    planning: { ...ROLE_OUTFIT_PRESETS['planning'] },
    'core-dev': { ...ROLE_OUTFIT_PRESETS['core-dev'] },
    infrastructure: { ...ROLE_OUTFIT_PRESETS['infrastructure'] },
    support: { ...ROLE_OUTFIT_PRESETS['support'] },
  };
}

function withShirt(
  drafts: Record<TeamSection, OutfitConfig>,
  role: TeamSection,
  shirt: string,
): Record<TeamSection, OutfitConfig> {
  const next = { ...drafts };
  next[role] = { ...drafts[role], colors: { ...drafts[role].colors, shirt } };
  return next;
}

describe('diffOutfitDrafts', () => {
  it('returns empty for identical snapshots', () => {
    const drafts = seedDrafts();
    expect(diffOutfitDrafts(drafts, drafts)).toEqual([]);
  });

  it('returns only the roles whose draft reference changed', () => {
    const prev = seedDrafts();
    const next = withShirt(withShirt(prev, 'planning', '#111111'), 'support', '#222222');
    expect(diffOutfitDrafts(prev, next).sort()).toEqual(['planning', 'support']);
  });

  it('returns every role when the whole map is replaced', () => {
    const prev = seedDrafts();
    expect(diffOutfitDrafts(prev, seedDrafts()).sort()).toEqual([...TEAM_SECTIONS].sort());
  });
});

describe('syncOutfitDrafts', () => {
  it('pushes changed roles onto the manager and skips unchanged roles', () => {
    const prev = seedDrafts();
    const next = withShirt(prev, 'core-dev', '#333333');
    const calls: Array<{ team: TeamSection; outfit: OutfitConfig }> = [];
    const baseline = syncOutfitDrafts(prev, next, {
      applyRoleOutfit: (team, outfit) => calls.push({ team, outfit }),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.team).toBe('core-dev');
    expect(calls[0]!.outfit).toBe(next['core-dev']);
    expect(baseline).toBe(next);
  });

  it('makes no manager calls when nothing changed', () => {
    const drafts = seedDrafts();
    let calls = 0;
    syncOutfitDrafts(drafts, drafts, {
      applyRoleOutfit: () => calls++,
    });
    expect(calls).toBe(0);
  });
});
