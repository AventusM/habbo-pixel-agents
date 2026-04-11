/**
 * envConfig.ts — Read and write .env files for the workspace root.
 * Used by both the VS Code configure command and shared logic.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Parse an .env file into a key→value Map.
 * Comments and blank lines are skipped; unknown keys are preserved in the map.
 */
export function readEnvFile(wsRoot: string): Map<string, string> {
  const envPath = join(wsRoot, '.env');
  if (!existsSync(envPath)) return new Map();
  const text = readFileSync(envPath, 'utf8');
  const map = new Map<string, string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    map.set(key, val);
  }
  return map;
}

/**
 * Merge `updates` into the existing .env at `wsRoot`.
 * - Replaces existing keys in-place (preserving surrounding lines).
 * - Appends new keys at the end.
 * - Empty string values are written as KEY= (not skipped).
 */
export function writeEnvFile(wsRoot: string, updates: Map<string, string>): void {
  const envPath = join(wsRoot, '.env');
  const raw = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const lines = raw ? raw.split('\n') : [];
  const written = new Set<string>();

  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return line;
    const key = line.slice(0, eqIdx).trim();
    if (updates.has(key)) {
      written.add(key);
      return `${key}=${updates.get(key)}`;
    }
    return line;
  });

  const appended: string[] = [];
  for (const [k, v] of updates) {
    if (!written.has(k)) {
      appended.push(`${k}=${v}`);
    }
  }

  if (appended.length > 0) {
    if (result[result.length - 1] !== '') result.push('');
    result.push(...appended);
  }

  writeFileSync(envPath, result.join('\n'), 'utf8');
}
