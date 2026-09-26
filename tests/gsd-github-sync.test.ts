// tests/gsd-github-sync.test.ts
// Guards for the GitHub→GSD sync classifier (M005/S05): title parsing,
// transition filtering, loop guards, exactly-once keys, notification shape.

import { describe, it, expect } from 'vitest';
import {
  parseTitlePrefix,
  classifyGithubSyncEvent,
  dedupeKey,
  toNotification,
} from '../scripts/gsd-github-sync.mjs';

const issue = (over: Record<string, unknown> = {}) => ({
  number: 115,
  title: 'M007/S03: extraction complete',
  body: 'closing per plan',
  closed_at: '2026-09-26T09:11:36Z',
  updated_at: '2026-09-26T09:11:36Z',
  ...over,
});

const payload = (over: Record<string, unknown> = {}) => ({
  action: 'closed',
  issue: issue(),
  sender: { login: 'AventusM', type: 'User' },
  ...over,
});

describe('parseTitlePrefix', () => {
  it('parses milestone-only titles', () => {
    expect(parseTitlePrefix('M007: pattern enforcement')).toEqual({ milestoneId: 'M007' });
  });

  it('parses milestone/slice titles', () => {
    expect(parseTitlePrefix('M005/S05: webhook branch')).toEqual({
      milestoneId: 'M005',
      sliceId: 'S05',
    });
  });

  it('rejects titles without the convention', () => {
    expect(parseTitlePrefix('Fix the thing')).toBeNull();
    expect(parseTitlePrefix('M07: too short')).toBeNull();
    expect(parseTitlePrefix('')).toBeNull();
    expect(parseTitlePrefix(undefined)).toBeNull();
  });
});

describe('classifyGithubSyncEvent', () => {
  it('accepts close and reopen transitions on prefixed issues', () => {
    const closed = classifyGithubSyncEvent('issues', payload());
    expect(closed).toMatchObject({
      kind: 'github-sync-intent',
      action: 'issues.closed',
      issue: 115,
      milestoneId: 'M007',
      sliceId: 'S03',
      actor: 'AventusM',
      hop: 1,
    });

    const reopened = classifyGithubSyncEvent('issues', payload({ action: 'reopened' }));
    expect(reopened?.action).toBe('issues.reopened');
  });

  it('stamps milestone-only intents with a null slice', () => {
    const intent = classifyGithubSyncEvent(
      'issues',
      payload({ issue: issue({ title: 'M007: pattern enforcement' }) }),
    );
    expect(intent?.sliceId).toBeNull();
  });

  it('ignores non-transition actions and non-issues events', () => {
    expect(classifyGithubSyncEvent('issues', payload({ action: 'edited' }))).toBeNull();
    expect(classifyGithubSyncEvent('push', payload())).toBeNull();
  });

  it('ignores titles without the M00X/S0X prefix', () => {
    expect(
      classifyGithubSyncEvent('issues', payload({ issue: issue({ title: 'regular issue' }) })),
    ).toBeNull();
  });

  it('ignores bot senders and gsd-sync markers (one hop max)', () => {
    const bot = payload({ sender: { login: 'gsd-sync[bot]', type: 'Bot' } });
    expect(classifyGithubSyncEvent('issues', bot)).toBeNull();

    const marked = payload({ issue: issue({ body: 'handled <!-- gsd-sync -->' }) });
    expect(classifyGithubSyncEvent('issues', marked)).toBeNull();
  });

  it('ignores payloads without an issue number', () => {
    expect(
      classifyGithubSyncEvent('issues', payload({ issue: issue({ number: undefined }) })),
    ).toBeNull();
    expect(classifyGithubSyncEvent('issues', { action: 'closed' })).toBeNull();
  });
});

describe('dedupeKey', () => {
  it('is stable for the same delivery and differs across transitions', () => {
    const a = dedupeKey(115, 'closed', issue());
    const b = dedupeKey(115, 'closed', issue());
    expect(a).toBe(b);

    const later = dedupeKey(115, 'closed', issue({ closed_at: '2026-09-27T00:00:00Z' }));
    expect(later).not.toBe(a);
  });
});

describe('toNotification', () => {
  it('builds a notification-store row pointing at the linked slice', () => {
    const intent = classifyGithubSyncEvent('issues', payload());
    expect(intent).not.toBeNull();
    const row = toNotification(intent!, 'n1');
    expect(row).toMatchObject({
      id: 'n1',
      severity: 'info',
      source: 'github-sync',
      read: false,
    });
    expect(row.message).toContain('GitHub #115 (M007/S03) closed');
  });
});
