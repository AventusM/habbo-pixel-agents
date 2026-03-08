// src/idleWander.ts
// Idle wander behavior: idle avatars walk to random tiles on staggered timers
// Includes auto-sit: avatars occasionally sit on nearby empty chairs
// Role-specific idle behaviors: coders sit at desks, planners pace, others wander

import type { TileGrid } from './isoTypes.js';
import type { AvatarManager } from './avatarManager.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from './isoFurnitureRenderer.js';
import { isTileOccupied } from './isoPathfinding.js';
import { isChairType } from './furnitureRegistry.js';
import type { TeamSection } from './agentTypes.js';
import type { SectionManager } from './sectionManager.js';

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

/** Planning pace delay: longer pauses at destinations (ms) */
const PACE_MIN_MS = 8000;
const PACE_MAX_MS = 12000;

/** Role-specific idle behavior type */
export type RoleIdleBehavior = 'wander' | 'sit-at-desk' | 'pace';

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

/** Map TeamSection to idle behavior */
function getIdleBehaviorForTeam(team: TeamSection): RoleIdleBehavior {
  switch (team) {
    case 'core-dev': return 'sit-at-desk';
    case 'planning': return 'pace';
    case 'infrastructure':
    case 'support':
    default: return 'wander';
  }
}

function randomPaceDelay(): number {
  return PACE_MIN_MS + Math.random() * (PACE_MAX_MS - PACE_MIN_MS);
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
  /** Agent role assignments for behavior selection */
  private agentRoles = new Map<string, TeamSection>();

  /**
   * Set the team role for an agent, determining idle behavior.
   * Core Dev agents prefer sitting at desks, Planners pace, others wander.
   */
  setAgentRole(agentId: string, team: TeamSection): void {
    this.agentRoles.set(agentId, team);
  }

  /** Get the idle behavior for an agent based on their team role */
  getAgentBehavior(agentId: string): RoleIdleBehavior {
    const team = this.agentRoles.get(agentId);
    return team ? getIdleBehaviorForTeam(team) : 'wander';
  }

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
    this.agentRoles.delete(avatarId);
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
    sectionManager?: SectionManager | null,
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

      // Role-specific idle behavior
      const behavior = this.getAgentBehavior(avatarId);
      const agentTeam = this.agentRoles.get(avatarId);

      if (behavior === 'sit-at-desk' && sectionManager && agentTeam) {
        // Core Dev: prefer sitting at desk chairs in their section
        const target = this.getIdleTargetForRole(avatarId, avatarManager, sectionManager, grid, blockedTiles, furniture);
        if (target) {
          // Check if target is a chair tile — set up pending sit
          const chair = furniture ? findChairAtTile(target.x, target.y, furniture, avatarManager) : null;
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
          } else {
            avatarManager.moveAvatarTo(avatarId, target.x, target.y, grid, undefined, blockedTiles);
          }
        }
        this.wanderTimers.set(avatarId, currentTimeMs + randomWanderDelay());
        continue;
      }

      if (behavior === 'pace' && sectionManager && agentTeam) {
        // Planning: pace between idle tiles in section with longer pauses
        const target = this.getIdleTargetForRole(avatarId, avatarManager, sectionManager, grid, blockedTiles, furniture);
        if (target) {
          avatarManager.moveAvatarTo(avatarId, target.x, target.y, grid, undefined, blockedTiles);
        }
        // Planners pause longer at each destination
        this.wanderTimers.set(avatarId, currentTimeMs + randomPaceDelay());
        continue;
      }

      // Default wander behavior (infrastructure, support, or no section manager)
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

  /**
   * Get an idle target tile based on the agent's role and section.
   * - Core Dev: find nearest unoccupied desk chair in section, fallback to section idle tile
   * - Planning: random idle tile within section (for pacing between positions)
   * - Others: random section idle tile
   */
  getIdleTargetForRole(
    agentId: string,
    avatarManager: AvatarManager,
    sectionManager: SectionManager,
    grid: TileGrid,
    blockedTiles?: Set<string>,
    furniture?: FurnitureSpec[],
  ): { x: number; y: number } | null {
    const team = this.agentRoles.get(agentId);
    if (!team) return null;

    const behavior = getIdleBehaviorForTeam(team);

    if (behavior === 'sit-at-desk' && furniture) {
      // Find an unoccupied desk chair in the agent's section
      const deskTile = sectionManager.getDeskTile(team, avatarManager.getOccupiedChairs());
      if (deskTile) {
        // Check if the desk tile has a chair on it
        const chair = findChairAtTile(deskTile.x, deskTile.y, furniture, avatarManager);
        if (chair) {
          return { x: chair.tileX, y: chair.tileY };
        }
      }
    }

    // For pace and wander, or fallback: use section idle tiles
    const idleTile = sectionManager.getIdleTile(team);
    if (idleTile) {
      // Verify it's walkable and not occupied
      if (
        idleTile.y >= 0 && idleTile.y < grid.height &&
        idleTile.x >= 0 && idleTile.x < grid.width &&
        grid.tiles[idleTile.y][idleTile.x] !== null &&
        !(blockedTiles && blockedTiles.has(`${idleTile.x},${idleTile.y}`))
      ) {
        return idleTile;
      }
    }

    return null;
  }
}

/**
 * Find a chair at a specific tile position.
 */
function findChairAtTile(
  tileX: number,
  tileY: number,
  furniture: FurnitureSpec[],
  avatarManager: AvatarManager,
): { tileX: number; tileY: number; direction: number } | null {
  const occupied = avatarManager.getOccupiedChairs();
  for (const item of furniture) {
    if (!isChairType(item.name)) continue;
    if (item.tileX !== tileX || item.tileY !== tileY) continue;
    const key = `${item.tileX},${item.tileY}`;
    if (occupied.has(key)) continue;
    return { tileX: item.tileX, tileY: item.tileY, direction: item.direction };
  }
  return null;
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
