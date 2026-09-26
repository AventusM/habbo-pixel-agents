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
import { randomUUID } from 'node:crypto';
import { mapFeedLineToRoomEvents } from './hooks-feed-mapper.mjs';
import { classifyGithubSyncEvent, toNotification } from './gsd-github-sync.mjs';

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
 * Record an accepted GitHub→GSD sync intent exactly once: append to the
 * runtime inbox, remember its dedupe key, surface a GSD notification.
 * Best-effort — the webhook's 202 contract must never depend on this.
 */
function recordGithubSyncIntent(intent) {
  const dir = path.resolve(projectDir, '.gsd', 'runtime', 'github-sync');
  fs.mkdirSync(dir, { recursive: true });
  const statePath = path.join(dir, 'state.json');
  let seen = {};
  try {
    seen = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    seen = {};
  }
  if (!seen || typeof seen !== 'object') seen = {};
  if (seen[intent.key]) return false;
  seen[intent.key] = intent.ts;
  fs.appendFileSync(path.join(dir, 'inbox.jsonl'), JSON.stringify(intent) + '\n');
  fs.writeFileSync(statePath, JSON.stringify(seen, null, 2) + '\n');
  try {
    fs.appendFileSync(
      path.resolve(projectDir, '.gsd', 'notifications.jsonl'),
      JSON.stringify(toNotification(intent, randomUUID())) + '\n',
    );
  } catch {
    // notifications.jsonl is best-effort (GSD may not have created it yet)
  }
  return true;
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

  try {
    const syncIntent = classifyGithubSyncEvent(event, payload);
    if (syncIntent) recordGithubSyncIntent(syncIntent);
  } catch {
    // sync is best-effort; the webhook contract above all
  }

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
      : {
          // Keep the documented /health shape even when the compiled bundle is
          // missing or fails to import, so service checks never see a divergent payload.
          status: 'ok',
          uptimeSeconds: Math.floor(process.uptime()),
          boardSource: currentBoardSource ?? 'unset',
          clients: clients.size,
          port: PORT,
        };
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

// Hooks-feed bridge state: tail .gsd/hooks-feed.jsonl -> room avatars.
// knownBridgeAgents dedupes agentCreated; bridgeCache powers late-join sync.
const knownBridgeAgents = new Set();
const bridgeCache = new Map(); // agentId -> { created, lastTool }

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

  // Send cached hooks-feed bridge agents to newly connected client
  for (const [agentId, entry] of bridgeCache) {
    ws.send(JSON.stringify(entry.created));
    ws.send(JSON.stringify({ type: 'agentStatus', agentId, status: 'active' }));
    if (entry.lastTool) {
      ws.send(JSON.stringify(entry.lastTool));
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
let hooksWatcher = null;

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

// --- Hooks feed bridge ---
// Tails .gsd/hooks-feed.jsonl (written by the role-feed / room-tool-feed /
// gsd-event-hook hooks) from EOF and maps each new line into room avatars via
// mapFeedLineToRoomEvents. Deliberately independent of the compiled server
// bundle so the bridge keeps working when dist/web/server.mjs is absent.
function startHooksBridge() {
  const feedPath = path.resolve(projectDir, '.gsd', 'hooks-feed.jsonl');
  if (!fs.existsSync(feedPath)) {
    console.log('[Hooks] No hooks-feed yet');
    return;
  }

  let offset = fs.statSync(feedPath).size;
  let pending = ''; // trailing partial line carried between events

  const readNew = () => {
    try {
      const size = fs.statSync(feedPath).size;
      if (size < offset) offset = 0; // truncated/rotated
      if (size <= offset) return;

      const bytes = size - offset;
      const buf = Buffer.alloc(bytes);
      const fd = fs.openSync(feedPath, 'r');
      let read = 0;
      try {
        read = fs.readSync(fd, buf, 0, bytes, offset);
      } finally {
        fs.closeSync(fd);
      }
      offset += read;
      pending += buf.toString('utf8', 0, read);

      const lines = pending.split('\n');
      pending = lines.pop(); // keep trailing partial line

      for (const line of lines) {
        const events = mapFeedLineToRoomEvents(line, knownBridgeAgents);
        if (events.length === 0) continue;

        for (const event of events) broadcast(event);

        // Add AFTER the mapper call returns — mapFeedLineToRoomEvents never
        // mutates the set, and agentCreated-first ordering is mandatory.
        const agentId = events[0].agentId;
        knownBridgeAgents.add(agentId);

        for (const event of events) {
          if (event.type === 'agentCreated') {
            bridgeCache.set(agentId, { created: event, lastTool: null });
            while (bridgeCache.size > 20) {
              bridgeCache.delete(bridgeCache.keys().next().value);
            }
          } else if (event.type === 'agentTool') {
            const entry = bridgeCache.get(agentId);
            if (entry) entry.lastTool = event;
          }
        }

        const toolEvt = events.find((e) => e.type === 'agentTool');
        const text = toolEvt && toolEvt.displayText ? String(toolEvt.displayText) : '';
        console.log(`[Hooks] ${agentId} ${text}`.slice(0, 120));
      }
    } catch {
      // file being written concurrently; retry on next watch event
    }
  };

  hooksWatcher = fs.watch(feedPath, () => { readNew(); });
  console.log(`[Hooks] Bridge watching ${feedPath}`);
}

// --- Start ---
server.listen(PORT, async () => {
  console.log(`\n  🏨 Habbo Room running at http://localhost:${PORT}`);
  console.log(`  📁 Project directory: ${projectDir}`);
  console.log(`  🔌 WebSocket server ready\n`);

  await startAgentManager();
  startHooksBridge();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  if (kanbanPollId) clearInterval(kanbanPollId);
  if (boardController) boardController.stop();
  if (boardDebouncer) boardDebouncer.cancel();
  if (copilotMonitor) copilotMonitor.stop();
  if (agentManager) agentManager.dispose();
  if (hooksWatcher) hooksWatcher.close();
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
  if (hooksWatcher) hooksWatcher.close();
  wss.close();
  server.close();
  process.exit(0);
});
