// src/idleWander.ts
// Idle wander behavior: idle avatars walk to random tiles on staggered timers
// Includes auto-sit: avatars occasionally sit on nearby empty chairs

import type { TileGrid } from './isoTypes.js';
import type { AvatarManager } from './avatarManager.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import { isTileOccupied } from './isoPathfinding.js';
import { isChairType } from './furnitureRegistry.js';

/** Min idle time before wandering (ms) */
const WANDER_MIN_MS = 4000;
/** Max idle time before wandering (ms) */
const WANDER_MAX_MS = 10000;
/** Max tile radius for random wander destination */
const WANDER_RADIUS = 5;
/** Probability of trying to sit on a chair instead of wandering */
const SIT_PROBABILITY = 0.3;
/** Min sit duration (ms) */
const SIT_DURATION_MIN_MS = 8000;
/** Max sit duration (ms) */
const SIT_DURATION_MAX_MS = 20000;

function randomWanderDelay(): number {
  return WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS);
}

function randomSitDuration(): number {
  return SIT_DURATION_MIN_MS + Math.random() * (SIT_DURATION_MAX_MS - SIT_DURATION_MIN_MS);
}

/** Info about a chair that an avatar is walking toward */
interface PendingSit {
  chairTileX: number;
  chairTileY: number;
  chairDirection: number;
}

export class IdleWanderManager {
  /** Next wander time per avatar */
  private wanderTimers = new Map<string, number>();
  /** Set of avatar IDs currently enabled for wandering */
  private enabled = new Set<string>();
  /** Avatars walking toward a chair to sit on */
  private pendingSits = new Map<string, PendingSit>();
  /** Avatars currently sitting — value is time to stand up */
  private sitTimers = new Map<string, number>();

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
    this.pendingSits.delete(avatarId);
    this.sitTimers.delete(avatarId);
  }

  /**
   * Tick each frame: for each idle-and-wandering avatar past its timer,
   * pick a random walkable tile within radius and start movement.
   * Also handles auto-sit and sit duration expiry.
   */
  tick(
    currentTimeMs: number,
    avatarManager: AvatarManager,
    grid: TileGrid,
    blockedTiles?: Set<string>,
    furniture?: FurnitureSpec[],
    multiTileFurniture?: MultiTileFurnitureSpec[],
  ): void {
    // Handle sitting avatars: check if sit duration expired
    for (const [avatarId, standTime] of this.sitTimers) {
      if (currentTimeMs >= standTime) {
        avatarManager.standAvatar(avatarId);
        this.sitTimers.delete(avatarId);
        this.wanderTimers.set(avatarId, currentTimeMs + randomWanderDelay());
      }
    }

    // Handle pending sits: check if avatar arrived at chair tile
    for (const [avatarId, pending] of this.pendingSits) {
      const avatar = avatarManager.getAvatar(avatarId);
      if (!avatar) {
        this.pendingSits.delete(avatarId);
        continue;
      }
      // Check if avatar has arrived (idle state, on the chair tile)
      if (
        avatar.state === 'idle' &&
        !avatarManager.isMoving(avatarId) &&
        avatar.tileX === pending.chairTileX &&
        avatar.tileY === pending.chairTileY
      ) {
        // Check chair still unoccupied
        const occupied = avatarManager.getOccupiedChairs();
        const chairKey = `${pending.chairTileX},${pending.chairTileY}`;
        if (!occupied.has(chairKey)) {
          avatarManager.sitAvatar(avatarId, pending.chairTileX, pending.chairTileY, pending.chairDirection);
          this.sitTimers.set(avatarId, currentTimeMs + randomSitDuration());
        }
        this.pendingSits.delete(avatarId);
      }
    }

    for (const avatarId of this.enabled) {
      // Skip avatars that are sitting or walking to a chair
      if (this.sitTimers.has(avatarId) || this.pendingSits.has(avatarId)) continue;

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

      // Try to sit on a nearby chair
      if (furniture && Math.random() < SIT_PROBABILITY) {
        const chair = findNearbyEmptyChair(
          avatar.tileX, avatar.tileY, WANDER_RADIUS,
          furniture, multiTileFurniture || [],
          avatarManager,
        );
        if (chair) {
          const moved = avatarManager.moveAvatarTo(
            avatarId, chair.tileX, chair.tileY, grid, undefined, blockedTiles,
          );
          if (moved) {
            this.pendingSits.set(avatarId, {
              chairTileX: chair.tileX,
              chairTileY: chair.tileY,
              chairDirection: chair.direction,
            });
            this.wanderTimers.delete(avatarId);
            continue;
          }
        }
      }

      // Normal wander: find a random walkable tile within radius
      const target = findNearbyWalkableTile(
        grid, avatar.tileX, avatar.tileY, WANDER_RADIUS, avatarManager.getAvatars(), blockedTiles
      );

      if (target) {
        avatarManager.moveAvatarTo(avatarId, target.x, target.y, grid, undefined, blockedTiles);
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
  blockedTiles?: Set<string>,
): { x: number; y: number } | null {
  const candidates: { x: number; y: number }[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (ny < 0 || ny >= grid.height || nx < 0 || nx >= grid.width) continue;
      if (grid.tiles[ny][nx] === null) continue;
      if (blockedTiles && blockedTiles.has(`${nx},${ny}`)) continue;
      if (avatars.some(a => a.tileX === nx && a.tileY === ny)) continue;
      candidates.push({ x: nx, y: ny });
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Find a nearby empty chair within radius.
 */
function findNearbyEmptyChair(
  cx: number,
  cy: number,
  radius: number,
  furniture: FurnitureSpec[],
  _multiTileFurniture: MultiTileFurnitureSpec[],
  avatarManager: AvatarManager,
): { tileX: number; tileY: number; direction: number } | null {
  const occupied = avatarManager.getOccupiedChairs();
  const candidates: { tileX: number; tileY: number; direction: number }[] = [];

  for (const item of furniture) {
    if (!isChairType(item.name)) continue;
    const key = `${item.tileX},${item.tileY}`;
    if (occupied.has(key)) continue;

    // Check within radius
    const dx = Math.abs(item.tileX - cx);
    const dy = Math.abs(item.tileY - cy);
    if (dx > radius || dy > radius) continue;

    // Check not occupied by a standing/walking avatar
    if (isTileOccupied(item.tileX, item.tileY, avatarManager.getAvatars())) continue;

    candidates.push({ tileX: item.tileX, tileY: item.tileY, direction: item.direction });
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
