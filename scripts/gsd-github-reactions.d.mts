// scripts/gsd-github-reactions.d.mts
// Type declarations for the pure GSD→GitHub reaction classifier (M005/S06).

export interface GsdEventEntry {
  cmd?: string;
  params?: { milestoneId?: string; sliceId?: string };
  hash?: string;
  actor?: string;
}

export interface GsdGithubReaction {
  v: 1;
  kind: 'gsd-github-reaction';
  ts: string;
  cmd: string;
  milestoneId: string;
  sliceId: string;
  close: boolean;
  verb: string;
  hop: 1;
  key: string;
}

export function classifyGsdEvent(entry: GsdEventEntry | null | undefined): GsdGithubReaction | null;

export function buildReactionComment(
  reaction: GsdGithubReaction,
  opts?: { mergeSha?: string; evidence?: string; reasons?: string; key?: string },
): string;

export function isIssueTerminal(issue: { state?: unknown } | null | undefined): boolean;

export function matchesIssueTitle(title: unknown, reaction: GsdGithubReaction): boolean;
