#!/usr/bin/env node
/**
 * habbo-dashboard — Habbo room view for GitHub Copilot coding agents
 *
 * Usage:
 *   npx habbo-dashboard owner/repo
 *   npx habbo-dashboard --ado-org myorg --ado-project myproject owner/repo
 */
import 'dotenv/config';
import { execSync, fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Parse args ---
const args = process.argv.slice(2);
let repo = '';
let token = process.env.GITHUB_TOKEN || '';
let port = process.env.PORT || '3000';
let adoOrg = '';
let adoProject = '';
let adoPat = '';
let help = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') help = true;
  else if (arg === '--port' && args[i + 1]) port = args[++i];
  else if (arg === '--token' && args[i + 1]) token = args[++i];
  else if (arg === '--ado-org' && args[i + 1]) adoOrg = args[++i];
  else if (arg === '--ado-project' && args[i + 1]) adoProject = args[++i];
  else if (arg === '--ado-pat' && args[i + 1]) adoPat = args[++i];
  else if (!arg.startsWith('-') && arg.includes('/')) repo = arg;
}

// CLI args override env vars
if (!repo) repo = process.env.GITHUB_REPO || '';
if (!adoOrg) adoOrg = process.env.AZDO_ORG || process.env.AZURE_DEVOPS_ORG || '';
if (!adoProject) adoProject = process.env.AZDO_PROJECT || process.env.AZURE_DEVOPS_PROJECT || '';
if (!adoPat) adoPat = process.env.AZDO_PAT || process.env.AZURE_DEVOPS_PAT || '';

if (help) {
  console.log(`
  habbo-dashboard — Habbo room view for GitHub Copilot coding agents

  Usage:
    npx habbo-dashboard owner/repo
    npx habbo-dashboard --ado-org myorg --ado-project myproject owner/repo

  Options:
    --port <number>        Server port (default: 3000)
    --token <token>        GitHub PAT (or set GITHUB_TOKEN env var / .env)
    --ado-org <org>        Azure DevOps organization (overrides .env)
    --ado-project <proj>   Azure DevOps project (overrides .env)
    --ado-pat <pat>        Azure DevOps PAT (overrides .env)
    -h, --help             Show this help

  Environment variables (also loaded from .env):
    GITHUB_TOKEN           GitHub Personal Access Token (required)
    GITHUB_REPO            owner/repo (fallback if no CLI arg given)
    PORT                   Server port (default: 3000)
    AZDO_ORG               Azure DevOps org (optional)
    AZDO_PROJECT           Azure DevOps project (optional)
    AZDO_PAT               Azure DevOps PAT (optional)
`);
  process.exit(0);
}

if (!repo) {
  console.error('Error: repository required. Usage: habbo-dashboard owner/repo');
  process.exit(1);
}

if (!token) {
  console.error('Error: GITHUB_TOKEN required. Set in .env or pass --token');
  process.exit(1);
}

// --- Ensure web build exists ---
const distWeb = path.join(ROOT, 'dist', 'web', 'index.html');
if (!fs.existsSync(distWeb)) {
  console.log('Building Habbo web client...');
  try {
    execSync('node esbuild.config.mjs web', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error('Build failed.');
    process.exit(1);
  }
}

// --- Start the existing web server with the right env ---
const serverScript = path.join(ROOT, 'scripts', 'web-server.mjs');

const env = {
  ...process.env,
  GITHUB_REPO: repo,
  GITHUB_TOKEN: token,
  PORT: port,
};

// CLI ADO flags override whatever was in .env
if (adoOrg) { env.AZDO_ORG = adoOrg; env.AZURE_DEVOPS_ORG = adoOrg; }
if (adoProject) { env.AZDO_PROJECT = adoProject; env.AZURE_DEVOPS_PROJECT = adoProject; }
if (adoPat) { env.AZDO_PAT = adoPat; env.AZURE_DEVOPS_PAT = adoPat; }

const child = fork(serverScript, [], { cwd: ROOT, env, stdio: 'inherit' });

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
