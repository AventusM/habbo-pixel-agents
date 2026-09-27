#!/usr/bin/env node
// MCP stdio proxy for the GSD MCP server.
// opencode's MCP client does not send request _meta, which GSD 1.18 planning
// mutations require for idempotency (_meta["io.opengsd/idempotency-key"]).
// This proxy injects a replay-stable key derived from tool name + arguments.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REAL_SERVER =
  '/Users/antonmoroz/.volta/tools/image/packages/@opengsd/gsd-pi/lib/node_modules/@opengsd/gsd-pi/packages/mcp-server/bin/gsd-mcp-server.js';

const IDEMPOTENCY_KEY = 'io.opengsd/idempotency-key';

// The GSD MCP server anchors planning mutations to its process cwd, not to the
// projectDir argument. Harnesses start this proxy with the agent's cwd — a
// worktree when the agent runs isolated — so planning writes would land in the
// worktree's local .gsd/gsd.db instead of the project's. Pin the child's cwd to
// the checkout that owns this proxy; that checkout is the project root.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function stableKey(params) {
  const { _meta, ...rest } = params ?? {};
  const json = JSON.stringify({ name: rest.name, arguments: rest.arguments ?? {} });
  return createHash('sha256').update(json).digest('hex').slice(0, 32);
}

const child = spawn(process.execPath, [REAL_SERVER], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
  cwd: PROJECT_ROOT,
});
process.stderr.write(`[gsd-mcp-proxy] project root pinned to ${PROJECT_ROOT}\n`);

let childBuf = '';
child.stdout.on('data', (chunk) => {
  childBuf += chunk.toString();
  let idx;
  while ((idx = childBuf.indexOf('\n')) !== -1) {
    const line = childBuf.slice(0, idx);
    childBuf = childBuf.slice(idx + 1);
    if (line.trim()) process.stdout.write(line + '\n');
  }
});

let selfBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  selfBuf += chunk;
  let idx;
  while ((idx = selfBuf.indexOf('\n')) !== -1) {
    const line = selfBuf.slice(0, idx);
    selfBuf = selfBuf.slice(idx + 1);
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(line + '\n');
      continue;
    }
    if (
      msg.method === 'tools/call' &&
      msg.params &&
      typeof msg.params.name === 'string'
    ) {
      msg.params = { ...msg.params, _meta: { ...(msg.params._meta ?? {}), [IDEMPOTENCY_KEY]: stableKey(msg.params) } };
    }
    child.stdin.write(JSON.stringify(msg) + '\n');
  }
});

process.stdin.on('end', () => child.stdin.end());
child.on('exit', (code) => process.exit(code ?? 0));
