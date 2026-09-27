// tests/room-furniture-editor.test.ts
// M009/S02 T02 — locks the furniture-editor interaction extraction.
//
// `node`-environment source-level guards (tests/room-interaction.test.ts style):
//   1. src/hooks/useRoomFurnitureEditor.ts exists and drives the engine ops.
//   2. src/hooks/useRoomEditorKeyboard.ts binds Delete/Backspace with cleanup.
//   3. RoomCanvas consumes both hooks and routes pointer events to RoomStage.
//   4. useRoomInteraction no longer owns furniture placement.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

describe('useRoomFurnitureEditor module contract', () => {
  it('exists as the extracted hook module', () => {
    expect(existsSync(join(SRC, 'hooks', 'useRoomFurnitureEditor.ts'))).toBe(true);
  });

  it('exports the hook and the pointer handlers', () => {
    const src = read('hooks/useRoomFurnitureEditor.ts');
    expect(src).toMatch(/export function useRoomFurnitureEditor/);
    for (const handler of [
      'onFurnitureMouseDown',
      'onFurnitureMouseMove',
      'onFurnitureMouseUp',
      'onFurnitureMouseLeave',
      'deleteSelected',
    ]) {
      expect(src).toContain(handler);
    }
  });

  it('drives the layout-editor engine ops', () => {
    const src = read('hooks/useRoomFurnitureEditor.ts');
    for (const op of ['findFurnitureAtTile', 'moveFurniture', 'deleteFurniture', 'placeFurniture']) {
      expect(src).toContain(op);
    }
  });

  it('wraps its handlers in useCallback for stable prop identities', () => {
    const src = read('hooks/useRoomFurnitureEditor.ts');
    expect((src.match(/useCallback\(/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});

describe('useRoomEditorKeyboard module contract', () => {
  it('exists and binds Delete/Backspace with cleanup', () => {
    expect(existsSync(join(SRC, 'hooks', 'useRoomEditorKeyboard.ts'))).toBe(true);
    const src = read('hooks/useRoomEditorKeyboard.ts');
    expect(src).toMatch(/export function useRoomEditorKeyboard/);
    expect(src).toContain('Delete');
    expect(src).toContain('Backspace');
    expect(src).toContain('addEventListener');
    expect(src).toContain('removeEventListener');
  });
});

describe('RoomCanvas furniture-editor wiring', () => {
  it('consumes both hooks', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).toMatch(/useRoomFurnitureEditor\(\{/);
    expect(src).toMatch(/useRoomEditorKeyboard\(\{/);
  });

  it('routes furniture pointer handlers into RoomStage', () => {
    const src = read('RoomCanvas.tsx');
    for (const prop of ['onMouseDown', 'onMouseMove', 'onMouseUp', 'onMouseLeave']) {
      expect(src).toContain(`${prop}={furnitureEditor.`);
    }
  });

  it('keeps selection state in the shell', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).toContain('selectedFurnitureInfo');
    expect(src).toContain('moveArmed');
  });
});

describe('useRoomInteraction delegation', () => {
  it('no longer places furniture (ownership moved to useRoomFurnitureEditor)', () => {
    const src = read('hooks/useRoomInteraction.ts');
    expect(src).not.toContain('placeFurniture');
    expect(src).toContain('useRoomFurnitureEditor');
  });
});
