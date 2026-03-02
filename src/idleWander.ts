// src/idleWander.ts
// Idle wander behavior: idle avatars walk to random tiles on staggered timers

import type { TileGrid } from './isoTypes.js';
import type { AvatarManager } from './avatarManager.js';
import { getRandomWalkableTile, isTileOccupied, findPath } from './isoPathfinding.js';

/** Min idle time before wandering (ms) */
const WANDER_MIN_MS = 4000;
/** Max idle time before wandering (ms) */
const WANDER_MAX_MS = 10000;
/** Max tile radius for random wander destination */
const WANDER_RADIUS = 5;

function randomWanderDelay(): number {
  return WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS);
}

export class IdleWanderManager {
  /** Next wander time per avatar */
  private wanderTimers = new Map<string, number>();
  /** Set of avatar IDs currently enabled for wandering */
  private enabled = new Set<string>();

  /**
   * Enable wandering for an avatar.
   */
  startWandering(avatarId: string): void {
    this.enabled.add(avatarId);
    if (!this.wanderTimers.has(avatarId)) {
      this.wanderTimers.set(avatarId, Date.now() + randomWanderDelay());
    }
  }

  /**
   * Disable wandering for an avatar.
   */
  stopWandering(avatarId: string): void {
    this.enabled.delete(avatarId);
    this.wanderTimers.delete(avatarId);
  }

  /**
   * Tick each frame: for each idle-and-wandering avatar past its timer,
   * pick a random walkable tile within radius and start movement.
   */
  tick(currentTimeMs: number, avatarManager: AvatarManager, grid: TileGrid): void {
    for (const avatarId of this.enabled) {
      const nextWander = this.wanderTimers.get(avatarId);
      if (nextWander === undefined || currentTimeMs < nextWander) continue;

      const avatar = avatarManager.getAvatar(avatarId);
      if (!avatar || avatar.state !== 'idle') {
        // Not idle yet, reset timer
        this.wanderTimers.set(avatarId, currentTimeMs + randomWanderDelay());
        continue;
      }

      // Already moving
      if (avatarManager.isMoving(avatarId)) {
        this.wanderTimers.set(avatarId, currentTimeMs + randomWanderDelay());
        continue;
      }

      // Find a random walkable tile within radius
      const target = findNearbyWalkableTile(
        grid, avatar.tileX, avatar.tileY, WANDER_RADIUS, avatarManager.getAvatars()
      );

      if (target) {
        avatarManager.moveAvatarTo(avatarId, target.x, target.y, grid);
      }

      // Reset timer regardless
      this.wanderTimers.set(avatarId, currentTimeMs + randomWanderDelay());
    }
  }
}

/**
 * Find a random walkable tile within a radius of (cx, cy).
 */
function findNearbyWalkableTile(
  grid: TileGrid,
  cx: number,
  cy: number,
  radius: number,
  avatars: { tileX: number; tileY: number }[],
): { x: number; y: number } | null {
  const candidates: { x: number; y: number }[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (ny < 0 || ny >= grid.height || nx < 0 || nx >= grid.width) continue;
      if (grid.tiles[ny][nx] === null) continue;
      if (avatars.some(a => a.tileX === nx && a.tileY === ny)) continue;
      candidates.push({ x: nx, y: ny });
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
