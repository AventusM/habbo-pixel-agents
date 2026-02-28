import * as vscode from 'vscode';

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

    // Set HTML content
    panel.webview.html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${panel.webview.cspSource}; style-src 'unsafe-inline';" />
    <style>
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100vh; background: #1a1a2e; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
  });

  context.subscriptions.push(disposable);
}
