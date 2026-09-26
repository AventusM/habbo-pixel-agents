// scripts/gsd-sync-wake.d.mts
// Type declarations for the pure GitHub→GSD inbox wake helper (Q14).

export interface SyncIntent {
  v?: number;
  kind?: string;
  ts?: string;
  action?: string;
  issue?: number;
  milestoneId?: string;
  sliceId?: string | null;
  key: string;
  [extra: string]: unknown;
}

export function parseInbox(text: unknown): SyncIntent[];

export function collectPending(
  intents: SyncIntent[],
  seen: Record<string, string> | null | undefined,
): SyncIntent[];

export function formatWake(pending: SyncIntent[] | null | undefined): string | null;

export function markSeen(
  seen: Record<string, string> | null | undefined,
  pending: SyncIntent[],
  at?: string,
): Record<string, string>;
