// tests/avatarDebugGrid.test.ts
// M009/S03 — structural guards for the spritesheet matrix surface: the
// standalone ?debuggrid=1 chrome is preserved, embedded mode drops the overlay
// chrome and close control, and an empty cache degrades to a visible fallback.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AvatarDebugGrid } from '../src/AvatarDebugGrid.js';
import type { SpriteCache } from '../src/isoSpriteCache.js';

const stubCache = {
  hasNitroAsset: (name: string) => name === 'hh_human_body',
} as unknown as SpriteCache;

describe('AvatarDebugGrid (M009/S03)', () => {
  it('keeps the standalone full-screen chrome with a close control', () => {
    const html = renderToStaticMarkup(
      React.createElement(AvatarDebugGrid, { spriteCache: stubCache, onClose: () => undefined }),
    );
    expect(html).toContain('Avatar Walk Debug Grid');
    expect(html).toContain('data-avatar-debug-grid="true"');
    expect(html).toContain('data-spritesheet-matrix="true"');
    expect(html).toContain('data-debug-borders="true"');
    expect(html).toContain('data-debug-close="true"');
  });

  it('renders embedded without overlay chrome or its own close control', () => {
    const html = renderToStaticMarkup(
      React.createElement(AvatarDebugGrid, { spriteCache: stubCache, embedded: true }),
    );
    expect(html).toContain('data-avatar-debug-grid="true"');
    expect(html).toContain('data-spritesheet-matrix="true"');
    expect(html).not.toContain('data-debug-close="true"');
    expect(html).not.toContain('position:fixed');
  });

  it('shows a fallback instead of a canvas without the figure cache', () => {
    const html = renderToStaticMarkup(
      React.createElement(AvatarDebugGrid, { spriteCache: null }),
    );
    expect(html).toContain('data-avatar-debug-grid-fallback="true"');
    expect(html).not.toContain('data-spritesheet-matrix="true"');
  });
});
