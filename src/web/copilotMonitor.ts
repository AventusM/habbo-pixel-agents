/**
 * GitHub Copilot Coding Agent monitor.
 *
 * Polls the GitHub API for Copilot coding agent activity:
 * - PRs authored by Copilot (user "Copilot" or branches matching copilot/*)
 * - Workflow runs named "Running Copilot coding agent"
 * - Latest commits on Copilot PRs (for detailed activity display)
 *
 * Emits agent lifecycle events (created, status, tool, removed) via callback,
 * using the same ExtensionMessage protocol as the JSONL-based AgentManager.
 */
import type { ExtensionMessage, TeamSection } from '../agentTypes.js';

export interface CopilotAgentSession {
  /** PR number as string — used as agentId */
  id: string;
  /** PR number */
  prNumber: number;
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
  /** SHA of the last commit we reported — avoids duplicate updates */
  lastCommitSha?: string;
  /** Name of the last active workflow run */
  lastRunName?: string;
  /** Total commit count at last check */
  commitCount: number;
}

/** Summarised activity for display */
interface ActivitySnapshot {
  /** Primary display text for speech bubble */
  displayText: string;
  /** What phase the agent is in */
  phase: 'planning' | 'coding' | 'responding' | 'testing' | 'waiting';
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

      // Build maps of active runs and latest run names per branch
      const activeBranches = new Set<string>();
      const runNameByBranch = new Map<string, string>();
      for (const run of runs) {
        if (run.status === 'in_progress' || run.status === 'queued') {
          activeBranches.add(run.branch);
        }
        // Keep the most recent run name per branch (runs are sorted newest first)
        if (!runNameByBranch.has(run.branch)) {
          runNameByBranch.set(run.branch, run.name);
        }
      }

      const currentIds = new Set<string>();

      for (const pr of prs) {
        const agentId = `copilot-pr-${pr.number}`;
        currentIds.add(agentId);
        const isRunning = activeBranches.has(pr.branch);
        const existing = this.sessions.get(agentId);
        const runName = runNameByBranch.get(pr.branch);

        if (!existing) {
          // New session — spawn agent
          const session: CopilotAgentSession = {
            id: agentId,
            prNumber: pr.number,
            title: pr.title,
            branch: pr.branch,
            prState: pr.state,
            draft: pr.draft,
            isRunning,
            lastStatus: 'Starting...',
            updatedAt: pr.updatedAt,
            linkedTicketId: this.extractTicketId(pr.branch, pr.title),
            lastRunName: runName,
            commitCount: 0,
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

          if (session.linkedTicketId) {
            this.onMessage({
              type: 'agentLinkedTicket',
              agentId,
              ticketId: session.linkedTicketId,
              ticketTitle: pr.title,
            } as any);
          }

          this.onMessage({
            type: 'agentStatus',
            agentId,
            status: isRunning ? 'active' : 'idle',
          });

          // Fetch initial activity snapshot
          const activity = await this.getActivitySnapshot(session, isRunning, runName);
          session.lastStatus = activity.displayText;
          this.onMessage({
            type: 'agentTool',
            agentId,
            toolName: 'CopilotAgent',
            displayText: activity.displayText,
          });

          console.log(`[CopilotMonitor] New agent: ${displayName} (PR #${pr.number}, ${activity.displayText})`);
        } else {
          // Existing session — check for state changes
          const wasRunning = existing.isRunning;
          existing.isRunning = isRunning;
          existing.prState = pr.state;
          existing.updatedAt = pr.updatedAt;
          existing.lastRunName = runName;

          // Always refresh activity when running, or on state transition
          if (isRunning || isRunning !== wasRunning) {
            const activity = await this.getActivitySnapshot(existing, isRunning, runName);

            // Only emit if the display text actually changed
            if (activity.displayText !== existing.lastStatus) {
              existing.lastStatus = activity.displayText;
              this.onMessage({
                type: 'agentStatus',
                agentId,
                status: isRunning ? 'active' : 'idle',
              });
              this.onMessage({
                type: 'agentTool',
                agentId,
                toolName: 'CopilotAgent',
                displayText: activity.displayText,
              });
              console.log(`[CopilotMonitor] PR #${pr.number}: ${activity.displayText}`);
            }
          }
        }
      }

      // Remove sessions for PRs that are no longer open
      for (const [agentId] of this.sessions) {
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

  /**
   * Build a detailed activity snapshot by combining:
   * - Workflow run name (what phase: initial coding vs responding to feedback)
   * - Latest commits (what the agent actually did)
   */
  private async getActivitySnapshot(
    session: CopilotAgentSession,
    isRunning: boolean,
    runName?: string,
  ): Promise<ActivitySnapshot> {
    if (!isRunning) {
      // Not running — summarise what happened based on latest commits
      const commits = await this.fetchPRCommits(session.prNumber);
      if (commits.length === 0) {
        return { displayText: 'Waiting for review', phase: 'waiting' };
      }

      const latest = commits[commits.length - 1];
      const msg = this.shortenCommitMessage(latest.message);
      const commitWord = commits.length === 1 ? 'commit' : 'commits';
      return {
        displayText: `Done — ${commits.length} ${commitWord}: "${msg}"`,
        phase: 'waiting',
      };
    }

    // Running — determine phase from run name and commits
    const phase = this.detectPhase(runName);
    const commits = await this.fetchPRCommits(session.prNumber);
    const newCommits = commits.length - session.commitCount;
    session.commitCount = commits.length;

    if (newCommits > 0) {
      // Agent just pushed — show what it committed
      const latest = commits[commits.length - 1];
      const msg = this.shortenCommitMessage(latest.message);
      session.lastCommitSha = latest.sha;

      const prefix = phase === 'responding' ? 'Responding' : 'Working';
      return {
        displayText: `${prefix}: pushed "${msg}"`,
        phase,
      };
    }

    // Running but no new commits yet — show phase + context
    switch (phase) {
      case 'responding':
        return { displayText: 'Responding to feedback...', phase };
      case 'planning':
        return { displayText: 'Planning approach...', phase };
      case 'testing':
        return { displayText: 'Running tests...', phase };
      case 'coding':
      default: {
        if (commits.length === 0) {
          return { displayText: 'Analyzing codebase...', phase: 'planning' };
        }
        const latest = commits[commits.length - 1];
        const msg = this.shortenCommitMessage(latest.message);
        return {
          displayText: `Coding... (last: "${msg}")`,
          phase: 'coding',
        };
      }
    }
  }

  /**
   * Detect the agent's phase from the workflow run name.
   * GitHub uses specific names for different Copilot agent activities.
   */
  private detectPhase(runName?: string): ActivitySnapshot['phase'] {
    if (!runName) return 'coding';
    const lower = runName.toLowerCase();
    if (lower.includes('addressing comment') || lower.includes('addressing review')) {
      return 'responding';
    }
    if (lower.includes('running copilot')) {
      return 'coding';
    }
    if (lower.includes('test')) {
      return 'testing';
    }
    if (lower.includes('plan')) {
      return 'planning';
    }
    return 'coding';
  }

  /** Shorten a commit message for display in a speech bubble */
  private shortenCommitMessage(msg: string): string {
    // Take first line only
    const firstLine = msg.split('\n')[0];
    // Strip conventional commit prefix
    const stripped = firstLine.replace(/^(feat|fix|chore|refactor|test|docs|style|ci|perf)(\(.+?\))?:\s*/i, '');
    // Truncate
    if (stripped.length > 50) {
      return stripped.slice(0, 47) + '...';
    }
    return stripped;
  }

  private async fetchPRCommits(prNumber: number): Promise<Array<{
    sha: string;
    message: string;
    date: string;
  }>> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls/${prNumber}/commits?per_page=100`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      console.warn(`[CopilotMonitor] Commits fetch failed for PR #${prNumber}: ${res.status}`);
      return [];
    }

    const commits = await res.json() as Array<{
      sha: string;
      commit: {
        message: string;
        author: { date: string };
      };
    }>;

    return commits.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author.date,
    }));
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
