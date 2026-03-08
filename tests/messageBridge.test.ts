// tests/messageBridge.test.ts
// Tests for MessageBridge relay between room and sidebar webviews

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({}), { virtual: true });

// Import after mocking
const { MessageBridge } = await import('../src/messageBridge.js');

/** Create a mock webview panel with postMessage spy */
function mockPanel() {
  const postMessage = vi.fn();
  return {
    webview: { postMessage },
    _postMessage: postMessage,
  };
}

/** Create a mock webview view with postMessage spy */
function mockView() {
  const postMessage = vi.fn();
  return {
    webview: { postMessage },
    _postMessage: postMessage,
  };
}

describe('MessageBridge', () => {
  let bridge: InstanceType<typeof MessageBridge>;

  beforeEach(() => {
    bridge = new MessageBridge();
  });

  describe('broadcastAgentEvent', () => {
    it('sends to both room and sidebar panels', () => {
      const room = mockPanel();
      const side = mockView();
      bridge.setRoomPanel(room as any);
      bridge.setSidePanel(side as any);

      const msg = { type: 'agentCreated', agentId: 'a1', terminalName: 'Agent 1', variant: 0 as const };
      bridge.broadcastAgentEvent(msg);

      expect(room._postMessage).toHaveBeenCalledWith(msg);
      expect(side._postMessage).toHaveBeenCalledWith(msg);
    });

    it('sends to room only when sidebar not set', () => {
      const room = mockPanel();
      bridge.setRoomPanel(room as any);

      const msg = { type: 'agentStatus', agentId: 'a1', status: 'active' as const };
      bridge.broadcastAgentEvent(msg);

      expect(room._postMessage).toHaveBeenCalledWith(msg);
    });
  });

  describe('handleSidebarMessage', () => {
    it('jumpToSection relays to room', () => {
      const room = mockPanel();
      bridge.setRoomPanel(room as any);

      bridge.handleSidebarMessage({ type: 'jumpToSection', team: 'planning' });

      expect(room._postMessage).toHaveBeenCalledWith({
        type: 'jumpToSection',
        team: 'planning',
      });
    });
  });

  describe('handleRoomMessage', () => {
    it('agentClicked relays scrollToAgent to sidebar', () => {
      const side = mockView();
      bridge.setSidePanel(side as any);

      bridge.handleRoomMessage({ type: 'agentClicked', agentId: 'agent-42' });

      expect(side._postMessage).toHaveBeenCalledWith({
        type: 'scrollToAgent',
        agentId: 'agent-42',
      });
    });
  });

  describe('null panel safety', () => {
    it('broadcastAgentEvent does not throw with null panels', () => {
      expect(() => {
        bridge.broadcastAgentEvent({ type: 'agentRemoved', agentId: 'x' });
      }).not.toThrow();
    });

    it('sendToRoom does not throw with null room panel', () => {
      expect(() => {
        bridge.sendToRoom({ type: 'test' });
      }).not.toThrow();
    });

    it('sendToSidebar does not throw with null side panel', () => {
      expect(() => {
        bridge.sendToSidebar({ type: 'test' });
      }).not.toThrow();
    });

    it('handleRoomMessage does not throw with null sidebar', () => {
      expect(() => {
        bridge.handleRoomMessage({ type: 'agentClicked', agentId: 'x' });
      }).not.toThrow();
    });

    it('handleSidebarMessage does not throw with null room', () => {
      expect(() => {
        bridge.handleSidebarMessage({ type: 'jumpToSection', team: 'core-dev' });
      }).not.toThrow();
    });
  });
});
