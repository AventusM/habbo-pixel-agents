// tests/room-interaction.test.ts
// M008/S04 T03 — locks the click/context-menu interaction extraction.
//
// `node`-environment source-level guards (tests/store-wiring.test.ts style):
//   1. src/hooks/useRoomInteraction.ts exists and exports the two handlers.
//   2. The intricate bodies (note hit-testing, editor paint, chair sit rAF loop)
//      moved out of RoomCanvas.
//   3. RoomCanvas consumes the hook, feeding it the T01/T02 callbacks.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const HOOK_PATH = join(SRC, 'hooks', 'useRoomInteraction.ts');

describe('useRoomInteraction module contract', () => {
  it('exists as the extracted hook module', () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it('exports useRoomInteraction', () => {
    const src = read('hooks/useRoomInteraction.ts');
    expect(src).toMatch(/export function useRoomInteraction/);
  });

  it('preserves the branch-heavy interaction logic verbatim', () => {
    const src = read('hooks/useRoomInteraction.ts');
    expect(src).toContain('handleClick');
    expect(src).toContain('handleContextMenu');
    expect(src).toContain('pointInQuad');
    expect(src).toContain('noteHitAreas');
    expect(src).toContain('isChairType');
    expect(src).toContain('computeBlockedTiles');
    expect(src).toContain('checkSitArrival');
    expect(src).toContain('requestAnimationFrame');
  });

  it('wraps both handlers in useCallback', () => {
    const src = read('hooks/useRoomInteraction.ts');
    expect(src.match(/useCallback\(/g)?.length).toBe(2);
  });
});

describe('RoomCanvas interaction extraction', () => {
  it('no longer defines the handlers inline', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).not.toMatch(/const handleClick\s*=/);
    expect(src).not.toMatch(/const handleContextMenu\s*=/);
    expect(src).not.toContain('checkSitArrival');
  });

  it('consumes useRoomInteraction with the T01/T02 callbacks', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).toMatch(
      /import\s*\{[^}]*useRoomInteraction[^}]*\}\s*from\s*'\.\/hooks\/useRoomInteraction\.js'/,
    );
    expect(src).toMatch(/useRoomInteraction\(\{/);
    expect(src).toMatch(/mouseToTile,/);
    expect(src).toMatch(/reRenderRoom,/);
  });
});
