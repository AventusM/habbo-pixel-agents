/**
 * @anthropic-claude/agent-dashboard — server-side exports
 *
 * Monitoring core: agent watcher, Copilot polling, Azure DevOps, event protocol.
 */

// Event protocol types
export type {
  AgentState,
  AgentEvent,
  ExtensionMessage,
  WebviewMessage,
  TeamSection,
  KanbanCard,
  KanbanCardChild,
  KanbanCardPr,
} from './agentTypes.js';

// Agent manager (local JSONL watcher)
export { AgentManager } from './agentManager.js';

// Copilot coding agent monitor
export { CopilotAgentMonitor } from './copilotMonitor.js';
export type { CopilotAgentSession, FeedMode, ParsedToolCall } from './copilotMonitor.js';

// Azure DevOps boards
export { fetchAzureDevOpsCards } from './azureDevOpsBoards.js';

// Transcript parser
export { parseTranscriptLine } from './transcriptParser.js';

// Agent classifier
export { classifyAgent, extractSubagentType } from './agentClassifier.js';

// File watcher
export { watchJsonlFile } from './fileWatcher.js';
export type { Disposable } from './fileWatcher.js';

// Server factories
export {
  createAgentManager,
  createCopilotMonitor,
  readGitHubEnv,
  readAzureDevOpsEnv,
  fetchEnrichedCards,
} from './server.js';
