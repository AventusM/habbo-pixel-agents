// tests/expFeed.test.ts
// Unit tests for the experiment feed: JSONL parsing (hook lines and
// translator run records), per-run summaries, agent mapping, idempotent sync,
// and history shaping.

import { describe, it, expect } from 'vitest';
import {
  parseExpLine,
  summarizeRun,
  syncExpRunsToAgents,
  expHistoryFromRuns,
} from '../src/expFeed.js';
import type { ExpAgentSink } from '../src/expFeed.js';
import type { ExpRunState, ExpSection, ExpResult } from '../src/state/expRunStore.js';
import type { AgentStatus, TeamSection } from '../src/agentTypes.js';

function makeRun(overrides: Partial<ExpRunState> = {}): ExpRunState {
  return {
    run_id: 'exp-1',
    issue: 80,
    path: 'gsd-loop',
    model: 'opencode-go/deepseek-flash',
    branch: 'exp/80-deepseek-flash-x',
    pr: null,
    pr_url: null,
    sections: {},
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function section(section: ExpSection, result: ExpResult, summary: string) {
  return {
    run_id: 'exp-1',
    issue: 80,
    path: 'gsd-loop',
    model: 'opencode-go/deepseek-flash',
    section,
    result,
    summary,
  };
}

class FakeSink implements ExpAgentSink {
  agents = new Map<
    string,
    { displayName: string; team: TeamSection; toolText: string; status: AgentStatus; ticketId?: string }
  >();
  removed: string[] = [];
  toolSets = 0;

  get(agentId: string) {
    const a = this.agents.get(agentId);
    return a ? { toolText: a.toolText, status: a.status } : undefined;
  }
  addAgent(agentId: string, displayName: string, team: TeamSection) {
    this.agents.set(agentId, { displayName, team, toolText: '', status: 'idle' });
  }
  setTool(agentId: string, toolText: string) {
    const a = this.agents.get(agentId);
    if (a) {
      a.toolText = toolText;
      this.toolSets++;
    }
  }
  setStatus(agentId: string, status: AgentStatus) {
    const a = this.agents.get(agentId);
    if (a) a.status = status;
  }
  setLinkedTicket(agentId: string, ticketId?: string) {
    const a = this.agents.get(agentId);
    if (a) a.ticketId = ticketId;
  }
  removeAgent(agentId: string) {
    this.agents.delete(agentId);
    this.removed.push(agentId);
  }
}

describe('parseExpLine', () => {
  it('parses a hook-record section line', () => {
    const recs = parseExpLine(
      JSON.stringify({
        run_id: 'exp-1',
        issue: 80,
        path: 'gsd-loop',
        model: 'opencode-go/deepseek-flash',
        section: 'build',
        result: 'done',
        summary: 'built it',
        branch: 'exp/80-x',
        pr: 99,
        pr_url: 'https://example.com/pull/99',
      }),
    );
    expect(recs).toHaveLength(1);
    expect(recs[0].run_id).toBe('exp-1');
    expect(recs[0].section).toBe('build');
    expect(recs[0].pr).toBe(99);
  });

  it('expands a translate-loop run record into section records', () => {
    const recs = parseExpLine(
      JSON.stringify({
        run_id: 'exp-1',
        issue: 80,
        path: 'gsd-loop',
        model: 'opencode-go/deepseek-flash',
        branch: 'exp/80-x',
        pr: 99,
        pr_url: 'https://example.com/pull/99',
        sections: [
          { section: 'build', result: 'done', summary: 'b' },
          { section: 'review', result: 'approved', summary: 'r' },
        ],
      }),
    );
    expect(recs).toHaveLength(2);
    expect(recs.map((r) => r.section)).toEqual(['build', 'review']);
    // run-level context propagates to each section
    for (const r of recs) {
      expect(r.run_id).toBe('exp-1');
      expect(r.pr).toBe(99);
    }
  });

  it('returns [] for blank, invalid, or incomplete lines', () => {
    expect(parseExpLine('')).toEqual([]);
    expect(parseExpLine('   ')).toEqual([]);
    expect(parseExpLine('not json')).toEqual([]);
    expect(parseExpLine('{"run_id":"x"}')).toEqual([]);
    expect(parseExpLine('{"run_id":"x","section":"nope","result":"done"}')).toEqual([]);
  });
});

describe('summarizeRun', () => {
  it('picks the most advanced section present', () => {
    const run = makeRun({
      sections: {
        build: { ...section('build', 'done', 'b'), run_id: 'exp-1', issue: 80, path: null, model: null, summary: 'b' },
        review: { ...section('review', 'approved', 'r'), run_id: 'exp-1', issue: 80, path: null, model: null, summary: 'r' },
      },
    });
    const s = summarizeRun(run);
    expect(s.currentSection).toBe('review');
    expect(s.status).toBe('approved');
    expect(s.summary).toBe('r');
    expect(s.label).toBe('deepseek-flash #80');
  });

  it('handles runs with no sections', () => {
    const s = summarizeRun(makeRun());
    expect(s.currentSection).toBeNull();
    expect(s.status).toBe('idle');
    expect(s.summary).toBe('');
  });
});

describe('toAgentFields + syncExpRunsToAgents', () => {
  it('creates one prefixed agent per run with ticket link', () => {
    const sink = new FakeSink();
    const run = makeRun({
      sections: {
        build: { ...section('build', 'done', 'working'), run_id: 'exp-1', issue: 80, path: null, model: null, summary: 'working' },
      },
    });
    syncExpRunsToAgents(sink, [run], [...sink.agents.keys()]);
    const agent = sink.agents.get('exp-exp-1');
    expect(agent).toBeDefined();
    expect(agent?.displayName).toBe('deepseek-flash #80');
    expect(agent?.toolText).toBe('working');
    expect(agent?.status).toBe('active');
    expect(agent?.ticketId).toBe('#80');
  });

  it('marks merged runs idle and is idempotent on repeat syncs', () => {
    const sink = new FakeSink();
    const run = makeRun({
      sections: {
        merge: { ...section('merge', 'merged', 'landed'), run_id: 'exp-1', issue: 80, path: null, model: null, summary: 'landed' },
      },
    });
    syncExpRunsToAgents(sink, [run], [...sink.agents.keys()]);
    expect(sink.agents.get('exp-exp-1')?.status).toBe('idle');
    const setsAfterFirst = sink.toolSets;
    syncExpRunsToAgents(sink, [run], [...sink.agents.keys()]);
    expect(sink.toolSets).toBe(setsAfterFirst);
  });

  it('removes stale exp- agents but keeps live ones', () => {
    const sink = new FakeSink();
    sink.addAgent('exp-old', 'Old', 'planning');
    sink.addAgent('live-1', 'Live', 'core-dev');
    syncExpRunsToAgents(sink, [makeRun()], [...sink.agents.keys()]);
    expect(sink.agents.has('exp-old')).toBe(false);
    expect(sink.removed).toContain('exp-old');
    expect(sink.agents.has('live-1')).toBe(true);
    expect(sink.agents.has('exp-exp-1')).toBe(true);
  });
});

describe('expHistoryFromRuns', () => {
  it('shapes rows with visibility passthrough', () => {
    const h = expHistoryFromRuns([makeRun()], false);
    expect(h.visible).toBe(false);
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].runId).toBe('exp-1');
  });
});
