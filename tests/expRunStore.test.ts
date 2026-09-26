// tests/expRunStore.test.ts
// Unit tests for the experiment run store: section ingestion (latest wins),
// PR linkage, removal, clear, subscriptions, visibility, reset.

import { describe, it, expect } from 'vitest';
import { ExpRunStore } from '../src/state/expRunStore.js';
import type { ExpSectionRecord } from '../src/state/expRunStore.js';

function rec(overrides: Partial<ExpSectionRecord> = {}): ExpSectionRecord {
  return {
    run_id: 'exp-test-1',
    issue: 80,
    path: 'gsd-loop',
    model: 'opencode-go/deepseek-flash',
    section: 'build',
    result: 'done',
    summary: 'did things',
    ...overrides,
  };
}

describe('expRunStore', () => {
  it('starts empty and visible', () => {
    const store = new ExpRunStore();
    expect(store.size).toBe(0);
    expect(store.visible).toBe(true);
    expect(store.all()).toEqual([]);
    expect(store.get('missing')).toBeUndefined();
  });

  it('ingests section records; latest wins per section', () => {
    const store = new ExpRunStore();
    store.ingest(rec({ section: 'build', summary: 'v1' }));
    store.ingest(rec({ section: 'build', summary: 'v2' }));
    store.ingest(rec({ section: 'review', result: 'approved', summary: 'ok' }));
    expect(store.size).toBe(1);
    const run = store.get('exp-test-1');
    expect(run?.sections.build?.summary).toBe('v2');
    expect(run?.sections.review?.result).toBe('approved');
    expect(run?.issue).toBe(80);
    expect(run?.model).toBe('opencode-go/deepseek-flash');
  });

  it('ignores records without run_id or with unknown section', () => {
    const store = new ExpRunStore();
    store.ingest({ ...rec(), run_id: '' });
    store.ingest({ ...rec(), section: 'nope' } as unknown as ExpSectionRecord);
    expect(store.size).toBe(0);
  });

  it('tracks PR linkage via setPr and ingest', () => {
    const store = new ExpRunStore();
    store.ingest(rec());
    expect(store.get('exp-test-1')?.pr).toBeNull();
    store.setPr('exp-test-1', 99, 'https://example.com/pull/99');
    expect(store.get('exp-test-1')?.pr).toBe(99);
    expect(store.get('exp-test-1')?.pr_url).toBe('https://example.com/pull/99');
    store.setPr('missing', 1);
    expect(store.size).toBe(1);
  });

  it('removes runs and clears all', () => {
    const store = new ExpRunStore();
    store.ingest(rec({ run_id: 'a' }));
    store.ingest(rec({ run_id: 'b' }));
    store.removeRun('a');
    expect(store.size).toBe(1);
    expect(store.get('a')).toBeUndefined();
    store.removeRun('missing');
    expect(store.size).toBe(1);
    store.clear();
    expect(store.size).toBe(0);
  });

  it('notifies subscribers on change', () => {
    const store = new ExpRunStore();
    const sizes: number[] = [];
    store.subscribe((state) => sizes.push(state.runs.size));
    store.ingest(rec());
    expect(sizes).toEqual([0, 1]);
  });

  it('toggles visibility and resets', () => {
    const store = new ExpRunStore();
    store.toggleVisible();
    expect(store.visible).toBe(false);
    store.ingest(rec());
    store.reset();
    expect(store.size).toBe(0);
    expect(store.visible).toBe(true);
  });

  it('snapshot returns runs array and visibility', () => {
    const store = new ExpRunStore();
    store.ingest(rec());
    const snap = store.snapshot();
    expect(snap.runs).toHaveLength(1);
    expect(snap.runs[0].run_id).toBe('exp-test-1');
    expect(snap.visible).toBe(true);
  });
});
