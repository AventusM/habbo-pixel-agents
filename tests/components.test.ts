// tests/components.test.ts
// M008/S02 T05 — presentational purity + render-parity guards for the chrome
// components extracted under the D021 convention.
//
// Two contracts are locked here:
//   1. Purity: every chrome component under src/components/ imports no
//      stores/clients/host modules and makes no network calls (props in,
//      JSX out — local UI state only).
//   2. Parity: each pure render surface still produces the same output the
//      shell used to inline (chip label, full-bleed canvas, editor entry +
//      panel gated by the shell-owned open flag).
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
import { LayoutEditorPanel } from '../src/LayoutEditorPanel.js';
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

  const baseProps = {
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
  };

  it('renders the floating Room Editor toggle as the entry point when closed', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomDevChrome, {
        ...baseProps,
        editorOpen: false,
        onEditorToggle: () => undefined,
      }),
    );
    expect(html).toContain('Room Editor');
    expect(html).toContain('position:fixed');
    expect(html).not.toContain('Save Layout');
  });

  it('renders the full editor panel when open (modes, IO, rotate)', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoomDevChrome, {
        ...baseProps,
        editorOpen: true,
        onEditorToggle: () => undefined,
      }),
    );
    for (const label of ['View', 'Paint', 'Color', 'Furniture', 'Save Layout', 'Load Layout']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('data-room-editor="true"');
  });

  it('gates dev-only affordances on devMode', () => {
    const closed = renderToStaticMarkup(
      React.createElement(RoomDevChrome, {
        ...baseProps,
        editorOpen: true,
        onEditorToggle: () => undefined,
      }),
    );
    expect(closed).not.toContain('Dev Capture');

    const dev = renderToStaticMarkup(
      React.createElement(RoomDevChrome, {
        ...baseProps,
        editorOpen: true,
        onEditorToggle: () => undefined,
        devMode: true,
      }),
    );
    expect(dev).toContain('Dev Capture');
  });

  it('passes the shell debug-entry callback through to the panel', () => {
    const onOpenDebug = vi.fn();
    const tree = RoomDevChrome({
      ...baseProps,
      editorOpen: true,
      onEditorToggle: vi.fn(),
      devMode: true,
      onOpenDebug,
    });
    const elements = collectElements(tree);
    const panel = elements.find((el) => el.type === LayoutEditorPanel);
    expect(panel?.props.onOpenDebug).toBe(onOpenDebug);
    expect(panel?.props.onDebugGrid).toBeUndefined();
  });

  it('invokes the shell callbacks (toggle + mode change)', () => {
    const onEditorToggle = vi.fn();
    const onModeChange = vi.fn();
    const tree = RoomDevChrome({
      ...baseProps,
      editorOpen: true,
      onEditorToggle,
      onModeChange,
    });
    const elements = collectElements(tree);

    const toggle = elements.find((el) => el.props['aria-expanded'] !== undefined);
    (toggle?.props.onClick as () => void)();
    expect(onEditorToggle).toHaveBeenCalledTimes(1);

    // The panel receives the shell callbacks unchanged (identity, not a copy).
    const panel = elements.find((el) => el.type === LayoutEditorPanel);
    expect(panel?.props.onModeChange).toBe(onModeChange);
    expect(panel?.props.onClose).toBe(onEditorToggle);
  });
});

describe('LayoutEditorPanel furniture affordances', () => {
  const baseProps = {
    editorMode: 'furniture' as EditorMode,
    onModeChange: () => undefined,
    selectedColor: { h: 0, s: 0, b: 100 } as HsbColor,
    onColorChange: () => undefined,
    selectedFurniture: 'hc_chr',
    onFurnitureChange: () => undefined,
    furnitureDirection: 0,
    onRotate: () => undefined,
    onSave: () => undefined,
    onLoad: () => undefined,
    onClose: () => undefined,
  };

  it('shows the selected-item indicator, Move and Delete with the key hint', () => {
    const html = renderToStaticMarkup(
      React.createElement(LayoutEditorPanel, {
        ...baseProps,
        selectedPlacement: {
          id: 'f1',
          kind: 'single' as const,
          name: 'chair',
          tileX: 2,
          tileY: 3,
          tileZ: 0,
        },
        onMoveSelected: () => undefined,
        onDeleteSelected: () => undefined,
      }),
    );
    expect(html).toContain('data-selected-furniture="true"');
    expect(html).toContain('chair');
    expect(html).toContain('data-move-selected="true"');
    expect(html).toContain('data-delete-selected="true"');
    expect(html).toContain('Delete / Backspace');
  });

  it('shows a select prompt and no affordances when nothing is selected', () => {
    const html = renderToStaticMarkup(React.createElement(LayoutEditorPanel, baseProps));
    expect(html).not.toContain('data-selected-furniture="true"');
    expect(html).not.toContain('data-delete-selected="true"');
    expect(html).toContain('Click a placed item to select it');
  });
});

describe('LayoutEditorPanel wall color control', () => {
  const baseProps = {
    editorMode: 'view' as EditorMode,
    onModeChange: () => undefined,
    selectedColor: { h: 0, s: 0, b: 100 } as HsbColor,
    onColorChange: () => undefined,
    selectedFurniture: 'hc_chr',
    onFurnitureChange: () => undefined,
    furnitureDirection: 0,
    onRotate: () => undefined,
    onSave: () => undefined,
    onLoad: () => undefined,
    onClose: () => undefined,
  };

  it('renders the per-section wall color control when sections are provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(LayoutEditorPanel, {
        ...baseProps,
        wallColorSections: [{ id: 'planning', label: 'Planning' }],
        wallColors: {},
        onWallColorChange: () => undefined,
        onWallColorClear: () => undefined,
      }),
    );
    expect(html).toContain('data-wall-color-control="true"');
    expect(html).toContain('Wall Color');
    expect(html).toContain('Planning');
    expect(html).toContain('data-wall-color-clear="true"');
  });

  it('omits the wall color control without sections', () => {
    const html = renderToStaticMarkup(React.createElement(LayoutEditorPanel, baseProps));
    expect(html).not.toContain('data-wall-color-control="true"');
  });
});

describe('LayoutEditorPanel debug entry (M009/S03)', () => {
  const baseProps = {
    editorMode: 'view' as EditorMode,
    onModeChange: () => undefined,
    selectedColor: { h: 0, s: 0, b: 100 } as HsbColor,
    onColorChange: () => undefined,
    selectedFurniture: 'hc_chr',
    onFurnitureChange: () => undefined,
    furnitureDirection: 0,
    onRotate: () => undefined,
    onSave: () => undefined,
    onLoad: () => undefined,
    onClose: () => undefined,
  };

  it('renders the Debug Surfaces entry in dev mode with a wired click handler', () => {
    const html = renderToStaticMarkup(
      React.createElement(LayoutEditorPanel, {
        ...baseProps,
        devMode: true,
        onDevCapture: () => undefined,
        onOpenDebug: () => undefined,
      }),
    );
    expect(html).toContain('data-open-debug="true"');
    expect(html).toContain('Debug Surfaces');
  });

  it('keeps the debug entry hidden outside dev mode', () => {
    const html = renderToStaticMarkup(
      React.createElement(LayoutEditorPanel, {
        ...baseProps,
        onOpenDebug: () => undefined,
      }),
    );
    expect(html).not.toContain('data-open-debug="true"');
    expect(html).not.toContain('Debug Surfaces');
  });

  it('renders the debug entry even without a dev-capture handler', () => {
    const html = renderToStaticMarkup(
      React.createElement(LayoutEditorPanel, {
        ...baseProps,
        devMode: true,
        onOpenDebug: () => undefined,
      }),
    );
    expect(html).toContain('data-open-debug="true"');
    expect(html).not.toContain('Dev Capture');
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
    onExportOutfits: () => undefined,
    onImportOutfitsFile: () => undefined,
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
    expect(html).toContain('data-pixellab-notice="true"');
    expect(html).toContain('PixelLab agents are out of scope');
    expect(html).toContain('data-export-outfits="true"');
    expect(html).toContain('data-import-outfits="true"');
    expect(html).toContain('data-import-outfits-input="true"');
  });

  it('invokes the supplied callbacks with the expected values', () => {
    const onSelectRole = vi.fn();
    const onSelectShirtColor = vi.fn();
    const onSelectHairColor = vi.fn();
    const onSelectHair = vi.fn();
    const onResetRole = vi.fn();
    const onExportOutfits = vi.fn();
    const onImportOutfitsFile = vi.fn();
    const tree = CharacterEditorPanel({
      ...baseProps,
      onSelectRole,
      onSelectShirtColor,
      onSelectHairColor,
      onSelectHair,
      onResetRole,
      onExportOutfits,
      onImportOutfitsFile,
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

    const exportButton = elements.find((el) => el.props['data-export-outfits'] === 'true');
    (exportButton?.props.onClick as () => void)();
    expect(onExportOutfits).toHaveBeenCalledTimes(1);

    const importInput = elements.find((el) => el.props['data-import-outfits-input'] === 'true');
    const importFile = { name: 'outfits.json' } as File;
    (importInput?.props.onChange as (e: unknown) => void)({ target: { files: [importFile] } });
    expect(onImportOutfitsFile).toHaveBeenCalledWith(importFile);
  });
});
