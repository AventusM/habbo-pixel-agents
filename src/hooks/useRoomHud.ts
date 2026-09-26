// src/hooks/useRoomHud.ts
// Orchestration HUD + experiment-history HUD data wiring (M008/S02, extracted
// from RoomCanvas). Per the D021 convention the store reads and the derived HUD
// state live in the hook; the shell only forwards the results into SceneInputs.
// The getters are stable (created once) so the per-frame render path allocates
// nothing beyond what the underlying derivations already allocate, and reading
// them per frame keeps SceneInputs.orchState/expHistory byte-for-byte identical.
import { useCallback } from 'react';
import { agentStore } from '../state/agentStore.js';
import { expRunStore } from '../state/expRunStore.js';
import { expHistoryFromRuns } from '../expFeed.js';
import type { OrchestrationState } from '../isoOrchestrationOverlay.js';
import type { ExpHistoryState } from '../expHistoryPanel.js';

export function useRoomHud() {
  /** Orchestration overlay state (agents + log + visibility) for the HUD. */
  const getOrchState = useCallback((): OrchestrationState => agentStore.snapshot(), []);

  /** Experiment-history panel state derived from the experiment run store. */
  const getExpHistory = useCallback(
    (): ExpHistoryState => expHistoryFromRuns(expRunStore.all(), expRunStore.visible),
    [],
  );

  return { getOrchState, getExpHistory };
}
