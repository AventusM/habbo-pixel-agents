// src/agentManager.ts
// Discovers and manages Claude Code agent sessions
// Runs in VS Code extension host (Node.js)

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { watchJsonlFile, type Disposable } from './fileWatcher.js';
import { parseTranscriptLine } from './transcriptParser.js';
import { extractSubagentType, classifyAgent } from './agentClassifier.js';
import type { AgentState, AgentEvent, ExtensionMessage, TeamSection } from './agentTypes.js';

/** How long without activity before an agent is considered idle (ms) */
const IDLE_TIMEOUT_MS = 10_000;

/** How often to check for idle agents (ms) */
const IDLE_CHECK_INTERVAL_MS = 5_000;

/** Only track JSONL files modified within this window (ms) */
const RECENT_THRESHOLD_MS = 30 * 60_000; // 30 minutes

export class AgentManager {
  private agents = new Map<string, AgentState>();
  private watchers = new Map<string, Disposable>();
  private nextVariant = 0;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private onMessage: (msg: ExtensionMessage) => void;
  private projectDir: string;
  private onClassificationNeeded?: (agentId: string) => void;

  constructor(
    projectDir: string,
    onMessage: (msg: ExtensionMessage) => void,
    onClassificationNeeded?: (agentId: string) => void,
  ) {
    this.projectDir = projectDir;
    this.onMessage = onMessage;
    this.onClassificationNeeded = onClassificationNeeded;
  }

  /**
   * Discover existing JSONL files in the Claude projects directory
   * and start watching them. Only tracks recently-active sessions.
   */
  discoverAgents(): void {
    const claudeDir = this.getClaudeProjectDir();
    if (!claudeDir || !fs.existsSync(claudeDir)) {
      console.log('[AgentManager] No Claude project directory found. projectDir:', this.projectDir, 'resolved:', claudeDir);
      return;
    }

    console.log('[AgentManager] Found Claude project dir:', claudeDir);

    const now = Date.now();

    try {
      const files = fs.readdirSync(claudeDir);
      // NOTE: Root-level JSONL files are parent/orchestrator conversations.
      // They should NOT spawn avatars. Only subagents/*.jsonl files are tracked.

      // Scan session directories for subagents/*.jsonl
      for (const file of files) {
        const sessionDirPath = path.join(claudeDir, file);
        try {
          const stat = fs.statSync(sessionDirPath);
          if (!stat.isDirectory()) continue;

          const subagentsPath = path.join(sessionDirPath, 'subagents');
          if (fs.existsSync(subagentsPath) && fs.statSync(subagentsPath).isDirectory()) {
            // Scan existing sub-agent JSONL files
            try {
              const subFiles = fs.readdirSync(subagentsPath);
              for (const subFile of subFiles) {
                if (!subFile.endsWith('.jsonl')) continue;
                const subFilePath = path.join(subagentsPath, subFile);
                try {
                  const subStat = fs.statSync(subFilePath);
                  if (now - subStat.mtimeMs < RECENT_THRESHOLD_MS) {
                    console.log(`[AgentManager] Tracking sub-agent: ${file}/subagents/${subFile} (modified ${Math.round((now - subStat.mtimeMs) / 1000)}s ago)`);
                    this.trackAgent(subFilePath);
                  }
                } catch {}
              }
            } catch {}
            // Watch for new sub-agent JSONL files in this subagents dir
            this.watchSubagentsDir(subagentsPath);
          } else {
            // No subagents dir yet — watch session dir for it to appear
            this.watchSessionDirForSubagents(sessionDirPath);
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[AgentManager] Error scanning directory:', err);
    }

    // Watch for new JSONL files and session directories appearing
    try {
      const dirWatcher = fs.watch(claudeDir, (eventType, filename) => {
        if (!filename) return;

        // NOTE: Root-level JSONL files are parent conversations — do NOT track them.
        // Only watch for new session directories that may contain subagents/.
        if (!filename.endsWith('.jsonl')) {
          const dirPath = path.join(claudeDir, filename);
          try {
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
              // Only watch if we aren't already watching this session dir
              const sessionKey = `__sessiondir__${dirPath}`;
              const subagentsKey = `__subagentsdir__${path.join(dirPath, 'subagents')}`;
              if (!this.watchers.has(sessionKey) && !this.watchers.has(subagentsKey)) {
                console.log(`[AgentManager] New session directory detected: ${filename}`);
                this.watchSessionDirForSubagents(dirPath);
              }
            }
          } catch {}
        }
      });

      this.watchers.set('__dir__', { dispose: () => dirWatcher.close() });
    } catch (err) {
      console.warn('[AgentManager] Cannot watch directory:', err);
    }

    // Start idle checker
    this.idleTimer = setInterval(() => this.checkIdleAgents(), IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * Get the Claude projects directory for the current workspace.
   *
   * Claude Code stores transcripts in ~/.claude/projects/{normalizedPath}/
   * where normalizedPath = path with / replaced by - (keeping the leading dash).
   * e.g. /Users/foo/bar → -Users-foo-bar
   */
  private getClaudeProjectDir(): string | null {
    const claudeBase = path.join(os.homedir(), '.claude', 'projects');
    console.log('[AgentManager] projectDir:', JSON.stringify(this.projectDir));

    if (!this.projectDir) {
      console.log('[AgentManager] Empty projectDir, cannot resolve Claude project dir');
      // Last resort: scan for directories and use the one matching our repo name
      return this.scanForProjectDir(claudeBase, 'habbo-pixel-agents');
    }

    // Claude Code normalizes the path: replace / with -, keep leading dash
    // /Users/antonmoroz/Documents/GitHub/project → -Users-antonmoroz-Documents-GitHub-project
    const normalized = this.projectDir.replace(/\//g, '-');
    const projectPath = path.join(claudeBase, normalized);
    console.log('[AgentManager] Trying normalized path:', projectPath);

    if (fs.existsSync(projectPath)) {
      return projectPath;
    }

    // Fallback: scan for a directory ending with the project basename
    return this.scanForProjectDir(claudeBase, path.basename(this.projectDir));
  }

  private scanForProjectDir(claudeBase: string, basename: string): string | null {
    if (!fs.existsSync(claudeBase)) return null;
    try {
      const dirs = fs.readdirSync(claudeBase);
      for (const dir of dirs) {
        if (dir.endsWith(`-${basename}`)) {
          const fullPath = path.join(claudeBase, dir);
          console.log('[AgentManager] Found via scan:', fullPath);
          return fullPath;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Start tracking a new agent from its JSONL file.
   */
  private trackAgent(jsonlPath: string): void {
    if (this.agents.has(jsonlPath)) return;

    const agentId = path.basename(jsonlPath, '.jsonl');
    const variant = (this.nextVariant++ % 6) as 0 | 1 | 2 | 3 | 4 | 5;

    // Read first ~50 lines for classification
    let initialContent = '';
    try {
      const raw = fs.readFileSync(jsonlPath, 'utf8');
      const lines = raw.split('\n');
      initialContent = lines.slice(0, 50).join('\n');
    } catch {
      // File may not be readable yet
    }

    // Try meta.json first (authoritative source from Claude Code)
    const metaPath = jsonlPath.replace('.jsonl', '.meta.json');
    let subagentType: string | null = null;
    try {
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        subagentType = meta.agentType || null;
      }
    } catch {}

    // Fall back to JSONL content scanning only if meta.json unavailable
    if (!subagentType) {
      subagentType = extractSubagentType(initialContent);
    }

    const classification = classifyAgent(subagentType, initialContent);

    const terminalName = classification.displayName;

    const state: AgentState = {
      agentId,
      terminalName,
      variant,
      status: 'idle',
      lastActivityMs: Date.now(),
      jsonlPath,
      role: classification.role,
      team: classification.team,
      taskArea: classification.taskArea,
      displayName: classification.displayName,
    };

    this.agents.set(jsonlPath, state);

    // Notify webview with classification data
    this.onMessage({
      type: 'agentCreated',
      agentId,
      terminalName,
      variant,
      role: classification.role,
      team: classification.team,
      taskArea: classification.taskArea,
    });

    // If subagent_type couldn't be determined, request manual classification
    if (!subagentType) {
      this.onMessage({ type: 'requestClassification', agentId });
      if (this.onClassificationNeeded) {
        this.onClassificationNeeded(agentId);
      }
    }

    // Watch for new events
    const watcher = watchJsonlFile(jsonlPath, (lines) => {
      for (const line of lines) {
        const event = parseTranscriptLine(line);
        if (event) {
          this.handleAgentEvent(jsonlPath, event);
        }
      }
    });

    this.watchers.set(jsonlPath, watcher);
    console.log(`[AgentManager] Tracking agent: ${agentId} (variant ${variant})`);
  }

  /**
   * Watch a session directory for a 'subagents' subdirectory to appear.
   * Once it appears, switches to watching the subagents dir for JSONL files.
   */
  private watchSessionDirForSubagents(sessionDirPath: string): void {
    const watcherKey = `__sessiondir__${sessionDirPath}`;
    if (this.watchers.has(watcherKey)) return;

    try {
      const watcher = fs.watch(sessionDirPath, (eventType, filename) => {
        if (filename !== 'subagents') return;
        const subagentsPath = path.join(sessionDirPath, 'subagents');
        try {
          if (fs.existsSync(subagentsPath) && fs.statSync(subagentsPath).isDirectory()) {
            console.log(`[AgentManager] Subagents dir appeared in: ${path.basename(sessionDirPath)}`);
            // Scan existing files in the new subagents dir
            try {
              const subFiles = fs.readdirSync(subagentsPath);
              for (const subFile of subFiles) {
                if (!subFile.endsWith('.jsonl')) continue;
                const subFilePath = path.join(subagentsPath, subFile);
                if (!this.agents.has(subFilePath)) {
                  this.trackAgent(subFilePath);
                }
              }
            } catch {}
            this.watchSubagentsDir(subagentsPath);
            // Close this session-level watcher — no longer needed
            const existing = this.watchers.get(watcherKey);
            if (existing) {
              existing.dispose();
              this.watchers.delete(watcherKey);
            }
          }
        } catch {}
      });

      this.watchers.set(watcherKey, { dispose: () => watcher.close() });
    } catch (err) {
      console.warn(`[AgentManager] Cannot watch session dir ${sessionDirPath}:`, err);
    }
  }

  /**
   * Watch a subagents directory for new JSONL files appearing.
   */
  private watchSubagentsDir(subagentsDirPath: string): void {
    const watcherKey = `__subagentsdir__${subagentsDirPath}`;
    if (this.watchers.has(watcherKey)) return;

    try {
      const watcher = fs.watch(subagentsDirPath, (eventType, filename) => {
        if (!filename || !filename.endsWith('.jsonl')) return;
        const filePath = path.join(subagentsDirPath, filename);
        try {
          if (fs.existsSync(filePath) && !this.agents.has(filePath)) {
            console.log(`[AgentManager] New sub-agent JSONL detected: ${filename}`);
            this.trackAgent(filePath);
          }
        } catch {}
      });

      this.watchers.set(watcherKey, { dispose: () => watcher.close() });
    } catch (err) {
      console.warn(`[AgentManager] Cannot watch subagents dir ${subagentsDirPath}:`, err);
    }
  }

  /**
   * Handle a parsed event from an agent's transcript.
   */
  private handleAgentEvent(jsonlPath: string, event: AgentEvent): void {
    const agent = this.agents.get(jsonlPath);
    if (!agent) return;

    agent.lastActivityMs = Date.now();

    if (event.type === 'tool_use') {
      // Agent is active (using tools)
      if (agent.status !== 'active') {
        agent.status = 'active';
        this.onMessage({
          type: 'agentStatus',
          agentId: agent.agentId,
          status: 'active',
        });
      }

      // Send tool event
      this.onMessage({
        type: 'agentTool',
        agentId: agent.agentId,
        toolName: event.toolName || 'unknown',
        displayText: event.displayText || 'Working...',
      });
    }
  }

  /**
   * Check for idle agents based on inactivity timeout.
   */
  private checkIdleAgents(): void {
    const now = Date.now();
    for (const [, agent] of this.agents) {
      if (agent.status === 'active' && now - agent.lastActivityMs > IDLE_TIMEOUT_MS) {
        agent.status = 'idle';
        this.onMessage({
          type: 'agentStatus',
          agentId: agent.agentId,
          status: 'idle',
        });
      }
    }
  }

  /**
   * Reassign an agent to a different team section.
   * Updates agent state and re-sends agentCreated to webview.
   */
  reassignAgent(agentId: string, team: TeamSection): void {
    for (const [, agent] of this.agents) {
      if (agent.agentId === agentId) {
        agent.team = team;
        this.onMessage({
          type: 'agentCreated',
          agentId: agent.agentId,
          terminalName: agent.terminalName,
          variant: agent.variant,
          role: agent.role,
          team: agent.team,
          taskArea: agent.taskArea,
        });
        break;
      }
    }
  }

  /**
   * Get all current agent states (for webview requestAgents).
   */
  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  /**
   * Clean up all watchers and timers.
   */
  dispose(): void {
    for (const [, watcher] of this.watchers) {
      watcher.dispose();
    }
    this.watchers.clear();
    this.agents.clear();

    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
