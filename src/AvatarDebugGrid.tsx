// src/AvatarDebugGrid.tsx
// Debug overlay: renders all 8 directions × 4 walk frames on a single canvas
// Triggered from dev mode panel — screenshot this to diagnose animation artifacts

import React, { useRef, useEffect, useState } from 'react';
import type { AvatarSpec } from './isoAvatarRenderer.js';
import { createNitroAvatarRenderable, setDebugAvatarParts } from './isoAvatarRenderer.js';
import { tileToScreen } from './isometricMath.js';
import type { SpriteCache } from './isoSpriteCache.js';

const CELL_W = 100;
const CELL_H = 120;
const DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const WALK_FRAMES = [0, 1, 2, 3];
const LABEL_H = 20;

interface AvatarDebugGridProps {
  onClose: () => void;
}

export function AvatarDebugGrid({ onClose }: AvatarDebugGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showBorders, setShowBorders] = useState(false);

  useEffect(() => {
    renderGrid(showBorders);
  }, [showBorders]);

  function renderGrid(borders: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const spriteCache: SpriteCache | undefined = (window as any).spriteCache;
    if (!spriteCache || !spriteCache.hasNitroAsset('hh_human_body')) return;

    setDebugAvatarParts(borders);

    const cols = WALK_FRAMES.length + 1; // +1 for idle column
    const rows = DIRECTIONS.length;
    const totalW = cols * CELL_W + 40;
    const totalH = rows * CELL_H + LABEL_H + 20;

    canvas.width = totalW;
    canvas.height = totalH;
    canvas.style.width = `${totalW}px`;
    canvas.style.height = `${totalH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, totalW, totalH);

    const tileOrigin = tileToScreen(0, 0, 0);

    // Column headers
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('idle', 40 + 0 * CELL_W + CELL_W / 2, 14);
    for (let f = 0; f < WALK_FRAMES.length; f++) {
      ctx.fillText(`wlk_${f}`, 40 + (f + 1) * CELL_W + CELL_W / 2, 14);
    }

    for (let row = 0; row < DIRECTIONS.length; row++) {
      const dir = DIRECTIONS[row];
      const cellY = LABEL_H + row * CELL_H;

      // Row label
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`dir ${dir}`, 34, cellY + CELL_H / 2 + 4);

      const states: Array<{ state: 'idle' | 'walk'; frame: number }> = [
        { state: 'idle', frame: 0 },
        ...WALK_FRAMES.map(f => ({ state: 'walk' as const, frame: f })),
      ];

      for (let col = 0; col < states.length; col++) {
        const { state, frame } = states[col];
        const cellX = 40 + col * CELL_W;

        // Cell border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, CELL_W, CELL_H);

        const spec: AvatarSpec = {
          id: 'debug',
          tileX: 0,
          tileY: 0,
          tileZ: 0,
          direction: dir,
          variant: 0,
          state,
          frame,
          lastUpdateMs: 0,
          nextBlinkMs: Infinity,
          blinkFrame: 0,
          spawnProgress: 0,
        };

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

    // Always restore to false so normal rendering isn't affected
    setDebugAvatarParts(false);
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

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={headerStyle} onClick={e => e.stopPropagation()}>
        <span>Avatar Walk Debug Grid</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showBorders}
            onChange={e => setShowBorders(e.target.checked)}
          />
          Part borders
        </label>
        <button
          onClick={onClose}
          style={{
            padding: '4px 12px',
            cursor: 'pointer',
            backgroundColor: '#c33',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
          }}
        >
          Close
        </button>
      </div>
      <canvas ref={canvasRef} onClick={e => e.stopPropagation()} />
    </div>
  );
}
