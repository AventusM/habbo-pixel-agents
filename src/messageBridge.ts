// src/messageBridge.ts
// Extension-room-sidebar message relay for orchestration panel
// Bridges messages between room webview panel and sidebar webview view

import * as vscode from 'vscode';
import type { ExtensionMessage } from './agentTypes.js';

/**
 * Relays messages between the room webview panel and the orchestration sidebar.
 * Both panels receive agent events; sidebar can send navigation commands to room.
 */
export class MessageBridge {
  private roomPanel: vscode.WebviewPanel | null = null;
  private sidePanel: vscode.WebviewView | null = null;

  /** Register the main room webview panel */
  setRoomPanel(panel: vscode.WebviewPanel): void {
    this.roomPanel = panel;
  }

  /** Register the sidebar orchestration webview view */
  setSidePanel(view: vscode.WebviewView): void {
    this.sidePanel = view;
  }

  /** Send a message to the room webview */
  sendToRoom(msg: any): void {
    this.roomPanel?.webview.postMessage(msg);
  }

  /** Send a message to the sidebar webview */
  sendToSidebar(msg: any): void {
    this.sidePanel?.webview.postMessage(msg);
  }

  /**
   * Broadcast an agent event to BOTH the room and sidebar webviews.
   * Used for agentCreated, agentStatus, agentTool, agentRemoved etc.
   */
  broadcastAgentEvent(msg: ExtensionMessage): void {
    this.roomPanel?.webview.postMessage(msg);
    this.sidePanel?.webview.postMessage(msg);
  }

  /**
   * Process a message received from the room webview.
   * Relays relevant messages to the sidebar (e.g., agentClicked).
   */
  handleRoomMessage(msg: any): void {
    switch (msg.type) {
      case 'agentClicked':
        this.sendToSidebar({ type: 'scrollToAgent', agentId: msg.agentId });
        break;
    }
  }

  /**
   * Process a message received from the sidebar webview.
   * Relays relevant messages to the room (e.g., jumpToSection).
   */
  handleSidebarMessage(msg: any): void {
    switch (msg.type) {
      case 'jumpToSection':
        this.sendToRoom({ type: 'jumpToSection', team: msg.team });
        break;
      case 'viewTranscript':
        // Handled by extension.ts — opens JSONL file in editor
        break;
      case 'reassignAgent':
        // Handled by extension.ts — calls agentManager.reassignAgent
        break;
    }
  }
}
