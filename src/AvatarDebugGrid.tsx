// src/AvatarDebugGrid.tsx
// Debug matrix: renders directions × poses (idle + walk frames) for a chosen
// role outfit on a single canvas. Surfaced from the room editor debug entry
// (embedded) and from the standalone ?debuggrid=1 route (full-screen).

import React, { useRef, useEffect, useState } from 'react';
import type { OutfitConfig } from './avatarOutfitConfig.js';
import type { SpriteCache } from './isoSpriteCache.js';
import { tileToScreen } from './isometricMath.js';
import { createNitroAvatarRenderable, setDebugAvatarParts } from './isoAvatarRenderer.js';
import {
  buildDebugAvatarSpec,
  buildSpritesheetCells,
  DEFAULT_DEBUG_DIRECTION_SET_ID,
  DEBUG_POSES,
  getDebugDirectionSet,
  type AvatarDirection,
  type DebugPose,
} from './debugSurfacesModel.js';

const CELL_W = 100;
const CELL_H = 120;
const LABEL_W = 40;
const LABEL_H = 20;
const BG_COLOR = '#1a1a2e';

const DEFAULT_DIRECTIONS = getDebugDirectionSet(DEFAULT_DEBUG_DIRECTION_SET_ID).directions;

export interface AvatarDebugGridProps {
  onClose?: () => void;
  spriteCache: SpriteCache | null;
  /** Role outfit drawn in every cell; without one the variant palette is used. */
  outfit?: OutfitConfig;
  directions?: readonly AvatarDirection[];
  poses?: readonly DebugPose[];
  /** Render the matrix inline (host supplies the overlay chrome) instead of full-screen. */
  embedded?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0,0,0,0.85)',
  zIndex: 2000,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  overflow: 'auto',
  padding: '20px',
  boxSizing: 'border-box',
};

const headerStyle: React.CSSProperties = {
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '14px',
  marginBottom: '10px',
  display: 'flex',
  gap: '20px',
  alignItems: 'center',
};

const embeddedStyle: React.CSSProperties = { marginTop: 8 };

const embeddedHeaderStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  marginBottom: 6,
  opacity: 0.9,
};

const closeButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  cursor: 'pointer',
  backgroundColor: '#c33',
  color: '#fff',
  border: 'none',
  borderRadius: '3px',
};

const canvasStyle: React.CSSProperties = { imageRendering: 'pixelated' };

const unavailableStyle: React.CSSProperties = {
  padding: '12px 8px',
  border: '1px dashed rgba(148, 163, 184, 0.5)',
  borderRadius: 4,
  opacity: 0.8,
  font: '12px/1.4 monospace',
  color: '#e2e8f0',
};

export function AvatarDebugGrid({
  onClose,
  spriteCache,
  outfit,
  directions = DEFAULT_DIRECTIONS,
  poses = DEBUG_POSES,
  embedded = false,
}: AvatarDebugGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showBorders, setShowBorders] = useState(false);
  const available = spriteCache !== null && spriteCache.hasNitroAsset('hh_human_body');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spriteCache || !spriteCache.hasNitroAsset('hh_human_body')) return;

    setDebugAvatarParts(showBorders);

    const cols = poses.length;
    const rows = directions.length;
    const totalW = LABEL_W + cols * CELL_W + 20;
    const totalH = rows * CELL_H + LABEL_H + 20;

    canvas.width = totalW;
    canvas.height = totalH;
    canvas.style.width = `${totalW}px`;
    canvas.style.height = `${totalH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, totalW, totalH);

    const tileOrigin = tileToScreen(0, 0, 0);

    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (let c = 0; c < cols; c++) {
      ctx.fillText(poses[c].label, LABEL_W + c * CELL_W + CELL_W / 2, 14);
    }

    const cells = buildSpritesheetCells(directions, poses);
    for (let row = 0; row < rows; row++) {
      const dir = directions[row];
      const cellY = LABEL_H + row * CELL_H;

      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`dir ${dir}`, LABEL_W - 6, cellY + CELL_H / 2 + 4);

      for (let col = 0; col < cols; col++) {
        const cell = cells[row * cols + col];
        const cellX = LABEL_W + col * CELL_W;

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, CELL_W, CELL_H);

        const spec = buildDebugAvatarSpec(
          `debug-${cell.id}`,
          cell.direction,
          cell.state,
          cell.frame,
          outfit,
        );
        const renderable = createNitroAvatarRenderable(spec, spriteCache);
        if (!renderable) continue;

        const centerX = cellX + CELL_W / 2 - tileOrigin.x;
        const centerY = cellY + CELL_H * 0.65 - tileOrigin.y;

        ctx.save();
        ctx.translate(centerX, centerY);
        renderable.draw(ctx);
        ctx.restore();
      }
    }

    setDebugAvatarParts(false);
  }, [showBorders, spriteCache, outfit, directions, poses]);

  const bordersToggle = (
    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={showBorders}
        onChange={(e) => setShowBorders(e.target.checked)}
        data-debug-borders="true"
      />
      Part borders
    </label>
  );

  const matrix = available ? (
    <canvas ref={canvasRef} style={canvasStyle} data-spritesheet-matrix="true" />
  ) : (
    <div style={unavailableStyle} data-avatar-debug-grid-fallback="true">
      spritesheet matrix unavailable — figure assets not loaded
    </div>
  );

  if (embedded) {
    return (
      <div style={embeddedStyle} data-avatar-debug-grid="true">
        <div style={embeddedHeaderStyle}>
          {bordersToggle}
        </div>
        {matrix}
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose} data-avatar-debug-grid="true">
      <div style={headerStyle} onClick={(e) => e.stopPropagation()}>
        <span>Avatar Walk Debug Grid</span>
        {bordersToggle}
        {onClose && (
          <button type="button" onClick={onClose} style={closeButtonStyle} data-debug-close="true">
            Close
          </button>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()}>{matrix}</div>
    </div>
  );
}
