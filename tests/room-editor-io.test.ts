// tests/room-editor-io.test.ts
// M008/S04 T02 — locks the editor/dev IO extraction.
//
// `node`-environment source-level guards (same style as tests/store-wiring.test.ts):
//   1. src/hooks/useRoomEditorIO.ts exists and exports the IO callbacks.
//   2. The room-buffer/booth/save/load/capture bodies moved out of RoomCanvas.
//   3. RoomCanvas consumes the hook and still threads setBoothFrame into
//      useRoomAgents (ordering contract).

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const HOOK_PATH = join(SRC, 'hooks', 'useRoomEditorIO.ts');

describe('useRoomEditorIO module contract', () => {
  it('exists as the extracted hook module', () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it('exports useRoomEditorIO', () => {
    const src = read('hooks/useRoomEditorIO.ts');
    expect(src).toMatch(/export function useRoomEditorIO/);
  });

  it('owns the room-buffer render, booth frame and save/load/capture commands', () => {
    const src = read('hooks/useRoomEditorIO.ts');
    expect(src).toContain('renderRoomBuffer');
    expect(src).toContain('reRenderRoom');
    expect(src).toContain('setBoothFrame');
    expect(src).toContain('handleSave');
    expect(src).toContain('handleLoad');
    expect(src).toContain('handleDevCapture');
    expect(src).toContain('createFurnitureRenderables');
    expect(src).toContain('saveLayout');
    expect(src).toContain('loadLayout');
  });

  it('returns useCallback-stable callbacks', () => {
    const src = read('hooks/useRoomEditorIO.ts');
    expect(src.match(/useCallback\(/g)?.length).toBe(6);
  });
});

describe('useRoomEditorIO dev capture host branches', () => {
  it('keeps the VS Code postMessage path verbatim', () => {
    const src = read('hooks/useRoomEditorIO.ts');
    expect(src).toContain("vscodeApi.postMessage({ type: 'devCapture', screenshot, logs })");
  });

  it('falls back to browser downloads + clipboard when no VS Code host is present', () => {
    const src = read('hooks/useRoomEditorIO.ts');
    expect(src).toContain('buildDevCapturePayload');
    expect(src).toContain('triggerDownload');
    expect(src).toContain('downloadJson');
    expect(src).toContain('copyTextBestEffort');
    expect(src).toContain('window.__devLogBuffer');
  });
});

describe('RoomCanvas editor IO extraction', () => {
  it('no longer defines the IO functions inline', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).not.toMatch(/function renderRoomBuffer/);
    expect(src).not.toMatch(/function setBoothFrame/);
    expect(src).not.toMatch(/const handleSave\s*=/);
    expect(src).not.toMatch(/const handleLoad\s*=/);
    expect(src).not.toMatch(/const handleDevCapture\s*=/);
  });

  it('consumes useRoomEditorIO before useRoomAgents and passes setBoothFrame', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).toMatch(
      /import\s*\{[^}]*useRoomEditorIO[^}]*\}\s*from\s*'\.\/hooks\/useRoomEditorIO\.js'/,
    );
    const editorIoIdx = src.indexOf('useRoomEditorIO({');
    const agentsIdx = src.indexOf('useRoomAgents({');
    expect(editorIoIdx).toBeGreaterThan(-1);
    expect(agentsIdx).toBeGreaterThan(editorIoIdx);
    expect(src).toMatch(/setBoothFrame,/);
  });
});
