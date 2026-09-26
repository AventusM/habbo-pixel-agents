// src/state/outfitPersistence.ts
// Versioned localStorage persistence for per-role outfit drafts (M006/S03 T01).
//
// Pure save/load functions over an injectable storage surface: the browser
// passes `localStorage`, unit tests pass an in-memory fake, and server/SSR or
// private-mode contexts resolve to null without throwing. Load validates shape,
// version, and role keys strictly — corrupt, wrong-version, or missing storage
// returns null so callers fall back to ROLE_OUTFIT_PRESETS; unknown role keys
// are ignored and invalid partial drafts are dropped per role.
// serializeOutfitDrafts/parseOutfitDraftsFile expose the same versioned
// envelope as a JSON file round-trip (export download + import upload).
import type { OutfitConfig } from '../avatarOutfitConfig.js';
import type { TeamSection } from '../agentTypes.js';
import { TEAM_SECTIONS } from './outfitStore.js';

/** Storage schema version. Bump when the persisted shape changes. */
export const OUTFIT_STORAGE_VERSION = 1;

/** Namespaced storage key for per-role outfit drafts. */
export const OUTFIT_STORAGE_KEY = 'habbo-pixel-agents:outfits:v1';

/** Minimal storage surface (subset of the Web Storage API). */
export interface OutfitStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Drafts keyed by role; only valid roles are ever present. */
export type OutfitDraftRecord = Record<TeamSection, OutfitConfig>;

interface PersistedOutfitPayload {
  version: number;
  drafts: Record<string, unknown>;
}

/** Resolve the ambient browser storage, or null outside a browser (or when
 * access itself throws, e.g. blocked third-party storage). Never throws. */
export function defaultOutfitStorage(): OutfitStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Probe once: some contexts expose localStorage but throw on access.
    const probeKey = `${OUTFIT_STORAGE_KEY}:probe`;
    localStorage.getItem(probeKey);
    return localStorage;
  } catch {
    return null;
  }
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isPartSlot(value: unknown): value is { asset: string; setId: number } {
  if (typeof value !== 'object' || value === null) return false;
  const slot = value as Record<string, unknown>;
  return (
    typeof slot['asset'] === 'string' &&
    (slot['asset'] as string).length > 0 &&
    typeof slot['setId'] === 'number' &&
    Number.isFinite(slot['setId'])
  );
}

/** Strict validator: unknown roles are rejected by the caller, partial or
 * malformed drafts are rejected here. Returns a fresh deep clone so the
 * caller can never write through to shared module state. */
export function isValidOutfitDraft(value: unknown): value is OutfitConfig {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  if (draft['gender'] !== 'M' && draft['gender'] !== 'F') return false;
  const parts = draft['parts'];
  const colors = draft['colors'];
  if (typeof parts !== 'object' || parts === null) return false;
  if (typeof colors !== 'object' || colors === null) return false;
  const partSlots = parts as Record<string, unknown>;
  for (const slot of ['hair', 'shirt', 'pants', 'shoes'] as const) {
    if (!isPartSlot(partSlots[slot])) return false;
  }
  const colorSlots = colors as Record<string, unknown>;
  for (const slot of ['skin', 'hair', 'shirt', 'pants', 'shoes'] as const) {
    const color = colorSlots[slot];
    if (typeof color !== 'string' || !HEX_COLOR_RE.test(color)) return false;
  }
  return true;
}

function cloneOutfit(outfit: OutfitConfig): OutfitConfig {
  return {
    gender: outfit.gender,
    parts: {
      hair: { ...outfit.parts.hair },
      shirt: { ...outfit.parts.shirt },
      pants: { ...outfit.parts.pants },
      shoes: { ...outfit.parts.shoes },
    },
    colors: { ...outfit.colors },
  };
}

/**
 * Build the versioned envelope shared by storage saves and file exports.
 * Only known TeamSection roles with valid drafts are included; unknown keys
 * and invalid partial drafts are dropped.
 */
function encodeOutfitDrafts(drafts: Partial<Record<string, OutfitConfig>>): PersistedOutfitPayload {
  const knownRoles = new Set<string>(TEAM_SECTIONS);
  const payload: PersistedOutfitPayload = { version: OUTFIT_STORAGE_VERSION, drafts: {} };
  for (const [role, draft] of Object.entries(drafts)) {
    if (!knownRoles.has(role)) continue;
    if (!isValidOutfitDraft(draft)) continue;
    payload.drafts[role] = cloneOutfit(draft);
  }
  return payload;
}

/**
 * Validate a parsed envelope: version must match and `drafts` must be an
 * object. Returns null for version-mismatched or non-object payloads;
 * otherwise a record holding only the valid known-role drafts (unknown role
 * keys ignored, invalid partial drafts dropped).
 */
function decodeOutfitPayload(payload: unknown): Partial<OutfitDraftRecord> | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const envelope = payload as Record<string, unknown>;
  if (envelope['version'] !== OUTFIT_STORAGE_VERSION) return null;
  if (typeof envelope['drafts'] !== 'object' || envelope['drafts'] === null) return null;
  const knownRoles = new Set<string>(TEAM_SECTIONS);
  const result: Partial<OutfitDraftRecord> = {};
  for (const [role, draft] of Object.entries(envelope['drafts'] as Record<string, unknown>)) {
    if (!knownRoles.has(role)) continue;
    if (!isValidOutfitDraft(draft)) continue;
    result[role as TeamSection] = cloneOutfit(draft);
  }
  return result;
}

/**
 * Serialize per-role outfit drafts to a JSON file string. Same versioned
 * envelope as the localStorage payload, so an export round-trips through
 * parseOutfitDraftsFile. Follows the layout-JSON file precedent
 * (src/isoLayoutEditor.ts saveLayout). Never throws for valid drafts.
 */
export function serializeOutfitDrafts(
  drafts: Partial<Record<string, OutfitConfig>>,
): string {
  return JSON.stringify(encodeOutfitDrafts(drafts), null, 2);
}

/**
 * Parse an outfit JSON file string (the export counterpart of
 * serializeOutfitDrafts, the load counterpart of loadLayout). Returns null
 * when the text is corrupt JSON, version-mismatched, or a non-object payload
 * (callers reject the file); otherwise the valid known-role drafts. Never
 * throws.
 */
export function parseOutfitDraftsFile(jsonString: string): Partial<OutfitDraftRecord> | null {
  let payload: unknown;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    return null;
  }
  return decodeOutfitPayload(payload);
}

/**
 * Persist per-role outfit drafts. Only known TeamSection roles are written;
 * unknown keys are dropped. Never throws — unavailable storage is a no-op.
 */
export function saveOutfitDrafts(
  drafts: Partial<Record<string, OutfitConfig>>,
  storage: OutfitStorage | null = defaultOutfitStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(OUTFIT_STORAGE_KEY, JSON.stringify(encodeOutfitDrafts(drafts)));
  } catch {
    // Private mode / quota / unavailable storage: persistence is best-effort.
  }
}

/**
 * Load persisted per-role outfit drafts. Returns null when storage is missing,
 * unreadable, corrupt, or version-mismatched (callers fall back to presets);
 * otherwise a record holding only the valid known-role drafts (unknown role
 * keys ignored, invalid partial drafts dropped). Never throws.
 */
export function loadOutfitDrafts(
  storage: OutfitStorage | null = defaultOutfitStorage(),
): Partial<OutfitDraftRecord> | null {
  if (storage === null) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(OUTFIT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  return decodeOutfitPayload(payload);
}
