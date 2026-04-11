#!/usr/bin/env node
/**
 * configure.mjs — Interactive .env wizard for Habbo Pixel Agents
 *
 * Usage:
 *   node scripts/configure.mjs           # interactive
 *   node scripts/configure.mjs --dry-run # show diff, do not write
 *   node scripts/configure.mjs --yes     # accept current defaults non-interactively (CI)
 *
 * Flow:
 *   1. Load existing .env (preserves unknown vars)
 *   2. Ask kanban source (github | azuredevops)
 *   3. Always: GITHUB_REPO, GITHUB_TOKEN
 *   4. GitHub kanban: GITHUB_PROJECT_OWNER, _OWNER_TYPE, _NUMBER
 *   5. AzDO: AZDO_ORG, AZDO_PROJECT, AZDO_PAT; optionally GitHub Copilot vars
 *   6. Optional: PORT
 *   7. Compute diff, write (or dry-run)
 */

import { createInterface } from 'readline';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  grey: '\x1b[90m',
};
const isTTY = process.stdout.isTTY;
const c = (code, str) => (isTTY ? `${code}${str}${C.reset}` : str);

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const YES = args.includes('--yes');

// ── .env file path ────────────────────────────────────────────────────────────
const ENV_PATH = resolve(process.cwd(), '.env');

// ── Parse existing .env into a Map (key → value), preserving comments/blanks ─
function parseEnv(text) {
  const map = new Map();
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

// ── Load existing .env or start empty ────────────────────────────────────────
let existingRaw = '';
let existing = new Map();
if (existsSync(ENV_PATH)) {
  existingRaw = readFileSync(ENV_PATH, 'utf8');
  existing = parseEnv(existingRaw);
}

// ── Readline helpers ──────────────────────────────────────────────────────────
let rl;
function openRl() {
  rl = createInterface({ input: process.stdin, output: process.stdout });
}
function closeRl() {
  if (rl) rl.close();
}

/**
 * Prompt the user and return their answer.
 * - Default shown as grey text in brackets.
 * - YES mode: return the default immediately.
 * - If answer is empty, returns the default.
 */
async function ask(label, defaultVal = '', { secret = false, choices = null } = {}) {
  const choiceHint = choices ? ` ${c(C.grey, `[${choices.join('/')}]`)}` : '';
  const defaultHint = defaultVal ? ` ${c(C.grey, `(${secret ? '***' : defaultVal})`)}` : '';
  const prompt = `${c(C.cyan, label)}${choiceHint}${defaultHint}: `;

  if (YES) {
    process.stdout.write(prompt + c(C.dim, defaultVal || '') + '\n');
    return defaultVal;
  }

  return new Promise((res) => {
    rl.question(prompt, (answer) => {
      const val = answer.trim();
      if (!val) { res(defaultVal); return; }
      if (choices && !choices.includes(val)) {
        process.stdout.write(c(C.yellow, `  ✗ Must be one of: ${choices.join(', ')}\n`));
        // Re-ask by recursing — close current rl, re-open
        res(ask(label, defaultVal, { secret, choices }));
        return;
      }
      res(val);
    });
  });
}

// ── Diff helper ───────────────────────────────────────────────────────────────
function diffEnv(before, after) {
  const lines = [];
  for (const [k, v] of after) {
    const prev = before.get(k);
    if (prev === undefined) {
      lines.push(`${c(C.green, '+')} ${k}=${c(C.green, v)}`);
    } else if (prev !== v) {
      lines.push(`${c(C.red, '-')} ${k}=${c(C.dim, prev)}`);
      lines.push(`${c(C.green, '+')} ${k}=${c(C.green, v)}`);
    }
  }
  return lines;
}

// ── Merge new values into existing raw text, add new keys at end ──────────────
function buildEnvText(raw, updates) {
  const lines = raw ? raw.split('\n') : [];
  const written = new Set();

  // Replace existing key=value lines
  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return line;
    const key = line.slice(0, eqIdx).trim();
    if (updates.has(key)) {
      written.add(key);
      const newVal = updates.get(key);
      return `${key}=${newVal}`;
    }
    return line;
  });

  // Append brand-new keys
  const appended = [];
  for (const [k, v] of updates) {
    if (!written.has(k)) {
      appended.push(`${k}=${v}`);
    }
  }

  if (appended.length > 0) {
    // Ensure blank separator before new block
    const trimmed = result[result.length - 1];
    if (trimmed !== '') result.push('');
    result.push(...appended);
  }

  return result.join('\n');
}

// ── Main wizard ───────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(c(C.bold, 'Habbo Pixel Agents — .env configuration wizard'));
  if (DRY_RUN) console.log(c(C.yellow, '  dry-run mode — no files will be written'));
  if (existsSync(ENV_PATH)) {
    console.log(c(C.grey, `  loading existing .env from ${ENV_PATH}`));
  } else {
    console.log(c(C.grey, `  no .env found — will create ${ENV_PATH}`));
  }
  console.log('');

  if (!YES) openRl();

  const updates = new Map();
  const def = (k) => existing.get(k) || '';

  // ── Step 1: Kanban source ──────────────────────────────────────────────────
  console.log(c(C.bold, '── Kanban source ──────────────────────────────────'));
  console.log(c(C.grey, '  Which board drives sticky-note cards on the room wall?'));
  const kanbanSource = await ask('KANBAN_SOURCE', def('KANBAN_SOURCE') || 'github', {
    choices: ['github', 'azuredevops'],
  });
  updates.set('KANBAN_SOURCE', kanbanSource);
  console.log('');

  // ── Step 2: GitHub Copilot monitoring (always required) ───────────────────
  console.log(c(C.bold, '── GitHub Copilot monitoring ───────────────────────'));
  console.log(c(C.grey, '  Required for real-time agent activity in the room.'));

  const githubRepo = await ask('GITHUB_REPO', def('GITHUB_REPO') || 'owner/repo');
  if (githubRepo && githubRepo !== 'owner/repo') updates.set('GITHUB_REPO', githubRepo);

  const githubToken = await ask('GITHUB_TOKEN', def('GITHUB_TOKEN'), { secret: true });
  if (githubToken) updates.set('GITHUB_TOKEN', githubToken);

  const pollInterval = await ask('GITHUB_POLL_INTERVAL (seconds)', def('GITHUB_POLL_INTERVAL') || '15');
  if (pollInterval && pollInterval !== '15') updates.set('GITHUB_POLL_INTERVAL', pollInterval);
  else if (pollInterval === '15' && !def('GITHUB_POLL_INTERVAL')) {
    // leave unset — it's the default
  }
  console.log('');

  // ── Step 3: Source-specific config ───────────────────────────────────────
  if (kanbanSource === 'github') {
    console.log(c(C.bold, '── GitHub Projects kanban ──────────────────────────'));
    console.log(c(C.grey, '  Leave blank to skip kanban integration.'));

    const owner = await ask('GITHUB_PROJECT_OWNER', def('GITHUB_PROJECT_OWNER'));
    if (owner) updates.set('GITHUB_PROJECT_OWNER', owner);

    if (owner) {
      const ownerType = await ask('GITHUB_PROJECT_OWNER_TYPE', def('GITHUB_PROJECT_OWNER_TYPE') || 'org', {
        choices: ['org', 'user'],
      });
      updates.set('GITHUB_PROJECT_OWNER_TYPE', ownerType);

      const projectNumber = await ask('GITHUB_PROJECT_NUMBER', def('GITHUB_PROJECT_NUMBER') || '0');
      if (projectNumber && projectNumber !== '0') updates.set('GITHUB_PROJECT_NUMBER', projectNumber);
    }
  } else {
    // azuredevops
    console.log(c(C.bold, '── Azure DevOps ────────────────────────────────────'));

    const azdoOrg = await ask('AZDO_ORG', def('AZDO_ORG'));
    if (azdoOrg) updates.set('AZDO_ORG', azdoOrg);

    const azdoProject = await ask('AZDO_PROJECT', def('AZDO_PROJECT'));
    if (azdoProject) updates.set('AZDO_PROJECT', azdoProject);

    const azdoPat = await ask('AZDO_PAT', def('AZDO_PAT'), { secret: true });
    if (azdoPat) updates.set('AZDO_PAT', azdoPat);

    const azdoPoll = await ask('AZDO_POLL_INTERVAL (seconds)', def('AZDO_POLL_INTERVAL') || '60');
    if (azdoPoll && azdoPoll !== '60') updates.set('AZDO_POLL_INTERVAL', azdoPoll);
  }
  console.log('');

  // ── Step 4: Server port ───────────────────────────────────────────────────
  console.log(c(C.bold, '── Web server ──────────────────────────────────────'));
  const port = await ask('PORT', def('PORT') || '3000');
  if (port && port !== '3000') updates.set('PORT', port);
  console.log('');

  closeRl();

  // ── Diff ──────────────────────────────────────────────────────────────────
  const diffLines = diffEnv(existing, updates);
  if (diffLines.length === 0) {
    console.log(c(C.grey, 'No changes — .env is already up to date.'));
    process.exit(0);
  }

  console.log(c(C.bold, 'Changes:'));
  for (const line of diffLines) console.log('  ' + line);
  console.log('');

  if (DRY_RUN) {
    console.log(c(C.yellow, 'Dry-run — .env not written.'));
    process.exit(0);
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  const newContent = buildEnvText(existingRaw, updates);
  writeFileSync(ENV_PATH, newContent, 'utf8');
  console.log(c(C.green, `✅ .env updated at ${ENV_PATH}`));
}

main().catch((err) => {
  console.error(c(C.red, `Error: ${err.message}`));
  closeRl();
  process.exit(1);
});
