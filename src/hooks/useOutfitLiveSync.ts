// src/hooks/useOutfitLiveSync.ts
// Live outfit sync (M006/S03, D021 convention): pushes outfitStore draft edits
// onto live avatars without respawning them. The hook subscribes to the drafts
// map through useStoreValue with the module-scope selectDrafts selector; when a
// role's draft reference changes, the role's new draft is pushed through
// AvatarManager.applyRoleOutfit, which swaps the outfit reference in place on
// every live avatar of that team. The Nitro draw path reads spec.outfit per
// frame, so walking agents restyle in place. There is NO JSX here and no
// React-state copy of any store value; the effect is event-driven only and
// never runs in the per-frame path.
import { useEffect, useRef } from 'react';
import type { OutfitConfig } from '../avatarOutfitConfig.js';
import type { TeamSection } from '../agentTypes.js';
import type { AvatarManager } from '../avatarManager.js';
import { outfitStore, selectDrafts, TEAM_SECTIONS } from '../state/outfitStore.js';
import { useStoreValue } from './useStoreValue.js';

/** Minimal manager surface this hook needs (AvatarManager satisfies it). */
export interface RoleOutfitTarget {
  applyRoleOutfit(team: TeamSection, outfit: OutfitConfig): void;
}

/**
 * Pure diff: roles whose draft reference changed between store snapshots.
 * Unchanged roles keep reference identity (the store replaces only the edited
 * role), so reference comparison is exact and never re-pushes stable roles.
 */
export function diffOutfitDrafts(
  prev: Record<TeamSection, OutfitConfig>,
  next: Record<TeamSection, OutfitConfig>,
): TeamSection[] {
  const changed: TeamSection[] = [];
  for (const role of TEAM_SECTIONS) {
    if (prev[role] !== next[role]) changed.push(role);
  }
  return changed;
}

/**
 * Push each changed role's draft onto the live manager. Returns `next` so the
 * caller can store it as the new baseline. Pure apart from the target calls.
 */
export function syncOutfitDrafts(
  prev: Record<TeamSection, OutfitConfig>,
  next: Record<TeamSection, OutfitConfig>,
  target: RoleOutfitTarget,
): Record<TeamSection, OutfitConfig> {
  for (const role of diffOutfitDrafts(prev, next)) {
    target.applyRoleOutfit(role, next[role]);
  }
  return next;
}

export function useOutfitLiveSync(avatarManager: AvatarManager): void {
  const drafts = useStoreValue(outfitStore, selectDrafts);
  const prevRef = useRef(drafts);
  useEffect(() => {
    prevRef.current = syncOutfitDrafts(prevRef.current, drafts, avatarManager);
  }, [avatarManager, drafts]);
}
