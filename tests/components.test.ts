// tests/components.test.ts
// M008/S02 T05 — presentational purity + render-parity guards for the chrome
// components extracted under the D021 convention.
//
// Two contracts are locked here:
//   1. Purity: every chrome component under src/components/ imports no
//      stores/clients/host modules and makes no network calls (props in,
//      JSX out — local UI state only).
//   2. Parity: each pure render surface still produces the same output the
//      shell used to inline (chip label, full-bleed canvas, dead dev gate).
//
// Rendering goes through react-dom/server so the suite stays in the existing
// `node` vitest environment with no new dependencies or config changes.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KanbanFilterChip } from '../src/components/KanbanFilterChip.js';
import { RoomStage } from '../src/components/RoomStage.js';
import { RoomDevChrome } from '../src/components/RoomDevChrome.js';
import type { EditorMode } from '../src/isoLayoutEditor.js';
import type { HsbColor } from '../src/isoTypes.js';

const COMPONENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');

const COMPONENT_FILES = ['KanbanFilterChip.tsx', 'RoomStage.tsx', 'RoomDevChrome.tsx'] as const;

function readComponent(name: string): string {
  return readFileSync(join(COMPONENTS_DIR, name), 'utf8');
}

describe('src/components purity (no stores/clients, no app logic)', () => {
  const forbidden: Array<readonly [label: string, pattern: RegExp]> = [
    ['store import', /from\s+['"][^'"]*\/state\//],
    ['wsClient import', /from\s+['"][^'"]*wsClient/],
    ['githubProjects import', /from\s+['"][^'"]*githubProjects/],
    ['azureDevOpsBoards import', /from\s+['"][^'"]*azureDevOpsBoards/],
    ['host-only import', /from\s+['"](?:vscode|node:)/],
    ['fetch call', /\bfetch\s*\(/],
    ['WebSocket call', /new\s+WebSocket\s*\(/],
    ['XMLHttpRequest call', /new\s+XMLHttpRequest\s*\(/],
  ];

  it.each(COMPONENT_FILES)('%s imports no stores/clients and makes no network calls', (name) => {
    const source = readComponent(name);
    for (const [label, pattern] of forbidden) {
      expect(pattern.test(source), `${name} must not contain a ${label}`).toBe(false);
    }
  });
});

describe('KanbanFilterChip render parity', () => {
  it('renders the active filter label verbatim (props in, JSX out)', () => {
    const html = renderToStaticMarkup(
      React.createElement(KanbanFilterChip, { label: 'GSD only' }),
    );
    expect(html).toContain('Kanban:');
    expect(html).toContain('GSD only');
    expect(html).toContain('press G');
    expect(html).toContain('position:fixed');
  });

  it('echoes whatever label the shell derives', () => {
    const html = renderToStaticMarkup(React.createElement(KanbanFilterChip, { label: 'All' }));
    expect(html).toContain('Kanban:');
    expect(html).toContain('All');
  });
});

describe('RoomStage render parity', () => {
  it('renders a full-bleed canvas wired to the shell handlers', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomStage, {
        canvasRef: React.createRef<HTMLCanvasElement>(),
        onClick: () => undefined,
        onContextMenu: () => undefined,
      }),
    );
    expect(html).toContain('<canvas');
    expect(html).toContain('width:100%');
    expect(html).toContain('height:100%');
    expect(html).toContain('touch-action:none');
  });
});

describe('RoomDevChrome render parity', () => {
  const editorMode: EditorMode = 'view';
  const selectedColor: HsbColor = { h: 0, s: 0, b: 100 };

  it('keeps the dev panel dead-gated: no visible chrome is emitted', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomDevChrome, {
        editorMode,
        onModeChange: () => undefined,
        selectedColor,
        onColorChange: () => undefined,
        selectedFurniture: '',
        onFurnitureChange: () => undefined,
        furnitureDirection: 0,
        devMode: false,
        onDevCapture: () => undefined,
        onPlaySound: () => undefined,
        availableSounds: [],
        onRotate: () => undefined,
        onSave: () => undefined,
        onLoad: () => undefined,
      }),
    );
    expect(html).toBe('');
  });
});
