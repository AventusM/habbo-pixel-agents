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

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KanbanFilterChip } from '../src/components/KanbanFilterChip.js';
import { RoomStage } from '../src/components/RoomStage.js';
import { RoomDevChrome } from '../src/components/RoomDevChrome.js';
import { CharacterEditorPanel } from '../src/components/CharacterEditorPanel.js';
import type { CharacterEditorPanelProps } from '../src/components/CharacterEditorPanel.js';
import type { CatalogItem } from '../src/avatarOutfitConfig.js';
import { FIGURE_CATALOG } from '../src/avatarOutfitConfig.js';
import type { TeamSection } from '../src/agentTypes.js';
import type { EditorMode } from '../src/isoLayoutEditor.js';
import type { HsbColor } from '../src/isoTypes.js';

const COMPONENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');

const COMPONENT_FILES = [
  'KanbanFilterChip.tsx',
  'RoomStage.tsx',
  'RoomDevChrome.tsx',
  'CharacterEditorPanel.tsx',
  'AvatarPreview.tsx',
] as const;

/** Recursively collect a JSX element tree so tests can invoke handlers directly. */
interface TestElement {
  type: unknown;
  props: Record<string, unknown>;
}

function collectElements(node: unknown, out: TestElement[] = []): TestElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collectElements(child, out);
    return out;
  }
  if (node && typeof node === 'object' && 'props' in node) {
    const element = node as TestElement;
    out.push(element);
    collectElements(element.props.children, out);
  }
  return out;
}

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

describe('CharacterEditorPanel render + handler parity', () => {
  const roles: TeamSection[] = ['planning', 'core-dev', 'infrastructure', 'support'];
  const hairOptions = FIGURE_CATALOG.filter((item) => item.category === 'hair');
  const firstHair: CatalogItem = hairOptions[0];
  const secondHair: CatalogItem = hairOptions[1];
  const shirtColors = ['#FFFFFF', '#FF8C00', '#3B5998'];
  const hairColors = ['#1A1A1A', '#C4651A'];

  const baseProps: CharacterEditorPanelProps = {
    roles,
    activeRole: 'core-dev',
    onSelectRole: () => undefined,
    hairOptions,
    selectedHairPart: { asset: firstHair.asset, setId: firstHair.setId },
    onSelectHair: () => undefined,
    hairColors,
    selectedHairColor: hairColors[0],
    onSelectHairColor: () => undefined,
    shirtColors,
    selectedShirtColor: shirtColors[0],
    onSelectShirtColor: () => undefined,
    onResetRole: () => undefined,
  };

  it('renders the four role labels and the swatch/selector surfaces', () => {
    const html = renderToStaticMarkup(React.createElement(CharacterEditorPanel, baseProps));
    for (const label of ['Planning', 'Core Dev', 'Infrastructure', 'Support']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('Character Editor');
    expect(html).toContain('data-swatch="#FF8C00"');
    expect(html).toContain('data-hair-swatch="#C4651A"');
    expect(html).toContain('data-hair-select="true"');
    expect(html).toContain('Reset Core Dev');
  });

  it('invokes the supplied callbacks with the expected values', () => {
    const onSelectRole = vi.fn();
    const onSelectShirtColor = vi.fn();
    const onSelectHairColor = vi.fn();
    const onSelectHair = vi.fn();
    const onResetRole = vi.fn();
    const tree = CharacterEditorPanel({
      ...baseProps,
      onSelectRole,
      onSelectShirtColor,
      onSelectHairColor,
      onSelectHair,
      onResetRole,
    });
    const elements = collectElements(tree);

    const roleButton = elements.find((el) => el.props['data-role'] === 'support');
    (roleButton?.props.onClick as () => void)();
    expect(onSelectRole).toHaveBeenCalledWith('support');

    const shirtSwatch = elements.find((el) => el.props['data-swatch'] === '#FF8C00');
    (shirtSwatch?.props.onClick as () => void)();
    expect(onSelectShirtColor).toHaveBeenCalledWith('#FF8C00');

    const hairSwatch = elements.find((el) => el.props['data-hair-swatch'] === '#C4651A');
    (hairSwatch?.props.onClick as () => void)();
    expect(onSelectHairColor).toHaveBeenCalledWith('#C4651A');

    const hairSelect = elements.find((el) => el.props['data-hair-select'] === 'true');
    (hairSelect?.props.onChange as (e: unknown) => void)({ target: { value: secondHair.id } });
    expect(onSelectHair).toHaveBeenCalledWith(secondHair);

    const resetButton = elements.find((el) => el.props['data-reset'] === 'core-dev');
    (resetButton?.props.onClick as () => void)();
    expect(onResetRole).toHaveBeenCalledWith('core-dev');
  });
});
