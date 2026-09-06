// src/degradations.ts
// Registry of active degraded states, surfaced in the status bar instead of
// console-only warnings. A degradation is a condition where the app is running
// with reduced data/capability (missing atlas, failed board fetch, WS
// reconnecting, incomplete figure assets).

export interface Degradation {
  id: string;
  detail: string;
  since: number;
}

const active = new Map<string, Degradation>();
const subscribers = new Set<(list: Degradation[]) => void>();

function notify(): void {
  const snapshot = getDegradations();
  for (const cb of subscribers) cb(snapshot);
}

export function reportDegradation(id: string, detail: string): void {
  const existing = active.get(id);
  if (existing && existing.detail === detail) return;
  active.set(id, { id, detail, since: existing?.since ?? Date.now() });
  notify();
}

export function clearDegradation(id: string): void {
  if (!active.has(id)) return;
  active.delete(id);
  notify();
}

export function getDegradations(): Degradation[] {
  return [...active.values()];
}

export function onDegradations(cb: (list: Degradation[]) => void): () => void {
  subscribers.add(cb);
  cb(getDegradations());
  return () => subscribers.delete(cb);
}
