import { describe, it, expect } from 'vitest';
import {
  extractSubagentType,
  classifyAgent,
  inferTaskArea,
  ROLE_TO_TEAM,
} from '../src/agentClassifier.js';

// Helper: create a JSONL line with an Agent tool_use
function agentToolLine(subagentType: string): string {
  return JSON.stringify({
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        name: 'Agent',
        input: { subagent_type: subagentType, prompt: 'do something' },
      },
    ],
  });
}

// Helper: create a JSONL line with a Read/Write/Edit tool_use
function fileToolLine(toolName: string, filePath: string): string {
  return JSON.stringify({
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        name: toolName,
        input: { file_path: filePath },
      },
    ],
  });
}

// Helper: create a JSONL line with a non-Agent tool_use
function otherToolLine(toolName: string): string {
  return JSON.stringify({
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        name: toolName,
        input: { command: 'npm test' },
      },
    ],
  });
}

describe('extractSubagentType', () => {
  it('returns subagent_type from JSONL with Agent tool_use', () => {
    const jsonl = agentToolLine('gsd-executor');
    expect(extractSubagentType(jsonl)).toBe('gsd-executor');
  });

  it('returns null from JSONL without any Agent tool_use', () => {
    const jsonl = otherToolLine('Bash');
    expect(extractSubagentType(jsonl)).toBeNull();
  });

  it('returns null from empty JSONL', () => {
    expect(extractSubagentType('')).toBeNull();
  });

  it('returns null from invalid JSONL', () => {
    expect(extractSubagentType('not json at all\n{broken')).toBeNull();
  });

  it('returns first Agent match when multiple tool_use blocks exist', () => {
    const jsonl = [
      otherToolLine('Bash'),
      agentToolLine('gsd-planner'),
      agentToolLine('gsd-executor'),
    ].join('\n');
    expect(extractSubagentType(jsonl)).toBe('gsd-planner');
  });
});

describe('classifyAgent', () => {
  it('maps gsd-executor to core-dev with roleName Executor', () => {
    const result = classifyAgent('gsd-executor', '');
    expect(result.team).toBe('core-dev');
    expect(result.roleName).toBe('Executor');
  });

  it('maps gsd-planner to planning with roleName Planner', () => {
    const result = classifyAgent('gsd-planner', '');
    expect(result.team).toBe('planning');
    expect(result.roleName).toBe('Planner');
  });

  it('maps gsd-debugger to support with roleName Debugger', () => {
    const result = classifyAgent('gsd-debugger', '');
    expect(result.team).toBe('support');
    expect(result.roleName).toBe('Debugger');
  });

  it('maps gsd-codebase-mapper to infrastructure with roleName Mapper', () => {
    const result = classifyAgent('gsd-codebase-mapper', '');
    expect(result.team).toBe('infrastructure');
    expect(result.roleName).toBe('Mapper');
  });

  it('maps gsd-phase-researcher to planning with roleName Researcher', () => {
    const result = classifyAgent('gsd-phase-researcher', '');
    expect(result.team).toBe('planning');
    expect(result.roleName).toBe('Researcher');
  });

  it('maps gsd-plan-checker to planning with roleName Checker', () => {
    const result = classifyAgent('gsd-plan-checker', '');
    expect(result.team).toBe('planning');
    expect(result.roleName).toBe('Checker');
  });

  it('maps gsd-verifier to support with roleName Verifier', () => {
    const result = classifyAgent('gsd-verifier', '');
    expect(result.team).toBe('support');
    expect(result.roleName).toBe('Verifier');
  });

  it('defaults unknown subagent type to core-dev', () => {
    const result = classifyAgent('custom-runner', '');
    expect(result.team).toBe('core-dev');
    expect(result.roleName).toBe('Runner');
  });

  it('returns core-dev with roleName Agent when subagentType is null', () => {
    const jsonl = fileToolLine('Read', 'tests/foo.test.ts');
    const result = classifyAgent(null, jsonl);
    expect(result.team).toBe('core-dev');
    expect(result.roleName).toBe('Agent');
    expect(result.taskArea).toBe('Testing');
  });
});

describe('inferTaskArea', () => {
  it('returns Frontend for .tsx files', () => {
    const jsonl = fileToolLine('Read', 'src/components/App.tsx');
    expect(inferTaskArea(jsonl)).toBe('Frontend');
  });

  it('returns Testing for tests/ files', () => {
    const jsonl = fileToolLine('Write', 'tests/foo.test.ts');
    expect(inferTaskArea(jsonl)).toBe('Testing');
  });

  it('returns Planning for .planning/ files', () => {
    const jsonl = fileToolLine('Edit', '.planning/STATE.md');
    expect(inferTaskArea(jsonl)).toBe('Planning');
  });

  it('returns Backend for src/api/ files', () => {
    const jsonl = fileToolLine('Read', 'src/api/auth.ts');
    expect(inferTaskArea(jsonl)).toBe('Backend');
  });

  it('returns Database for prisma/ files', () => {
    const jsonl = fileToolLine('Write', 'prisma/schema.prisma');
    expect(inferTaskArea(jsonl)).toBe('Database');
  });

  it('returns General for empty JSONL', () => {
    expect(inferTaskArea('')).toBe('General');
  });

  it('returns General when no file paths match categories', () => {
    const jsonl = otherToolLine('Bash');
    expect(inferTaskArea(jsonl)).toBe('General');
  });

  it('picks the most frequent category when mixed', () => {
    const jsonl = [
      fileToolLine('Read', 'src/components/Foo.tsx'),
      fileToolLine('Read', 'src/components/Bar.tsx'),
      fileToolLine('Read', 'tests/foo.test.ts'),
    ].join('\n');
    expect(inferTaskArea(jsonl)).toBe('Frontend');
  });
});

describe('extractSubagentType with sub-agent transcripts', () => {
  it('returns null for sub-agent transcripts (they contain tool_use but not Agent spawns)', () => {
    // Sub-agents use tools like Read/Write/Bash — they don't spawn other agents via Agent tool_use
    const subAgentJsonl = [
      JSON.stringify({ role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'src/foo.ts' } }] }),
      JSON.stringify({ role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] }),
      JSON.stringify({ role: 'assistant', content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'src/bar.ts', content: '// code' } }] }),
    ].join('\n');
    expect(extractSubagentType(subAgentJsonl)).toBeNull();
  });

  it('returns null for user-only messages without any tool_use', () => {
    const userOnlyJsonl = [
      JSON.stringify({ role: 'user', content: 'Please fix the bug' }),
      JSON.stringify({ role: 'assistant', content: 'I will fix it now.' }),
    ].join('\n');
    expect(extractSubagentType(userOnlyJsonl)).toBeNull();
  });
});

describe('classifyAgent with meta.json agentType values', () => {
  it('classifies gsd-executor as core-dev team', () => {
    const result = classifyAgent('gsd-executor', '');
    expect(result.team).toBe('core-dev');
    expect(result.role).toBe('gsd-executor');
    expect(result.roleName).toBe('Executor');
  });

  it('classifies gsd-planner as planning team', () => {
    const result = classifyAgent('gsd-planner', '');
    expect(result.team).toBe('planning');
    expect(result.role).toBe('gsd-planner');
    expect(result.roleName).toBe('Planner');
  });

  it('classifies null subagentType as core-dev with Agent role', () => {
    const result = classifyAgent(null, '');
    expect(result.team).toBe('core-dev');
    expect(result.role).toBe('unknown');
    expect(result.roleName).toBe('Agent');
    expect(result.taskArea).toBe('General');
  });
});

describe('ROLE_TO_TEAM coverage', () => {
  it('covers all expected GSD subagent types', () => {
    const expectedTypes = [
      'gsd-phase-researcher',
      'gsd-planner',
      'gsd-plan-checker',
      'gsd-executor',
      'gsd-codebase-mapper',
      'gsd-debugger',
      'gsd-verifier',
    ];
    for (const t of expectedTypes) {
      expect(ROLE_TO_TEAM[t]).toBeDefined();
    }
  });
});

describe('display name format', () => {
  it('formats as "Executor - Frontend" for gsd-executor with frontend files', () => {
    const jsonl = fileToolLine('Read', 'src/components/Widget.tsx');
    const result = classifyAgent('gsd-executor', jsonl);
    expect(result.displayName).toBe('Executor - Frontend');
  });

  it('formats as "Agent - Testing" when subagentType is null with test files', () => {
    const jsonl = fileToolLine('Write', 'tests/unit.test.ts');
    const result = classifyAgent(null, jsonl);
    expect(result.displayName).toBe('Agent - Testing');
  });

  it('formats as "Planner - General" when no file paths present', () => {
    const result = classifyAgent('gsd-planner', '');
    expect(result.displayName).toBe('Planner - General');
  });
});
