/**
 * Server-side AgentManager wrapper for standalone web deployment.
 *
 * Imports from local source files — esbuild bundles these into dist/web/server.mjs.
 * The packages/agent-dashboard/ copy is for external consumers; this repo uses
 * the source files directly so esbuild can resolve them.
 */
import { AgentManager } from '../agentManager.js';
import { fetchAzureDevOpsCards } from '../azureDevOpsBoards.js';
import { CopilotAgentMonitor } from './copilotMonitor.js';
import type { ExtensionMessage, KanbanCard } from '../agentTypes.js';

/**
 * Create an AgentManager configured for standalone server use.
 */
export function createAgentManager(
  projectDir: string,
  onMessage: (msg: ExtensionMessage) => void,
): AgentManager {
  return new AgentManager(projectDir, onMessage);
}

/**
 * Create a CopilotAgentMonitor for polling GitHub Copilot coding agent activity.
 */
export function createCopilotMonitor(
  owner: string,
  repo: string,
  token: string,
  onMessage: (msg: ExtensionMessage) => void,
  pollIntervalMs?: number,
  adoConfig?: { organization: string; project: string; pat: string },
): CopilotAgentMonitor {
  return new CopilotAgentMonitor(owner, repo, token, onMessage, pollIntervalMs, adoConfig);
}

/**
 * Read GitHub config from environment variables.
 */
export function readGitHubEnv(): {
  owner: string;
  repo: string;
  token: string;
  pollIntervalSeconds: number;
} {
  const fullRepo = process.env.GITHUB_REPO || '';
  const [owner, repo] = fullRepo.includes('/') ? fullRepo.split('/') : ['', ''];
  return {
    owner,
    repo,
    token: process.env.GITHUB_TOKEN || '',
    pollIntervalSeconds: parseInt(process.env.GITHUB_POLL_INTERVAL || '15', 10),
  };
}

/**
 * Read Azure DevOps config from environment variables.
 */
export function readAzureDevOpsEnv(): {
  organization: string;
  project: string;
  pat: string;
  pollIntervalSeconds: number;
} {
  return {
    organization: process.env.AZDO_ORG || process.env.AZURE_DEVOPS_ORG || '',
    project: process.env.AZDO_PROJECT || process.env.AZURE_DEVOPS_PROJECT || '',
    pat: process.env.AZDO_PAT || process.env.AZURE_DEVOPS_PAT || '',
    pollIntervalSeconds: parseInt(process.env.AZDO_POLL_INTERVAL || '60', 10),
  };
}

/**
 * Fetch enriched Azure DevOps cards including relations.
 */
export async function fetchEnrichedCards(
  organization: string,
  project: string,
  pat: string,
): Promise<KanbanCard[]> {
  return fetchAzureDevOpsCards(organization, project, pat, { includeRelations: true });
}
