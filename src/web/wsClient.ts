/**
 * WebSocket client for the standalone Habbo room browser app.
 *
 * Connects to the local WebSocket server, receives agent events,
 * and dispatches them as extensionMessage CustomEvents — the same
 * protocol RoomCanvas already listens to.
 */

/** Connection state exposed for status display */
export type WsState = 'connecting' | 'connected' | 'disconnected';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let state: WsState = 'disconnected';
let onStateChange: ((state: WsState) => void) | null = null;
let hasReceivedAgents = false;

/** Whether any real agent events have been received */
export function hasRealAgents(): boolean {
  return hasReceivedAgents;
}

/** Get current connection state */
export function getWsState(): WsState {
  return state;
}

/** Set a callback for connection state changes */
export function onWsStateChange(cb: (state: WsState) => void): void {
  onStateChange = cb;
}

function setState(newState: WsState) {
  state = newState;
  onStateChange?.(newState);
}

/**
 * Connect to the WebSocket server and start relaying agent events.
 *
 * @param url - WebSocket URL (defaults to ws://localhost:3000 based on current page)
 */
export function connectWs(url?: string): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = url || `ws://${window.location.host}`;
  setState('connecting');

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.warn('[WS] Failed to create WebSocket:', err);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    setState('connected');
    console.log('[WS] Connected to server');

    // Clear any pending reconnect
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg && msg.type) {
        // Track whether we've received real agent data
        if (msg.type === 'agentCreated' || msg.type === 'kanbanCards') {
          hasReceivedAgents = true;
        }

        // Dispatch as extensionMessage — same protocol RoomCanvas uses
        window.dispatchEvent(new CustomEvent('extensionMessage', { detail: msg }));
      }
    } catch (err) {
      console.warn('[WS] Failed to parse message:', err);
    }
  };

  ws.onclose = () => {
    setState('disconnected');
    console.log('[WS] Disconnected from server');
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.warn('[WS] Connection error');
    // onclose will fire after onerror — reconnect happens there
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log('[WS] Attempting reconnect...');
    connectWs();
  }, 3000);
}

/** Disconnect and stop reconnecting */
export function disconnectWs(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  setState('disconnected');
}
