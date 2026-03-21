/**
 * Server-side AgentManager wrapper for standalone web deployment.
 *
 * Reuses the existing AgentManager, fileWatcher, transcriptParser,
 * and agentClassifier modules — zero duplication.
 *
 * Built by esbuild into dist/web/server.mjs (ESM, Node platform).
 */
import { AgentManager } from '../agentManager.js';
import { fetchAzureDevOpsCards } from '../azureDevOpsBoards.js';
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
 * Read Azure DevOps config from environment variables.
 */
export function readAzureDevOpsEnv(): {
  organization: string;
  project: string;
  pat: string;
  pollIntervalSeconds: number;
} {
  return {
    organization: process.env.AZDO_ORG || '',
    project: process.env.AZDO_PROJECT || '',
    pat: process.env.AZDO_PAT || '',
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
