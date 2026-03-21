/**
 * Server-side AgentManager wrapper for standalone web deployment.
 *
 * Reuses the existing AgentManager, fileWatcher, transcriptParser,
 * and agentClassifier modules — zero duplication.
 *
 * Built by esbuild into dist/web/server.mjs (ESM format, Node platform).
 */
import { AgentManager } from '../agentManager.js';
import type { ExtensionMessage } from '../agentTypes.js';

/**
 * Create an AgentManager configured for standalone server use.
 *
 * @param projectDir - Path to the project being monitored
 * @param onMessage - Callback for agent events (relayed to WebSocket clients)
 * @returns The AgentManager instance
 */
export function createAgentManager(
  projectDir: string,
  onMessage: (msg: ExtensionMessage) => void,
): AgentManager {
  return new AgentManager(projectDir, onMessage);
}
