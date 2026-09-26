// src/components/RoleOutfitMatrix.tsx
// Presentational role-outfit matrix (M009/S03, D021 convention): the four
// TeamSection roles (rows) × a small direction/pose set (columns), drawn as a
// canvas grid through the shared Nitro preview path. Props in, JSX out — no
// stores, no host APIs; the canvas redraws only when its inputs change.

import { useEffect, useRef, type CSSProperties } from 'react';
import type { SpriteCache } from '../isoSpriteCache.js';
import { tileToScreen } from '../isometricMath.js';
import { drawAvatarPreview, hasPreviewAssets } from '../render/avatarPreview.js';
import {
  buildDebugAvatarSpec,
  ROLE_MATRIX_COLUMNS,
  ROLE_OUTFIT_ROWS,
  type MatrixColumn,
  type RoleOutfitRow,
} from '../debugSurfacesModel.js';

const CELL_W = 96;
const CELL_H = 116;
const LABEL_W = 96;
const HEADER_H = 18;
const BG_COLOR = '#1a1a2e';

const wrapStyle: CSSProperties = { marginTop: 12 };
const canvasStyle: CSSProperties = { imageRendering: 'pixelated' };
const fallbackStyle: CSSProperties = {
  marginTop: 12,
  padding: '12px 8px',
  border: '1px dashed rgba(148, 163, 184, 0.5)',
  borderRadius: 4,
  opacity: 0.8,
};

export interface RoleOutfitMatrixProps {
  spriteCache: SpriteCache | null;
  rows?: readonly RoleOutfitRow[];
  columns?: readonly MatrixColumn[];
}

export function RoleOutfitMatrix({
  spriteCache,
  rows = ROLE_OUTFIT_ROWS,
  columns = ROLE_MATRIX_COLUMNS,
}: RoleOutfitMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const available = hasPreviewAssets(spriteCache);

  useEffect(() => {
    if (!available || !spriteCache) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const totalW = LABEL_W + columns.length * CELL_W;
    const totalH = HEADER_H + rows.length * CELL_H;
    canvas.width = totalW;
    canvas.height = totalH;
    canvas.style.width = `${totalW}px`;
    canvas.style.height = `${totalH}px`;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, totalW, totalH);
    const tileOrigin = tileToScreen(0, 0, 0);

    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (let c = 0; c < columns.length; c++) {
      ctx.fillText(columns[c].label, LABEL_W + c * CELL_W + CELL_W / 2, 12);
    }

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const cellY = HEADER_H + r * CELL_H;

      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(row.label, LABEL_W - 8, cellY + CELL_H / 2 + 4);

      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const cellX = LABEL_W + c * CELL_W;

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, CELL_W, CELL_H);

        const spec = buildDebugAvatarSpec(
          `role-${row.role}-${col.id}`,
          col.direction,
          col.state,
          col.frame,
          row.outfit,
        );
        const centerX = cellX + CELL_W / 2 - tileOrigin.x;
        const centerY = cellY + CELL_H * 0.65 - tileOrigin.y;

        ctx.save();
        ctx.translate(centerX, centerY);
        drawAvatarPreview(ctx, spec, spriteCache);
        ctx.restore();
      }
    }
  }, [available, spriteCache, rows, columns]);

  if (!available) {
    return (
      <div style={fallbackStyle} data-role-outfit-matrix-fallback="true">
        role outfit matrix unavailable — figure assets not loaded
      </div>
    );
  }

  return (
    <div
      style={wrapStyle}
      data-role-outfit-matrix="true"
      data-roles={rows.map((row) => row.role).join(',')}
    >
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
}
