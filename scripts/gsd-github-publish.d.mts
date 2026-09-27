// scripts/gsd-github-publish.d.mts
// Type declarations for the plan-time publisher (M010/S02, D035).

export interface IssueOutcome {
  id: string;
  text: string;
}

export interface IssueBodyInput {
  milestone: string;
  slice: string;
  goal?: string;
  demo?: string;
  outcomes?: IssueOutcome[];
  exclusions?: IssueOutcome[];
  tasks?: string[];
  risk?: string;
  depends?: string[];
  parent?: string;
  humanMerge?: boolean;
}

export interface TrailerInput {
  milestone: string;
  slice: string;
  parent?: string;
  stackedOn?: string;
  outcomes?: string[] | string;
  humanMerge?: boolean;
}

export declare const SYNC_LABELS_BASE: string[];
export declare const BOT_MARKER: string;
export declare const PUBLISH_CAP: number;

export function buildIssueTitle(milestoneId: string, sliceId: string, sliceTitle: string): string;
export function buildTrailer(input: TrailerInput): string;
export function buildIssueBody(input: IssueBodyInput): string;
export function hasBlockedLabel(issue: { labels?: unknown } | null | undefined): boolean;
export function isExactTitleMatch(issueTitle: unknown, expectedTitle: string): boolean;
export function ensureMilestoneLabel(
  execFn: (cmd: string, args: string[]) => string,
  milestoneId: string,
  opts?: { dryRun?: boolean },
): { action: string; milestoneId: string };
export function listCandidateIssues(
  execFn: (cmd: string, args: string[]) => string,
  milestoneId: string,
  sliceId: string,
): Array<{ number: number; title: string; state: string; labels: unknown[] }>;
export function upsertSliceIssue(
  execFn: (cmd: string, args: string[]) => string,
  input: { milestoneId: string; sliceId: string; title: string; body: string; dryRun?: boolean },
): { action: string; number?: number; title?: string; body?: string; raw?: string };
export function getSliceState(
  milestoneId: string,
  sliceId: string,
): {
  milestoneId: string;
  sliceId: string;
  title: string;
  goal: string;
  demo: string;
  outcomes: IssueOutcome[];
  exclusions: IssueOutcome[];
  tasks: string[];
  risk: string;
  depends: string[];
} | null;
export function getMilestoneSlices(milestoneId: string): string[];
