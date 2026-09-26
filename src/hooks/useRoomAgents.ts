// src/hooks/useRoomAgents.ts
// Agent spawn/despawn/teleport lifecycle: section-manager ownership, booth
// occupancy, spawn/despawn orchestration and deferred booth step-outs
// (M008/S01, extracted from RoomCanvas). Part 1 of 2 — T05 extends it.
import { useRef } from 'react';
import { SectionManager } from '../sectionManager.js';
import { computeBlockedTiles } from '../isoPathfinding.js';
import { createTeleportEffect } from '../teleportEffect.js';
import { agentStore } from '../state/agentStore.js';
import { tileToScreen, TILE_H_HALF } from '../isometricMath.js';
import type { TeleportEffect } from '../teleportEffect.js';
import type { FloorTemplate } from '../roomLayoutEngine.js';
import type { ExtensionMessage, TeamSection } from '../agentTypes.js';
import type { TileGrid } from '../isoTypes.js';
import type { FurnitureSpec, MultiTileFurnitureSpec } from '../isoFurnitureRenderer.js';
import type { AvatarManager } from '../avatarManager.js';
import type { IdleWanderManager } from '../idleWander.js';
import type { AvatarSelectionManager } from '../avatarSelection.js';

export interface UseRoomAgentsOptions {
  avatarManager: AvatarManager;
  idleWander: IdleWanderManager;
  selectionManager: AvatarSelectionManager;
  getGrid: () => TileGrid | null;
  getFurniture: () => FurnitureSpec[];
  getMultiTileFurniture: () => MultiTileFurnitureSpec[];
  getCameraOrigin: () => { x: number; y: number };
  setBoothFrame: (tileX: number, tileY: number, frameIndex: number) => void;
}

export function useRoomAgents(options: UseRoomAgentsOptions) {
  const { avatarManager, idleWander, selectionManager } = options;

  // Section manager for team-based agent placement
  const sectionManagerRef = useRef<SectionManager | null>(null);

  // Active teleport effects (spawn/despawn flash)
  const teleportEffectsRef = useRef<TeleportEffect[]>([]);

  // Agents mid-despawn (walking to booth before removal)
  const despawningAgentsRef = useRef<Set<string>>(new Set());

  // Booth tiles temporarily made walkable during spawn/despawn
  const walkableBoothsRef = useRef<Set<string>>(new Set());

  // Agents waiting to step out of booth after spawn animation completes
  // Maps agentId → booth tile {x, y}
  const pendingStepOutRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  /** Lazily construct the section manager from the global floor template. */
  const ensureSectionManager = (): SectionManager | null => {
    if (!sectionManagerRef.current) {
      const tmpl = (window as any).floorTemplate as FloorTemplate | undefined;
      if (tmpl) {
        sectionManagerRef.current = new SectionManager(tmpl);
      }
    }
    return sectionManagerRef.current;
  };

  /** Spawn a fresh agent avatar at its team's teleport booth (or a random tile). */
  const handleAgentCreated = (msg: ExtensionMessage) => {
    if (msg.type !== 'agentCreated') return;

    const grid = options.getGrid();

    // Guard: skip if avatar already exists (prevents duplicate side effects from re-broadcast)
    if (avatarManager.getAvatar(msg.agentId)) {
      console.log(`[Room] agentCreated: ${msg.agentId} already exists, skipping`);
      return;
    }
    if (grid) {
      const sectionManager = ensureSectionManager();
      const team: TeamSection = msg.team || 'core-dev';
      console.log(`[Room] agentCreated: ${msg.agentId} team=${team}`);

      const blocked = computeBlockedTiles(
        options.getFurniture(),
        options.getMultiTileFurniture(),
        walkableBoothsRef.current,
      );

      // Try to spawn at section teleport booth
      const spawnTile = sectionManager?.getSpawnTile(team);
      console.log(`[Room] spawnTile for ${team}:`, spawnTile);
      let avatar;
      if (spawnTile) {
        // Temporarily make booth tile walkable and open door
        const boothKey = `${spawnTile.x},${spawnTile.y}`;
        walkableBoothsRef.current.add(boothKey);
        options.setBoothFrame(spawnTile.x, spawnTile.y, 1);
        avatar = avatarManager.spawnAvatarAt(msg.agentId, msg.variant, spawnTile.x, spawnTile.y, 0, grid, msg.terminalName, team);
        console.log(`[Room] spawnAvatarAt result:`, avatar ? 'ok' : 'null');
        // Create teleport flash effect at spawn position
        if (avatar) {
          const { x: sx, y: sy } = tileToScreen(spawnTile.x, spawnTile.y, 0);
          const ox = options.getCameraOrigin();
          console.log(`[Room] Creating teleport flash at sx=${sx + ox.x}, sy=${sy + TILE_H_HALF + ox.y}`);
          teleportEffectsRef.current.push(
            createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'spawn')
          );
          // Register pending step-out (handled in render loop when spawn animation ends)
          pendingStepOutRef.current.set(msg.agentId, { ...spawnTile });
        } else {
          // Spawn failed, revert walkability
          walkableBoothsRef.current.delete(boothKey);
          options.setBoothFrame(spawnTile.x, spawnTile.y, 0);
        }
      } else {
        // Fallback: random tile
        avatarManager.spawnAvatar(msg.agentId, msg.variant, grid, msg.terminalName, blocked, team);
      }

      // Assign agent to section and record initial activity
      if (sectionManager) {
        sectionManager.assignAgent(msg.agentId, team);
        sectionManager.updateActivity(team, Date.now());
      }

      // Track in agent store (drives the orchestration overlay)
      agentStore.addAgent(msg.agentId, msg.terminalName || msg.agentId, team);

      // Set role-specific idle behavior before starting wander
      idleWander.setAgentRole(msg.agentId, team);

      // New agents start wandering until they become active
      idleWander.startWandering(msg.agentId);
    }
  };

  /** Remove an agent, walking it to its team booth first when one exists. */
  const handleAgentRemoved = (msg: ExtensionMessage) => {
    if (msg.type !== 'agentRemoved') return;

    const grid = options.getGrid();

    console.log(`[Room] agentRemoved: ${msg.agentId}`);
    agentStore.removeAgent(msg.agentId);
    const sectionManager = ensureSectionManager();
    const agentTeam = sectionManager?.getAgentTeam(msg.agentId);
    const boothTile = agentTeam ? sectionManager?.getSpawnTile(agentTeam) : null;
    const avatar = avatarManager.getAvatar(msg.agentId);
    console.log(`[Room] despawn: team=${agentTeam}, boothTile=`, boothTile, `avatar=`, avatar ? `at(${avatar.tileX},${avatar.tileY})` : 'null');

    if (boothTile && avatar && grid) {
      // Walk-to-booth despawn flow — temporarily make booth walkable
      const despawnBoothKeyOuter = `${boothTile.x},${boothTile.y}`;
      walkableBoothsRef.current.add(despawnBoothKeyOuter);
      despawningAgentsRef.current.add(msg.agentId);
      idleWander.stopWandering(msg.agentId);

      // Stand up if sitting
      if (avatar.state === 'sit') {
        avatarManager.standAvatar(msg.agentId);
      }

      // If already at booth tile, trigger despawn immediately
      if (avatar.tileX === boothTile.x && avatar.tileY === boothTile.y) {
        // Open booth door for despawn
        const despawnBoothKey = `${boothTile.x},${boothTile.y}`;
        walkableBoothsRef.current.add(despawnBoothKey);
        options.setBoothFrame(boothTile.x, boothTile.y, 1);
        const { x: sx, y: sy } = tileToScreen(boothTile.x, boothTile.y, 0);
        const ox = options.getCameraOrigin();
        teleportEffectsRef.current.push(
          createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'despawn')
        );
        // Schedule removal after effect duration, then close booth and re-block
        const capturedBooth = { ...boothTile };
        const capturedKey = despawnBoothKey;
        setTimeout(() => {
          avatarManager.removeAvatar(msg.agentId);
          sectionManager?.removeAgent(msg.agentId);
          despawningAgentsRef.current.delete(msg.agentId);
          options.setBoothFrame(capturedBooth.x, capturedBooth.y, 0);
          walkableBoothsRef.current.delete(capturedKey);
        }, 500);
      } else {
        // Pathfind to booth — recompute blocked with booth tile now walkable
        const despawnBlocked = computeBlockedTiles(
          options.getFurniture(),
          options.getMultiTileFurniture(),
          walkableBoothsRef.current,
        );
        avatarManager.moveAvatarTo(msg.agentId, boothTile.x, boothTile.y, grid, undefined, despawnBlocked);
      }
    } else {
      // No team or no booth: immediate despawn
      avatarManager.despawnAvatar(msg.agentId);
      idleWander.stopWandering(msg.agentId);
      sectionManager?.removeAgent(msg.agentId);
    }
    selectionManager.deselectAvatar();
  };

  /** Frame tick: trigger the despawn effect once a despawner reaches its booth. */
  const tickDespawns = (_nowMs: number) => {
    // Check despawning agents: if they've reached the booth tile, trigger despawn effect
    if (despawningAgentsRef.current.size > 0 && sectionManagerRef.current) {
      for (const agentId of despawningAgentsRef.current) {
        const avatar = avatarManager.getAvatar(agentId);
        if (!avatar) {
          despawningAgentsRef.current.delete(agentId);
          continue;
        }
        // Check if avatar has arrived at booth (idle and not moving)
        if (avatar.state === 'idle' && !avatarManager.isMoving(agentId)) {
          const team = sectionManagerRef.current.getAgentTeam(agentId);
          const boothTile = team ? sectionManagerRef.current.getSpawnTile(team) : null;
          if (boothTile && avatar.tileX === boothTile.x && avatar.tileY === boothTile.y) {
            // Open booth door for despawn
            options.setBoothFrame(boothTile.x, boothTile.y, 1);
            // Create despawn teleport effect
            const { x: sx, y: sy } = tileToScreen(boothTile.x, boothTile.y, 0);
            const ox = options.getCameraOrigin();
            teleportEffectsRef.current.push(
              createTeleportEffect(sx + ox.x, sy + TILE_H_HALF + ox.y, 'despawn')
            );
            // Schedule removal after effect, then close booth and re-block tile
            const capturedAgentId = agentId;
            const capturedBooth = { ...boothTile };
            const capturedBoothKey = `${boothTile.x},${boothTile.y}`;
            setTimeout(() => {
              avatarManager.removeAvatar(capturedAgentId);
              sectionManagerRef.current?.removeAgent(capturedAgentId);
              despawningAgentsRef.current.delete(capturedAgentId);
              options.setBoothFrame(capturedBooth.x, capturedBooth.y, 0);
              walkableBoothsRef.current.delete(capturedBoothKey);
            }, 500);
            // Remove from despawning set immediately to prevent re-triggering
            despawningAgentsRef.current.delete(agentId);
          }
        }
      }
    }
  };

  /** Frame draw: move spawned agents out of the booth once their animation ends. */
  const processPendingStepOuts = () => {
    const grid = options.getGrid();
    if (!grid) return;

    // Check pending step-outs: move agent out of booth once spawn animation ends
    if (pendingStepOutRef.current.size > 0) {
      for (const [agentId, boothPos] of pendingStepOutRef.current) {
        const av = avatarManager.getAvatar(agentId);
        if (!av) {
          pendingStepOutRef.current.delete(agentId);
          continue;
        }
        if (av.state === 'idle') {
          pendingStepOutRef.current.delete(agentId);
          const stepBlocked = computeBlockedTiles(
            options.getFurniture(),
            options.getMultiTileFurniture(),
            walkableBoothsRef.current,
          );
          // Prefer stepping out in booth facing direction (dir 2 = +x, bottom-right)
          const offsets = [
            { dx: 1, dy: 0 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
          ];
          for (const off of offsets) {
            const nx = boothPos.x + off.dx;
            const ny = boothPos.y + off.dy;
            if (nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height
                && grid.tiles[ny][nx] !== null && !stepBlocked.has(`${nx},${ny}`)) {
              avatarManager.moveAvatarTo(agentId, nx, ny, grid, undefined, stepBlocked);
              break;
            }
          }
          // Close booth door and re-block after agent steps out
          const capturedPos = { ...boothPos };
          const capturedKey = `${boothPos.x},${boothPos.y}`;
          setTimeout(() => {
            options.setBoothFrame(capturedPos.x, capturedPos.y, 0);
            walkableBoothsRef.current.delete(capturedKey);
          }, 800);
        }
      }
    }
  };

  return {
    sectionManagerRef,
    teleportEffectsRef,
    walkableBoothsRef,
    despawningAgentsRef,
    pendingStepOutRef,
    ensureSectionManager,
    handleAgentCreated,
    handleAgentRemoved,
    tickDespawns,
    processPendingStepOuts,
  };
}
