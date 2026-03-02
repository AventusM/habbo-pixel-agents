// src/agentManager.ts
// Discovers and manages Claude Code agent sessions
// Runs in VS Code extension host (Node.js)

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { watchJsonlFile, type Disposable } from './fileWatcher.js';
import { parseTranscriptLine } from './transcriptParser.js';
import type { AgentState, AgentEvent, ExtensionMessage } from './agentTypes.js';

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

  constructor(projectDir: string, onMessage: (msg: ExtensionMessage) => void) {
    this.projectDir = projectDir;
    this.onMessage = onMessage;
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
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const filePath = path.join(claudeDir, file);

        // Only track recently-modified files (not old historical sessions)
        try {
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs < RECENT_THRESHOLD_MS) {
            console.log(`[AgentManager] Tracking recent session: ${file} (modified ${Math.round((now - stat.mtimeMs) / 1000)}s ago)`);
            this.trackAgent(filePath);
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[AgentManager] Error scanning directory:', err);
    }

    // Watch for new JSONL files appearing in the directory
    try {
      const dirWatcher = fs.watch(claudeDir, (eventType, filename) => {
        if (filename && filename.endsWith('.jsonl')) {
          const filePath = path.join(claudeDir, filename);
          if (fs.existsSync(filePath) && !this.agents.has(filePath)) {
            console.log(`[AgentManager] New JSONL detected: ${filename}`);
            this.trackAgent(filePath);
          }
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
    const terminalName = `Claude ${this.agents.size + 1}`;

    const state: AgentState = {
      agentId,
      terminalName,
      variant,
      status: 'idle',
      lastActivityMs: Date.now(),
      jsonlPath,
    };

    this.agents.set(jsonlPath, state);

    // Notify webview
    this.onMessage({
      type: 'agentCreated',
      agentId,
      terminalName,
      variant,
    });

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
