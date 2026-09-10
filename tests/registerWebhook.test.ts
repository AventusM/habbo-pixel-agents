// tests/registerWebhook.test.ts
// Regression for #80 O-3: the webhook-registration helper must pass every
// events[]/config[] pair behind a `gh api` field flag. Bare `key=value`
// arguments are read as positional endpoint args and the request never lands.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'scripts', 'register-webhook.mjs');

// Records each `gh` invocation as a CALL-delimited block of argv lines, then
// returns the canned list response (so create/update paths can be exercised).
const GH_STUB = `#!/bin/sh
{
  printf 'CALL\\n'
  for a in "$@"; do printf '%s\\n' "$a"; done
} >> "$GH_ARGS_FILE"
printf '%s' "$GH_STUB_RESPONSE"
`;

interface RunResult {
  calls: string[][];
  stdout: string;
}

function runScript(args: string[], listResponse: string): RunResult {
  const dir = mkdtempSync(join(tmpdir(), 'gh-stub-'));
  const argsFile = join(dir, 'args.txt');
  const ghPath = join(dir, 'gh');
  writeFileSync(ghPath, GH_STUB);
  chmodSync(ghPath, 0o755);
  writeFileSync(argsFile, '');

  const stdout = execFileSync('node', [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GH_ARGS_FILE: argsFile,
      GH_STUB_RESPONSE: listResponse,
    },
  });

  const raw = readFileSync(argsFile, 'utf8');
  rmSync(dir, { recursive: true, force: true });

  const calls = raw
    .split('CALL\n')
    .filter((block) => block.trim() !== '')
    .map((block) => block.split('\n').filter((line) => line !== ''));

  return { calls, stdout };
}

function assertFieldsFlagged(call: string[]) {
  for (let i = 0; i < call.length; i++) {
    if (/^(events\[\]|config\[|name=|active=)/.test(call[i])) {
      expect(['-f', '-F']).toContain(call[i - 1]);
    }
  }
}

describe('register-webhook helper (#80 O-3)', () => {
  const baseArgs = ['--url', 'https://example.com/hook', '--repo', 'o/r', '--secret', 's3cret'];

  it('flags every create field so the request reaches the API', () => {
    const { calls } = runScript(baseArgs, '[]');
    const create = calls.find((c) => c.includes('--method') && c.includes('POST'));
    expect(create).toEqual([
      'api', 'repos/o/r/hooks', '--method', 'POST',
      '-f', 'name=web', '-F', 'active=true',
      '-f', 'events[]=issues', '-f', 'events[]=projects_v2_item',
      '-f', 'config[url]=https://example.com/hook',
      '-f', 'config[content_type]=json',
      '-f', 'config[secret]=s3cret',
    ]);
    assertFieldsFlagged(create!);
  });

  it('flags every update field so the request reaches the API', () => {
    const { calls } = runScript(
      baseArgs,
      '[{"id":42,"config":{"url":"https://example.com/hook"}}]',
    );
    const patch = calls.find((c) => c.includes('--method') && c.includes('PATCH'));
    expect(patch).toEqual([
      'api', 'repos/o/r/hooks/42', '--method', 'PATCH',
      '-f', 'config[url]=https://example.com/hook',
      '-f', 'config[content_type]=json',
      '-f', 'config[secret]=s3cret',
      '-f', 'events[]=issues', '-f', 'events[]=projects_v2_item',
    ]);
    assertFieldsFlagged(patch!);
  });

  it('respects a custom --events list', () => {
    const { calls } = runScript([...baseArgs, '--events', 'push,issues'], '[]');
    const create = calls.find((c) => c.includes('--method') && c.includes('POST'));
    expect(create).toContain('events[]=push');
    expect(create).toContain('events[]=issues');
    expect(create).not.toContain('events[]=projects_v2_item');
    assertFieldsFlagged(create!);
  });

  it('prints field-flagged invocations in --dry-run', () => {
    const { stdout } = runScript([...baseArgs, '--dry-run'], '[]');
    const fieldLines = stdout.split('\n').filter((line) => /events\[\]|config\[/.test(line));
    expect(fieldLines.length).toBeGreaterThan(0);
    for (const line of fieldLines) {
      const tokens = line.trim().split(/\s+/);
      for (let i = 0; i < tokens.length; i++) {
        if (/^(events\[\]|config\[)/.test(tokens[i])) {
          expect(tokens[i - 1]).toBe('-f');
        }
      }
    }
    expect(stdout).toContain('-f events[]=issues');
    expect(stdout).not.toContain('s3cret');
  });
});
