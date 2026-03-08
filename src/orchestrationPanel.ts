// src/orchestrationPanel.ts
// WebviewViewProvider for the orchestration sidebar panel in VS Code Activity Bar

import * as vscode from 'vscode';
import { MessageBridge } from './messageBridge.js';
import { getOrchestrationPanelHtml } from './orchestrationPanelHtml.js';

/**
 * Provides the Habbo Agents orchestration sidebar panel.
 * Unified command panel: agents, layout editor, navigation.
 */
export class OrchestrationPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'habboPixelAgents.orchestrationPanel';

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly messageBridge: MessageBridge,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Generate asset URIs for furniture preview
    const furnitureBaseUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-assets', 'furniture'),
    ).toString();
    const manifestUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-assets', 'manifest.json'),
    ).toString();

    webviewView.webview.html = getOrchestrationPanelHtml(
      webviewView.webview,
      this.extensionUri,
      { furnitureBaseUri, manifestUri },
    );

    // Register sidebar with message bridge
    this.messageBridge.setSidePanel(webviewView);

    // Forward messages from sidebar to bridge
    webviewView.webview.onDidReceiveMessage((msg) => {
      this.messageBridge.handleSidebarMessage(msg);
      // Emit a custom event for extension.ts to handle specific actions
      this._onDidReceiveMessage.fire(msg);
    });
  }

  private readonly _onDidReceiveMessage = new vscode.EventEmitter<any>();
  /** Event fired when sidebar sends a message (for extension.ts handling) */
  public readonly onDidReceiveMessage = this._onDidReceiveMessage.event;
}
