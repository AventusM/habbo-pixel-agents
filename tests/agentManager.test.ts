import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isAgentCompleted } from '../src/agentManager.js';

describe('isAgentCompleted', () => {
  let tmpDir: string;

  function setup(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
    return tmpDir;
  }

  afterEach(() => {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('returns true for file ending with end_turn assistant message', () => {
    const dir = setup();
    const filePath = path.join(dir, 'completed.jsonl');
    const lines = [
      JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'hello' }] } }),
      JSON.stringify({ type: 'assistant', message: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] } }),
    ];
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
    expect(isAgentCompleted(filePath)).toBe(true);
  });

  it('returns false for file ending with tool_use stop_reason', () => {
    const dir = setup();
    const filePath = path.join(dir, 'running.jsonl');
    const lines = [
      JSON.stringify({ type: 'user', message: { content: [] } }),
      JSON.stringify({ type: 'assistant', message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'Bash' }] } }),
    ];
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
    expect(isAgentCompleted(filePath)).toBe(false);
  });

  it('returns false for file ending with user message', () => {
    const dir = setup();
    const filePath = path.join(dir, 'user-last.jsonl');
    const lines = [
      JSON.stringify({ type: 'assistant', message: { stop_reason: 'end_turn', content: [] } }),
      JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'continue' }] } }),
    ];
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
    expect(isAgentCompleted(filePath)).toBe(false);
  });

  it('returns false for empty file', () => {
    const dir = setup();
    const filePath = path.join(dir, 'empty.jsonl');
    fs.writeFileSync(filePath, '');
    expect(isAgentCompleted(filePath)).toBe(false);
  });

  it('returns false for file with corrupt JSON last line', () => {
    const dir = setup();
    const filePath = path.join(dir, 'corrupt.jsonl');
    const lines = [
      JSON.stringify({ type: 'user', message: { content: [] } }),
      '{"type":"assistant","message":{"stop_reason":"end_tu',  // truncated JSON
    ];
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
    expect(isAgentCompleted(filePath)).toBe(false);
  });

  it('returns false for non-existent file path', () => {
    expect(isAgentCompleted('/tmp/does-not-exist-agent-test.jsonl')).toBe(false);
  });
});
