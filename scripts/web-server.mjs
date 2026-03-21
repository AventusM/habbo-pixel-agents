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
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

// Dynamic import of the compiled server module (built by esbuild)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist', 'web');
const PORT = parseInt(process.env.PORT || '3000', 10);

// Parse --project flag
let projectDir = process.cwd();
const projectIdx = process.argv.indexOf('--project');
if (projectIdx !== -1 && process.argv[projectIdx + 1]) {
  projectDir = path.resolve(process.argv[projectIdx + 1]);
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

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);

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

// --- Agent Manager ---
// Import dynamically from the server bundle built by esbuild
let agentManager = null;

async function startAgentManager() {
  try {
    // Import the compiled server module
    const serverBundle = path.resolve(__dirname, '..', 'dist', 'web', 'server.mjs');
    if (!fs.existsSync(serverBundle)) {
      console.log('[Server] No server.mjs found — running without agent monitoring');
      console.log('[Server] Agents will not be tracked. Use demo mode in the browser.');
      return;
    }

    const { createAgentManager } = await import(serverBundle);
    agentManager = createAgentManager(projectDir, (msg) => {
      broadcast(msg);
    });
    agentManager.discoverAgents();
    console.log(`[Server] AgentManager started, watching: ${projectDir}`);
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
  if (agentManager) agentManager.dispose();
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (agentManager) agentManager.dispose();
  wss.close();
  server.close();
  process.exit(0);
});
