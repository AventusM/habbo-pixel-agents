#!/usr/bin/env node
/**
 * Register (or update) the GitHub repo webhook that drives the wall's
 * `webhook` board source for low-latency updates.
 *
 * Provider-agnostic: pass any publicly reachable HTTPS URL — a Tailscale
 * `funnel` route, a reverse proxy, or a tunnel. GitHub cannot POST to a
 * tailnet-only `serve` URL, so only the funnel/webhook path uses this helper;
 * the default `probe` path needs no webhook at all.
 *
 * Requires the `gh` CLI, authenticated. Never prints the secret.
 *
 * Usage:
 *   node scripts/register-webhook.mjs --url https://host/webhooks/github
 *   node scripts/register-webhook.mjs --url ... --repo owner/name --secret ...
 *
 * Options:
 *   --url URL       Public HTTPS endpoint (required)
 *   --repo OWNER/R  Target repo; defaults to $GITHUB_REPO
 *   --secret S      HMAC secret; defaults to $WEBHOOK_SECRET (required)
 *   --events LIST   Comma-separated events; default issues,projects_v2_item
 *   --dry-run       Print the gh commands instead of running them
 *   --help          Show this text
 */
import { execFileSync } from 'node:child_process';

const DEFAULT_EVENTS = ['issues', 'projects_v2_item'];

function parseArgs(argv) {
  const opts = { events: DEFAULT_EVENTS, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) {
        console.error(`Missing value for ${arg}`);
        process.exit(2);
      }
      return value;
    };
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--url') opts.url = next();
    else if (arg === '--repo') opts.repo = next();
    else if (arg === '--secret') opts.secret = next();
    else if (arg === '--events') opts.events = next().split(',').map((e) => e.trim()).filter(Boolean);
    else if (arg === '--dry-run') opts.dryRun = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

const HELP = `Register or update the GitHub webhook for the wall's live board.

Usage:
  node scripts/register-webhook.mjs --url https://host/webhooks/github

Options:
  --url URL       Public HTTPS endpoint (required)
  --repo OWNER/R  Target repo; defaults to $GITHUB_REPO
  --secret S      HMAC secret; defaults to $WEBHOOK_SECRET (required)
  --events LIST   Comma-separated events; default ${DEFAULT_EVENTS.join(',')}
  --dry-run       Print the gh commands instead of running them
  --help          Show this text`;

function gh(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8' });
  } catch (err) {
    const detail = (err.stderr || err.message || '').toString().trim();
    throw new Error(`gh ${args[0]} failed: ${detail}`);
  }
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log(HELP);
  process.exit(0);
}

const repo = opts.repo || process.env.GITHUB_REPO || '';
const secret = opts.secret || process.env.WEBHOOK_SECRET || '';

if (!opts.url) {
  console.error('Error: --url is required (the public HTTPS webhook endpoint).');
  console.error(HELP);
  process.exit(2);
}
if (!/^https:\/\//i.test(opts.url)) {
  console.error(`Error: --url must be an https:// URL (got ${opts.url}).`);
  console.error('GitHub cannot deliver hooks to http:// or tailnet-only serve URLs; use `tailscale funnel`.');
  process.exit(2);
}
if (!repo || !repo.includes('/')) {
  console.error('Error: --repo OWNER/REPO (or GITHUB_REPO) is required.');
  process.exit(2);
}
if (!secret) {
  console.error('Error: --secret (or WEBHOOK_SECRET) is required.');
  console.error('On a funnel route HMAC validation is mandatory; a webhook without a secret leaves the server in probe mode.');
  process.exit(2);
}

const [owner, name] = repo.split('/');
const hookPath = `repos/${owner}/${name}/hooks`;
const config = [
  `config[url]=${opts.url}`,
  'config[content_type]=json',
  `config[secret]=${secret}`,
];

// `gh api` needs every field behind its own flag; a bare `key=value` is read
// as a positional endpoint argument and fails with `accepts 1 arg(s), received
// N`. Keys with `[]`/`[sub]` still nest correctly when passed after `-f`.
const asFields = (pairs) => pairs.flatMap((pair) => ['-f', pair]);

// `gh api` reads the secret through argv; keep it out of any printed command.
const redact = (value) => (value.includes(secret) ? value.replace(secret, '***') : value);

if (opts.dryRun) {
  const redacted = config.map(redact);
  const events = opts.events.map((e) => `events[]=${e}`);
  console.log('Dry run — no changes made. Commands that would run:');
  console.log('  gh', ['api', hookPath].join(' '));
  console.log(
    '  gh',
    [
      'api', hookPath, '--method', 'POST',
      '-f', 'name=web', '-F', 'active=true',
      ...asFields(events), ...asFields(redacted),
    ].join(' '),
  );
  console.log(
    '  gh',
    [
      'api', `repos/${owner}/${name}/hooks/<id>`, '--method', 'PATCH',
      ...asFields(redacted), ...asFields(events),
    ].join(' '),
  );
  process.exit(0);
}

let existingId = null;
try {
  const hooks = JSON.parse(gh(['api', hookPath]) || '[]');
  const match = hooks.find((h) => h?.config?.url === opts.url);
  existingId = match?.id ?? null;
} catch (err) {
  console.error(`Error: could not list existing hooks. ${err.message}`);
  console.error('Ensure the gh CLI is authenticated with repo admin scope.');
  process.exit(1);
}

const events = opts.events.map((e) => `events[]=${e}`);
try {
  if (existingId) {
    const args = [
      'api', `repos/${owner}/${name}/hooks/${existingId}`,
      '--method', 'PATCH', ...asFields(config), ...asFields(events),
    ];
    gh(args);
    console.log(`Updated webhook #${existingId} → ${opts.url} (${opts.events.join(', ')})`);
  } else {
    const args = [
      'api', hookPath,
      '--method', 'POST',
      '-f', 'name=web',
      '-F', 'active=true',
      ...asFields(events),
      ...asFields(config),
    ];
    gh(args);
    console.log(`Created webhook → ${opts.url} (${opts.events.join(', ')})`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

console.log('');
console.log('Next: set WEBHOOK_SECRET in .env, run the wall, and confirm the');
console.log('status chip reads "board: webhook". Verify /health responds too.');
