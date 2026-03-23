/**
 * Server-side AgentManager wrapper for standalone web deployment.
 *
 * Re-exports from @anthropic-claude/agent-dashboard package.
 * The root repo's web-server.mjs dynamically imports this file (built as dist/web/server.mjs).
 */
export {
  createAgentManager,
  createCopilotMonitor,
  readGitHubEnv,
  readAzureDevOpsEnv,
  fetchEnrichedCards,
} from '@anthropic-claude/agent-dashboard';
