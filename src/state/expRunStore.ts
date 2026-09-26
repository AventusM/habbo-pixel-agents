// src/state/expRunStore.ts
// Experiment run store (M004/S03): one entry per active experiment run
// (run_id -> issue/model/sections/PR), fed by hook-record JSONL lines and the
// translate-loop run records. Backed by the zustand store wrapper (D005), so
// subscribers get state-sync semantics like the other domain stores.

import { createStore, type Store, type Unsubscribe } from './store.js';

export type ExpSection = 'spec' | 'build' | 'review' | 'merge';
export type ExpResult =
  | 'done'
  | 'idle'
  | 'blocked'
  | 'rework'
  | 'approved'
  | 'merged'
  | 'failed';

export const EXP_SECTIONS_IN_ORDER: ExpSection[] = ['spec', 'build', 'review', 'merge'];

const VALID_SECTIONS = new Set<string>(EXP_SECTIONS_IN_ORDER);

/** One hook-record line or one entry of a translate-loop run record. */
export interface ExpSectionRecord {
  run_id: string;
  issue: number | null;
  path: string | null;
  model: string | null;
  section: ExpSection;
  started_at?: string | null;
  ended_at?: string | null;
  result: ExpResult;
  summary: string;
  tool_calls?: number | null;
  tests?: string | null;
  verdict?: string | null;
  verdict_url?: string | null;
  branch?: string | null;
  pr?: number | null;
  pr_url?: string | null;
}

export interface ExpRunState {
  run_id: string;
  issue: number | null;
  path: string | null;
  model: string | null;
  branch: string | null;
  pr: number | null;
  pr_url: string | null;
  sections: Partial<Record<ExpSection, ExpSectionRecord>>;
  updatedAt: string;
}

export interface ExpRunStoreState {
  runs: ReadonlyMap<string, ExpRunState>;
  visible: boolean;
}

export function isExpSection(value: unknown): value is ExpSection {
  return typeof value === 'string' && VALID_SECTIONS.has(value);
}

export class ExpRunStore {
  private readonly store: Store<ExpRunStoreState> = createStore<ExpRunStoreState>({
    runs: new Map(),
    visible: true,
  });

  get size(): number {
    return this.store.get().runs.size;
  }

  get visible(): boolean {
    return this.store.get().visible;
  }

  get(runId: string): ExpRunState | undefined {
    return this.store.get().runs.get(runId);
  }

  all(): ExpRunState[] {
    return [...this.store.get().runs.values()];
  }

  /** Read-only view for render consumers (matches agentStore.snapshot()). */
  snapshot(): { runs: ExpRunState[]; visible: boolean } {
    const state = this.store.get();
    return { runs: [...state.runs.values()], visible: state.visible };
  }

  subscribe(listener: (state: ExpRunStoreState) => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  subscribeSelector<S>(
    selector: (state: ExpRunStoreState) => S,
    listener: (selected: S) => void,
  ): Unsubscribe {
    return this.store.subscribeSelector(selector, listener);
  }

  /** Ingest one section record; the latest record wins per section. */
  ingest(record: ExpSectionRecord): void {
    if (!record || typeof record.run_id !== 'string' || !record.run_id) return;
    if (!isExpSection(record.section)) return;
    this.store.update((prev) => {
      const runs = new Map(prev.runs);
      const now = new Date().toISOString();
      const existing = runs.get(record.run_id);
      if (existing) {
        const sections: Partial<Record<ExpSection, ExpSectionRecord>> = {
          ...existing.sections,
        };
        sections[record.section] = record;
        runs.set(record.run_id, {
          ...existing,
          issue: record.issue ?? existing.issue,
          path: record.path ?? existing.path,
          model: record.model ?? existing.model,
          branch: record.branch ?? existing.branch,
          pr: record.pr ?? existing.pr,
          pr_url: record.pr_url ?? existing.pr_url,
          sections,
          updatedAt: now,
        });
      } else {
        const sections: Partial<Record<ExpSection, ExpSectionRecord>> = {};
        sections[record.section] = record;
        runs.set(record.run_id, {
          run_id: record.run_id,
          issue: record.issue,
          path: record.path,
          model: record.model,
          branch: record.branch ?? null,
          pr: record.pr ?? null,
          pr_url: record.pr_url ?? null,
          sections,
          updatedAt: now,
        });
      }
      return { ...prev, runs };
    });
  }

  setPr(runId: string, pr: number, prUrl?: string): void {
    this.store.update((prev) => {
      const existing = prev.runs.get(runId);
      if (!existing) return prev;
      const runs = new Map(prev.runs);
      runs.set(runId, {
        ...existing,
        pr,
        pr_url: prUrl ?? existing.pr_url,
        updatedAt: new Date().toISOString(),
      });
      return { ...prev, runs };
    });
  }

  removeRun(runId: string): void {
    this.store.update((prev) => {
      if (!prev.runs.has(runId)) return prev;
      const runs = new Map(prev.runs);
      runs.delete(runId);
      return { ...prev, runs };
    });
  }

  clear(): void {
    this.store.update((prev) =>
      prev.runs.size === 0 ? prev : { ...prev, runs: new Map() },
    );
  }

  toggleVisible(): void {
    this.store.update((prev) => ({ ...prev, visible: !prev.visible }));
  }

  reset(): void {
    this.store.set({ runs: new Map(), visible: true });
  }
}

export const expRunStore = new ExpRunStore();
