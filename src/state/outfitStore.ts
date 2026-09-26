// src/state/outfitStore.ts
// Role outfit draft store (M006/S02, D021 convention): the single source of truth
// for the in-room character editor. Holds one independent editable draft per
// TeamSection role plus the active role, and exposes mutations for role switch,
// color and catalog-part edits, and reset-to-preset. Drafts are seeded as
// independent clones of ROLE_OUTFIT_PRESETS so editing never mutates the shared
// presets or another role's draft. There are no React imports here — components
// and hooks only read this store through useStoreValue/selectors.
import type { CatalogItem, OutfitConfig } from '../avatarOutfitConfig.js';
import { ROLE_OUTFIT_PRESETS } from '../avatarOutfitConfig.js';
import type { TeamSection } from '../agentTypes.js';
import { createStore, type Store, type Unsubscribe } from './store.js';

/** The four TeamSection roles, in editor display order. */
export const TEAM_SECTIONS: readonly TeamSection[] = [
  'planning',
  'core-dev',
  'infrastructure',
  'support',
];

/** Editable color slot names (the keys of OutfitConfig.colors). */
export type ColorSlot = keyof OutfitConfig['colors'];

export interface OutfitState {
  drafts: Record<TeamSection, OutfitConfig>;
  activeRole: TeamSection;
}

// Module-scope selectors: stable identities so useStoreValue never re-subscribes,
// and every returned value is a primitive or a stable store reference.
export const selectActiveRole = (state: OutfitState): TeamSection => state.activeRole;
export const selectDrafts = (state: OutfitState): Record<TeamSection, OutfitConfig> => state.drafts;
export const selectActiveOutfit = (state: OutfitState): OutfitConfig =>
  state.drafts[state.activeRole];

/** Independent clone: `parts` and `colors` are fresh objects, so a draft edit
 * can never write through to ROLE_OUTFIT_PRESETS, DEFAULT_PRESETS, or a sibling draft. */
function cloneOutfit(outfit: OutfitConfig): OutfitConfig {
  return {
    gender: outfit.gender,
    parts: { ...outfit.parts },
    colors: { ...outfit.colors },
  };
}

function seedDrafts(): Record<TeamSection, OutfitConfig> {
  return {
    'planning': cloneOutfit(ROLE_OUTFIT_PRESETS['planning']),
    'core-dev': cloneOutfit(ROLE_OUTFIT_PRESETS['core-dev']),
    'infrastructure': cloneOutfit(ROLE_OUTFIT_PRESETS['infrastructure']),
    'support': cloneOutfit(ROLE_OUTFIT_PRESETS['support']),
  };
}

export class OutfitStore {
  private readonly store: Store<OutfitState> = createStore<OutfitState>({
    drafts: seedDrafts(),
    activeRole: 'planning',
  });

  get(): OutfitState {
    return this.store.get();
  }

  get activeRole(): TeamSection {
    return this.store.get().activeRole;
  }

  get drafts(): Record<TeamSection, OutfitConfig> {
    return this.store.get().drafts;
  }

  get activeOutfit(): OutfitConfig {
    const state = this.store.get();
    return state.drafts[state.activeRole];
  }

  subscribe(listener: (state: OutfitState) => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  subscribeSelector<S>(
    selector: (state: OutfitState) => S,
    listener: (selected: S) => void,
  ): Unsubscribe {
    return this.store.subscribeSelector(selector, listener);
  }

  /** Switch the edited role. No-op when already active. */
  selectRole(team: TeamSection): void {
    const prev = this.store.get();
    if (prev.activeRole === team) return;
    this.store.update((state) => ({ ...state, activeRole: team }));
    console.debug(`[outfitStore] selectRole ${team}`);
  }

  /** Set one color slot (hair, shirt, skin, pants, shoes) on the active draft. */
  setColor(slot: ColorSlot, hex: string): void {
    const prev = this.store.get();
    const current = prev.drafts[prev.activeRole];
    if (current.colors[slot] === hex) return;
    const next = cloneOutfit(current);
    next.colors[slot] = hex;
    this.store.update((state) => ({
      ...state,
      drafts: { ...state.drafts, [state.activeRole]: next },
    }));
    console.debug(`[outfitStore] setColor ${slot}=${hex} (${prev.activeRole})`);
  }

  /** Replace the hair part of the active draft from a catalog item. */
  setHair(item: CatalogItem): void {
    this.replacePart(item, 'hair');
  }

  /** Replace the shirt part of the active draft from a catalog item. */
  setShirt(item: CatalogItem): void {
    this.replacePart(item, 'shirt');
  }

  /** Re-seed one role's draft from its ROLE_OUTFIT_PRESETS entry. */
  resetRole(team: TeamSection): void {
    const next = cloneOutfit(ROLE_OUTFIT_PRESETS[team]);
    this.store.update((state) => ({
      ...state,
      drafts: { ...state.drafts, [team]: next },
    }));
    console.debug(`[outfitStore] resetRole ${team}`);
  }

  private replacePart(item: CatalogItem, slot: 'hair' | 'shirt'): void {
    const prev = this.store.get();
    const current = prev.drafts[prev.activeRole];
    const existing = current.parts[slot];
    if (existing.asset === item.asset && existing.setId === item.setId) return;
    const next = cloneOutfit(current);
    next.parts[slot] = { asset: item.asset, setId: item.setId };
    this.store.update((state) => ({
      ...state,
      drafts: { ...state.drafts, [state.activeRole]: next },
    }));
    console.debug(
      `[outfitStore] set${slot === 'hair' ? 'Hair' : 'Shirt'} ${item.id} (${prev.activeRole})`,
    );
  }
}

export const outfitStore = new OutfitStore();
