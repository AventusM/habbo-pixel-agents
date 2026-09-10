#!/usr/bin/env node
/**
 * Standalone web server for the Habbo room.
 *
 * Serves static files from dist/web/ on HTTP, and runs a WebSocket server
 * that relays agent events from the AgentManager (JSONL file watching)
 * to connected browsers.
 *
 * Usage:
 *   node scripts/web-server.mjs [--project /path/to/project]
 *
 * The --project flag tells AgentManager where to look for Claude Code
 * transcripts. Defaults to the current working directory.
 */
import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WebSocketServer } from 'ws';

// Dynamic import of the compiled server module (built by esbuild)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist', 'web');
const PORT = parseInt(process.env.PORT || '3000', 10);

// Parse flags
let projectDir = process.cwd();
let skipLocalAgents = false;
const projectIdx = process.argv.indexOf('--project');
if (projectIdx !== -1 && process.argv[projectIdx + 1]) {
  projectDir = path.resolve(process.argv[projectIdx + 1]);
}
if (process.argv.includes('--no-local')) {
  skipLocalAgents = true;
}

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
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.map':  'application/json',
};

if (!fs.existsSync(DIST_DIR)) {
  console.error(`Error: ${DIST_DIR} does not exist.`);
  console.error('Run "npm run build:web" first.');
  process.exit(1);
}

// --- Health payload builder ---
// Sourced from the compiled server bundle when present so src/health.ts stays
// the single tested source of truth; fall back to a minimal ok payload when the
// bundle is absent so /health keeps answering.
const SERVER_BUNDLE = path.resolve(__dirname, '..', 'dist', 'web', 'server.mjs');
let buildHealthPayload = null;
if (fs.existsSync(SERVER_BUNDLE)) {
  try {
    ({ buildHealthPayload } = await import(SERVER_BUNDLE));
  } catch (err) {
    console.warn('[Health] Could not load health payload builder:', err.message);
  }
}

// --- Board updates (webhook receiver + ETag probe) ---
const REPO_FULL_NAME = process.env.GITHUB_REPO || '';
let boardController = null;
let boardDebouncer = null;
let currentBoardSource = null; // last source that delivered an update
let boardHelpers = null; // populated from the compiled server bundle below

/** Prefer the env token; fall back to the gh CLI's stored token for local dev. */
function resolveGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** Parse an env value as a positive integer, falling back when it isn't one. */
function positiveIntEnv(raw, fallback) {
  const parsed = parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * POST /webhooks/github. HMAC-validated when WEBHOOK_SECRET is set; relevant
 * events are debounced and trigger a full board fetch + broadcast.
 */
async function handleGithubWebhook(req, res) {
  if (!boardHelpers) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('board source not ready');
    return;
  }

  let raw;
  try {
    raw = await readRawBody(req);
  } catch (err) {
    res.writeHead(413, { 'Content-Type': 'text/plain' });
    res.end(err.message);
    return;
  }

  const secret = process.env.WEBHOOK_SECRET || '';
  const signature = req.headers['x-hub-signature-256'];
  if (secret && !boardHelpers.verifyWebhookSignature(secret, signature, raw)) {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('invalid signature');
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    // Malformed payloads are acknowledged but ignored.
  }

  const event = req.headers['x-github-event'];
  const relevant = boardDebouncer
    && boardHelpers.isRelevantBoardEvent(event, payload, REPO_FULL_NAME);
  if (relevant) boardDebouncer.trigger();

  res.writeHead(202, { 'Content-Type': 'text/plain' });
  res.end(relevant ? 'accepted' : 'ignored');
}

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);

  if ((req.method === 'GET' || req.method === 'HEAD') && urlPath === '/health') {
    const payload = buildHealthPayload
      ? buildHealthPayload({
          uptimeSeconds: process.uptime(),
          boardSource: currentBoardSource,
          clients: clients.size,
          port: PORT,
        })
      : { status: 'ok' };
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(payload));
    return;
  }

  if (req.method === 'POST' && urlPath === '/webhooks/github') {
    void handleGithubWebhook(req, res);
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(DIST_DIR, urlPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
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
let lastKanbanCards = null; // Cache for new client sync

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);

  // Send current agent states to newly connected client
  if (agentManager) {
    for (const agent of agentManager.getAgents()) {
      ws.send(JSON.stringify({
        type: 'agentCreated',
        agentId: agent.agentId,
        terminalName: agent.terminalName,
        variant: agent.variant,
        role: agent.role,
        team: agent.team,
        taskArea: agent.taskArea,
      }));
      ws.send(JSON.stringify({
        type: 'agentStatus',
        agentId: agent.agentId,
        status: agent.status,
      }));
    }
  }

  // Send cached kanban cards to newly connected client
  if (lastKanbanCards) {
    ws.send(JSON.stringify({ type: 'kanbanCards', cards: lastKanbanCards }));
  }

  // Send the active board source (webhook | probe | demo)
  if (currentBoardSource) {
    ws.send(JSON.stringify({ type: 'boardSource', source: currentBoardSource }));
  }

  // Send current Copilot agent sessions to newly connected client
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
      // Send current feed mode
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

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(data);
    }
  }
}

// --- Agent Manager + Kanban Polling ---
// Import dynamically from the server bundle built by esbuild
let agentManager = null;
let kanbanPollId = null;
let copilotMonitor = null;

async function startAgentManager() {
  try {
    // Import the compiled server module
    const serverBundle = path.resolve(__dirname, '..', 'dist', 'web', 'server.mjs');
    if (!fs.existsSync(serverBundle)) {
      console.log('[Server] No server.mjs found — running without agent monitoring');
      console.log('[Server] Agents will not be tracked. Use demo mode in the browser.');
      return;
    }

    const {
      createAgentManager, readAzureDevOpsEnv, fetchEnrichedCards, createCopilotMonitor,
      readGitHubEnv, readGitHubProjectsEnv, fetchKanbanCards,
      classifyBoardSource, createBoardSourceController, createDebouncer,
      isRelevantBoardEvent, verifyWebhookSignature,
    } = await import(serverBundle);

    boardHelpers = { isRelevantBoardEvent, verifyWebhookSignature };

    // Start local JSONL agent watcher (skip with --no-local flag)
    if (!skipLocalAgents) {
      agentManager = createAgentManager(projectDir, (msg) => {
        broadcast(msg);
      });
      agentManager.discoverAgents();
      console.log(`[Server] AgentManager started, watching: ${projectDir}`);
    } else {
      console.log('[Server] Local agent watching skipped (--no-local)');
    }

    // Start Azure DevOps kanban polling if configured.
    // Provider selection: KANBAN_SOURCE=github|azuredevops forces one; unset
    // prefers ADO when fully configured, else falls back to GitHub Projects.
    const adoConfig = readAzureDevOpsEnv();
    const ghProjectsConfig = readGitHubProjectsEnv();
    const adoConfigured = !!(adoConfig.organization && adoConfig.project && adoConfig.pat);
    const ghProjectsConfigured = !!(ghProjectsConfig.owner && ghProjectsConfig.projectNumber > 0);
    const useAdoKanban =
      ghProjectsConfig.kanbanSource === 'azuredevops' ||
      (ghProjectsConfig.kanbanSource === '' && adoConfigured);
    const useGitHubKanban =
      ghProjectsConfig.kanbanSource === 'github' ||
      (ghProjectsConfig.kanbanSource === '' && !adoConfigured && ghProjectsConfigured);

    if (useAdoKanban && adoConfigured) {
      console.log(`[Kanban] Azure DevOps configured: ${adoConfig.organization}/${adoConfig.project}`);

      // ADO is a plain full poll, not a webhook or a conditional ETag probe,
      // so it deliberately emits no `boardSource` — the chip stays neutral
      // rather than mislabelling this path.

      // Initial fetch
      const cards = await fetchEnrichedCards(adoConfig.organization, adoConfig.project, adoConfig.pat);
      if (cards.length > 0) {
        lastKanbanCards = cards;
        broadcast({ type: 'kanbanCards', cards });
        console.log(`[Kanban] Initial fetch: ${cards.length} cards`);
      }

      // Poll on interval
      if (adoConfig.pollIntervalSeconds > 0) {
        kanbanPollId = setInterval(async () => {
          try {
            const polledCards = await fetchEnrichedCards(adoConfig.organization, adoConfig.project, adoConfig.pat);
            lastKanbanCards = polledCards;
            broadcast({ type: 'kanbanCards', cards: polledCards });
          } catch (err) {
            console.warn('[Kanban] Poll failed:', err.message);
          }
        }, adoConfig.pollIntervalSeconds * 1000);
        console.log(`[Kanban] Polling every ${adoConfig.pollIntervalSeconds}s`);
      }
    } else if (useGitHubKanban && ghProjectsConfigured) {
      console.log(`[Kanban] GitHub Projects configured: ${ghProjectsConfig.owner}/${ghProjectsConfig.projectNumber}`);

      const token = resolveGitHubToken();
      const probeUrl = REPO_FULL_NAME
        ? `https://api.github.com/repos/${REPO_FULL_NAME}/issues?state=all&sort=updated&direction=desc&per_page=1`
        : '';
      const webhookSecret = process.env.WEBHOOK_SECRET || '';
      const kind = classifyBoardSource({ configured: true, webhookSecret });
      const probeIntervalMs = positiveIntEnv(process.env.BOARD_PROBE_INTERVAL, 10) * 1000;

      boardController = createBoardSourceController({
        kind,
        // fetchKanbanCards is synchronous (gh CLI) and silent-fails to []
        fetchAll: async () => fetchKanbanCards(
          ghProjectsConfig.owner,
          ghProjectsConfig.projectNumber,
          ghProjectsConfig.ownerType,
        ),
        onCards: (cards) => {
          lastKanbanCards = cards;
          broadcast({ type: 'kanbanCards', cards });
          console.log(`[Kanban] Updated: ${cards.length} cards`);
        },
        onSource: (source) => {
          currentBoardSource = source;
          broadcast({ type: 'boardSource', source });
          console.log(`[Kanban] Active board source: ${source}`);
        },
        probe: probeUrl && token
          ? { url: probeUrl, token, intervalMs: probeIntervalMs }
          : undefined,
        fallbackIntervalMs: probeUrl && token
          ? undefined
          : ghProjectsConfig.pollIntervalSeconds * 1000,
        onError: (err) => console.warn(
          '[Kanban] Board source error:',
          err instanceof Error ? err.message : String(err),
        ),
        log: console.log,
      });

      boardDebouncer = createDebouncer(() => {
        console.log('[Kanban] Webhook event — refetching board');
        boardController.refresh('webhook');
      }, positiveIntEnv(process.env.WEBHOOK_DEBOUNCE_MS, 300));

      boardController.start();

      if (!probeUrl || !token) {
        console.log('[Kanban] Probe disabled (set GITHUB_REPO + GITHUB_TOKEN to enable the ETag probe); using full poll');
      } else {
        console.log(`[Kanban] ETag probe every ${probeIntervalMs / 1000}s`);
      }
      if (kind === 'webhook') {
        console.log('[Kanban] Webhook receiver ready: POST /webhooks/github');
      }
    } else if (!adoConfigured) {
      console.log('[Kanban] No kanban source configured (set AZDO_ORG/AZDO_PROJECT/AZDO_PAT, or KANBAN_SOURCE=github with GITHUB_PROJECT_OWNER/GITHUB_PROJECT_NUMBER)');
    }

    // Start GitHub Copilot coding agent monitor if configured
    const ghConfig = readGitHubEnv();
    if (ghConfig.owner && ghConfig.repo && ghConfig.token) {
      // Pass ADO config so the monitor can sync ticket state on PR-opened
      const adoForCopilot = (adoConfig.organization && adoConfig.project && adoConfig.pat)
        ? { organization: adoConfig.organization, project: adoConfig.project, pat: adoConfig.pat }
        : undefined;

      copilotMonitor = createCopilotMonitor(
        ghConfig.owner, ghConfig.repo, ghConfig.token,
        (msg) => { broadcast(msg); },
        ghConfig.pollIntervalSeconds * 1000,
        adoForCopilot,
        ghConfig.copilotToken || undefined,
      );

      // When ADO state changes (Doing/Done), immediately re-fetch kanban cards
      if (adoConfig.organization && adoConfig.project && adoConfig.pat) {
        copilotMonitor.setOnAdoStateChange(async () => {
          try {
            const cards = await fetchEnrichedCards(adoConfig.organization, adoConfig.project, adoConfig.pat);
            lastKanbanCards = cards;
            broadcast({ type: 'kanbanCards', cards });
            console.log(`[Kanban] Refreshed after ADO state change: ${cards.length} cards`);
          } catch (err) {
            console.warn('[Kanban] Refresh after ADO change failed:', err.message);
          }
        });
      }

      copilotMonitor.start();
      console.log(`[Copilot] Monitor started: ${ghConfig.owner}/${ghConfig.repo} (every ${ghConfig.pollIntervalSeconds}s)`);
      if (adoForCopilot) {
        console.log(`[Copilot] ADO state sync enabled: ${adoForCopilot.organization}/${adoForCopilot.project}`);
      }
    } else {
      console.log('[Copilot] No GitHub config (set GITHUB_REPO=owner/repo and GITHUB_TOKEN)');
    }
  } catch (err) {
    console.warn('[Server] AgentManager failed to start:', err.message);
    console.log('[Server] Running without agent monitoring (demo mode only)');
  }
}

// --- Start ---
server.listen(PORT, async () => {
  console.log(`\n  🏨 Habbo Room running at http://localhost:${PORT}`);
  console.log(`  📁 Project directory: ${projectDir}`);
  console.log(`  🔌 WebSocket server ready\n`);

  await startAgentManager();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  if (kanbanPollId) clearInterval(kanbanPollId);
  if (boardController) boardController.stop();
  if (boardDebouncer) boardDebouncer.cancel();
  if (copilotMonitor) copilotMonitor.stop();
  if (agentManager) agentManager.dispose();
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (kanbanPollId) clearInterval(kanbanPollId);
  if (boardController) boardController.stop();
  if (boardDebouncer) boardDebouncer.cancel();
  if (copilotMonitor) copilotMonitor.stop();
  if (agentManager) agentManager.dispose();
  wss.close();
  server.close();
  process.exit(0);
});
