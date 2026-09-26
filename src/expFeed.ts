// src/expFeed.ts
// Pure feed logic for experiment runs (M004/S03): parse JSONL lines from
// hook-record / translate-loop output into section records, derive per-run
// agent summaries with PR links, and map runs to room-agent fields. No canvas,
// no store imports — RoomCanvas wires these into agentStore/expRunStore.

import type { ExpResult, ExpRunState, ExpSection, ExpSectionRecord } from './state/expRunStore.js';
import { EXP_SECTIONS_IN_ORDER, isExpSection } from './state/expRunStore.js';
import type { AgentStatus, TeamSection } from './agentTypes.js';

const VALID_RESULTS = new Set<string>([
  'done',
  'idle',
  'blocked',
  'rework',
  'approved',
  'merged',
  'failed',
]);

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asIntOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeSection(value: Record<string, unknown>): ExpSectionRecord | null {
  const run_id = typeof value.run_id === 'string' && value.run_id ? value.run_id : null;
  const section = isExpSection(value.section) ? (value.section as ExpSection) : null;
  const result =
    typeof value.result === 'string' && VALID_RESULTS.has(value.result)
      ? (value.result as ExpResult)
      : null;
  if (!run_id || !section || !result) return null;
  return {
    run_id,
    issue: asIntOrNull(value.issue),
    path: asStringOrNull(value.path),
    model: asStringOrNull(value.model),
    section,
    started_at: asStringOrNull(value.started_at),
    ended_at: asStringOrNull(value.ended_at),
    result,
    summary: typeof value.summary === 'string' ? value.summary : '',
    tool_calls: asIntOrNull(value.tool_calls),
    tests: asStringOrNull(value.tests),
    verdict: asStringOrNull(value.verdict),
    verdict_url: asStringOrNull(value.verdict_url),
    branch: asStringOrNull(value.branch),
    pr: asIntOrNull(value.pr),
    pr_url: asStringOrNull(value.pr_url),
  };
}

/**
 * Parse one JSONL line from hook-record (single section record) or
 * translate-loop (run record with a `sections` array) into section records.
 * Returns [] for blank/invalid lines — callers skip them.
 */
export function parseExpLine(line: string): ExpSectionRecord[] {
  if (!line || !line.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return [];
  }
  if (!isRecordLike(parsed)) return [];
  if (Array.isArray(parsed.sections)) {
    const out: ExpSectionRecord[] = [];
    for (const entry of parsed.sections) {
      if (!isRecordLike(entry)) continue;
      const rec = normalizeSection({
        ...entry,
        run_id: parsed.run_id,
        issue: parsed.issue,
        path: parsed.path,
        model: parsed.model,
        branch: parsed.branch,
        pr: parsed.pr,
        pr_url: parsed.pr_url,
      });
      if (rec) out.push(rec);
    }
    return out;
  }
  const rec = normalizeSection(parsed);
  return rec ? [rec] : [];
}

export interface ExpAgentSummary {
  runId: string;
  label: string;
  model: string | null;
  issue: number | null;
  status: string;
  currentSection: ExpSection | null;
  summary: string;
  prUrl: string | null;
  branch: string | null;
}

function shortModel(model: string | null, fallback: string): string {
  if (!model) return fallback;
  const base = model.split('/').pop() ?? model;
  return base || fallback;
}

/** Collapse a run to the most advanced section present, for display. */
export function summarizeRun(run: ExpRunState): ExpAgentSummary {
  let current: ExpSectionRecord | null = null;
  for (const section of EXP_SECTIONS_IN_ORDER) {
    const rec = run.sections[section];
    if (rec) current = rec;
  }
  const label =
    run.issue != null
      ? `${shortModel(run.model, run.run_id)} #${run.issue}`
      : shortModel(run.model, run.run_id);
  return {
    runId: run.run_id,
    label,
    model: run.model,
    issue: run.issue,
    status: current ? current.result : 'idle',
    currentSection: current ? current.section : null,
    summary: current ? current.summary : '',
    prUrl: run.pr_url,
    branch: run.branch,
  };
}

export interface ExpAgentFields {
  agentId: string;
  displayName: string;
  team: TeamSection;
  toolText: string;
  status: AgentStatus;
  ticketId?: string;
}

/** Map a run to room-agent fields. Agent ids are prefixed to avoid collisions. */
export function toAgentFields(run: ExpRunState): ExpAgentFields {
  const summary = summarizeRun(run);
  return {
    agentId: `exp-${run.run_id}`,
    displayName: summary.label,
    team: 'planning',
    toolText: summary.summary,
    status: summary.status === 'merged' ? 'idle' : 'active',
    ticketId: run.issue != null ? `#${run.issue}` : undefined,
  };
}

/** Minimal sink surface so tests can use a fake instead of the real store. */
export interface ExpAgentSink {
  get(agentId: string): { toolText: string; status: AgentStatus } | undefined;
  addAgent(agentId: string, displayName: string, team: TeamSection): void;
  setTool(agentId: string, toolText: string): void;
  setStatus(agentId: string, status: AgentStatus): void;
  setLinkedTicket(agentId: string, ticketId?: string, ticketTitle?: string): void;
  removeAgent(agentId: string): void;
}

/**
 * Mirror active experiment runs as room agents (one avatar per run).
 * Idempotent: only touches agents whose tool text, status, or ticket changed,
 * and removes `exp-` agents whose runs disappeared.
 */
export function syncExpRunsToAgents(sink: ExpAgentSink, runs: ExpRunState[], existingIds: string[]): void {
  const want = new Set<string>();
  for (const run of runs) {
    const fields = toAgentFields(run);
    want.add(fields.agentId);
    const current = sink.get(fields.agentId);
    if (!current) {
      sink.addAgent(fields.agentId, fields.displayName, fields.team);
      if (fields.toolText) sink.setTool(fields.agentId, fields.toolText);
      sink.setStatus(fields.agentId, fields.status);
    } else {
      if (current.toolText !== fields.toolText && fields.toolText) {
        sink.setTool(fields.agentId, fields.toolText);
      }
      if (current.status !== fields.status) sink.setStatus(fields.agentId, fields.status);
    }
    sink.setLinkedTicket(fields.agentId, fields.ticketId, undefined);
  }
  for (const id of existingIds) {
    if (id.startsWith('exp-') && !want.has(id)) sink.removeAgent(id);
  }
}

/** Build panel-ready history state from runs (newest first). */
export function expHistoryFromRuns(
  runs: ExpRunState[],
  visible: boolean,
): { rows: ExpAgentSummary[]; visible: boolean } {
  return { rows: runs.map(summarizeRun), visible };
}
