/**
 * @anthropic-claude/agent-dashboard — browser-side exports
 *
 * WebSocket client for connecting to the dashboard server from a browser.
 */
export {
  connectWs,
  disconnectWs,
  hasRealAgents,
  getWsState,
  onWsStateChange,
} from './wsClient.js';

export type { WsState } from './wsClient.js';
