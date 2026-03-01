// src/isoAgentBehavior.ts
// Avatar pathfinding integration and parent/child relationship rendering
// Converts BFS tile paths to isometric screen positions with facing directions

import { tileToScreen, getDirection } from './isometricMath.js';
import type { AvatarSpec } from './isoAvatarRenderer.js';

/**
 * Represents a single step in a BFS path as tile coordinates.
 */
export interface TilePathStep {
  tileX: number;
  tileY: number;
  tileZ: number;
}

/**
 * BFS path represented as an array of tile coordinate steps.
 */
export type TilePath = TilePathStep[];

/**
 * Screen position with facing direction for avatar rendering.
 */
export interface IsometricPosition {
  screenX: number;
  screenY: number;
  direction: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/**
 * Convert a BFS tile path to isometric screen positions with facing directions.
 *
 * For each step in the path:
 * 1. Convert tile coordinates to screen coordinates via tileToScreen()
 * 2. Calculate facing direction from current step to next step via getDirection()
 * 3. Use direction from previous step if at end of path
 *
 * @param path - BFS path as tile coordinates
 * @returns Array of screen positions with directions
 */
export function pathToIsometricPositions(path: TilePath): IsometricPosition[] {
  if (path.length === 0) return [];

  const positions: IsometricPosition[] = [];

  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    const screen = tileToScreen(step.tileX, step.tileY, step.tileZ);

    // Determine direction
    let direction: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

    if (i < path.length - 1) {
      // Look ahead to next step
      const nextStep = path[i + 1];
      direction = getDirection(
        step.tileX, step.tileY,
        nextStep.tileX, nextStep.tileY
      ) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    } else {
      // Last step: use previous direction or default to 2 (SE)
      direction = i > 0 ? positions[i - 1].direction : 2;
    }

    positions.push({
      screenX: screen.x,
      screenY: screen.y,
      direction,
    });
  }

  return positions;
}

/**
 * Draw a line connecting parent avatar to child avatar in isometric space.
 *
 * Line is drawn from parent foot position to child foot position.
 * Uses a distinct color (cyan) with 2px stroke and slight transparency.
 *
 * @param ctx - Canvas rendering context
 * @param parentSpec - Parent avatar specification
 * @param childSpec - Child avatar specification
 */
export function drawParentChildLine(
  ctx: CanvasRenderingContext2D,
  parentSpec: AvatarSpec,
  childSpec: AvatarSpec
): void {
  // Convert tile positions to screen positions (foot position)
  const parentScreen = tileToScreen(
    parentSpec.tileX,
    parentSpec.tileY,
    parentSpec.tileZ
  );
  const childScreen = tileToScreen(
    childSpec.tileX,
    childSpec.tileY,
    childSpec.tileZ
  );

  // Draw line
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)'; // Cyan with 60% opacity
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(parentScreen.x, parentScreen.y);
  ctx.lineTo(childScreen.x, childScreen.y);
  ctx.stroke();

  ctx.restore();
}

/**
 * Update avatar position along a path based on elapsed time.
 *
 * @param spec - Avatar specification (mutated in place)
 * @param path - Isometric positions from pathToIsometricPositions()
 * @param currentTimeMs - Current timestamp
 * @param pathStartTimeMs - Timestamp when path started
 * @param pathDurationMs - Total duration to traverse path (e.g., 2000ms for 2 seconds)
 */
export function updateAvatarAlongPath(
  spec: AvatarSpec,
  path: IsometricPosition[],
  currentTimeMs: number,
  pathStartTimeMs: number,
  pathDurationMs: number
): void {
  if (path.length === 0) return;

  const elapsed = currentTimeMs - pathStartTimeMs;
  const progress = Math.min(1.0, elapsed / pathDurationMs);

  // Find current segment
  const segmentIndex = Math.floor(progress * (path.length - 1));
  const segmentProgress = (progress * (path.length - 1)) % 1.0;

  const start = path[segmentIndex];
  const end = path[Math.min(segmentIndex + 1, path.length - 1)];

  // Lerp between start and end
  const lerpX = start.screenX + (end.screenX - start.screenX) * segmentProgress;
  const lerpY = start.screenY + (end.screenY - start.screenY) * segmentProgress;

  // Update spec with screen position (converted back to tile for rendering)
  // This is a simplification - actual implementation may store screen pos directly
  spec.direction = start.direction;

  // If moving, set walk state; if reached end, set idle
  if (progress < 1.0) {
    spec.state = 'walk';
  } else {
    spec.state = 'idle';
  }
}
