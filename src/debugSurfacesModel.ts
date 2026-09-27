// src/debugSurfacesModel.ts
// Pure view-model for the editor debug surfaces (M009/S03): the spritesheet
// matrix (directions × poses for a chosen role outfit) and the role-outfit
// matrix (four roles × a small direction/pose set). No React, no stores, no
// host APIs — components render from these constants and builders.

import type { TeamSection } from './agentTypes.js';
import type { AvatarSpec } from './avatarRendererTypes.js';
import { getRolePreset, type OutfitConfig } from './avatarOutfitConfig.js';
import { SECTION_WALL_OPTIONS } from './roomLayoutEngine.js';

export type AvatarDirection = AvatarSpec['direction'];
export type DebugPoseState = 'idle' | 'walk';

export interface DebugRoleOption {
  id: TeamSection;
  label: string;
}

export interface DebugPose {
  id: string;
  label: string;
  state: DebugPoseState;
  frame: number;
}

export interface DebugDirectionSet {
  id: string;
  label: string;
  directions: readonly AvatarDirection[];
}

export interface RoleOutfitRow {
  role: TeamSection;
  label: string;
  outfit: OutfitConfig;
}

export interface MatrixColumn {
  id: string;
  label: string;
  direction: AvatarDirection;
  state: DebugPoseState;
  frame: number;
}

export interface MatrixCell {
  id: string;
  direction: AvatarDirection;
  state: DebugPoseState;
  frame: number;
}

/** The four roles in editor display order, with the labels the panel uses. */
export const DEBUG_ROLE_OPTIONS: readonly DebugRoleOption[] = SECTION_WALL_OPTIONS;

/** Spritesheet columns: idle plus the four walk-cycle frames. */
export const DEBUG_POSES: readonly DebugPose[] = [
  { id: 'idle', label: 'idle', state: 'idle', frame: 0 },
  { id: 'walk-0', label: 'wlk_0', state: 'walk', frame: 0 },
  { id: 'walk-1', label: 'wlk_1', state: 'walk', frame: 1 },
  { id: 'walk-2', label: 'wlk_2', state: 'walk', frame: 2 },
  { id: 'walk-3', label: 'wlk_3', state: 'walk', frame: 3 },
];

const ALL_DIRECTIONS: readonly AvatarDirection[] = [0, 1, 2, 3, 4, 5, 6, 7];
const CARDINAL_DIRECTIONS: readonly AvatarDirection[] = [0, 2, 4, 6];

export const DEBUG_DIRECTION_SETS: readonly DebugDirectionSet[] = [
  { id: 'all', label: 'all 8 dirs', directions: ALL_DIRECTIONS },
  { id: 'cardinal', label: 'cardinal dirs', directions: CARDINAL_DIRECTIONS },
];

export const DEFAULT_DEBUG_DIRECTION_SET_ID = 'all';
export const DEFAULT_DEBUG_ROLE: TeamSection = 'planning';

/**
 * One row per role, resolved through the same getRolePreset resolver the spawn
 * path uses (variant 0), so the matrix shows exactly what agents spawn with.
 */
export const ROLE_OUTFIT_ROWS: readonly RoleOutfitRow[] = DEBUG_ROLE_OPTIONS.map(({ id, label }) => ({
  role: id,
  label,
  outfit: getRolePreset(id, 0),
}));

/** Small direction/pose set for the role-outfit matrix columns. */
export const ROLE_MATRIX_COLUMNS: readonly MatrixColumn[] = [
  { id: 'idle-d2', label: 'idle', direction: 2, state: 'idle', frame: 0 },
  { id: 'walk-d2-0', label: 'wlk 0', direction: 2, state: 'walk', frame: 0 },
  { id: 'walk-d2-2', label: 'wlk 2', direction: 2, state: 'walk', frame: 2 },
  { id: 'idle-d4', label: 'idle W', direction: 4, state: 'idle', frame: 0 },
];

export function findRoleOutfitRow(role: TeamSection): RoleOutfitRow {
  return ROLE_OUTFIT_ROWS.find((row) => row.role === role) ?? ROLE_OUTFIT_ROWS[0];
}

export function getDebugDirectionSet(id: string): DebugDirectionSet {
  return DEBUG_DIRECTION_SETS.find((set) => set.id === id) ?? DEBUG_DIRECTION_SETS[0];
}

/** Row-major cells for the spritesheet grid (rows = directions, columns = poses). */
export function buildSpritesheetCells(
  directions: readonly AvatarDirection[],
  poses: readonly DebugPose[] = DEBUG_POSES,
): readonly MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const direction of directions) {
    for (const pose of poses) {
      cells.push({
        id: `${direction}:${pose.id}`,
        direction,
        state: pose.state,
        frame: pose.frame,
      });
    }
  }
  return cells;
}

/**
 * Build a minimal debug AvatarSpec. Without an outfit the renderer falls back
 * to the variant palette (standalone ?debuggrid=1 parity); with one, the role
 * outfit is applied through the shared outfitToFigureParts path.
 */
export function buildDebugAvatarSpec(
  id: string,
  direction: AvatarDirection,
  state: DebugPoseState,
  frame: number,
  outfit?: OutfitConfig,
): AvatarSpec {
  const spec: AvatarSpec = {
    id,
    tileX: 0,
    tileY: 0,
    tileZ: 0,
    direction,
    variant: 0,
    state,
    frame,
    lastUpdateMs: 0,
    nextBlinkMs: Infinity,
    blinkFrame: 0,
    spawnProgress: 0,
  };
  if (outfit) {
    spec.outfit = outfit;
  }
  return spec;
}
