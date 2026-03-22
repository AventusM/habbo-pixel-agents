// tests/copilotMonitor.test.ts
// Unit tests for the CopilotAgentMonitor parsing and formatting utilities.
// These exercise the same logic paths used when displaying live Copilot
// agent activity in speech bubbles (M004-S09).

import { describe, it, expect } from 'vitest';
import {
  parseLastToolCall,
  formatCopilotToolCall,
  extractTicketId,
  formatDisplayName,
} from '../src/web/copilotMonitor.js';

// ---------------------------------------------------------------------------
// Helper — wrap a JSON object as an SSE data line
// ---------------------------------------------------------------------------
function sseData(json: unknown): string {
  return `data: ${JSON.stringify(json)}\n`;
}

function sseToolCall(toolName: string, args: Record<string, unknown>): string {
  return sseData({
    choices: [
      {
        delta: {
          tool_calls: [
            { function: { name: toolName, arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// parseLastToolCall
// ---------------------------------------------------------------------------
describe('parseLastToolCall', () => {
  it('returns null for empty body', () => {
    expect(parseLastToolCall('')).toBeNull();
  });

  it('returns null for body with no data lines', () => {
    expect(parseLastToolCall('event: ping\n\n')).toBeNull();
  });

  it('parses a view tool call', () => {
    const body = sseToolCall('view', { path: 'src/isoSpriteCache.ts' });
    const result = parseLastToolCall(body);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('view');
    expect(result!.path).toBe('src/isoSpriteCache.ts');
  });

  it('parses a bash tool call with command', () => {
    const body = sseToolCall('bash', { command: 'npx vitest run' });
    const result = parseLastToolCall(body);
    expect(result!.name).toBe('bash');
    expect(result!.command).toBe('npx vitest run');
  });

  it('parses an edit tool call with path', () => {
    const body = sseToolCall('edit', { path: 'src/RoomCanvas.tsx' });
    const result = parseLastToolCall(body);
    expect(result!.name).toBe('edit');
    expect(result!.path).toBe('src/RoomCanvas.tsx');
  });

  it('parses a grep tool call with pattern', () => {
    const body = sseToolCall('grep', { pattern: 'sit|chair' });
    const result = parseLastToolCall(body);
    expect(result!.name).toBe('grep');
    expect(result!.pattern).toBe('sit|chair');
  });

  it('skips setup tools and returns the next real tool', () => {
    const setup = sseToolCall('run_setup', {});
    const realTool = sseToolCall('view', { path: 'README.md' });
    // Body has setup first, real tool second — scan from end → real tool found first
    const body = setup + realTool;
    const result = parseLastToolCall(body);
    expect(result!.name).toBe('view');
  });

  it('skips report_progress tool calls', () => {
    const progress = sseToolCall('report_progress', { message: 'done' });
    const real = sseToolCall('edit', { path: 'src/foo.ts' });
    const body = real + progress; // progress is last line, real comes before
    // Scan from end: progress is skipped, edit is returned
    const result = parseLastToolCall(body);
    expect(result!.name).toBe('edit');
  });

  it('returns the last tool when multiple real tools are present', () => {
    const first = sseToolCall('view', { path: 'old.ts' });
    const last = sseToolCall('edit', { path: 'new.ts' });
    const body = first + last;
    // Scan from end → edit (last) is returned
    const result = parseLastToolCall(body);
    expect(result!.name).toBe('edit');
    expect(result!.path).toBe('new.ts');
  });

  it('falls back to _thinking when only reasoning content is present', () => {
    const body = sseData({
      choices: [
        {
          delta: {
            content: 'I need to look at the test suite before making changes.',
            tool_calls: [],
          },
        },
      ],
    });
    const result = parseLastToolCall(body);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('_thinking');
    expect(result!.description).toContain('I need to look');
  });

  it('ignores very short thinking content', () => {
    const body = sseData({
      choices: [{ delta: { content: 'ok', tool_calls: [] } }],
    });
    expect(parseLastToolCall(body)).toBeNull();
  });

  it('ignores PR metadata thinking content', () => {
    const body = sseData({
      choices: [
        {
          delta: {
            content: '<pr_title>Fix bug</pr_title>',
            tool_calls: [],
          },
        },
      ],
    });
    expect(parseLastToolCall(body)).toBeNull();
  });

  it('handles malformed JSON data lines gracefully', () => {
    const body = 'data: {broken\ndata: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ function: { name: 'view', arguments: '{"path":"ok.ts"}' } }] } }] }) + '\n';
    const result = parseLastToolCall(body);
    expect(result!.name).toBe('view');
  });

  it('accepts file_path alias for path argument', () => {
    const body = sseToolCall('view', { file_path: 'src/alt.ts' });
    const result = parseLastToolCall(body);
    expect(result!.path).toBe('src/alt.ts');
  });
});

// ---------------------------------------------------------------------------
// formatCopilotToolCall
// ---------------------------------------------------------------------------
describe('formatCopilotToolCall', () => {
  it('formats a view tool call', () => {
    const text = formatCopilotToolCall({ name: 'view', path: 'src/isoSpriteCache.ts' });
    expect(text).toBe('Reading isoSpriteCache.ts');
  });

  it('formats a view with no path', () => {
    expect(formatCopilotToolCall({ name: 'view' })).toBe('Reading file');
  });

  it('formats a bash with command', () => {
    expect(formatCopilotToolCall({ name: 'bash', command: 'npx vitest run' })).toBe('Running: npx vitest run');
  });

  it('formats a bash with description', () => {
    expect(formatCopilotToolCall({ name: 'bash', description: 'Run the test suite' })).toBe('Run the test suite');
  });

  it('formats a bash with no args', () => {
    expect(formatCopilotToolCall({ name: 'bash' })).toBe('Running command...');
  });

  it('formats a glob tool call', () => {
    expect(formatCopilotToolCall({ name: 'glob', pattern: '**/*.test.ts' })).toBe('Searching: **/*.test.ts');
  });

  it('formats a grep tool call', () => {
    expect(formatCopilotToolCall({ name: 'grep', pattern: 'parseLastToolCall' })).toBe('Searching for: parseLastToolCall');
  });

  it('formats an edit tool call', () => {
    expect(formatCopilotToolCall({ name: 'edit', path: 'src/RoomCanvas.tsx' })).toBe('Editing RoomCanvas.tsx');
  });

  it('formats a write tool call', () => {
    expect(formatCopilotToolCall({ name: 'write', path: 'src/newFile.ts' })).toBe('Writing newFile.ts');
  });

  it('formats a create tool call', () => {
    expect(formatCopilotToolCall({ name: 'create', path: 'src/newFile.ts' })).toBe('Writing newFile.ts');
  });

  it('formats a task tool call with description', () => {
    expect(formatCopilotToolCall({ name: 'task', description: 'Run build verification' })).toBe('Task: Run build verification');
  });

  it('formats a task tool call without description', () => {
    expect(formatCopilotToolCall({ name: 'task' })).toBe('Running sub-task...');
  });

  it('formats reply_to_comment', () => {
    expect(formatCopilotToolCall({ name: 'reply_to_comment' })).toBe('Replying to review comment');
  });

  it('formats codeql_checker', () => {
    expect(formatCopilotToolCall({ name: 'codeql_checker' })).toBe('Running security analysis');
  });

  it('formats playwright tool by stripping prefix', () => {
    const text = formatCopilotToolCall({ name: 'playwright-browser_navigate' });
    expect(text).toBe('Browser: browser navigate');
  });

  it('formats unknown tool with Using prefix', () => {
    expect(formatCopilotToolCall({ name: 'store_memory' })).toBe('Using store_memory');
  });

  it('formats _thinking by extracting first sentence', () => {
    const text = formatCopilotToolCall({
      name: '_thinking',
      description: 'I should check the test output. Then fix the issue.',
    });
    expect(text).toBe('I should check the test output');
  });

  it('truncates long text to 50 chars', () => {
    const longCmd = 'a'.repeat(60);
    const text = formatCopilotToolCall({ name: 'bash', command: longCmd });
    expect(text.length).toBeLessThanOrEqual('Running: '.length + 43); // truncated
    expect(text.endsWith('...')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractTicketId
// ---------------------------------------------------------------------------
describe('extractTicketId', () => {
  it('extracts AB# ticket from PR title', () => {
    expect(extractTicketId('copilot/fix-bug', 'Fix bug AB#42')).toBe('42');
  });

  it('extracts #N ticket reference when no AB# present', () => {
    expect(extractTicketId('copilot/fix', 'Fix issue #99')).toBe('99');
  });

  it('prefers AB# over plain # when both present', () => {
    expect(extractTicketId('copilot/fix', 'Fix #5 AB#10 related')).toBe('10');
  });

  it('returns undefined when no ticket ref found', () => {
    expect(extractTicketId('copilot/update-docs', 'Update documentation')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatDisplayName
// ---------------------------------------------------------------------------
describe('formatDisplayName', () => {
  it('strips copilot/ prefix and title-cases words', () => {
    expect(formatDisplayName('copilot/fix-login-bug')).toBe('Fix Login Bug');
  });

  it('truncates to 20 characters', () => {
    const result = formatDisplayName('copilot/a-very-long-branch-name-here');
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('handles branch without copilot/ prefix', () => {
    expect(formatDisplayName('feat/my-feature')).toBe('Feat/My Feature');
  });
});
