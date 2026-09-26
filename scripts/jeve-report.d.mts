// scripts/jeve-report.d.mts
// Type declarations for the pure JEV handoff report builder (Q15).

export const GENERATOR: string;

export type Band = 'clear' | 'act' | 'blocked';
export type Verdict = 'blocked' | 'act' | 'unverified' | 'clear' | 'empty';

export interface RubricRule {
  id: string;
  text?: string;
  source?: { path?: string; line?: number; [extra: string]: unknown };
  scope?: string[] | null;
  when?: string;
  check?: {
    type?: 'lint' | 'model' | 'deferred' | 'unenforceable' | string;
    question?: string;
    how?: string;
    overlaps?: string;
    reason?: string;
    [extra: string]: unknown;
  };
  status?: string;
  origin?: string;
  [extra: string]: unknown;
}

export interface Rubric {
  version?: number;
  compiledAt?: string;
  sources?: unknown[];
  rules?: RubricRule[];
  [extra: string]: unknown;
}

export interface EventVerdict {
  ruleId?: string;
  probability?: number | null;
  band?: Band | string;
  [extra: string]: unknown;
}

export interface CheckEvent {
  kind: 'check';
  at?: string;
  phase?: string;
  sessionId?: string;
  promptId?: string;
  files?: string[];
  rules?: number;
  latencyMs?: number;
  modelLatencyMs?: number;
  usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number; [extra: string]: unknown };
  verdicts?: EventVerdict[];
  blocked?: boolean;
  [extra: string]: unknown;
}

export interface SkipEvent {
  kind: 'skip';
  at?: string;
  sessionId?: string;
  reason?: string;
  files?: string[];
  [extra: string]: unknown;
}

export interface ParsedEvents {
  checks: CheckEvent[];
  skips: SkipEvent[];
}

export interface ReportRule {
  id: string;
  band: Verdict;
  probability: number | null;
  checks: number;
  lastAt: string | null;
  evidence: 'event' | 'live' | 'event+live' | 'none';
  scope: string[] | null;
}

export interface ReportFile {
  path: string;
  status: 'checked' | 'no-rules' | 'unseen';
  lastEventAt: string | null;
  governedRules: string[];
}

export interface LiveSection {
  phase?: string;
  files?: string[];
  modelRules?: number;
  calls?: number;
  latencyMs?: number;
  verdicts?: EventVerdict[];
  [extra: string]: unknown;
}

export interface LiveResult {
  ran?: boolean;
  reason?: string | null;
  spendUsd?: number;
  sections?: LiveSection[];
}

export interface ReportTotals {
  checks: number;
  clear: number;
  act: number;
  blocked: number;
  unverified: number;
  skips: number;
  files: number;
  governedFiles: number;
  costUsd: number;
}

export interface JeveReport {
  version: number;
  generator: string;
  generatedAt: string;
  repo: { root: string; name: string };
  branch: string;
  base: { ref: string; sha: string };
  head: { sha: string; shortSha: string; subject: string };
  changedFiles: string[];
  deletedFiles: string[];
  rules: ReportRule[];
  files: ReportFile[];
  lintRules: string[];
  excludedRules: Record<string, number>;
  live: { ran: boolean; reason: string | null; spendUsd: number };
  totals: ReportTotals;
  verdict: Verdict;
  notes: string[];
}

export interface BuildReportInput {
  repoRoot: string;
  repoName: string;
  branch: string;
  base: { ref: string; sha: string };
  head: { sha: string; subject: string };
  changedFiles: string[];
  deletedFiles?: string[];
  rubric: Rubric;
  eventsText: string;
  liveResult?: LiveResult | null;
  baseTime?: string | null;
  generatedAt?: string;
  extraNotes?: string[];
}

export interface VerdictInput {
  changedFiles?: readonly string[] | null;
  rules?: ReadonlyArray<{ band?: string | null }> | null;
}

export function parseEvents(text: unknown): ParsedEvents;

export function matchGlob(glob: string, filePath: string): boolean;

export function ruleGovernsFile(
  rule: RubricRule | null | undefined,
  filePath: string,
): boolean;

export function governedModelRules(rubric: Rubric, changedFiles: string[]): RubricRule[];

export function decideVerdict(report: VerdictInput): Verdict;

export function buildReport(input: BuildReportInput): JeveReport;

export function renderMarkdown(report: JeveReport): string;
