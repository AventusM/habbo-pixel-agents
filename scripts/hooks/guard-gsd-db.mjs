#!/usr/bin/env node
// scripts/hooks/guard-gsd-db.mjs
// M003 gsd-loop trial (issue #84, O-3): Copilot preToolUse guardrail.
// DENIES direct writes to the GSD SQLite database — the .gsd state store is
// authoritative and must only change through the GSD CLI/MCP (which validate
// idempotency and projection consistency). Reads stdin JSON per the Copilot
// hooks contract: { tool_name, tool_input: { command? | file_path? | ... } }.
// Deny = non-zero exit with a reason on stderr. Allow = silent exit 0.

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // can't parse -> allow; the agent logs the error anyway
  }

  const tool = String(payload.tool_name ?? '');
  const input = JSON.stringify(payload.tool_input ?? {});

  // Direct manipulation of the GSD state database or its WAL files
  const GSD_DB_PATTERN = /gsd\.db(-wal|-shm)?/;

  if (tool === 'Bash' && GSD_DB_PATTERN.test(input)) {
    console.error(
      'BLOCKED: direct writes to .gsd/gsd.db are not allowed. ' +
        'Use the GSD CLI (gsd ...) or the gsd_gsd_* MCP tools — they enforce ' +
        'idempotency keys and projection consistency.',
    );
    process.exit(2); // deny
  }

  if ((tool === 'Write' || tool === 'Edit') && GSD_DB_PATTERN.test(input)) {
    console.error(
      'BLOCKED: .gsd/gsd.db is machine-managed. Use the GSD CLI/MCP tools.',
    );
    process.exit(2); // deny
  }

  process.exit(0); // allow
});
