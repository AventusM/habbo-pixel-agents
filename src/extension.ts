import * as vscode from 'vscode';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import { config as loadDotenv } from 'dotenv';
import { AgentManager } from './agentManager.js';
import type { WebviewMessage, ExtensionMessage, TeamSection } from './agentTypes.js';
import { fetchKanbanCards } from './githubProjects.js';
import { fetchAzureDevOpsCards } from './azureDevOpsBoards.js';
import { MessageBridge } from './messageBridge.js';
import { readEnvFile, writeEnvFile } from './envConfig.js';
import { OrchestrationPanelProvider } from './orchestrationPanel.js';

interface KanbanConfig {
  owner: string;
  ownerType: 'org' | 'user';
  projectNumber: number;
  pollIntervalSeconds: number;
}

/** Read kanban config — env vars take priority, VS Code settings as fallback. */
function readKanbanConfig(): KanbanConfig {
  const config = vscode.workspace.getConfiguration('habboPixelAgents');
  const owner = process.env.GITHUB_PROJECT_OWNER || config.get<string>('githubProject.owner', '') || '';
  const ownerType = (process.env.GITHUB_PROJECT_OWNER_TYPE || config.get<string>('githubProject.ownerType', '') || 'org') as 'org' | 'user';
  const projectNumber = parseInt(process.env.GITHUB_PROJECT_NUMBER || '0', 10) || config.get<number>('githubProject.projectNumber', 0) || 0;
  const pollIntervalSeconds = config.get<number>('githubProject.pollIntervalSeconds', 60);

  return { owner, ownerType, projectNumber, pollIntervalSeconds };
}

interface AzureDevOpsConfig {
  organization: string;
  project: string;
  pat: string;
  pollIntervalSeconds: number;
}

/** Read Azure DevOps config — env vars take priority, VS Code settings as fallback. */
function readAzureDevOpsConfig(): AzureDevOpsConfig {
  const config = vscode.workspace.getConfiguration('habboPixelAgents');
  const organization = process.env.AZURE_DEVOPS_ORG || config.get<string>('azureDevOps.organization', '') || '';
  const project = process.env.AZURE_DEVOPS_PROJECT || config.get<string>('azureDevOps.project', '') || '';
  const pat = process.env.AZURE_DEVOPS_PAT || config.get<string>('azureDevOps.pat', '') || '';
  const pollIntervalSeconds = config.get<number>('azureDevOps.pollIntervalSeconds', 60);

  return { organization, project, pat, pollIntervalSeconds };
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
  // Load .env from workspace root (or extension root in dev mode)
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionUri.fsPath;
  {
    const envPath = join(wsRoot, '.env');
    const result = loadDotenv({ path: envPath });
    console.log(`[dotenv] loaded from ${envPath}`, result.error ? `error: ${result.error}` : `parsed ${Object.keys(result.parsed || {}).length} vars`);
  }

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

  // Handle sidebar messages — execute VS Code commands and relay to room
  orchestrationProvider.onDidReceiveMessage(async (msg: any) => {
    switch (msg.type) {
      case 'debugSpawn':
        vscode.commands.executeCommand('habbo-pixel-agents.debugSpawn');
        break;
      case 'debugDespawn':
        vscode.commands.executeCommand('habbo-pixel-agents.debugDespawn');
        break;
      case 'debugDespawnAll':
        vscode.commands.executeCommand('habbo-pixel-agents.debugDespawnAll');
        break;
      case 'openRoom':
        vscode.commands.executeCommand('habbo-pixel-agents.openRoom');
        break;
      case 'toggleOverlay':
        bridge.sendToRoom({ type: 'toggleOverlay' });
        break;
      case 'autoFollow':
        bridge.sendToRoom({ type: 'autoFollow' });
        break;
      case 'jumpToSection':
        bridge.sendToRoom({ type: 'jumpToSection', team: msg.team });
        break;
      // Layout editor commands — relay to room webview
      case 'editorMode':
        bridge.sendToRoom({ type: 'editorMode', mode: msg.mode });
        break;
      case 'editorColor':
        bridge.sendToRoom({ type: 'editorColor', h: msg.h, s: msg.s, b: msg.b });
        break;
      case 'editorFurniture':
        bridge.sendToRoom({ type: 'editorFurniture', furniture: msg.furniture });
        break;
      case 'editorRotate':
        bridge.sendToRoom({ type: 'editorRotate' });
        break;
      case 'editorSave':
        bridge.sendToRoom({ type: 'editorSave' });
        break;
      case 'editorLoad':
        bridge.sendToRoom({ type: 'editorLoad' });
        break;
      case 'playSound':
        bridge.sendToRoom({ type: 'playSound', sound: msg.sound });
        break;
      case 'devCapture':
        bridge.sendToRoom({ type: 'devCapture' });
        break;
      case 'debugGrid':
        bridge.sendToRoom({ type: 'debugGrid' });
        break;
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
    // Generate webview URIs for PixelLab character sprites
    const pixellabPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.png')
    );
    const pixellabJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.json')
    );

    // Generate webview URIs for team-specific PixelLab atlases
    // All teams currently use the same habbo-inspiration-new character
    const plPlanningPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.png')
    );
    const plPlanningJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.json')
    );
    const plCoreDevPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.png')
    );
    const plCoreDevJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.json')
    );
    const plInfrastructurePngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.png')
    );
    const plInfrastructureJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.json')
    );
    const plSupportPngUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.png')
    );
    const plSupportJsonUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'pixellab', 'habbo-inspiration-new.json')
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
          const readyConfig = vscode.workspace.getConfiguration('habboPixelAgents');
          const readyKanbanSource = process.env.KANBAN_SOURCE || readyConfig.get<string>('kanbanSource', '') || 'github';
          console.log(`[Kanban] ready received. source="${readyKanbanSource}"`);

          if (readyKanbanSource === 'azuredevops') {
            const { organization, project, pat } = readAzureDevOpsConfig();
            console.log(`[Kanban] ADO config: org="${organization}" project="${project}" pat=${pat ? '***' : '(empty)'}`);
            if (organization && project && pat) {
              void fetchAzureDevOpsCards(organization, project, pat).then((cards) => {
                console.log(`[Kanban] fetched ${cards.length} ADO cards`);
                panel.webview.postMessage({ type: 'kanbanCards', cards } as ExtensionMessage);
              });
            } else {
              console.log('[Kanban] skipped ADO fetch: missing org, project, or pat');
            }
          } else {
            const { owner, ownerType, projectNumber } = readKanbanConfig();
            console.log(`[Kanban] GitHub config: owner="${owner}" projectNumber=${projectNumber} ownerType="${ownerType}"`);
            if (owner && projectNumber > 0) {
              const cards = fetchKanbanCards(owner, projectNumber, ownerType);
              console.log(`[Kanban] fetched ${cards.length} GitHub cards`);
              panel.webview.postMessage({ type: 'kanbanCards', cards } as ExtensionMessage);
            } else {
              console.log('[Kanban] skipped GitHub fetch: owner or projectNumber not configured');
            }
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
        case 'exportDebugGrid': {
          const { screenshot: gridScreenshot } = msg as { type: 'exportDebugGrid'; screenshot: string };
          const ts = Date.now();
          const desktopDir = join(os.homedir(), 'Desktop');
          const gridPngPath = join(desktopDir, `habbo-debug-grid-${ts}.png`);
          const gridBase64 = gridScreenshot.replace(/^data:image\/png;base64,/, '');
          writeFileSync(gridPngPath, Buffer.from(gridBase64, 'base64'));
          vscode.window.showInformationMessage(`Debug grid exported: ${gridPngPath}`);
          break;
        }
        default:
          // Relay unhandled room messages through bridge (e.g., agentClicked)
          bridge.handleRoomMessage(msg);
          break;
      }
    });

    // --- Kanban polling (GitHub Projects or Azure DevOps, gated by kanbanSource) ---
    let kanbanPollId: ReturnType<typeof setInterval> | undefined;

    {
      const globalConfig = vscode.workspace.getConfiguration('habboPixelAgents');
      const kanbanSource = process.env.KANBAN_SOURCE || globalConfig.get<string>('kanbanSource', '') || 'github';

      if (kanbanSource === 'azuredevops') {
        const { organization: adoOrg, project: adoProject, pat: adoPat, pollIntervalSeconds: adoPollIntervalSeconds } = readAzureDevOpsConfig();
        if (adoOrg && adoProject && adoPat && adoPollIntervalSeconds > 0) {
          kanbanPollId = setInterval(() => {
            void fetchAzureDevOpsCards(adoOrg, adoProject, adoPat).then((cards) => {
              panel.webview.postMessage({ type: 'kanbanCards', cards } as ExtensionMessage);
            });
          }, adoPollIntervalSeconds * 1000);
        }
      } else {
        // Default: GitHub Projects
        const { owner: pollOwner, ownerType: pollOwnerType, projectNumber: pollProjectNumber, pollIntervalSeconds } = readKanbanConfig();
        if (pollOwner && pollProjectNumber > 0 && pollIntervalSeconds > 0) {
          kanbanPollId = setInterval(() => {
            const polledCards = fetchKanbanCards(pollOwner, pollProjectNumber, pollOwnerType);
            panel.webview.postMessage({ type: 'kanbanCards', cards: polledCards } as ExtensionMessage);
          }, pollIntervalSeconds * 1000);
        }
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
        pixellabPng: '${pixellabPngUri}',
        pixellabJson: '${pixellabJsonUri}',
        plPlanningPng: '${plPlanningPngUri}',
        plPlanningJson: '${plPlanningJsonUri}',
        plCoreDevPng: '${plCoreDevPngUri}',
        plCoreDevJson: '${plCoreDevJsonUri}',
        plInfrastructurePng: '${plInfrastructurePngUri}',
        plInfrastructureJson: '${plInfrastructureJsonUri}',
        plSupportPng: '${plSupportPngUri}',
        plSupportJson: '${plSupportJsonUri}'
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

  // --- Debug commands for testing spawn/despawn ---
  const debugAgents = new Map<string, number>(); // agentId → variant
  let debugVariant = 0;
  const teams: TeamSection[] = ['planning', 'core-dev', 'infrastructure', 'support'];
  const debugRoles: Record<TeamSection, string[]> = {
    'planning': ['Architect', 'Planner', 'Designer'],
    'core-dev': ['Coder', 'Developer', 'Engineer'],
    'infrastructure': ['DevOps', 'SRE', 'Builder'],
    'support': ['Reviewer', 'Tester', 'QA'],
  };
  const debugTasks: Record<TeamSection, string[]> = {
    'planning': ['Roadmap', 'API Design', 'Schema'],
    'core-dev': ['Frontend', 'Backend', 'Renderer'],
    'infrastructure': ['CI/CD', 'Deploy', 'Pipeline'],
    'support': ['Bug Triage', 'Docs', 'Tests'],
  };
  const debugTeamCounters: Record<TeamSection, number> = {
    'planning': 0, 'core-dev': 0, 'infrastructure': 0, 'support': 0,
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('habbo-pixel-agents.debugSpawn', () => {
      const id = `debug-${Date.now()}`;
      const variant = (debugVariant++ % 6) as 0 | 1 | 2 | 3 | 4 | 5;
      const team = teams[debugVariant % teams.length];
      const teamNum = ++debugTeamCounters[team];
      const role = debugRoles[team][teamNum % debugRoles[team].length];
      const task = debugTasks[team][teamNum % debugTasks[team].length];
      debugAgents.set(id, variant);
      bridge.broadcastAgentEvent({
        type: 'agentCreated',
        agentId: id,
        terminalName: `${role}`,
        variant,
        team,
        role,
        taskArea: `${task} #${teamNum}`,
      });
      vscode.window.showInformationMessage(`Spawned ${id} → ${team}: ${role} (${task} #${teamNum})`);
    }),
    vscode.commands.registerCommand('habbo-pixel-agents.debugDespawn', () => {
      const lastId = Array.from(debugAgents.keys()).pop();
      if (!lastId) {
        vscode.window.showWarningMessage('No debug agents to despawn');
        return;
      }
      bridge.broadcastAgentEvent({
        type: 'agentRemoved',
        agentId: lastId,
      });
      debugAgents.delete(lastId);
      vscode.window.showInformationMessage(`Despawning ${lastId}`);
    }),
    vscode.commands.registerCommand('habbo-pixel-agents.debugDespawnAll', () => {
      for (const id of debugAgents.keys()) {
        bridge.broadcastAgentEvent({ type: 'agentRemoved', agentId: id });
      }
      const count = debugAgents.size;
      debugAgents.clear();
      vscode.window.showInformationMessage(`Despawned all ${count} debug agents`);
    }),
  );

  // ── Configure Integration command ──────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('habbo-pixel-agents.configure', async () => {
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsRoot) {
        vscode.window.showErrorMessage('Habbo: No workspace folder open — cannot write .env');
        return;
      }

      const existing = readEnvFile(wsRoot);
      const def = (k: string) => existing.get(k) ?? '';
      const updates = new Map<string, string>();

      // Step 1: Kanban source
      const kanbanSource = await vscode.window.showQuickPick(
        [
          { label: 'github', description: 'GitHub Projects board', picked: def('KANBAN_SOURCE') !== 'azuredevops' },
          { label: 'azuredevops', description: 'Azure DevOps board', picked: def('KANBAN_SOURCE') === 'azuredevops' },
        ],
        { placeHolder: 'Kanban source — which board drives wall sticky notes?' },
      );
      if (!kanbanSource) return; // user cancelled
      updates.set('KANBAN_SOURCE', kanbanSource.label);

      // Step 2: GitHub Copilot monitoring (always required)
      const githubRepo = await vscode.window.showInputBox({
        prompt: 'GitHub repo to monitor for Copilot agent activity',
        placeHolder: 'owner/repo',
        value: def('GITHUB_REPO') || 'owner/repo',
        validateInput: (v) => (v.includes('/') ? null : 'Must be in owner/repo format'),
      });
      if (githubRepo === undefined) return;
      if (githubRepo && githubRepo !== 'owner/repo') updates.set('GITHUB_REPO', githubRepo);

      const githubToken = await vscode.window.showInputBox({
        prompt: 'GitHub Personal Access Token (read:repo + read:actions)',
        placeHolder: 'ghp_...',
        value: def('GITHUB_TOKEN'),
        password: true,
        validateInput: (v) => (!v ? 'Token is required for Copilot monitoring' : null),
      });
      if (githubToken === undefined) return;
      if (githubToken) updates.set('GITHUB_TOKEN', githubToken);

      // Step 3a: GitHub Projects kanban
      if (kanbanSource.label === 'github') {
        const ghOwner = await vscode.window.showInputBox({
          prompt: 'GitHub Project owner (org or user login) — leave blank to skip kanban',
          placeHolder: 'myorg',
          value: def('GITHUB_PROJECT_OWNER'),
        });
        if (ghOwner === undefined) return;
        if (ghOwner) {
          updates.set('GITHUB_PROJECT_OWNER', ghOwner);

          const ownerType = await vscode.window.showQuickPick(
            [
              { label: 'org', description: 'GitHub organization', picked: def('GITHUB_PROJECT_OWNER_TYPE') !== 'user' },
              { label: 'user', description: 'Personal user account', picked: def('GITHUB_PROJECT_OWNER_TYPE') === 'user' },
            ],
            { placeHolder: 'Owner type' },
          );
          if (!ownerType) return;
          updates.set('GITHUB_PROJECT_OWNER_TYPE', ownerType.label);

          const projectNumber = await vscode.window.showInputBox({
            prompt: 'GitHub Projects project number (from the project URL)',
            placeHolder: '1',
            value: def('GITHUB_PROJECT_NUMBER') || '0',
            validateInput: (v) => (isNaN(Number(v)) ? 'Must be a number' : null),
          });
          if (projectNumber === undefined) return;
          if (projectNumber && projectNumber !== '0') updates.set('GITHUB_PROJECT_NUMBER', projectNumber);
        }
      }

      // Step 3b: Azure DevOps kanban
      if (kanbanSource.label === 'azuredevops') {
        const azdoOrg = await vscode.window.showInputBox({
          prompt: 'Azure DevOps organization name (from https://dev.azure.com/ORG)',
          placeHolder: 'mycompany',
          value: def('AZDO_ORG'),
        });
        if (azdoOrg === undefined) return;
        if (azdoOrg) updates.set('AZDO_ORG', azdoOrg);

        const azdoProject = await vscode.window.showInputBox({
          prompt: 'Azure DevOps project name',
          placeHolder: 'MyProject',
          value: def('AZDO_PROJECT'),
        });
        if (azdoProject === undefined) return;
        if (azdoProject) updates.set('AZDO_PROJECT', azdoProject);

        const azdoPat = await vscode.window.showInputBox({
          prompt: 'Azure DevOps Personal Access Token (read:work items)',
          placeHolder: 'your-pat-here',
          value: def('AZDO_PAT'),
          password: true,
        });
        if (azdoPat === undefined) return;
        if (azdoPat) updates.set('AZDO_PAT', azdoPat);
      }

      if (updates.size === 0) {
        vscode.window.showInformationMessage('Habbo: No changes — .env is already up to date.');
        return;
      }

      try {
        writeEnvFile(wsRoot, updates);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`Habbo: Failed to write .env — ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      const action = await vscode.window.showInformationMessage(
        `✅ .env updated (${updates.size} var${updates.size !== 1 ? 's' : ''} changed)`,
        'Reload Window',
      );
      if (action === 'Reload Window') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    }),
  );

  // Auto-open room and devtools when running in Extension Development Host
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    vscode.commands.executeCommand('habbo-pixel-agents.openRoom').then(() => {
      setTimeout(() => {
        vscode.commands.executeCommand('workbench.action.webview.openDeveloperTools');
      }, 1000);
    });
  }
}
