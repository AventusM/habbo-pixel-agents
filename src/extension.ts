import * as vscode from 'vscode';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import { AgentManager } from './agentManager.js';
import type { WebviewMessage, ExtensionMessage, TeamSection } from './agentTypes.js';
import { fetchKanbanCards } from './githubProjects.js';
import { MessageBridge } from './messageBridge.js';
import { OrchestrationPanelProvider } from './orchestrationPanel.js';

interface KanbanConfig {
  owner: string;
  ownerType: 'org' | 'user';
  projectNumber: number;
  pollIntervalSeconds: number;
}

/**
 * Read kanban config from VS Code settings, falling back to .vscode/settings.json
 * in the extension directory when no workspace folder is open (e.g. Extension Dev Host).
 */
function readKanbanConfig(extUri: vscode.Uri): KanbanConfig {
  const config = vscode.workspace.getConfiguration('habboPixelAgents');
  let owner = config.get<string>('githubProject.owner', '');
  let ownerType = config.get<string>('githubProject.ownerType', 'org') as 'org' | 'user';
  let projectNumber = config.get<number>('githubProject.projectNumber', 0);
  const pollIntervalSeconds = config.get<number>('githubProject.pollIntervalSeconds', 60);

  if (!owner) {
    try {
      const settingsPath = join(extUri.fsPath, '.vscode', 'settings.json');
      if (existsSync(settingsPath)) {
        const raw = JSON.parse(readFileSync(settingsPath, 'utf8'));
        owner = raw['habboPixelAgents.githubProject.owner'] || '';
        ownerType = (raw['habboPixelAgents.githubProject.ownerType'] || 'org') as 'org' | 'user';
        projectNumber = raw['habboPixelAgents.githubProject.projectNumber'] || 0;
      }
    } catch {
      // Ignore — settings simply not available
    }
  }

  return { owner, ownerType, projectNumber, pollIntervalSeconds };
}

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
  // --- Message Bridge & Orchestration Sidebar ---
  const bridge = new MessageBridge();
  const orchestrationProvider = new OrchestrationPanelProvider(context.extensionUri, bridge);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OrchestrationPanelProvider.viewType,
      orchestrationProvider,
    ),
  );

  // Shared agentManager reference (set inside openRoom command)
  let sharedAgentManager: AgentManager | null = null;

  // Handle sidebar messages that need extension host action
  orchestrationProvider.onDidReceiveMessage(async (msg: any) => {
    switch (msg.type) {
      case 'viewTranscript': {
        if (!sharedAgentManager) break;
        const agents = sharedAgentManager.getAgents();
        const agent = agents.find(a => a.agentId === msg.agentId);
        if (agent?.jsonlPath) {
          try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(agent.jsonlPath));
            await vscode.window.showTextDocument(doc, { preview: true });
          } catch (err) {
            console.warn('[Orchestration] Failed to open transcript:', err);
          }
        }
        break;
      }
      case 'reassignAgent': {
        if (sharedAgentManager) {
          sharedAgentManager.reassignAgent(msg.agentId, msg.team || 'core-dev');
        }
        break;
      }
    }
  });

  const disposable = vscode.commands.registerCommand('habbo-pixel-agents.openRoom', () => {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'habboRoom',
      'Habbo Room',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
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

    // Generate webview URI for notification sound (Phase 8)
    const notificationSoundUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'sounds', 'notification.wav')
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

    // --- Message Bridge: register room panel ---
    bridge.setRoomPanel(panel);

    // --- Agent Manager ---
    const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      || vscode.workspace.rootPath
      || '';
    console.log('[Extension] Workspace dir for AgentManager:', workspaceDir);
    const agentManager = new AgentManager(workspaceDir, (msg: ExtensionMessage) => {
      bridge.broadcastAgentEvent(msg);
    }, async (agentId: string) => {
      // Show VS Code quickpick for manual agent classification
      const teamOptions: Array<{ label: string; value: TeamSection }> = [
        { label: 'Planning', value: 'planning' },
        { label: 'Core Dev', value: 'core-dev' },
        { label: 'Infrastructure', value: 'infrastructure' },
        { label: 'Support', value: 'support' },
      ];
      const picked = await vscode.window.showQuickPick(
        teamOptions.map(o => o.label),
        { placeHolder: `Classify agent ${agentId}: select team` },
      );
      const selectedTeam = teamOptions.find(o => o.label === picked)?.value ?? 'core-dev';
      agentManager.reassignAgent(agentId, selectedTeam);
    });
    sharedAgentManager = agentManager;

    // Listen for messages from webview
    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.type) {
        case 'ready': {
          // Signal dev mode to webview
          if (context.extensionMode === vscode.ExtensionMode.Development) {
            panel.webview.postMessage({ type: 'devMode', enabled: true } as ExtensionMessage);
          }
          agentManager.discoverAgents();
          const { owner, ownerType, projectNumber } = readKanbanConfig(context.extensionUri);
          console.log(`[Kanban] ready received. owner="${owner}" projectNumber=${projectNumber} ownerType="${ownerType}"`);
          if (owner && projectNumber > 0) {
            const cards = fetchKanbanCards(owner, projectNumber, ownerType);
            console.log(`[Kanban] fetched ${cards.length} cards:`, cards.map(c => c.title));
            panel.webview.postMessage({ type: 'kanbanCards', cards } as ExtensionMessage);
          } else {
            console.log('[Kanban] skipped fetch: owner or projectNumber not configured');
          }
          break;
        }
        case 'requestAgents':
          // Send current agents to both room and sidebar (including classification data)
          for (const agent of agentManager.getAgents()) {
            bridge.broadcastAgentEvent({
              type: 'agentCreated',
              agentId: agent.agentId,
              terminalName: agent.terminalName,
              variant: agent.variant,
              role: agent.role,
              team: agent.team,
              taskArea: agent.taskArea,
            });
            bridge.broadcastAgentEvent({
              type: 'agentStatus',
              agentId: agent.agentId,
              status: agent.status,
            });
          }
          break;
        case 'reassignAgent': {
          const { agentId: reassignId, team: reassignTeam } = msg as { type: 'reassignAgent'; agentId: string; team: TeamSection };
          agentManager.reassignAgent(reassignId, reassignTeam);
          break;
        }
        case 'devCapture': {
          const { screenshot, logs } = msg as { type: 'devCapture'; screenshot: string; logs: string[] };
          const timestamp = Date.now();
          const pngPath = join(os.tmpdir(), `habbo-capture-${timestamp}.png`);

          // Decode base64 data URL and write PNG
          const base64Data = screenshot.replace(/^data:image\/png;base64,/, '');
          writeFileSync(pngPath, Buffer.from(base64Data, 'base64'));

          // Format clipboard text
          const logSection = logs.length > 0
            ? `\nConsole (last ${logs.length} lines):\n${logs.join('\n')}`
            : '';
          const clipboardText = `Screenshot: ${pngPath}${logSection}`;
          vscode.env.clipboard.writeText(clipboardText);
          vscode.window.showInformationMessage(`Dev capture saved: ${pngPath}`);
          break;
        }
        case 'saveAvatar': {
          const { agentId, outfit } = msg as any;
          if (workspaceDir) {
            const avatarsDir = join(workspaceDir, '.habbo-agents');
            const avatarsPath = join(avatarsDir, 'avatars.json');
            // Read existing data
            let data: Record<string, any> = {};
            try {
              if (existsSync(avatarsPath)) {
                data = JSON.parse(readFileSync(avatarsPath, 'utf8'));
              }
            } catch { /* fresh file */ }
            // Merge
            if (!data[agentId]) data[agentId] = {};
            data[agentId].outfit = outfit;
            // Write
            if (!existsSync(avatarsDir)) {
              mkdirSync(avatarsDir, { recursive: true });
            }
            writeFileSync(avatarsPath, JSON.stringify(data, null, 2));
          }
          break;
        }
        case 'loadAvatars': {
          if (workspaceDir) {
            const avatarsPath = join(workspaceDir, '.habbo-agents', 'avatars.json');
            let data: Record<string, any> = {};
            try {
              if (existsSync(avatarsPath)) {
                data = JSON.parse(readFileSync(avatarsPath, 'utf8'));
              }
            } catch { /* no file yet */ }
            panel.webview.postMessage({ type: 'avatarOutfits', outfits: data } as ExtensionMessage);
          }
          break;
        }
        default:
          // Relay unhandled room messages through bridge (e.g., agentClicked)
          bridge.handleRoomMessage(msg);
          break;
      }
    });

    // --- GitHub Projects kanban polling ---
    let kanbanPollId: ReturnType<typeof setInterval> | undefined;

    {
      const { owner: pollOwner, ownerType: pollOwnerType, projectNumber: pollProjectNumber, pollIntervalSeconds } = readKanbanConfig(context.extensionUri);
      if (pollOwner && pollProjectNumber > 0 && pollIntervalSeconds > 0) {
        kanbanPollId = setInterval(() => {
          const polledCards = fetchKanbanCards(pollOwner, pollProjectNumber, pollOwnerType);
          panel.webview.postMessage({ type: 'kanbanCards', cards: polledCards } as ExtensionMessage);
        }, pollIntervalSeconds * 1000);
      }
    }

    // Cleanup on panel dispose
    panel.onDidDispose(() => {
      if (kanbanPollId) {
        clearInterval(kanbanPollId);
      }
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

  // Auto-open room and devtools when running in Extension Development Host
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    vscode.commands.executeCommand('habbo-pixel-agents.openRoom').then(() => {
      setTimeout(() => {
        vscode.commands.executeCommand('workbench.action.webview.openDeveloperTools');
      }, 1000);
    });
  }
}
