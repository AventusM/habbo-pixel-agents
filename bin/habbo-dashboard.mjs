#!/usr/bin/env node
/**
 * habbo-dashboard — Habbo room view for GitHub Copilot coding agents
 *
 * Usage:
 *   npx habbo-dashboard                         (interactive prompts)
 *   npx habbo-dashboard owner/repo              (direct start)
 *   npx habbo-dashboard --ado-org myorg owner/repo
 */
import 'dotenv/config';
import { execSync, fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Readline helper ---
function ask(rl, question, fallback) {
  const prompt = fallback ? `${question} (${fallback}): ` : `${question}: `;
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer.trim() || fallback || '');
    });
  });
}

// --- Parse args ---
const args = process.argv.slice(2);
let repo = '';
let token = '';
let port = '';
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

if (help) {
  console.log(`
  habbo-dashboard — Habbo room view for GitHub Copilot coding agents

  Usage:
    npx habbo-dashboard                          Interactive setup
    npx habbo-dashboard owner/repo               Direct start
    npx habbo-dashboard --ado-org O --ado-project P owner/repo

  Options:
    --port <number>        Server port (default: 3000)
    --token <token>        GitHub PAT (or set GITHUB_TOKEN env var / .env)
    --ado-org <org>        Azure DevOps organization
    --ado-project <proj>   Azure DevOps project
    --ado-pat <pat>        Azure DevOps PAT
    -h, --help             Show this help
`);
  process.exit(0);
}

// --- Resolve values: CLI arg > env var > prompt ---
async function resolveConfig() {
  // Env defaults (loaded by dotenv)
  const envRepo = process.env.GITHUB_REPO || '';
  const envToken = process.env.GITHUB_TOKEN || '';
  const envPort = process.env.PORT || '3000';
  const envAdoOrg = process.env.AZDO_ORG || process.env.AZURE_DEVOPS_ORG || '';
  const envAdoProject = process.env.AZDO_PROJECT || process.env.AZURE_DEVOPS_PROJECT || '';
  const envAdoPat = process.env.AZDO_PAT || process.env.AZURE_DEVOPS_PAT || '';

  // Apply env defaults where CLI didn't provide a value
  if (!repo) repo = envRepo;
  if (!token) token = envToken;
  if (!port) port = envPort;
  if (!adoOrg) adoOrg = envAdoOrg;
  if (!adoProject) adoProject = envAdoProject;
  if (!adoPat) adoPat = envAdoPat;

  // If repo and token are set, we can skip prompts
  if (repo && token) return;

  // Interactive mode
  console.log('\n  🏨 Habbo Dashboard Setup\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    if (!repo) {
      repo = await ask(rl, '  GitHub repository (owner/repo)', envRepo);
    }
    if (!repo) {
      console.error('\n  Error: repository is required.');
      process.exit(1);
    }

    if (!token) {
      token = await ask(rl, '  GitHub token', envToken ? '••••' + envToken.slice(-4) : '');
      // If they pressed enter on the masked default, use the full env token
      if (token.startsWith('••••') || !token) token = envToken;
    }
    if (!token) {
      console.error('\n  Error: GITHUB_TOKEN is required. Set in .env or enter above.');
      process.exit(1);
    }

    // ADO is optional — only ask if not already set
    if (!adoOrg || !adoProject) {
      console.log('\n  Azure DevOps board (optional — press Enter to skip)');
      if (!adoOrg) adoOrg = await ask(rl, '  ADO organization', envAdoOrg);
      if (adoOrg && !adoProject) {
        adoProject = await ask(rl, '  ADO project', envAdoProject);
      }
    }

    if (!port || port === envPort) {
      const customPort = await ask(rl, '  Port', envPort);
      if (customPort) port = customPort;
    }
  } finally {
    rl.close();
  }

  console.log('');
}

// --- Main ---
async function main() {
  await resolveConfig();

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

  // --- Start the web server ---
  const serverScript = path.join(ROOT, 'scripts', 'web-server.mjs');

  const env = {
    ...process.env,
    GITHUB_REPO: repo,
    GITHUB_TOKEN: token,
    PORT: port,
  };

  if (adoOrg) { env.AZDO_ORG = adoOrg; env.AZURE_DEVOPS_ORG = adoOrg; }
  if (adoProject) { env.AZDO_PROJECT = adoProject; env.AZURE_DEVOPS_PROJECT = adoProject; }
  if (adoPat) { env.AZDO_PAT = adoPat; env.AZURE_DEVOPS_PAT = adoPat; }

  const child = fork(serverScript, ['--no-local'], { cwd: ROOT, env, stdio: 'inherit' });

  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
