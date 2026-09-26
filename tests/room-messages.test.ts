// tests/room-messages.test.ts
// M008/S04 T04 — locks the message-bus dispatcher + kanban keyboard extraction.
//
// `node`-environment source-level guards (tests/store-wiring.test.ts style):
//   1. useRoomMessages.ts exists and dispatches every extension-message case.
//   2. useKanbanKeyboard.ts exists and owns the filter cycle + note traversal.
//   3. RoomCanvas no longer subscribes to the bus or binds the keyboard itself.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

const MESSAGE_CASES = [
  'clearAgents',
  'agentCreated',
  'agentRemoved',
  'agentStatus',
  'agentTool',
  'agentLinkedTicket',
  'jumpToSection',
  'toggleOverlay',
  'autoFollow',
  'kanbanCards',
  'devMode',
  'editorMode',
  'editorColor',
  'editorFurniture',
  'editorRotate',
  'editorSave',
  'editorLoad',
  'devCapture',
  'playSound',
] as const;

describe('useRoomMessages module contract', () => {
  it('exists and exports useRoomMessages', () => {
    expect(existsSync(join(SRC, 'hooks', 'useRoomMessages.ts'))).toBe(true);
    expect(read('hooks/useRoomMessages.ts')).toMatch(/export function useRoomMessages/);
  });

  it('dispatches every extension-message case', () => {
    const src = read('hooks/useRoomMessages.ts');
    for (const type of MESSAGE_CASES) {
      expect(src, `missing case ${type}`).toContain(`case '${type}':`);
    }
  });

  it('subscribes via onMessage and unsubscribes in cleanup', () => {
    const src = read('hooks/useRoomMessages.ts');
    expect(src).toContain('onMessage(handleExtensionMessage)');
    expect(src).toContain('return () => unsubscribe()');
  });
});

describe('useKanbanKeyboard module contract', () => {
  it('exists and exports useKanbanKeyboard', () => {
    expect(existsSync(join(SRC, 'hooks', 'useKanbanKeyboard.ts'))).toBe(true);
    expect(read('hooks/useKanbanKeyboard.ts')).toMatch(/export function useKanbanKeyboard/);
  });

  it('owns the filter cycle and note traversal keys', () => {
    const src = read('hooks/useKanbanKeyboard.ts');
    expect(src).toContain('cycleFilter');
    expect(src).toContain('ArrowRight');
    expect(src).toContain('ArrowLeft');
    expect(src).toContain('Escape');
    expect(src).toContain("addEventListener('keydown'");
    expect(src).toContain("removeEventListener('keydown'");
  });
});

describe('RoomCanvas message/keyboard extraction', () => {
  it('no longer subscribes to the bus or handles the message switch inline', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).not.toContain('onMessage(');
    expect(src).not.toContain("case 'clearAgents':");
    expect(src).not.toContain('handleExtensionMessage');
  });

  it('no longer binds the kanban keyboard itself', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).not.toContain('handleFilterKey');
    expect(src).not.toContain('cycleFilter');
  });

  it('consumes both hooks', () => {
    const src = read('RoomCanvas.tsx');
    expect(src).toMatch(
      /import\s*\{[^}]*useRoomMessages[^}]*\}\s*from\s*'\.\/hooks\/useRoomMessages\.js'/,
    );
    expect(src).toMatch(
      /import\s*\{[^}]*useKanbanKeyboard[^}]*\}\s*from\s*'\.\/hooks\/useKanbanKeyboard\.js'/,
    );
    expect(src).toMatch(/useRoomMessages\(\{/);
    expect(src).toMatch(/useKanbanKeyboard\(\{/);
  });
});
