// src/avatarManager.ts
// Manages dynamic avatar pool driven by agent events
// Runs in browser (webview-side)

import type { AvatarSpec } from './avatarRendererTypes.js';
import type { TileGrid } from './isoTypes.js';
import type { TilePath, IsometricPosition } from './isoAgentBehavior.js';
import { pathToIsometricPositions } from './isoAgentBehavior.js';
import { findPath, getRandomWalkableTile, isTileOccupied } from './isoPathfinding.js';
import { tileToScreen } from './isometricMath.js';
import type { TeamSection } from './agentTypes.js';

/** Time per tile step in ms (walk speed) */
const TILE_STEP_DURATION_MS = 350;

/** Path state for an avatar in motion */
interface PathState {
  tilePath: TilePath;
  isoPositions: IsometricPosition[];
  startTimeMs: number;
  currentStep: number;
  arrivalDirection?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export class AvatarManager {
  private avatars = new Map<string, AvatarSpec>();
  private pathStates = new Map<string, PathState>();

  /**
   * Spawn a new avatar at a random walkable tile.
   */
  spawnAvatar(agentId: string, variant: 0 | 1 | 2 | 3 | 4 | 5, grid: TileGrid, displayName?: string, blockedTiles?: Set<string>, team?: TeamSection): AvatarSpec | null {
    if (this.avatars.has(agentId)) return this.avatars.get(agentId)!;

    // Find a walkable tile not occupied by another avatar or furniture
    const existingAvatars = this.getAvatars();
    let attempts = 0;
    let tile = getRandomWalkableTile(grid, blockedTiles);

    while (tile && isTileOccupied(tile.tileX, tile.tileY, existingAvatars) && attempts < 50) {
      tile = getRandomWalkableTile(grid, blockedTiles);
      attempts++;
    }

    if (!tile) return null;

    const now = Date.now();

    const spec: AvatarSpec = {
      id: agentId,
      tileX: tile.tileX,
      tileY: tile.tileY,
      tileZ: tile.tileZ,
      direction: 2,
      variant,
      state: 'spawning',
      frame: 0,
      lastUpdateMs: now,
      spawnProgress: 0,
      screenOffsetX: 0,
      screenOffsetY: 0,
      isSelected: false,
      displayName,
      team: team || 'core-dev',
    };

    this.avatars.set(agentId, spec);
    return spec;
  }

  /**
   * Spawn a new avatar at a specific tile (e.g., teleport booth position).
   * Used for section-aware spawning where the tile is predetermined.
   */
  spawnAvatarAt(agentId: string, variant: 0 | 1 | 2 | 3 | 4 | 5, tileX: number, tileY: number, tileZ: number, grid: TileGrid, displayName?: string, team?: TeamSection): AvatarSpec | null {
    if (this.avatars.has(agentId)) return this.avatars.get(agentId)!;

    // Validate the tile is within grid bounds
    if (tileY < 0 || tileY >= grid.height || tileX < 0 || tileX >= grid.width) return null;

    const now = Date.now();

    const spec: AvatarSpec = {
      id: agentId,
      tileX,
      tileY,
      tileZ,
      direction: 2,
      variant,
      state: 'spawning',
      frame: 0,
      lastUpdateMs: now,
      spawnProgress: 0,
      screenOffsetX: 0,
      screenOffsetY: 0,
      isSelected: false,
      displayName,
      team: team || 'core-dev',
    };

    this.avatars.set(agentId, spec);
    return spec;
  }

  /**
   * Despawn an avatar with despawning animation.
   */
  despawnAvatar(agentId: string): void {
    const avatar = this.avatars.get(agentId);
    if (!avatar) return;

    avatar.state = 'despawning';
    avatar.spawnProgress = 1.0;
    avatar.lastUpdateMs = Date.now();

    // Stop any active path
    this.pathStates.delete(agentId);
  }

  /**
   * Get all avatar IDs currently tracked.
   */
  getAllAvatarIds(): string[] {
    return Array.from(this.avatars.keys());
  }

  /**
   * Remove a fully despawned avatar from the pool.
   */
  removeAvatar(agentId: string): void {
    this.avatars.delete(agentId);
    this.pathStates.delete(agentId);
  }

  /**
   * Move an avatar to a target tile using BFS pathfinding.
   * @returns true if path was found and movement started
   */
  moveAvatarTo(agentId: string, targetX: number, targetY: number, grid: TileGrid, arrivalDirection?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7, blockedTiles?: Set<string>): boolean {
    const avatar = this.avatars.get(agentId);
    if (!avatar) return false;
    if (avatar.state === 'spawning' || avatar.state === 'despawning') return false;

    // Stand up first if sitting
    if (avatar.state === 'sit') {
      this.standAvatar(agentId);
    }

    // Don't move to current tile
    if (avatar.tileX === targetX && avatar.tileY === targetY) return false;

    // Check not occupied by another avatar
    const others = this.getAvatars().filter(a => a.id !== agentId);
    if (isTileOccupied(targetX, targetY, others)) return false;

    const tilePath = findPath(grid, avatar.tileX, avatar.tileY, targetX, targetY, blockedTiles);
    if (!tilePath || tilePath.length < 2) return false;

    const isoPositions = pathToIsometricPositions(tilePath);

    this.pathStates.set(agentId, {
      tilePath,
      isoPositions,
      startTimeMs: Date.now(),
      currentStep: 0,
      arrivalDirection,
    });

    avatar.state = 'walk';
    avatar.frame = 0;
    avatar.lastUpdateMs = Date.now();

    return true;
  }

  /**
   * Update all avatars each frame. Advances path-following and manages state transitions.
   */
  tick(currentTimeMs: number): void {
    for (const [agentId, avatar] of this.avatars) {
      // Handle despawn completion
      if (avatar.state === 'despawning' && avatar.spawnProgress <= 0) {
        this.removeAvatar(agentId);
        continue;
      }

      // Skip path processing for sitting avatars
      if (avatar.state === 'sit') continue;

      // Handle path following
      const pathState = this.pathStates.get(agentId);
      if (!pathState) {
        // Not on a path — clear offsets
        avatar.screenOffsetX = 0;
        avatar.screenOffsetY = 0;
        continue;
      }

      const elapsed = currentTimeMs - pathState.startTimeMs;
      const stepDuration = TILE_STEP_DURATION_MS;
      const currentStep = Math.floor(elapsed / stepDuration);
      const stepProgress = (elapsed % stepDuration) / stepDuration;

      const maxStep = pathState.tilePath.length - 1;

      if (currentStep >= maxStep) {
        // Arrived at destination
        const dest = pathState.tilePath[maxStep];
        avatar.tileX = dest.tileX;
        avatar.tileY = dest.tileY;
        avatar.tileZ = dest.tileZ;
        avatar.screenOffsetX = 0;
        avatar.screenOffsetY = 0;
        avatar.state = 'idle';
        avatar.direction = pathState.arrivalDirection
          ?? pathState.isoPositions[maxStep]?.direction
          ?? avatar.direction;
        avatar.lastUpdateMs = currentTimeMs;

        this.pathStates.delete(agentId);
        continue;
      }

      // Currently between step currentStep and currentStep+1
      const fromTile = pathState.tilePath[currentStep];
      const toTile = pathState.tilePath[currentStep + 1];

      // Snap tileX/tileY to whichever tile the avatar is visually closest to.
      // This keeps the data position in sync with the visual position so
      // tile-based click selection works correctly.
      const snapTile = stepProgress < 0.5 ? fromTile : toTile;
      avatar.tileX = snapTile.tileX;
      avatar.tileY = snapTile.tileY;
      avatar.tileZ = snapTile.tileZ;

      // Update facing direction
      avatar.direction = pathState.isoPositions[currentStep]?.direction ?? avatar.direction;

      // Calculate screen offset for smooth interpolation (relative to snapped tile)
      const snapScreen = tileToScreen(snapTile.tileX, snapTile.tileY, snapTile.tileZ);
      const fromScreen = tileToScreen(fromTile.tileX, fromTile.tileY, fromTile.tileZ);
      const toScreen = tileToScreen(toTile.tileX, toTile.tileY, toTile.tileZ);

      // Visual position = lerp(from, to, progress), offset = visual - snap
      const visualX = fromScreen.x + (toScreen.x - fromScreen.x) * stepProgress;
      const visualY = fromScreen.y + (toScreen.y - fromScreen.y) * stepProgress;
      avatar.screenOffsetX = visualX - snapScreen.x;
      avatar.screenOffsetY = visualY - snapScreen.y;

      // Ensure walk state
      avatar.state = 'walk';
    }
  }

  /**
   * Sit an avatar on a chair at the given tile.
   */
  sitAvatar(agentId: string, chairTileX: number, chairTileY: number, chairDirection: number): void {
    const avatar = this.avatars.get(agentId);
    if (!avatar) return;

    avatar.state = 'sit';
    avatar.tileX = chairTileX;
    avatar.tileY = chairTileY;
    avatar.direction = chairDirection as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    avatar.sittingChairKey = `${chairTileX},${chairTileY}`;
    avatar.screenOffsetX = 0;
    avatar.screenOffsetY = 0;
    this.pathStates.delete(agentId);
  }

  /**
   * Stand an avatar up from a chair.
   */
  standAvatar(agentId: string): void {
    const avatar = this.avatars.get(agentId);
    if (!avatar) return;

    avatar.state = 'idle';
    avatar.sittingChairKey = undefined;
    avatar.lastUpdateMs = Date.now();
  }

  /**
   * Get the set of chair tile keys currently occupied by sitting avatars.
   */
  getOccupiedChairs(): Set<string> {
    const occupied = new Set<string>();
    for (const avatar of this.avatars.values()) {
      if (avatar.sittingChairKey) {
        occupied.add(avatar.sittingChairKey);
      }
    }
    return occupied;
  }

  /**
   * Get all active avatars.
   */
  getAvatars(): AvatarSpec[] {
    return Array.from(this.avatars.values());
  }

  /**
   * Get avatar at a specific tile position.
   */
  getAvatarAtTile(tileX: number, tileY: number): AvatarSpec | null {
    for (const avatar of this.avatars.values()) {
      if (avatar.tileX === tileX && avatar.tileY === tileY) {
        return avatar;
      }
    }
    return null;
  }

  /**
   * Check if an avatar is currently moving.
   */
  isMoving(agentId: string): boolean {
    return this.pathStates.has(agentId);
  }

  /**
   * Get avatar by ID.
   */
  getAvatar(agentId: string): AvatarSpec | undefined {
    return this.avatars.get(agentId);
  }

  /**
   * Get number of active avatars.
   */
  get size(): number {
    return this.avatars.size;
  }
}
