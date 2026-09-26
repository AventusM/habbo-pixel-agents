// src/components/AvatarPreview.tsx
// Presentational live preview canvas (M006/S02, D021 convention). Props in, JSX
// out: it takes an OutfitConfig draft and the room's SpriteCache and redraws
// through the shared Nitro preview helper whenever the draft reference changes,
// so shirt/hair edits update immediately. It imports no stores/clients — only the
// pure render helper and types — so it stays under the components purity guard.
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { OutfitConfig } from '../avatarOutfitConfig.js';
import type { SpriteCache } from '../isoSpriteCache.js';
import { buildPreviewSpec, drawAvatarPreview, hasPreviewAssets } from '../render/avatarPreview.js';

const fallbackStyle: CSSProperties = {
  marginTop: 8,
  padding: '12px 8px',
  border: '1px dashed rgba(148, 163, 184, 0.5)',
  borderRadius: 4,
  textAlign: 'center',
  opacity: 0.8,
};

export interface AvatarPreviewProps {
  outfit: OutfitConfig;
  spriteCache: SpriteCache | null;
  width?: number;
  height?: number;
}

export function AvatarPreview({
  outfit,
  spriteCache,
  width = 90,
  height = 120,
}: AvatarPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const available = hasPreviewAssets(spriteCache);

  useEffect(() => {
    if (!available || !spriteCache) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawAvatarPreview(ctx, buildPreviewSpec(outfit), spriteCache, {
      clearWidth: width,
      clearHeight: height,
    });
  }, [available, outfit, spriteCache, width, height]);

  if (!available) {
    return <div style={fallbackStyle}>preview unavailable</div>;
  }

  return (
    <div style={{ marginTop: 8, textAlign: 'center' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
