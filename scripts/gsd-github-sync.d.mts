// scripts/gsd-github-sync.d.mts
// Type declarations for the pure GitHub→GSD sync classifier (M005/S05).

export interface TitlePrefix {
  milestoneId: string;
  sliceId?: string;
}

export interface GithubIssuePayload {
  action?: string;
  issue?: {
    number?: number;
    title?: unknown;
    body?: unknown;
    closed_at?: string | null;
    updated_at?: string | null;
  } | null;
  sender?: { login?: string; type?: string } | null;
}

export interface GithubSyncIntent {
  v: 1;
  kind: 'github-sync-intent';
  ts: string;
  action: 'issues.closed' | 'issues.reopened';
  issue: number;
  title: string;
  milestoneId: string;
  sliceId: string | null;
  actor: string | null;
  hop: 1;
  key: string;
}

export interface GsdNotification {
  id: string;
  ts: string;
  severity: 'info';
  message: string;
  source: 'github-sync';
  read: boolean;
}

export function parseTitlePrefix(title: unknown): TitlePrefix | null;

export function dedupeKey(
  issueNumber: number,
  action: string,
  issue:
    | { closed_at?: string | null; updated_at?: string | null }
    | null
    | undefined,
): string;

export function classifyGithubSyncEvent(
  event: unknown,
  payload: GithubIssuePayload | null | undefined,
  opts?: { botMarker?: string },
): GithubSyncIntent | null;

export function toNotification(intent: GithubSyncIntent, id: string): GsdNotification;
