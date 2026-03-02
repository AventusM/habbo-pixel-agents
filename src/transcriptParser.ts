// src/transcriptParser.ts
// Parse Claude Code JSONL transcript lines into structured events

import type { AgentEvent } from './agentTypes.js';

/**
 * Parse a single JSONL transcript line into an AgentEvent.
 *
 * Recognizes:
 * - assistant messages with tool_use content blocks
 * - user messages with tool_result content blocks
 * - system messages with turn_duration
 *
 * @param line - Raw JSONL line string
 * @returns Parsed AgentEvent or null if unrecognized
 */
export function parseTranscriptLine(line: string): AgentEvent | null {
  if (!line.trim()) return null;

  try {
    const entry = JSON.parse(line);

    // Tool use from assistant
    if (entry.role === 'assistant' && Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === 'tool_use') {
          const toolName = block.name || 'unknown';
          const input = block.input || {};
          return {
            type: 'tool_use',
            toolName,
            toolInput: input,
            displayText: formatToolStatus(toolName, input),
          };
        }
      }
    }

    // Tool result from user
    if (entry.role === 'user' && Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            toolName: block.tool_use_id,
          };
        }
      }
    }

    // Turn duration from system
    if (entry.type === 'system' && entry.turn_duration !== undefined) {
      return {
        type: 'turn_duration',
        durationMs: entry.turn_duration,
      };
    }

    return null;
  } catch {
    return null; // Invalid JSON
  }
}

/**
 * Format a tool invocation into a human-readable status string.
 *
 * @param toolName - Name of the tool being used
 * @param input - Tool input parameters
 * @returns Display string for UI
 */
export function formatToolStatus(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return `Reading ${truncatePath(input.file_path as string)}`;
    case 'Write':
      return `Writing ${truncatePath(input.file_path as string)}`;
    case 'Edit':
      return `Editing ${truncatePath(input.file_path as string)}`;
    case 'Bash':
      return `Running: ${truncateText(input.command as string, 40)}`;
    case 'Glob':
      return `Searching: ${input.pattern}`;
    case 'Grep':
      return `Searching for: ${truncateText(input.pattern as string, 30)}`;
    case 'WebSearch':
      return `Searching web: ${truncateText(input.query as string, 30)}`;
    case 'WebFetch':
      return `Fetching URL`;
    case 'Agent':
      return `Running agent: ${truncateText(input.description as string || '', 30)}`;
    default:
      return `Using ${toolName}`;
  }
}

function truncatePath(path: string | undefined): string {
  if (!path) return 'file';
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function truncateText(text: string | undefined, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
