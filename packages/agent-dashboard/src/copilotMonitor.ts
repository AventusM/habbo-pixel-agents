/**
 * GitHub Copilot Coding Agent monitor.
 *
 * Polls the GitHub API for Copilot coding agent activity:
 * - PRs authored by Copilot (user "Copilot" or branches matching copilot/*)
 * - Workflow runs named "Running Copilot coding agent"
 * - Live session logs from the Copilot sessions API for real-time activity
 *
 * Emits agent lifecycle events (created, status, tool, removed) via callback,
 * using the same ExtensionMessage protocol as the JSONL-based AgentManager.
 */
import type { ExtensionMessage, TeamSection } from "./agentTypes.js";

/** How agent activity data is currently being delivered */
export type FeedMode = "sse" | "fast-poll" | "poll";

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
  /** Copilot session UUID (from api.githubcopilot.com) */
  copilotSessionId?: string;
  /** Current data feed mode for this agent */
  feedMode: FeedMode;
  /** Human-readable reason for the current feed mode */
  feedReason: string;
}

/** A parsed tool call from the Copilot session SSE stream */
export interface ParsedToolCall {
  name: string;
  description?: string;
  path?: string;
  pattern?: string;
  command?: string;
  /** Message from report_progress tool calls */
  message?: string;
}

/** Summarised activity for display */
export interface ActivitySnapshot {
  /** Primary display text for speech bubble */
  displayText: string;
  /** What phase the agent is in */
  phase: "planning" | "coding" | "responding" | "testing" | "waiting";
}

/**
 * Parse the last meaningful tool call from the Copilot SSE stream body.
 *
 * The stream contains `data: {json}\n\n` lines. We scan from the end
 * to find the most recent agent tool call (skipping setup steps and
 * PR metadata generation).
 */
export function parseLastToolCall(sseBody: string): ParsedToolCall | null {
  const lines = sseBody.split("\n");
  const skipTools = new Set(["run_setup"]);
  let lastThinking: ParsedToolCall | null = null;

  // Scan from the end for the last real tool call
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.startsWith("data: ")) continue;

    try {
      const json = JSON.parse(line.slice(6));
      const choices = json.choices || [];
      for (const choice of choices) {
        const delta = choice.delta || {};

        // Check for tool calls — prefer these over thinking
        const toolCalls = delta.tool_calls || [];
        for (const tc of toolCalls) {
          const fn = tc.function || {};
          const name = fn.name as string;
          if (!name || skipTools.has(name)) continue;

          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(fn.arguments || "{}");
          } catch {
            // Arguments might not be valid JSON
          }

          return {
            name,
            description: args.description as string | undefined,
            path: (args.path || args.file_path) as string | undefined,
            pattern: args.pattern as string | undefined,
            command: args.command as string | undefined,
            message: args.message as string | undefined,
          };
        }

        // Check for agent reasoning (content without tool calls)
        // Only keep the first (most recent) meaningful one as fallback
        if (!lastThinking && delta.content && toolCalls.length === 0) {
          const content = (delta.content as string).trim();
          // Skip PR metadata, empty content, and very short content
          if (
            content.length > 10 &&
            !content.includes("<pr_title>") &&
            !content.includes("<pr_description>") &&
            !content.startsWith("$") // skip shell output
          ) {
            lastThinking = {
              name: "_thinking",
              description: content,
            };
          }
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return lastThinking;
}

/** Extract just the filename from a path */
function extractFilename(path?: string): string {
  if (!path) return "file";
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/** Truncate text with ellipsis */
function truncate(text?: string, maxLen = 50): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/**
 * Format a Copilot tool call into a human-readable display string.
 * Similar to formatToolStatus in transcriptParser.ts.
 */
export function formatCopilotToolCall(tool: ParsedToolCall): string {
  switch (tool.name) {
    case "bash": {
      if (tool.description) return truncate(tool.description, 50);
      if (tool.command) return `Running: ${truncate(tool.command, 40)}`;
      return "Running command...";
    }
    case "view":
      return `Reading ${extractFilename(tool.path)}`;
    case "glob":
      return `Searching: ${truncate(tool.pattern, 40)}`;
    case "grep":
      return `Searching for: ${truncate(tool.pattern, 35)}`;
    case "edit":
      return `Editing ${extractFilename(tool.path)}`;
    case "write":
    case "create":
      return `Writing ${extractFilename(tool.path)}`;
    case "task":
      return tool.description
        ? `Task: ${truncate(tool.description, 40)}`
        : "Running sub-task...";
    case "reply_to_comment":
      return "Replying to review comment";
    case "codeql_checker":
      return "Running security analysis";
    case "report_progress": {
      // Agent progress update — message field has the main content
      const msg = tool.message || tool.description || tool.command || "";
      if (msg) return truncate(msg, 50);
      return "Updating progress...";
    }
    case "run_custom_setup_step": {
      const step = tool.description || tool.command || "";
      if (step) return `Setup: ${truncate(step, 42)}`;
      return "Setting up environment...";
    }
    case "_thinking": {
      // Agent reasoning — extract first sentence
      const text = tool.description || "";
      const firstSentence = text.split(/[.!?\n]/)[0].trim();
      return truncate(firstSentence, 50);
    }
    default: {
      // Handle prefixed tools like playwright-browser_navigate
      const name = tool.name;
      if (name.startsWith("playwright-")) {
        const action = name.replace("playwright-", "").replace(/_/g, " ");
        return `Browser: ${action}`;
      }
      return `Using ${name}`;
    }
  }
}

/** Extract Azure DevOps ticket ID from PR title (AB#NNN) or generic #NNN reference */
export function extractTicketId(
  branch: string,
  title: string,
  body?: string,
): string | undefined {
  // Check title first
  const abMatchTitle = title.match(/AB#(\d+)/);
  if (abMatchTitle) return abMatchTitle[1];
  // Check body for AB#NNN (Copilot agent includes this when triggered from ADO)
  if (body) {
    const abMatchBody = body.match(/AB#(\d+)/);
    if (abMatchBody) return abMatchBody[1];
  }
  // Fallback: generic #NNN in title only (body has too many false positives)
  const hashMatch = title.match(/#(\d+)/);
  if (hashMatch) return hashMatch[1];
  return undefined;
}

/** Convert a Copilot branch name to a display-friendly short name */
export function formatDisplayName(branch: string): string {
  return branch
    .replace("copilot/", "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 20);
}

/** State for a single SSE connection to Copilot session logs */
export interface SSEConnection {
  /** The agent ID this connection serves */
  agentId: string;
  /** AbortController to cancel the fetch */
  controller: AbortController;
  /** Whether the connection is currently active */
  connected: boolean;
}

/**
 * Parse a single SSE `data:` line into a tool call.
 *
 * Unlike `parseLastToolCall` which scans the entire body from the end,
 * this processes one event at a time for incremental streaming.
 * Returns null for setup/progress tools, unparseable lines, or
 * content that isn't a meaningful tool call or thinking.
 */
export function parseSingleSSEEvent(dataLine: string): ParsedToolCall | null {
  if (!dataLine.startsWith("data: ")) return null;

  const skipTools = new Set(["run_setup"]);

  try {
    const json = JSON.parse(dataLine.slice(6));
    const choices = json.choices || [];
    for (const choice of choices) {
      const delta = choice.delta || {};

      // Check for tool calls
      const toolCalls = delta.tool_calls || [];
      for (const tc of toolCalls) {
        const fn = tc.function || {};
        const name = fn.name as string;
        if (!name || skipTools.has(name)) continue;

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(fn.arguments || "{}");
        } catch {
          // Arguments might not be valid JSON
        }

        return {
          name,
          description: args.description as string | undefined,
          path: (args.path || args.file_path) as string | undefined,
          pattern: args.pattern as string | undefined,
          command: args.command as string | undefined,
          message: args.message as string | undefined,
        };
      }

      // Check for agent reasoning (content without tool calls)
      if (delta.content && toolCalls.length === 0) {
        const content = (delta.content as string).trim();
        if (
          content.length > 10 &&
          !content.includes("<pr_title>") &&
          !content.includes("<pr_description>") &&
          !content.startsWith("$")
        ) {
          return {
            name: "_thinking",
            description: content,
          };
        }
      }
    }
  } catch {
    // Unparseable line — skip
  }

  return null;
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
  /** Cache of PR number → Copilot session ID */
  private sessionIdCache = new Map<number, string>();
  /** Whether the Copilot sessions API is available (avoids repeated 401s) */
  private sessionApiAvailable = true;
  /** OAuth token for api.githubcopilot.com sessions API (separate from GitHub PAT) */
  private copilotToken: string;
  /** Active SSE connections per agent ID */
  private sseConnections = new Map<string, SSEConnection>();
  /** Active fast-poll timers per agent ID (when SSE fails) */
  private fastPollTimers = new Map<string, ReturnType<typeof setInterval>>();
  /** ADO tickets already transitioned to "Doing" in this session */
  private adoTransitionedToDoing = new Set<string>();
  /** Azure DevOps config for server-side state sync */
  private adoConfig?: { organization: string; project: string; pat: string };
  /** Callback when ADO state is changed — server uses this to refresh kanban */
  private onAdoStateChange?: () => void;

  constructor(
    owner: string,
    repo: string,
    token: string,
    onMessage: (msg: ExtensionMessage) => void,
    pollIntervalMs = 15_000,
    adoConfig?: { organization: string; project: string; pat: string },
    copilotToken?: string,
  ) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.copilotToken = copilotToken || token;
    this.onMessage = onMessage;
    this.pollIntervalMs = pollIntervalMs;
    if (adoConfig?.organization && adoConfig?.project && adoConfig?.pat) {
      this.adoConfig = adoConfig;
    }
  }

  /** Register a callback to fire after any ADO state change (e.g. to refresh kanban) */
  setOnAdoStateChange(cb: () => void): void {
    this.onAdoStateChange = cb;
  }

  /** Start polling for Copilot agent activity */
  start(): void {
    console.log(
      `[CopilotMonitor] Starting — polling ${this.owner}/${this.repo} every ${this.pollIntervalMs / 1000}s`,
    );
    void this.poll();
    this.pollTimer = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  /** Stop polling and close all SSE connections and fast-poll timers */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.closeAllSSEConnections();
    this.stopAllFastPollTimers();
  }

  /** Get current sessions */
  getSessions(): CopilotAgentSession[] {
    return Array.from(this.sessions.values());
  }

  /** Check if an agent has an active SSE stream */
  hasActiveSSE(agentId: string): boolean {
    const conn = this.sseConnections.get(agentId);
    return conn?.connected === true;
  }

  /**
   * Open a persistent SSE connection to stream tool calls for a running agent.
   *
   * Reads the response body incrementally via ReadableStream, parses each
   * `data:` line as it arrives, and emits agentTool/agentStatus messages
   * for new tool calls. Falls back to fast-poll (3s) if SSE fails.
   */
  private async openSSEStream(session: CopilotAgentSession): Promise<void> {
    const agentId = session.id;

    // Don't open duplicate connections
    if (this.sseConnections.has(agentId)) return;
    if (!this.sessionApiAvailable) {
      this.setFeedMode(session, "poll", "sessions API disabled (auth failure)");
      this.startFastPoll(session);
      return;
    }

    // Resolve the Copilot session ID
    const sessionId = await this.resolveCopilotSessionId(session.prNumber);
    if (!sessionId) {
      this.setFeedMode(
        session,
        "poll",
        `no session ID found for PR #${session.prNumber}`,
      );
      this.startFastPoll(session);
      return;
    }
    session.copilotSessionId = sessionId;

    const controller = new AbortController();
    const conn: SSEConnection = { agentId, controller, connected: false };
    this.sseConnections.set(agentId, conn);

    // Run the streaming fetch in the background — don't await it
    void this.runSSEStream(session, sessionId, conn);
  }

  /**
   * The actual SSE streaming loop. Runs for the lifetime of one connection.
   * If the stream closes immediately (endpoint returns full body, not persistent),
   * falls back to fast-poll (3s) instead of waiting 15s.
   */
  private async runSSEStream(
    session: CopilotAgentSession,
    sessionId: string,
    conn: SSEConnection,
  ): Promise<void> {
    const agentId = session.id;
    const streamStartTime = Date.now();

    try {
      const res = await fetch(
        `https://api.githubcopilot.com/agents/sessions/${sessionId}/logs`,
        {
          headers: {
            Authorization: `Bearer ${this.copilotToken}`,
            "Content-Type": "application/json",
            "Copilot-Integration-Id": "copilot-4-cli",
            "X-Github-Api-Version": "2026-01-09",
          },
          signal: conn.controller.signal,
        },
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.warn(
            `[CopilotMonitor] SSE: session logs API returned ${res.status}, disabling`,
          );
          this.sessionApiAvailable = false;
        } else {
          console.warn(
            `[CopilotMonitor] SSE: failed for PR #${session.prNumber}: HTTP ${res.status}`,
          );
        }
        this.sseConnections.delete(agentId);
        this.setFeedMode(session, "fast-poll", `SSE HTTP ${res.status}`);
        this.startFastPoll(session);
        return;
      }

      if (!res.body) {
        console.warn(
          `[CopilotMonitor] SSE: no response body for PR #${session.prNumber}`,
        );
        this.sseConnections.delete(agentId);
        this.setFeedMode(session, "fast-poll", "SSE response had no body");
        this.startFastPoll(session);
        return;
      }

      // Log response headers for diagnostics
      const contentType = res.headers.get("content-type") || "unknown";
      const transferEncoding = res.headers.get("transfer-encoding") || "none";
      console.log(
        `[CopilotMonitor] SSE connected for PR #${session.prNumber} (content-type: ${contentType}, transfer-encoding: ${transferEncoding})`,
      );

      conn.connected = true;
      this.setFeedMode(session, "sse", "connected");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from the buffer
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);

          if (!line.startsWith("data: ")) continue;

          const toolCall = parseSingleSSEEvent(line);
          if (!toolCall) continue;
          eventCount++;

          const displayText = formatCopilotToolCall(toolCall);
          const phase = this.detectPhaseFromTool(toolCall);

          // Only emit if the display text actually changed
          if (displayText !== session.lastStatus) {
            session.lastStatus = displayText;
            this.onMessage({
              type: "agentStatus",
              agentId,
              status: "active",
            });
            this.onMessage({
              type: "agentTool",
              agentId,
              toolName: "CopilotAgent",
              displayText: this.withTicketPrefix(session, displayText),
            });
            console.log(
              `[CopilotMonitor] SSE PR #${session.prNumber}: ${displayText}`,
            );
          }
        }
      }

      // Stream ended — check if it was a real persistent connection or a body dump
      const streamDurationMs = Date.now() - streamStartTime;
      console.log(
        `[CopilotMonitor] SSE stream ended for PR #${session.prNumber} after ${Math.round(streamDurationMs / 1000)}s (${eventCount} events)`,
      );

      // If stream ended quickly (< 10s) and agent is still running, it was a body dump, not persistent SSE
      if (streamDurationMs < 10_000 && session.isRunning) {
        console.log(
          `[CopilotMonitor] SSE stream was not persistent for PR #${session.prNumber} — switching to fast-poll`,
        );
        this.setFeedMode(
          session,
          "fast-poll",
          `stream closed after ${Math.round(streamDurationMs / 1000)}s`,
        );
        this.startFastPoll(session);
      }
    } catch (err) {
      // AbortError is expected when we close the connection
      if ((err as Error).name !== "AbortError") {
        console.warn(
          `[CopilotMonitor] SSE error for PR #${session.prNumber}: ${(err as Error).message}`,
        );
        this.setFeedMode(
          session,
          "fast-poll",
          `SSE error: ${(err as Error).message}`,
        );
        this.startFastPoll(session);
      }
    } finally {
      conn.connected = false;
      this.sseConnections.delete(agentId);
      console.log(`[CopilotMonitor] SSE closed for PR #${session.prNumber}`);
    }
  }

  /** Close the SSE connection for a specific agent */
  private closeSSEConnection(agentId: string): void {
    const conn = this.sseConnections.get(agentId);
    if (conn) {
      conn.controller.abort();
      this.sseConnections.delete(agentId);
    }
  }

  /** Close all active SSE connections */
  private closeAllSSEConnections(): void {
    for (const [agentId, conn] of this.sseConnections) {
      conn.controller.abort();
    }
    this.sseConnections.clear();
  }

  /** Update the feed mode for a session and broadcast to clients */
  private setFeedMode(
    session: CopilotAgentSession,
    mode: FeedMode,
    reason: string,
  ): void {
    if (session.feedMode === mode && session.feedReason === reason) return;
    session.feedMode = mode;
    session.feedReason = reason;
    console.log(
      `[CopilotMonitor] PR #${session.prNumber}: feed=${mode} (${reason})`,
    );
    this.onMessage({
      type: "agentFeedMode",
      agentId: session.id,
      feedMode: mode,
      feedReason: reason,
    });
  }

  /**
   * Start a fast-poll timer (3s) for an agent whose SSE connection failed.
   * Fast-poll fetches the session logs body and parses the last tool call —
   * same as the old getActivitySnapshot but at 3s instead of 15s.
   */
  private startFastPoll(session: CopilotAgentSession): void {
    const agentId = session.id;
    // Don't duplicate timers
    if (this.fastPollTimers.has(agentId)) return;
    if (!session.isRunning) return;

    const FAST_POLL_MS = 3_000;
    console.log(
      `[CopilotMonitor] Starting fast-poll (${FAST_POLL_MS / 1000}s) for PR #${session.prNumber}`,
    );

    const timer = setInterval(async () => {
      // Stop if agent is no longer running or session API is unavailable
      if (!session.isRunning || !this.sessionApiAvailable) {
        this.stopFastPoll(agentId);
        if (!this.sessionApiAvailable) {
          this.setFeedMode(session, "poll", "sessions API unavailable");
        }
        return;
      }
      try {
        const activity = await this.fetchLiveActivity(session);
        if (activity && activity.displayText !== session.lastStatus) {
          session.lastStatus = activity.displayText;
          this.onMessage({
            type: "agentStatus",
            agentId,
            status: "active",
          });
          this.onMessage({
            type: "agentTool",
            agentId,
            toolName: "CopilotAgent",
            displayText: this.withTicketPrefix(session, activity.displayText),
          });
          console.log(
            `[CopilotMonitor] Fast-poll PR #${session.prNumber}: ${activity.displayText}`,
          );
        }
      } catch (err) {
        console.warn(
          `[CopilotMonitor] Fast-poll error PR #${session.prNumber}: ${(err as Error).message}`,
        );
      }
    }, FAST_POLL_MS);

    this.fastPollTimers.set(agentId, timer);
  }

  /** Stop the fast-poll timer for a specific agent */
  private stopFastPoll(agentId: string): void {
    const timer = this.fastPollTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.fastPollTimers.delete(agentId);
    }
  }

  /** Stop all fast-poll timers */
  private stopAllFastPollTimers(): void {
    for (const [, timer] of this.fastPollTimers) {
      clearInterval(timer);
    }
    this.fastPollTimers.clear();
  }

  /**
   * Transition an Azure DevOps work item to a target state.
   * Used to move tickets to "Doing" when a Copilot PR is first detected.
   */
  async updateAdoWorkItemState(
    ticketId: string,
    targetState: string,
  ): Promise<boolean> {
    if (!this.adoConfig) return false;
    const { organization, project, pat } = this.adoConfig;

    try {
      const authHeader = `Basic ${Buffer.from(":" + pat).toString("base64")}`;
      const res = await fetch(
        `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${ticketId}?api-version=7.1`,
        {
          method: "PATCH",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json-patch+json",
          },
          body: JSON.stringify([
            { op: "replace", path: "/fields/System.State", value: targetState },
          ]),
        },
      );

      if (res.ok) {
        console.log(`[CopilotMonitor] ADO #${ticketId} → ${targetState}`);
        this.onAdoStateChange?.();
        return true;
      } else {
        console.warn(
          `[CopilotMonitor] ADO #${ticketId} update failed: HTTP ${res.status}`,
        );
        return false;
      }
    } catch (err) {
      console.warn(
        `[CopilotMonitor] ADO #${ticketId} update error: ${(err as Error).message}`,
      );
      return false;
    }
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
        if (run.status === "in_progress" || run.status === "queued") {
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
            lastStatus: "Starting...",
            updatedAt: pr.updatedAt,
            linkedTicketId: this.extractTicketId(pr.branch, pr.title, pr.body),
            lastRunName: runName,
            commitCount: 0,
            feedMode: "poll",
            feedReason: "initializing",
          };
          this.sessions.set(agentId, session);

          const v = (this.variant++ % 6) as 0 | 1 | 2 | 3 | 4 | 5;
          const displayName = this.getDisplayName(pr.branch);

          this.onMessage({
            type: "agentCreated",
            agentId,
            terminalName: displayName,
            variant: v,
            team: "core-dev" as TeamSection,
            role: "Copilot",
            taskArea: pr.title,
          });

          if (session.linkedTicketId) {
            this.onMessage({
              type: "agentLinkedTicket",
              agentId,
              ticketId: session.linkedTicketId,
              ticketTitle: pr.title,
            } as any);
          }

          this.onMessage({
            type: "agentStatus",
            agentId,
            status: isRunning ? "active" : "idle",
          });

          // Fetch initial activity snapshot
          const activity = await this.getActivitySnapshot(
            session,
            isRunning,
            runName,
            true,
          );
          session.lastStatus = activity.displayText;
          this.onMessage({
            type: "agentTool",
            agentId,
            toolName: "CopilotAgent",
            displayText: this.withTicketPrefix(session, activity.displayText),
          });

          console.log(
            `[CopilotMonitor] New agent: ${displayName} (PR #${pr.number}, ${activity.displayText})`,
          );

          // Sync ADO state to "Doing" for new Copilot PRs with linked tickets
          // A Copilot PR existing means the agent is working — don't require isRunning
          if (
            session.linkedTicketId &&
            !this.adoTransitionedToDoing.has(session.linkedTicketId)
          ) {
            this.adoTransitionedToDoing.add(session.linkedTicketId);
            console.log(
              `[CopilotMonitor] New Copilot PR #${pr.number} linked to ADO #${session.linkedTicketId} — syncing to Doing`,
            );
            void this.updateAdoWorkItemState(session.linkedTicketId, "Doing");
          }

          // Open SSE stream for real-time updates if agent is running
          if (isRunning) {
            void this.openSSEStream(session);
          } else {
            this.setFeedMode(session, "poll", "agent not running");
          }
        } else {
          // Existing session — check for state changes
          const wasRunning = existing.isRunning;
          existing.isRunning = isRunning;
          existing.prState = pr.state;
          existing.updatedAt = pr.updatedAt;
          existing.lastRunName = runName;

          // Manage SSE/fast-poll connection lifecycle based on running state
          if (isRunning && !wasRunning) {
            // Agent started running — try SSE stream, sync ADO if needed
            this.stopFastPoll(agentId);
            void this.openSSEStream(existing);

            // Sync ADO to "Doing" if not already done
            if (
              existing.linkedTicketId &&
              !this.adoTransitionedToDoing.has(existing.linkedTicketId)
            ) {
              this.adoTransitionedToDoing.add(existing.linkedTicketId);
              void this.updateAdoWorkItemState(
                existing.linkedTicketId,
                "Doing",
              );
            }
          } else if (!isRunning && wasRunning) {
            // Agent stopped running — close SSE stream and fast-poll
            this.closeSSEConnection(agentId);
            this.stopFastPoll(agentId);
            this.setFeedMode(existing, "poll", "agent stopped");
          }

          // Skip activity snapshot if SSE or fast-poll is handling updates
          if (this.hasActiveSSE(agentId) || this.fastPollTimers.has(agentId)) {
            // Real-time feed is handling updates — just emit status if it changed
            if (isRunning !== wasRunning) {
              this.onMessage({
                type: "agentStatus",
                agentId,
                status: isRunning ? "active" : "idle",
              });
            }
            continue;
          }

          // No active SSE or fast-poll — fall back to main poll-based activity snapshot
          if (isRunning || isRunning !== wasRunning) {
            const activity = await this.getActivitySnapshot(
              existing,
              isRunning,
              runName,
            );

            // Only emit if the display text actually changed
            if (activity.displayText !== existing.lastStatus) {
              existing.lastStatus = activity.displayText;
              this.onMessage({
                type: "agentStatus",
                agentId,
                status: isRunning ? "active" : "idle",
              });
              this.onMessage({
                type: "agentTool",
                agentId,
                toolName: "CopilotAgent",
                displayText: this.withTicketPrefix(
                  existing,
                  activity.displayText,
                ),
              });
              console.log(
                `[CopilotMonitor] PR #${pr.number}: ${activity.displayText}`,
              );
            }
          }
        }
      }

      // Remove sessions for PRs that are no longer open
      // and sync ADO ticket to "Done" if the PR was merged/closed
      for (const [agentId, session] of this.sessions) {
        if (!currentIds.has(agentId)) {
          // Sync linked ticket to "Done" before removing
          if (session.linkedTicketId && this.adoConfig) {
            console.log(
              `[CopilotMonitor] PR #${session.prNumber} closed/merged — syncing ADO #${session.linkedTicketId} to Done`,
            );
            void this.updateAdoWorkItemState(session.linkedTicketId, "Done");
          }
          this.closeSSEConnection(agentId);
          this.stopFastPoll(agentId);
          this.onMessage({ type: "agentRemoved", agentId });
          this.sessions.delete(agentId);
          console.log(`[CopilotMonitor] Agent removed: ${agentId}`);
        }
      }
    } catch (err) {
      console.warn("[CopilotMonitor] Poll failed:", (err as Error).message);
    }
  }

  /**
   * Build a detailed activity snapshot using the Copilot session logs API.
   *
   * When available, fetches live tool calls from the session SSE stream
   * to show exactly what the agent is doing: "Reading isoSpriteCache.ts",
   * "Running tests", "Searching for: sit|chair".
   *
   * Falls back to phase + PR title when the session API is unavailable.
   */
  private async getActivitySnapshot(
    session: CopilotAgentSession,
    isRunning: boolean,
    runName?: string,
    isInitialDiscovery?: boolean,
  ): Promise<ActivitySnapshot> {
    const topic = this.shortenTitle(session.title);

    // Try to get live/recent activity from Copilot session logs
    // Works for both running (shows current tool) and completed (shows last tool)
    const liveActivity = await this.fetchLiveActivity(session);

    if (!isRunning) {
      // Distinguish "hasn't started yet" from "already finished" on initial discovery
      if (isInitialDiscovery) {
        const commits = await this.fetchPRCommits(session.prNumber);
        if (commits.length > 0) {
          // Has commits — agent already ran and finished
          return { displayText: "Awaiting user feedback", phase: "waiting" };
        }
        // No commits yet — genuinely hasn't started
        return { displayText: `Starting: ${topic}`, phase: "waiting" };
      }
      // Agent finished — awaiting human review
      return { displayText: "Awaiting user feedback", phase: "waiting" };
    }

    // Running — use live activity if available
    if (liveActivity) {
      return liveActivity;
    }

    // Fallback: determine phase from run name
    const phase = this.detectPhase(runName);
    const commits = await this.fetchPRCommits(session.prNumber);
    const newCommits = commits.length - session.commitCount;
    session.commitCount = commits.length;
    if (newCommits > 0) {
      session.lastCommitSha = commits[commits.length - 1].sha;
    }

    switch (phase) {
      case "responding":
        return { displayText: `Reviewing feedback: ${topic}`, phase };
      case "planning":
        return { displayText: `Planning: ${topic}`, phase };
      case "testing":
        return { displayText: `Testing: ${topic}`, phase };
      case "coding":
      default:
        if (commits.length === 0) {
          return { displayText: `Analyzing: ${topic}`, phase: "planning" };
        }
        return { displayText: `Coding: ${topic}`, phase: "coding" };
    }
  }

  /**
   * Fetch the latest activity from the Copilot session logs API.
   *
   * Returns null if the API is unavailable or no session is found.
   */
  private async fetchLiveActivity(
    session: CopilotAgentSession,
  ): Promise<ActivitySnapshot | null> {
    if (!this.sessionApiAvailable) return null;

    try {
      // Resolve the Copilot session ID for this PR
      const sessionId = await this.resolveCopilotSessionId(session.prNumber);
      if (!sessionId) {
        console.log(
          `[CopilotMonitor] No session ID found for PR #${session.prNumber}`,
        );
        return null;
      }
      session.copilotSessionId = sessionId;

      // Fetch the session logs SSE stream
      const res = await fetch(
        `https://api.githubcopilot.com/agents/sessions/${sessionId}/logs`,
        {
          headers: {
            Authorization: `Bearer ${this.copilotToken}`,
            "Content-Type": "application/json",
            "Copilot-Integration-Id": "copilot-4-cli",
            "X-Github-Api-Version": "2026-01-09",
          },
        },
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.warn(
            "[CopilotMonitor] Session logs API not authorized, disabling",
          );
          this.sessionApiAvailable = false;
        }
        return null;
      }

      const body = await res.text();
      const toolCall = this.parseLastToolCall(body);
      if (!toolCall) return null;

      const displayText = this.formatCopilotToolCall(toolCall);
      const phase = this.detectPhaseFromTool(toolCall);
      return { displayText, phase };
    } catch (err) {
      console.warn(
        "[CopilotMonitor] Live activity fetch failed:",
        (err as Error).message,
      );
      return null;
    }
  }

  /**
   * Look up the Copilot session UUID for a PR via the sessions list API.
   */
  private async resolveCopilotSessionId(
    prNumber: number,
  ): Promise<string | null> {
    // Check cache first
    const cached = this.sessionIdCache.get(prNumber);
    if (cached) return cached;

    try {
      const res = await fetch(
        "https://api.githubcopilot.com/agents/sessions?page_number=1&page_size=50&sort=last_updated_at%2Cdesc",
        {
          headers: {
            Authorization: `Bearer ${this.copilotToken}`,
            "Content-Type": "application/json",
            "Copilot-Integration-Id": "copilot-4-cli",
            "X-Github-Api-Version": "2026-01-09",
          },
        },
      );

      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          // Token doesn't support sessions API — stop trying
          if (this.sessionApiAvailable) {
            console.warn(
              `[CopilotMonitor] Sessions API unavailable (HTTP ${res.status}) — live activity disabled`,
            );
          }
          this.sessionApiAvailable = false;
        } else {
          console.warn(
            `[CopilotMonitor] Sessions list API returned HTTP ${res.status}`,
          );
        }
        return null;
      }

      const wrapper = (await res.json()) as {
        sessions: Array<{
          id: string;
          resource_number: number;
          state: string;
          repo_id: number;
          head_ref: string;
        }>;
        has_next_page: boolean;
      };
      const sessions = wrapper.sessions || [];

      // Match by PR number and head_ref branch prefix
      for (const s of sessions) {
        if (
          s.resource_number === prNumber &&
          s.head_ref?.startsWith("copilot/")
        ) {
          this.sessionIdCache.set(prNumber, s.id);
          console.log(
            `[CopilotMonitor] Resolved session for PR #${prNumber}: ${s.id.slice(0, 8)}...`,
          );
          return s.id;
        }
      }

      // Log why we didn't find a match
      const prNumbers = sessions.map((s) => s.resource_number);
      const hasPrMatch = sessions.some((s) => s.resource_number === prNumber);
      if (hasPrMatch) {
        const matching = sessions.filter((s) => s.resource_number === prNumber);
        const branches = matching.map((s) => s.head_ref).join(", ");
        console.log(
          `[CopilotMonitor] PR #${prNumber} found in sessions but no copilot/ branch match (branches: ${branches})`,
        );
      } else {
        console.log(
          `[CopilotMonitor] PR #${prNumber} not in ${sessions.length} sessions (has_next_page: ${wrapper.has_next_page})`,
        );
      }
    } catch (err) {
      console.warn(
        `[CopilotMonitor] Sessions list API error: ${(err as Error).message}`,
      );
    }

    return null;
  }

  /** Delegates to the module-level parseLastToolCall function */
  private parseLastToolCall(sseBody: string): ParsedToolCall | null {
    return parseLastToolCall(sseBody);
  }

  /** Delegates to the module-level formatCopilotToolCall function */
  private formatCopilotToolCall(tool: ParsedToolCall): string {
    return formatCopilotToolCall(tool);
  }

  /**
   * Detect phase from the tool the agent is currently using.
   */
  private detectPhaseFromTool(tool: ParsedToolCall): ActivitySnapshot["phase"] {
    switch (tool.name) {
      case "bash": {
        const cmd = (tool.command || tool.description || "").toLowerCase();
        if (
          cmd.includes("test") ||
          cmd.includes("vitest") ||
          cmd.includes("jest")
        ) {
          return "testing";
        }
        return "coding";
      }
      case "view":
      case "glob":
      case "grep":
      case "_thinking":
        return "planning";
      case "edit":
      case "write":
      case "create":
        return "coding";
      default:
        return "coding";
    }
  }

  /**
   * Detect the agent's phase from the workflow run name.
   * GitHub uses specific names for different Copilot agent activities.
   */
  private detectPhase(runName?: string): ActivitySnapshot["phase"] {
    if (!runName) return "coding";
    const lower = runName.toLowerCase();
    if (
      lower.includes("addressing comment") ||
      lower.includes("addressing review")
    ) {
      return "responding";
    }
    if (lower.includes("running copilot")) {
      return "coding";
    }
    if (lower.includes("test")) {
      return "testing";
    }
    if (lower.includes("plan")) {
      return "planning";
    }
    return "coding";
  }

  /** Shorten a commit message for display in a speech bubble */
  private shortenCommitMessage(msg: string): string {
    const firstLine = msg.split("\n")[0];
    const stripped = firstLine.replace(
      /^(feat|fix|chore|refactor|test|docs|style|ci|perf)(\(.+?\))?:\s*/i,
      "",
    );
    if (stripped.length > 50) {
      return stripped.slice(0, 47) + "...";
    }
    return stripped;
  }

  /** Shorten a PR title for the speech bubble — strip ticket refs, prefixes, truncate */
  private shortenTitle(title: string): string {
    let t = title
      .replace(/\bAB#\d+\b/g, "")
      .replace(
        /^(feat|fix|chore|refactor|test|docs|style|ci|perf)(\(.+?\))?:\s*/i,
        "",
      )
      .replace(/\s+/g, " ")
      .trim();
    if (t.length > 40) {
      t = t.slice(0, 37) + "...";
    }
    return t;
  }

  /** Extract Azure DevOps ticket ID from branch name, PR title, or PR body */
  private extractTicketId(
    branch: string,
    title: string,
    body?: string,
  ): string | undefined {
    return extractTicketId(branch, title, body);
  }

  /** Convert branch name to a display-friendly name */
  getDisplayName(branch: string): string {
    return formatDisplayName(branch);
  }

  /** Prefix display text with the linked ADO ticket ID if present */
  private withTicketPrefix(session: CopilotAgentSession, text: string): string {
    if (session.linkedTicketId) {
      return `AB#${session.linkedTicketId} · ${text}`;
    }
    return text;
  }

  private async fetchPRCommits(prNumber: number): Promise<
    Array<{
      sha: string;
      message: string;
      date: string;
    }>
  > {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls/${prNumber}/commits?per_page=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      console.warn(
        `[CopilotMonitor] Commits fetch failed for PR #${prNumber}: ${res.status}`,
      );
      return [];
    }

    const commits = (await res.json()) as Array<{
      sha: string;
      commit: {
        message: string;
        author: { date: string };
      };
    }>;

    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author.date,
    }));
  }

  private async fetchCopilotPRs(): Promise<
    Array<{
      number: number;
      title: string;
      body: string;
      branch: string;
      state: string;
      draft: boolean;
      updatedAt: string;
    }>
  > {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls?state=open&per_page=30`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      console.warn(`[CopilotMonitor] PR fetch failed: ${res.status}`);
      return [];
    }

    const prs = (await res.json()) as Array<{
      number: number;
      title: string;
      body: string | null;
      head: { ref: string };
      state: string;
      draft: boolean;
      updated_at: string;
      user: { login: string };
    }>;

    return prs
      .filter(
        (pr) =>
          pr.user.login === "Copilot" || pr.head.ref.startsWith("copilot/"),
      )
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body || "",
        branch: pr.head.ref,
        state: pr.state,
        draft: pr.draft,
        updatedAt: pr.updated_at,
      }));
  }

  private async fetchCopilotRuns(): Promise<
    Array<{
      id: number;
      status: string;
      branch: string;
      name: string;
    }>
  > {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs?per_page=20`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      console.warn(`[CopilotMonitor] Runs fetch failed: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      workflow_runs: Array<{
        id: number;
        status: string;
        head_branch: string;
        name: string;
      }>;
    };

    return (data.workflow_runs || [])
      .filter((run) => run.head_branch.startsWith("copilot/"))
      .map((run) => ({
        id: run.id,
        status: run.status,
        branch: run.head_branch,
        name: run.name,
      }));
  }
}
