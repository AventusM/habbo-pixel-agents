// tests/transcriptParser.test.ts

import { describe, it, expect } from 'vitest';
import { parseTranscriptLine, formatToolStatus } from '../src/transcriptParser.js';

describe('parseTranscriptLine', () => {
  it('parses assistant tool_use message', () => {
    const line = JSON.stringify({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          name: 'Read',
          input: { file_path: '/src/index.ts' },
        },
      ],
    });

    const event = parseTranscriptLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe('tool_use');
    expect(event!.toolName).toBe('Read');
    expect(event!.displayText).toBe('Reading index.ts');
  });

  it('parses Bash tool use with command', () => {
    const line = JSON.stringify({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          name: 'Bash',
          input: { command: 'npm test' },
        },
      ],
    });

    const event = parseTranscriptLine(line);

    expect(event!.type).toBe('tool_use');
    expect(event!.toolName).toBe('Bash');
    expect(event!.displayText).toBe('Running: npm test');
  });

  it('parses user tool_result message', () => {
    const line = JSON.stringify({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_123',
        },
      ],
    });

    const event = parseTranscriptLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe('tool_result');
  });

  it('parses system turn_duration', () => {
    const line = JSON.stringify({
      type: 'system',
      turn_duration: 1500,
    });

    const event = parseTranscriptLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe('turn_duration');
    expect(event!.durationMs).toBe(1500);
  });

  it('returns null for empty line', () => {
    expect(parseTranscriptLine('')).toBeNull();
    expect(parseTranscriptLine('  ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseTranscriptLine('not json')).toBeNull();
    expect(parseTranscriptLine('{invalid')).toBeNull();
  });

  it('returns null for unrecognized message format', () => {
    const line = JSON.stringify({ role: 'assistant', content: 'just text' });
    expect(parseTranscriptLine(line)).toBeNull();
  });
});

describe('formatToolStatus', () => {
  it('formats Read tool', () => {
    expect(formatToolStatus('Read', { file_path: '/a/b/c.ts' })).toBe('Reading c.ts');
  });

  it('formats Write tool', () => {
    expect(formatToolStatus('Write', { file_path: '/src/app.ts' })).toBe('Writing app.ts');
  });

  it('formats Edit tool', () => {
    expect(formatToolStatus('Edit', { file_path: '/src/utils.ts' })).toBe('Editing utils.ts');
  });

  it('formats Bash with command', () => {
    expect(formatToolStatus('Bash', { command: 'npm test' })).toBe('Running: npm test');
  });

  it('truncates long Bash commands', () => {
    const longCmd = 'a'.repeat(50);
    const result = formatToolStatus('Bash', { command: longCmd });
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toContain('...');
  });

  it('formats Glob tool', () => {
    expect(formatToolStatus('Glob', { pattern: '**/*.ts' })).toBe('Searching: **/*.ts');
  });

  it('formats unknown tool', () => {
    expect(formatToolStatus('CustomTool', {})).toBe('Using CustomTool');
  });
});
