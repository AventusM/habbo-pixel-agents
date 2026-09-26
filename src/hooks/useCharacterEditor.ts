// src/hooks/useCharacterEditor.ts
// Character editor hook + pure view model (M006/S02, D021 convention).
//
// The store is the single source of truth; this module is the container-logic
// layer. It reads outfitStore through useStoreValue with module-scope selectors
// and hands the shell a stable handler surface plus a pure, testable derivation
// (buildCharacterEditorView) for the presentational CharacterEditorPanel. There
// is NO JSX here and no React-state copy of any store value.

import { useCallback } from 'react';
import type { CatalogItem, OutfitConfig } from '../avatarOutfitConfig.js';
import {
  CLOTHING_PALETTE,
  HAIR_PALETTE,
  SKIN_PALETTE,
  getCatalogForSlot,
} from '../avatarOutfitConfig.js';
import type { TeamSection } from '../agentTypes.js';
import {
  outfitStore,
  TEAM_SECTIONS,
  selectActiveRole,
  selectDrafts,
  type ColorSlot,
  type OutfitState,
} from '../state/outfitStore.js';
import { useStoreValue } from './useStoreValue.js';

/** Color palettes the panel renders, injected so the derivation stays pure. */
export interface CharacterEditorPalettes {
  hairColors: readonly string[];
  shirtColors: readonly string[];
  skinColors: readonly string[];
}

export const EDITOR_PALETTES: CharacterEditorPalettes = {
  hairColors: HAIR_PALETTE,
  shirtColors: CLOTHING_PALETTE,
  skinColors: SKIN_PALETTE,
};

/** Everything the presentational panel renders, derived from store state. */
export interface CharacterEditorView {
  roles: readonly TeamSection[];
  activeRole: TeamSection;
  outfit: OutfitConfig;
  hairOptions: CatalogItem[];
  hairColors: readonly string[];
  shirtColors: readonly string[];
  skinColors: readonly string[];
}

export interface CharacterEditorControls {
  selectRole: (team: TeamSection) => void;
  setColor: (slot: ColorSlot, hex: string) => void;
  setHair: (item: CatalogItem) => void;
  setShirt: (item: CatalogItem) => void;
  resetRole: (team: TeamSection) => void;
  exportOutfits: () => void;
  importOutfitsFile: (file: File) => void;
}

export type CharacterEditor = CharacterEditorView & CharacterEditorControls;

/**
 * Pure derivation of the editor view model from store state. Kept free of React
 * and of the store singleton so it is unit-testable without a renderer.
 */
export function buildCharacterEditorView(
  state: OutfitState,
  palettes: CharacterEditorPalettes,
): CharacterEditorView {
  const outfit = state.drafts[state.activeRole];
  return {
    roles: TEAM_SECTIONS,
    activeRole: state.activeRole,
    outfit,
    hairOptions: getCatalogForSlot('hair', outfit.gender),
    hairColors: palettes.hairColors,
    shirtColors: palettes.shirtColors,
    skinColors: palettes.skinColors,
  };
}

export function useCharacterEditor(): CharacterEditor {
  // Module-scope selectors return primitives/stable references, so useStoreValue
  // never re-subscribes and getSnapshot stays stable across renders.
  const drafts = useStoreValue(outfitStore, selectDrafts);
  const activeRole = useStoreValue(outfitStore, selectActiveRole);

  const view = buildCharacterEditorView({ drafts, activeRole }, EDITOR_PALETTES);

  // Stable handlers: empty dependency arrays because they only close over the
  // module-scope store singleton.
  const selectRole = useCallback((team: TeamSection) => outfitStore.selectRole(team), []);
  const setColor = useCallback(
    (slot: ColorSlot, hex: string) => outfitStore.setColor(slot, hex),
    [],
  );
  const setHair = useCallback((item: CatalogItem) => outfitStore.setHair(item), []);
  const setShirt = useCallback((item: CatalogItem) => outfitStore.setShirt(item), []);
  const resetRole = useCallback((team: TeamSection) => outfitStore.resetRole(team), []);

  // File round-trip (M006/S03 review fix, issue #108 outcome 2): export
  // downloads every draft as outfit JSON; import reads a picked file and
  // applies its valid drafts through the store (same validation as storage).
  const exportOutfits = useCallback(() => {
    const blob = new Blob([outfitStore.exportOutfits()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'outfits.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const importOutfitsFile = useCallback((file: File): void => {
    file.text().then(
      (text) => {
        if (outfitStore.importOutfits(text) === null) {
          console.error('[useCharacterEditor] import: rejected (corrupt or wrong version)');
        }
      },
      (error) => {
        console.error('[useCharacterEditor] import: cannot read file', error);
      },
    );
  }, []);

  return { ...view, selectRole, setColor, setHair, setShirt, resetRole, exportOutfits, importOutfitsFile };
}
