// src/isoWallRenderer.ts
// Room perimeter wall renderer.
// Draws continuous wall panels rising ABOVE the floor along left and right edges,
// plus a back corner post where the two walls meet.
// Walls are drawn BEFORE floor tiles so they appear behind the floor.

import {
  TILE_W_HALF,
  TILE_H_HALF,
  WALL_HEIGHT,
  WALL_THICKNESS,
  FLOOR_THICKNESS,
  tileToScreen,
} from './isometricMath.js';
import type { TileGrid, HsbColor } from './isoTypes.js';
import { tileColors, hsbToHsl } from './isoTypes.js';

/** Number of horizontal panel bands on each wall. */
const WALL_PANEL_COUNT = 7;

/**
 * Generate wall-specific color set from HSB.
 * Returns shades for the wall surface, panel bands, separator lines,
 * top cap (lightest — faces up toward light), and front face (darkest — shadow side).
 * Strong contrast between faces is critical for 3D readability at a distance.
 */
function wallPanelColors(hsb: HsbColor, face: 'left' | 'right'): {
  base: string;
  line: string;
  bandLight: string;
  bandDark: string;
  capTop: string;
  capFront: string;
  capLine: string;
  outline: string;
} {
  const { h, s, l } = hsbToHsl(hsb);
  // Left wall is l-10, right wall is l-20 (from tileColors)
  const baseL = face === 'left' ? Math.max(0, l - 10) : Math.max(0, l - 20);
  return {
    base: `hsl(${h}, ${s}%, ${baseL}%)`,
    line: `hsl(${h}, ${s}%, ${Math.max(0, baseL - 10)}%)`,
    bandLight: `hsl(${h}, ${s}%, ${Math.min(100, baseL + 3)}%)`,
    bandDark: `hsl(${h}, ${s}%, ${Math.max(0, baseL - 5)}%)`,
    // Top cap: clearly lighter — it faces upward toward the light source
    capTop: `hsl(${h}, ${Math.max(0, s - 5)}%, ${Math.min(100, baseL + 12)}%)`,
    // Front face: clearly darker — it's the shadow/depth side
    capFront: `hsl(${h}, ${s}%, ${Math.max(0, baseL - 18)}%)`,
    // Cap edge line
    capLine: `hsl(${h}, ${s}%, ${Math.max(0, baseL - 22)}%)`,
    // Dark outline border — separates wall from floor/background
    outline: `hsl(${h}, ${Math.min(100, s + 10)}%, ${Math.max(0, baseL - 30)}%)`,
  };
}

/**
 * Draw horizontal panel stripes and separator lines within a wall polygon.
 * The wall polygon is defined by `bottomPoints` (floor edge) which is the
 * bottom boundary, shifted up by WALL_HEIGHT for the top boundary.
 *
 * Panel lines run parallel to the bottom edge (following isometric slope).
 * Each band is a parallelogram stripe clipped to the wall polygon.
 */
function drawWallPanelLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bottomPoints: Array<{ x: number; y: number }>,
  colors: { base: string; line: string; bandLight: string; bandDark: string },
): void {
  // Save/restore so the clip doesn't leak
  ctx.save();

  // Build the wall polygon path for clipping
  ctx.beginPath();
  ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
  for (let i = 1; i < bottomPoints.length; i++) {
    ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
  }
  for (let i = bottomPoints.length - 1; i >= 0; i--) {
    ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
  }
  ctx.closePath();
  ctx.clip();

  // Draw alternating band stripes (parallelograms running parallel to floor edge)
  const bandHeight = WALL_HEIGHT / WALL_PANEL_COUNT;
  for (let band = 0; band < WALL_PANEL_COUNT; band++) {
    const yOff = band * bandHeight;
    const isLight = band % 2 === 0;

    ctx.beginPath();
    // Bottom edge of this band (offset up from floor edge)
    for (let i = 0; i < bottomPoints.length; i++) {
      ctx[i === 0 ? 'moveTo' : 'lineTo'](
        bottomPoints[i].x,
        bottomPoints[i].y - yOff,
      );
    }
    // Top edge of this band
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(
        bottomPoints[i].x,
        bottomPoints[i].y - yOff - bandHeight,
      );
    }
    ctx.closePath();
    ctx.fillStyle = isLight ? colors.bandLight : colors.bandDark;
    ctx.fill();
  }

  // Draw separator lines between panels
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = colors.line;
  for (let band = 1; band < WALL_PANEL_COUNT; band++) {
    const yOff = band * bandHeight;
    ctx.beginPath();
    for (let i = 0; i < bottomPoints.length; i++) {
      ctx[i === 0 ? 'moveTo' : 'lineTo'](
        bottomPoints[i].x,
        bottomPoints[i].y - yOff,
      );
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw continuous wall panels rising above the floor along left and right edges,
 * plus a back corner post at tile (0,0).
 *
 * Each wall traces the outer edge of the floor, then extends WALL_HEIGHT
 * UPWARD (negative Y) to form the room enclosure behind the floor.
 *
 * Must be called BEFORE drawing floor tiles so walls appear behind.
 */
export function drawWallPanels(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  hsb: HsbColor,
  tileColorMap?: Map<string, HsbColor>,
): void {
  const tileHsb = (tileColorMap && tileColorMap.get('0,0')) || hsb;

  // --- LEFT WALL (rises above the left edge of the floor) ---
  const leftEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (tx === 0 || grid.tiles[ty][tx - 1] == null) {
        leftEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (leftEdge.length > 0) {
    const { left } = tileColors(tileHsb);
    const panelColors = wallPanelColors(tileHsb, 'left');
    const bottomPoints: Array<{ x: number; y: number }> = [];

    // Start at back corner: top vertex of first left-edge tile
    const first = leftEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    bottomPoints.push({
      x: fsx + cameraOrigin.x,
      y: fsy + cameraOrigin.y,
    });

    // Left vertex of each tile along the left edge
    for (const { tx, ty, height } of leftEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      bottomPoints.push({
        x: sx + cameraOrigin.x - TILE_W_HALF,
        y: sy + cameraOrigin.y + TILE_H_HALF,
      });
    }

    // Draw polygon: bottom edge forward, top edge (shifted up) backward
    ctx.beginPath();
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();

    // Draw panel lines and alternating bands on the left wall
    drawWallPanelLines(ctx, bottomPoints, panelColors);

    // --- LEFT WALL TOP CAP (visible top surface of the wall slab) ---
    // The cap is a parallelogram strip along the ceiling line, offset inward
    // toward the room. "Inward" for the left wall = right+down in screen coords.
    const capD = WALL_THICKNESS;
    const topColors = wallPanelColors(tileHsb, 'left');
    ctx.beginPath();
    // Outer ceiling edge (back to front)
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y - WALL_HEIGHT);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    // Inner ceiling edge (front to back, shifted inward toward room)
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x + capD, bottomPoints[i].y - WALL_HEIGHT + capD / 2);
    }
    ctx.closePath();
    ctx.fillStyle = topColors.capTop;
    ctx.fill();

    // Highlight line along the outer ceiling edge
    ctx.beginPath();
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y - WALL_HEIGHT);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    ctx.strokeStyle = topColors.capLine;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- LEFT WALL FRONT FACE (pre-floor: behind floor tiles) ---
    const lastPt = bottomPoints[bottomPoints.length - 1];
    const floorOverlapL = FLOOR_THICKNESS + 2;
    ctx.beginPath();
    ctx.moveTo(lastPt.x, lastPt.y + floorOverlapL);
    ctx.lineTo(lastPt.x, lastPt.y - WALL_HEIGHT);
    ctx.lineTo(lastPt.x + capD, lastPt.y - WALL_HEIGHT + capD / 2);
    ctx.lineTo(lastPt.x + capD, lastPt.y + floorOverlapL + capD / 2);
    ctx.closePath();
    ctx.fillStyle = topColors.capFront;
    ctx.fill();
  }
  const rightEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let tx = 0; tx < grid.width; tx++) {
    for (let ty = 0; ty < grid.height; ty++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (ty === 0 || grid.tiles[ty - 1]?.[tx] == null) {
        rightEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (rightEdge.length > 0) {
    const { right } = tileColors(tileHsb);
    const panelColors = wallPanelColors(tileHsb, 'right');
    const bottomPoints: Array<{ x: number; y: number }> = [];

    // Start at back corner: top vertex of first right-edge tile
    const first = rightEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    bottomPoints.push({
      x: fsx + cameraOrigin.x,
      y: fsy + cameraOrigin.y,
    });

    // Right vertex of each tile along the right edge
    for (const { tx, ty, height } of rightEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      bottomPoints.push({
        x: sx + cameraOrigin.x + TILE_W_HALF,
        y: sy + cameraOrigin.y + TILE_H_HALF,
      });
    }

    ctx.beginPath();
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();

    // Draw panel lines and alternating bands on the right wall
    drawWallPanelLines(ctx, bottomPoints, panelColors);

    // --- RIGHT WALL TOP CAP (visible top surface of the wall slab) ---
    // "Inward" for the right wall = left+down in screen coords.
    const capD = WALL_THICKNESS;
    const topColors = wallPanelColors(tileHsb, 'right');
    ctx.beginPath();
    // Outer ceiling edge (back to front)
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y - WALL_HEIGHT);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    // Inner ceiling edge (front to back, shifted inward toward room)
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x - capD, bottomPoints[i].y - WALL_HEIGHT + capD / 2);
    }
    ctx.closePath();
    ctx.fillStyle = topColors.capTop;
    ctx.fill();

    // Highlight line along the outer ceiling edge
    ctx.beginPath();
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y - WALL_HEIGHT);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y - WALL_HEIGHT);
    }
    ctx.strokeStyle = topColors.capLine;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- RIGHT WALL FRONT FACE (pre-floor: behind floor tiles) ---
    const lastPt = bottomPoints[bottomPoints.length - 1];
    const floorOverlapR = FLOOR_THICKNESS + 2;
    ctx.beginPath();
    ctx.moveTo(lastPt.x, lastPt.y + floorOverlapR);
    ctx.lineTo(lastPt.x, lastPt.y - WALL_HEIGHT);
    ctx.lineTo(lastPt.x - capD, lastPt.y - WALL_HEIGHT + capD / 2);
    ctx.lineTo(lastPt.x - capD, lastPt.y + floorOverlapR + capD / 2);
    ctx.closePath();
    ctx.fillStyle = topColors.capFront;
    ctx.fill();
  }
  // --- BACK CORNER POST ---
  const cornerTile = grid.tiles[0]?.[0];
  if (cornerTile != null) {
    const { x: sx, y: sy } = tileToScreen(0, 0, cornerTile.height);
    const screenX = sx + cameraOrigin.x;
    const screenY = sy + cameraOrigin.y;

    const cornerHsb = (tileColorMap && tileColorMap.get('0,0')) || hsb;
    const { left } = tileColors(cornerHsb);

    // Post rises UPWARD from tile top vertex
    ctx.fillStyle = left;
    ctx.fillRect(screenX - 2, screenY - WALL_HEIGHT, 4, WALL_HEIGHT);
  }
}

/**
 * Draw wall thickness edges — bottom-face strip and border lines.
 *
 * Must be called AFTER floor tiles so the edges render on top.
 *
 * Each wall gets:
 * - A bottom-face strip along the floor junction (the underside of the wall
 *   "ledge" — visible where wall meets floor). This is offset inward toward
 *   the room.
 * - A darker border line along the bottom edge of the wall panel.
 * - A lighter border line along the top edge (ceiling line).
 */
export function drawWallEdges(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  grid: TileGrid,
  cameraOrigin: { x: number; y: number },
  hsb: HsbColor,
  tileColorMap?: Map<string, HsbColor>,
): void {
  const tileHsb = (tileColorMap && tileColorMap.get('0,0')) || hsb;
  const colors = tileColors(tileHsb);

  // --- LEFT WALL bottom-face + borders ---
  const leftEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (tx === 0 || grid.tiles[ty][tx - 1] == null) {
        leftEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (leftEdge.length > 0) {
    const pts: Array<{ x: number; y: number }> = [];
    const first = leftEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    pts.push({ x: fsx + cameraOrigin.x, y: fsy + cameraOrigin.y });
    for (const { tx, ty, height } of leftEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      pts.push({ x: sx + cameraOrigin.x - TILE_W_HALF, y: sy + cameraOrigin.y + TILE_H_HALF });
    }

    // Border line along top edge (ceiling)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - WALL_HEIGHT);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y - WALL_HEIGHT);
    }
    ctx.strokeStyle = colors.right;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // --- RIGHT WALL bottom-face + borders ---
  const rightEdge: Array<{ tx: number; ty: number; height: number }> = [];
  for (let tx = 0; tx < grid.width; tx++) {
    for (let ty = 0; ty < grid.height; ty++) {
      const tile = grid.tiles[ty][tx];
      if (tile == null) continue;
      if (ty === 0 || grid.tiles[ty - 1]?.[tx] == null) {
        rightEdge.push({ tx, ty, height: tile.height });
        break;
      }
    }
  }

  if (rightEdge.length > 0) {
    const pts: Array<{ x: number; y: number }> = [];
    const first = rightEdge[0];
    const { x: fsx, y: fsy } = tileToScreen(first.tx, first.ty, first.height);
    pts.push({ x: fsx + cameraOrigin.x, y: fsy + cameraOrigin.y });
    for (const { tx, ty, height } of rightEdge) {
      const { x: sx, y: sy } = tileToScreen(tx, ty, height);
      pts.push({ x: sx + cameraOrigin.x + TILE_W_HALF, y: sy + cameraOrigin.y + TILE_H_HALF });
    }

    // Border line along top edge (ceiling)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - WALL_HEIGHT);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y - WALL_HEIGHT);
    }
    ctx.strokeStyle = colors.left;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // --- FRONT FACES + OUTLINES (drawn after floor so wall is on top) ---
  const capD = WALL_THICKNESS;
  const floorOverlap = FLOOR_THICKNESS + 2;

  // Left wall front face + outline
  {
    const leftPts: Array<{ x: number; y: number }> = [];
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const tile = grid.tiles[ty][tx];
        if (tile == null) continue;
        if (tx === 0 || grid.tiles[ty][tx - 1] == null) {
          const { x: sx, y: sy } = tileToScreen(tx, ty, tile.height);
          if (leftPts.length === 0) {
            leftPts.push({ x: sx + cameraOrigin.x, y: sy + cameraOrigin.y });
          }
          leftPts.push({ x: sx + cameraOrigin.x - TILE_W_HALF, y: sy + cameraOrigin.y + TILE_H_HALF });
          break;
        }
      }
    }
    if (leftPts.length > 1) {
      const lColors = wallPanelColors(tileHsb, 'left');
      const lastPt = leftPts[leftPts.length - 1];
      // Outline only (front face fill is in pre-floor drawWallPanels)
      ctx.strokeStyle = lColors.outline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y + floorOverlap);
      ctx.lineTo(lastPt.x, lastPt.y - WALL_HEIGHT);
      for (let i = leftPts.length - 2; i >= 0; i--) {
        ctx.lineTo(leftPts[i].x, leftPts[i].y - WALL_HEIGHT);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(leftPts[0].x + capD, leftPts[0].y - WALL_HEIGHT + capD / 2);
      for (let i = 1; i < leftPts.length; i++) {
        ctx.lineTo(leftPts[i].x + capD, leftPts[i].y - WALL_HEIGHT + capD / 2);
      }
      ctx.lineTo(lastPt.x + capD, lastPt.y + floorOverlap + capD / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(leftPts[0].x, leftPts[0].y);
      ctx.lineTo(leftPts[0].x, leftPts[0].y - WALL_HEIGHT);
      ctx.stroke();
    }
  }

  // Right wall front face + outline
  {
    const rightPts: Array<{ x: number; y: number }> = [];
    for (let tx = 0; tx < grid.width; tx++) {
      for (let ty = 0; ty < grid.height; ty++) {
        const tile = grid.tiles[ty][tx];
        if (tile == null) continue;
        if (ty === 0 || grid.tiles[ty - 1]?.[tx] == null) {
          const { x: sx, y: sy } = tileToScreen(tx, ty, tile.height);
          if (rightPts.length === 0) {
            rightPts.push({ x: sx + cameraOrigin.x, y: sy + cameraOrigin.y });
          }
          rightPts.push({ x: sx + cameraOrigin.x + TILE_W_HALF, y: sy + cameraOrigin.y + TILE_H_HALF });
          break;
        }
      }
    }
    if (rightPts.length > 1) {
      const rColors = wallPanelColors(tileHsb, 'right');
      const lastPt = rightPts[rightPts.length - 1];
      // Outline only (front face fill is in pre-floor drawWallPanels)
      ctx.strokeStyle = rColors.outline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y + floorOverlap);
      ctx.lineTo(lastPt.x, lastPt.y - WALL_HEIGHT);
      for (let i = rightPts.length - 2; i >= 0; i--) {
        ctx.lineTo(rightPts[i].x, rightPts[i].y - WALL_HEIGHT);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightPts[0].x - capD, rightPts[0].y - WALL_HEIGHT + capD / 2);
      for (let i = 1; i < rightPts.length; i++) {
        ctx.lineTo(rightPts[i].x - capD, rightPts[i].y - WALL_HEIGHT + capD / 2);
      }
      ctx.lineTo(lastPt.x - capD, lastPt.y + floorOverlap + capD / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightPts[0].x, rightPts[0].y);
      ctx.lineTo(rightPts[0].x, rightPts[0].y - WALL_HEIGHT);
      ctx.stroke();
    }
  }
}
