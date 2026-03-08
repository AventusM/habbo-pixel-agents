// src/agentClassifier.ts
// Agent classification pipeline: maps JSONL transcript data to roles, teams, and display names

import type { TeamSection } from './agentTypes.js';

/** Classification result for an agent */
export interface AgentClassification {
  role: string;
  roleName: string;
  team: TeamSection;
  taskArea: string;
  displayName: string;
}

/** Map GSD subagent types to team sections */
export const ROLE_TO_TEAM: Record<string, TeamSection> = {
  'gsd-phase-researcher': 'planning',
  'gsd-planner': 'planning',
  'gsd-plan-checker': 'planning',
  'gsd-executor': 'core-dev',
  'gsd-codebase-mapper': 'infrastructure',
  'gsd-debugger': 'support',
  'gsd-verifier': 'support',
};

/** Map GSD subagent types to human-readable role names */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'gsd-executor': 'Executor',
  'gsd-planner': 'Planner',
  'gsd-phase-researcher': 'Researcher',
  'gsd-plan-checker': 'Checker',
  'gsd-codebase-mapper': 'Mapper',
  'gsd-debugger': 'Debugger',
  'gsd-verifier': 'Verifier',
};

/**
 * Extract the subagent_type from JSONL content by scanning for Agent tool_use blocks.
 * Returns the first match found, or null if none.
 */
export function extractSubagentType(jsonlContent: string): string | null {
  const lines = jsonlContent.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.role === 'assistant' && Array.isArray(entry.content)) {
        for (const block of entry.content) {
          if (
            block.type === 'tool_use' &&
            block.name === 'Agent' &&
            block.input?.subagent_type
          ) {
            return block.input.subagent_type as string;
          }
        }
      }
    } catch {
      // Skip invalid JSON lines
    }
  }
  return null;
}

/**
 * Infer the task area from file paths found in Read/Write/Edit tool uses in JSONL content.
 * Categories: Frontend, Backend, Testing, Database, Planning, General (fallback).
 */
export function inferTaskArea(jsonlContent: string): string {
  const filePaths: string[] = [];
  const lines = jsonlContent.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.role === 'assistant' && Array.isArray(entry.content)) {
        for (const block of entry.content) {
          if (block.type === 'tool_use') {
            const name = block.name;
            if (name === 'Read' || name === 'Write' || name === 'Edit') {
              const path = block.input?.file_path as string | undefined;
              if (path) filePaths.push(path);
            }
          }
        }
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  if (filePaths.length === 0) return 'General';

  // Count category hits
  const counts: Record<string, number> = {
    Frontend: 0,
    Backend: 0,
    Testing: 0,
    Database: 0,
    Planning: 0,
  };

  for (const fp of filePaths) {
    if (fp.includes('.planning/') || fp.includes('.planning\\')) {
      counts.Planning++;
    } else if (fp.includes('tests/') || fp.includes('tests\\') || fp.includes('__tests__')) {
      counts.Testing++;
    } else if (fp.includes('src/components/') || fp.endsWith('.tsx')) {
      counts.Frontend++;
    } else if (fp.includes('src/api/') || fp.includes('route.ts')) {
      counts.Backend++;
    } else if (fp.includes('prisma/') || fp.includes('schema')) {
      counts.Database++;
    }
  }

  // Return the category with the most hits, or General if all zero
  let best = 'General';
  let bestCount = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = cat;
    }
  }
  return best;
}

/**
 * Derive a human-readable role name from a subagent_type string.
 * Known types use ROLE_DISPLAY_NAMES; unknown types capitalize the last hyphen-segment.
 */
function getRoleName(subagentType: string | null): string {
  if (!subagentType) return 'Agent';
  if (ROLE_DISPLAY_NAMES[subagentType]) return ROLE_DISPLAY_NAMES[subagentType];
  // Unknown type: capitalize last word after last hyphen
  const parts = subagentType.split('-');
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

/**
 * Classify an agent based on its subagent_type and JSONL transcript content.
 * Combines role lookup, team assignment, task area inference, and display name generation.
 */
export function classifyAgent(
  subagentType: string | null,
  jsonlContent: string,
): AgentClassification {
  const role = subagentType ?? 'unknown';
  const roleName = getRoleName(subagentType);
  const team: TeamSection = (subagentType && ROLE_TO_TEAM[subagentType]) || 'core-dev';
  const taskArea = inferTaskArea(jsonlContent);
  const displayName = `${roleName} - ${taskArea}`;

  return { role, roleName, team, taskArea, displayName };
}
