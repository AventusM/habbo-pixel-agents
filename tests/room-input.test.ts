// tests/room-input.test.ts
// M008/S04 T01 — locks the pointer→tile input extraction.
//
// The suite runs in the `node` environment (no React DOM / renderHook), so these
// are source-level guards in the style of tests/store-wiring.test.ts:
//   1. src/hooks/useRoomInput.ts exists and exports the mapping callbacks.
//   2. The mapping bodies moved out of RoomCanvas (no `function mouseToTile`).
//   3. RoomCanvas consumes the hook and hands stable callbacks to CanvasStage.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const HOOK_PATH = join(SRC, 'hooks', 'useRoomInput.ts');

describe('useRoomInput module contract', () => {
  it('exists as the extracted hook module', () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it('exports useRoomInput and the shared RoomRenderState type', () => {
    const src = read('hooks/useRoomInput.ts');
    expect(src).toMatch(/export function useRoomInput/);
    expect(src).toMatch(/export interface RoomRenderState/);
  });

  it('owns the mouse→tile / hover mapping and its math', () => {
    const src = read('hooks/useRoomInput.ts');
    expect(src).toContain('mouseToTile');
    expect(src).toContain('updateHover');
    expect(src).toContain('onHoverEnd');
    expect(src).toContain('screenToWorld');
    expect(src).toContain('screenToTile');
  });

  it('returns useCallback-stable callbacks (frame path must not re-create them)', () => {
    const src = read('hooks/useRoomInput.ts');
    // Three useCallback wrappers: mouseToTile, updateHover, onHoverEnd.
    expect(src.match(/useCallback\(/g)?.length).toBe(3);
  });
});

describe('RoomCanvas input extraction', () => {
  it('no longer defines the mapping functions inline', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).not.toMatch(/function mouseToTile/);
    expect(src).not.toMatch(/function updateHover/);
  });

  it('consumes useRoomInput and wires its callbacks into CanvasStage', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).toMatch(/import\s*\{[^}]*useRoomInput[^}]*\}\s*from\s*'\.\/hooks\/useRoomInput\.js'/);
    expect(src).toMatch(/useRoomInput\s*\(\s*\{/);
    expect(src).toMatch(/onHover:\s*updateHover/);
    expect(src).toMatch(/onHoverEnd[,:]/);
  });
});
