#!/usr/bin/env node
// scripts/hooks/room-tool-feed.mjs
// PROTOTYPE (M003/S07): a Claude Code PostToolUse hook that tags tool activity
// with the agent's ROLE and appends it to a room-visible feed.
//
// Demonstrates the deterministic-reaction data path for room-visualized team
// roles (planning / core-dev / infrastructure / support): tool usage is
// already shown per agent in the room via JSONL transcript watching — this
// hook adds a ROLE-AWARE, structured feed that could drive role-specific
// automation (e.g. an asset-pipeline agent triggering pack scripts, a
// visual-regression agent triggering screenshot diffs).
//
// Claude Code PostToolUse contract: receives JSON on stdin like
//   { "session_id": "...", "tool_name": "Bash", "tool_input": {...},
//     "tool_response": {...} }
// and may print JSON to stdout (e.g. {"suppressOutput":true}) or nothing.
//
// Config via env:
//   AGENT_ROLE   one of: planning | core-dev | infrastructure | support
//                (default: core-dev). In practice, set per terminal/session
//                so each agent role carries its own hook behavior.
//   HOOK_FEED    feed file (default: .gsd/hooks-feed.jsonl)

import fs from 'fs';

const ROLE = process.env.AGENT_ROLE ?? 'core-dev';
const FEED = process.env.HOOK_FEED ?? '.gsd/hooks-feed.jsonl';

// Role-specific deterministic reactions to tool usage
const ROLE_REACTIONS = {
  'asset-pipeline': [/pack-.*sprites/, /esbuild\.config/],
  'visual-regression': [/vitest/, /screenshot/],
  planning: [/gsd.*plan/, /decision/],
  'core-dev': [/vitest/, /typecheck/],
  infrastructure: [/docker|deploy|webhook/],
  support: [],
};

function stdinJson() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
  });
}

const payload = await stdinJson();
if (!payload || !payload.tool_name) {
  process.exit(0); // not a tool event we understand; stay silent
}

const inputStr = JSON.stringify(payload.tool_input ?? {});
const triggers = ROLE_REACTIONS[ROLE] ?? [];
const matched = triggers.some((re) => re.test(inputStr));

// Feed only meaningful events (matched role triggers + all Write/Edit for
// surface-area reduction); suppress pure-read noise.
const interesting = matched || /^(Write|Edit|MultiEdit)$/.test(payload.tool_name);

if (interesting) {
  const event = {
    source: 'room-tool-feed',
    ts: new Date().toISOString(),
    role: ROLE,
    sessionId: payload.session_id,
    tool: payload.tool_name,
    matchedRoleTrigger: matched,
    summary: String(payload.tool_input?.file_path ?? payload.tool_input?.command ?? payload.tool_name).slice(0, 120),
  };
  fs.appendFileSync(FEED, JSON.stringify(event) + '\n');
}

// Always suppress output so the agent conversation is not polluted
process.stdout.write(JSON.stringify({ suppressOutput: true }));
