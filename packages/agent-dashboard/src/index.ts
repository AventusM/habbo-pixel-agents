/**
 * @anthropic-claude/agent-dashboard — server-side exports
 *
 * Monitoring core: agent watcher, Copilot polling, Azure DevOps, event protocol.
 */

// Event protocol types
export type {
  AgentState,
  AgentStatus,
  AgentEvent,
  ExtensionMessage,
  WebviewMessage,
  TeamSection,
  KanbanCard,
  KanbanCardChild,
  KanbanCardPr,
} from './agentTypes.js';

// Agent manager (local JSONL watcher)
export { AgentManager, isAgentCompleted } from './agentManager.js';

// Copilot coding agent monitor
export { CopilotAgentMonitor, parseLastToolCall, parseSingleSSEEvent, formatCopilotToolCall, extractTicketId, formatDisplayName } from './copilotMonitor.js';
export type { CopilotAgentSession, FeedMode, ParsedToolCall, ActivitySnapshot } from './copilotMonitor.js';

// Azure DevOps boards
export { fetchAzureDevOpsCards, mapAzureDevOpsState } from './azureDevOpsBoards.js';

// Transcript parser
export { parseTranscriptLine, extractSubagentTypeFromLine, formatToolStatus } from './transcriptParser.js';

// Agent classifier
export { classifyAgent, extractSubagentType, inferTaskArea, ROLE_TO_TEAM } from './agentClassifier.js';
export type { AgentClassification } from './agentClassifier.js';

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
