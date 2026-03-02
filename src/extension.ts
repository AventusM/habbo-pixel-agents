import * as vscode from 'vscode';
import { AgentManager } from './agentManager.js';
import type { WebviewMessage, ExtensionMessage } from './agentTypes.js';

const DEMO_HEIGHTMAP = [
  '0000000000',
  '0111100000',
  '0100000000',
  '0100000000',
  '0100000000',
  '0000000000',
  '0000000000',
  '0000000000',
  '0000000000',
  '0000000000',
].join('\n');

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('habbo-pixel-agents.openRoom', () => {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'habboRoom',
      'Habbo Room',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
      }
    );

    // Build script URI
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')
    );

    // Generate webview URIs for chair atlas (proof-of-concept from Phase 3)
    const chairPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'chair_atlas.png')
    );
    const chairJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'chair_atlas.json')
    );

    // Generate webview URIs for furniture atlas (Phase 4)
    const furniturePngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'furniture_atlas.png')
    );
    const furnitureJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'furniture_atlas.json')
    );

    // Generate webview URIs for avatar atlas (Phase 5)
    const avatarPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'avatar_atlas.png')
    );
    const avatarJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'avatar_atlas.json')
    );

    // Generate webview URI for Press Start 2P font (Phase 6)
    const fontUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'PressStart2P-Regular.ttf')
    );

    // Generate webview URI for notification sound (Phase 8 - placeholder)
    const notificationSoundUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'sounds', 'notification.ogg')
    );

    // Generate webview URIs for Nitro assets (per-item spritesheets)
    const nitroManifestUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'manifest.json')
    );
    const nitroFurnitureBaseUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'furniture')
    );
    const nitroFiguresBaseUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'figures')
    );

    // --- Agent Manager ---
    const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      || vscode.workspace.rootPath
      || '';
    console.log('[Extension] Workspace dir for AgentManager:', workspaceDir);
    const agentManager = new AgentManager(workspaceDir, (msg: ExtensionMessage) => {
      panel.webview.postMessage(msg);
    });

    // Listen for messages from webview
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.type) {
        case 'ready':
          agentManager.discoverAgents();
          break;
        case 'requestAgents':
          // Send current agents to webview
          for (const agent of agentManager.getAgents()) {
            panel.webview.postMessage({
              type: 'agentCreated',
              agentId: agent.agentId,
              terminalName: agent.terminalName,
              variant: agent.variant,
            } as ExtensionMessage);
            panel.webview.postMessage({
              type: 'agentStatus',
              agentId: agent.agentId,
              status: agent.status,
            } as ExtensionMessage);
          }
          break;
      }
    });

    // Cleanup on panel dispose
    panel.onDidDispose(() => {
      agentManager.dispose();
    });

    // Set HTML content
    panel.webview.html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${panel.webview.cspSource}; img-src ${panel.webview.cspSource}; connect-src ${panel.webview.cspSource}; style-src 'unsafe-inline'; font-src ${panel.webview.cspSource}; media-src ${panel.webview.cspSource};" />
    <link rel="preload" href="${fontUri}" as="font" type="font/ttf" crossorigin />
    <style>
      @font-face {
        font-family: 'Press Start 2P';
        src: url('${fontUri}') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: block;
      }
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100vh; background: #1a1a2e; }
    </style>
    <script>
      window.ASSET_URIS = {
        chairPng: '${chairPngUri}',
        chairJson: '${chairJsonUri}',
        furniturePng: '${furniturePngUri}',
        furnitureJson: '${furnitureJsonUri}',
        avatarPng: '${avatarPngUri}',
        avatarJson: '${avatarJsonUri}',
        notificationSound: '${notificationSoundUri}',
        nitroManifest: '${nitroManifestUri}',
        nitroFurnitureBase: '${nitroFurnitureBaseUri}',
        nitroFiguresBase: '${nitroFiguresBaseUri}'
      };
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
  });

  context.subscriptions.push(disposable);
}
