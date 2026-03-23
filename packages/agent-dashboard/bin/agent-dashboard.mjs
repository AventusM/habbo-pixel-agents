#!/usr/bin/env node
/**
 * CLI entry point for @anthropic-claude/agent-dashboard
 *
 * Usage:
 *   npx @anthropic-claude/agent-dashboard owner/repo
 *   npx @anthropic-claude/agent-dashboard --repo owner/repo --port 3000
 *
 * Environment variables (also read from .env):
 *   GITHUB_TOKEN  — GitHub PAT for API access (required)
 *   GITHUB_REPO   — owner/repo (alternative to CLI arg)
 *   PORT          — server port (default: 3000)
 *   AZDO_ORG, AZDO_PROJECT, AZDO_PAT — optional Azure DevOps integration
 */
import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

// --- Argument parsing ---
function parseArgs() {
  const args = process.argv.slice(2);
  let repo = process.env.GITHUB_REPO || '';
  let token = process.env.GITHUB_TOKEN || '';
  let port = parseInt(process.env.PORT || '3000', 10);
  let projectDir = process.cwd();
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--repo' && args[i + 1]) {
      repo = args[++i];
    } else if (arg === '--token' && args[i + 1]) {
      token = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      port = parseInt(args[++i], 10);
    } else if (arg === '--project' && args[i + 1]) {
      projectDir = path.resolve(args[++i]);
    } else if (!arg.startsWith('-') && arg.includes('/') && !repo) {
      // Positional: owner/repo
      repo = arg;
    }
  }

  return { repo, token, port, projectDir, help };
}

function printUsage() {
  console.log(`
  agent-dashboard — Real-time web dashboard for GitHub Copilot coding agents

  Usage:
    npx @anthropic-claude/agent-dashboard owner/repo
    npx @anthropic-claude/agent-dashboard --repo owner/repo [options]

  Options:
    --repo <owner/repo>    GitHub repository to monitor
    --token <token>        GitHub PAT (or set GITHUB_TOKEN env var)
    --port <number>        Server port (default: 3000)
    --project <path>       Project directory for local JSONL agent watching
    -h, --help             Show this help

  Environment variables:
    GITHUB_TOKEN           GitHub Personal Access Token (required)
    GITHUB_REPO            owner/repo (alternative to CLI arg)
    PORT                   Server port (default: 3000)
    AZDO_ORG               Azure DevOps organization (optional)
    AZDO_PROJECT           Azure DevOps project (optional)
    AZDO_PAT               Azure DevOps PAT (optional)
`);
}

// --- MIME types ---
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ttf':  'font/ttf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.map':  'application/json',
};

// --- Main ---
async function main() {
  const config = parseArgs();

  if (config.help) {
    printUsage();
    process.exit(0);
  }

  if (!config.repo) {
    console.error('Error: repository required. Usage: agent-dashboard owner/repo');
    console.error('  Or set GITHUB_REPO=owner/repo in environment / .env file');
    process.exit(1);
  }

  if (!config.token) {
    console.error('Error: GitHub token required.');
    console.error('  Set GITHUB_TOKEN in environment or .env file, or use --token flag');
    process.exit(1);
  }

  const [owner, repo] = config.repo.includes('/')
    ? config.repo.split('/')
    : ['', config.repo];

  if (!owner || !repo) {
    console.error('Error: repository must be in owner/repo format');
    process.exit(1);
  }

  // Resolve dashboard static files
  const DIST_DIR = path.resolve(PACKAGE_ROOT, 'dist', 'dashboard');

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Error: Dashboard files not found at ${DIST_DIR}`);
    console.error('The package may not have been built correctly.');
    process.exit(1);
  }

  // --- HTTP Server ---
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${config.port}`).pathname);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(DIST_DIR, urlPath);
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA fallback
        if (!path.extname(urlPath)) {
          const indexPath = path.join(DIST_DIR, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            fs.createReadStream(indexPath).pipe(res);
            return;
          }
        }
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  // --- WebSocket Server ---
  const wss = new WebSocketServer({ server });
  const clients = new Set();

  function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);

    // Send current sessions to newly connected client
    if (copilotMonitor) {
      for (const session of copilotMonitor.getSessions()) {
        ws.send(JSON.stringify({
          type: 'agentCreated',
          agentId: session.id,
          terminalName: copilotMonitor.getDisplayName(session.branch),
          variant: 0,
          team: 'core-dev',
          role: 'Copilot',
          taskArea: session.title,
        }));
        ws.send(JSON.stringify({
          type: 'agentStatus',
          agentId: session.id,
          status: session.isRunning ? 'active' : 'idle',
        }));
        if (session.lastStatus) {
          const ticketPrefix = session.linkedTicketId ? `AB#${session.linkedTicketId} · ` : '';
          ws.send(JSON.stringify({
            type: 'agentTool',
            agentId: session.id,
            toolName: 'CopilotAgent',
            displayText: `${ticketPrefix}${session.lastStatus}`,
          }));
        }
        if (session.linkedTicketId) {
          ws.send(JSON.stringify({
            type: 'agentLinkedTicket',
            agentId: session.id,
            ticketId: session.linkedTicketId,
            ticketTitle: session.title,
          }));
        }
        ws.send(JSON.stringify({
          type: 'agentFeedMode',
          agentId: session.id,
          feedMode: session.feedMode || 'poll',
          feedReason: session.feedReason || 'unknown',
        }));
      }
    }

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', (err) => {
      console.warn('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  // --- Start monitors ---
  // Dynamic import of the built server module
  const serverBundle = path.resolve(PACKAGE_ROOT, 'dist', 'index.mjs');
  let copilotMonitor = null;
  let agentManager = null;

  try {
    const pkg = await import(serverBundle);

    // Start Copilot monitor
    const adoOrg = process.env.AZDO_ORG || process.env.AZURE_DEVOPS_ORG || '';
    const adoProject = process.env.AZDO_PROJECT || process.env.AZURE_DEVOPS_PROJECT || '';
    const adoPat = process.env.AZDO_PAT || process.env.AZURE_DEVOPS_PAT || '';
    const adoConfig = (adoOrg && adoProject && adoPat)
      ? { organization: adoOrg, project: adoProject, pat: adoPat }
      : undefined;

    const pollInterval = parseInt(process.env.GITHUB_POLL_INTERVAL || '15', 10);

    copilotMonitor = pkg.createCopilotMonitor(
      owner, repo, config.token,
      (msg) => broadcast(msg),
      pollInterval * 1000,
      adoConfig,
    );
    copilotMonitor.start();
    console.log(`[Copilot] Monitor started: ${owner}/${repo} (every ${pollInterval}s)`);

    if (adoConfig) {
      console.log(`[Copilot] ADO sync enabled: ${adoConfig.organization}/${adoConfig.project}`);
    }

    // Start local agent manager if project dir exists
    agentManager = pkg.createAgentManager(config.projectDir, (msg) => broadcast(msg));
    agentManager.discoverAgents();
    console.log(`[Agents] Watching local project: ${config.projectDir}`);

  } catch (err) {
    console.warn('[Server] Monitor startup error:', err.message);
  }

  // --- Listen ---
  server.listen(config.port, () => {
    console.log(`\n  🤖 Agent Dashboard running at http://localhost:${config.port}`);
    console.log(`  📦 Repository: ${owner}/${repo}`);
    console.log(`  🔌 WebSocket relay ready\n`);
  });

  // --- Graceful shutdown ---
  function shutdown() {
    console.log('\n[Server] Shutting down...');
    if (copilotMonitor) copilotMonitor.stop();
    if (agentManager) agentManager.dispose();
    wss.close();
    server.close();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
