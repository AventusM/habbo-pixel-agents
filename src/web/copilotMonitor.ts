/**
 * GitHub Copilot Coding Agent monitor.
 *
 * Polls the GitHub API for Copilot coding agent activity:
 * - PRs authored by Copilot (user "Copilot" or branches matching copilot/*)
 * - Workflow runs named "Running Copilot coding agent"
 *
 * Emits agent lifecycle events (created, status, tool, removed) via callback,
 * using the same ExtensionMessage protocol as the JSONL-based AgentManager.
 */
import type { ExtensionMessage, TeamSection } from '../agentTypes.js';

export interface CopilotAgentSession {
  /** PR number as string — used as agentId */
  id: string;
  /** PR title */
  title: string;
  /** Branch name (e.g. copilot/fix-bug) */
  branch: string;
  /** PR state: open, closed, merged */
  prState: string;
  /** Whether the PR is a draft */
  draft: boolean;
  /** Whether the agent workflow is currently running */
  isRunning: boolean;
  /** Last workflow status text */
  lastStatus: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Linked Azure DevOps ticket ID (if branch name matches) */
  linkedTicketId?: string;
}

export class CopilotAgentMonitor {
  private owner: string;
  private repo: string;
  private token: string;
  private sessions = new Map<string, CopilotAgentSession>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private onMessage: (msg: ExtensionMessage) => void;
  private pollIntervalMs: number;
  private variant = 0;

  constructor(
    owner: string,
    repo: string,
    token: string,
    onMessage: (msg: ExtensionMessage) => void,
    pollIntervalMs = 15_000,
  ) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.onMessage = onMessage;
    this.pollIntervalMs = pollIntervalMs;
  }

  /** Start polling for Copilot agent activity */
  start(): void {
    console.log(`[CopilotMonitor] Starting — polling ${this.owner}/${this.repo} every ${this.pollIntervalMs / 1000}s`);
    // Initial poll immediately
    void this.poll();
    this.pollTimer = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  /** Stop polling */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Get current sessions */
  getSessions(): CopilotAgentSession[] {
    return Array.from(this.sessions.values());
  }

  private async poll(): Promise<void> {
    try {
      const [prs, runs] = await Promise.all([
        this.fetchCopilotPRs(),
        this.fetchCopilotRuns(),
      ]);

      // Build a set of branches with active runs
      const activeBranches = new Set<string>();
      const runStatusByBranch = new Map<string, string>();
      for (const run of runs) {
        if (run.status === 'in_progress' || run.status === 'queued') {
          activeBranches.add(run.branch);
          runStatusByBranch.set(run.branch, run.name || 'Working...');
        }
      }

      // Track which sessions still exist
      const currentIds = new Set<string>();

      for (const pr of prs) {
        const agentId = `copilot-pr-${pr.number}`;
        currentIds.add(agentId);
        const isRunning = activeBranches.has(pr.branch);
        const existing = this.sessions.get(agentId);

        if (!existing) {
          // New session — spawn agent
          const session: CopilotAgentSession = {
            id: agentId,
            title: pr.title,
            branch: pr.branch,
            prState: pr.state,
            draft: pr.draft,
            isRunning,
            lastStatus: isRunning ? (runStatusByBranch.get(pr.branch) || 'Working...') : 'Waiting',
            updatedAt: pr.updatedAt,
            linkedTicketId: this.extractTicketId(pr.branch, pr.title),
          };
          this.sessions.set(agentId, session);

          const v = (this.variant++ % 6) as 0 | 1 | 2 | 3 | 4 | 5;
          const displayName = this.getDisplayName(pr.branch);

          this.onMessage({
            type: 'agentCreated',
            agentId,
            terminalName: displayName,
            variant: v,
            team: 'core-dev' as TeamSection,
            role: 'Copilot',
            taskArea: pr.title,
          });

          // Link to ticket if available
          if (session.linkedTicketId) {
            this.onMessage({
              type: 'agentLinkedTicket',
              agentId,
              ticketId: session.linkedTicketId,
              ticketTitle: pr.title,
            } as any);
          }

          // Set initial status
          this.onMessage({
            type: 'agentStatus',
            agentId,
            status: isRunning ? 'active' : 'idle',
          });

          if (isRunning) {
            this.onMessage({
              type: 'agentTool',
              agentId,
              toolName: 'CopilotAgent',
              displayText: session.lastStatus,
            });
          }

          console.log(`[CopilotMonitor] New agent: ${displayName} (PR #${pr.number}, ${isRunning ? 'running' : 'idle'})`);
        } else {
          // Existing session — check for state changes
          const wasRunning = existing.isRunning;
          existing.isRunning = isRunning;
          existing.prState = pr.state;
          existing.updatedAt = pr.updatedAt;

          if (isRunning && !wasRunning) {
            // Agent started working
            existing.lastStatus = runStatusByBranch.get(pr.branch) || 'Working...';
            this.onMessage({ type: 'agentStatus', agentId, status: 'active' });
            this.onMessage({
              type: 'agentTool',
              agentId,
              toolName: 'CopilotAgent',
              displayText: existing.lastStatus,
            });
            console.log(`[CopilotMonitor] Agent active: PR #${pr.number}`);
          } else if (!isRunning && wasRunning) {
            // Agent stopped working
            existing.lastStatus = 'Waiting for review';
            this.onMessage({ type: 'agentStatus', agentId, status: 'idle' });
            console.log(`[CopilotMonitor] Agent idle: PR #${pr.number}`);
          }
        }
      }

      // Remove sessions for PRs that are no longer open
      for (const [agentId, session] of this.sessions) {
        if (!currentIds.has(agentId)) {
          this.onMessage({ type: 'agentRemoved', agentId });
          this.sessions.delete(agentId);
          console.log(`[CopilotMonitor] Agent removed: ${agentId}`);
        }
      }
    } catch (err) {
      console.warn('[CopilotMonitor] Poll failed:', (err as Error).message);
    }
  }

  private async fetchCopilotPRs(): Promise<Array<{
    number: number;
    title: string;
    branch: string;
    state: string;
    draft: boolean;
    updatedAt: string;
  }>> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls?state=open&per_page=30`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      console.warn(`[CopilotMonitor] PR fetch failed: ${res.status}`);
      return [];
    }

    const prs = await res.json() as Array<{
      number: number;
      title: string;
      head: { ref: string };
      state: string;
      draft: boolean;
      updated_at: string;
      user: { login: string };
    }>;

    return prs
      .filter(pr => pr.user.login === 'Copilot' || pr.head.ref.startsWith('copilot/'))
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        branch: pr.head.ref,
        state: pr.state,
        draft: pr.draft,
        updatedAt: pr.updated_at,
      }));
  }

  private async fetchCopilotRuns(): Promise<Array<{
    id: number;
    status: string;
    branch: string;
    name: string;
  }>> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs?per_page=20`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      console.warn(`[CopilotMonitor] Runs fetch failed: ${res.status}`);
      return [];
    }

    const data = await res.json() as {
      workflow_runs: Array<{
        id: number;
        status: string;
        head_branch: string;
        name: string;
      }>;
    };

    return (data.workflow_runs || [])
      .filter(run => run.head_branch.startsWith('copilot/'))
      .map(run => ({
        id: run.id,
        status: run.status,
        branch: run.head_branch,
        name: run.name,
      }));
  }

  /** Extract Azure DevOps ticket ID from branch name or PR title */
  private extractTicketId(branch: string, title: string): string | undefined {
    // Match patterns like AB#123 (Azure DevOps link syntax) or #123
    const abMatch = title.match(/AB#(\d+)/);
    if (abMatch) return abMatch[1];

    const hashMatch = title.match(/#(\d+)/);
    if (hashMatch) return hashMatch[1];

    return undefined;
  }

  /** Convert branch name to a display-friendly name */
  getDisplayName(branch: string): string {
    return branch
      .replace('copilot/', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .slice(0, 20);
  }
}
