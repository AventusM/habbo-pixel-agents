# Phase 17.5: Auto-Despawn Agents on Task Completion - Research

**Researched:** 2026-03-09
**Domain:** Agent lifecycle detection / JSONL transcript analysis
**Confidence:** HIGH

## Summary

Sub-agents currently only despawn when their JSONL file is deleted from disk (via `fs.watch` deletion event or `checkIdleAgents()` fallback). When a sub-agent completes its task naturally, the JSONL file remains on disk indefinitely, so the avatar stays in the room forever. The fix requires detecting when an agent has **completed** its work and triggering the existing `removeAgent()` despawn flow.

Empirical analysis of real sub-agent JSONL files reveals a clear completion signal: the last JSONL line of a completed agent has `message.stop_reason === "end_turn"` with `type === "assistant"`. An agent still working will have `stop_reason === "tool_use"` (waiting for tool results) or have new lines still being appended. The detection strategy is: in the existing `checkIdleAgents()` 5-second polling loop, read the last line of each tracked JSONL file, parse it, and if `stop_reason === "end_turn"` AND the file hasn't been modified for a threshold period (e.g., 15-30 seconds), treat the agent as completed and call `removeAgent()`.

**Primary recommendation:** Extend `checkIdleAgents()` to detect completion by reading the last JSONL line for `stop_reason: "end_turn"` combined with a staleness check, then trigger the existing `removeAgent()` despawn flow.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| 17.5-01 | `isAgentCompleted()` returns true for end_turn last line | Empirically verified: all 4 completed subagent JSONL files end with `type: "assistant"` + `message.stop_reason: "end_turn"` |
| 17.5-02 | `isAgentCompleted()` returns false for tool_use last line | Empirically verified: active subagent has `stop_reason: "tool_use"` as last line |
| 17.5-03 | `checkIdleAgents()` calls removeAgent when completed + stale | Extends existing 5s polling loop with staleness check (15s threshold) before calling existing `removeAgent()` |
| 17.5-04 | `checkIdleAgents()` does NOT remove when end_turn but not stale | Staleness guard prevents premature despawn on mid-conversation end_turn responses |
| 17.5-05 | Graceful handling of partial/corrupt last line | try/catch around JSON.parse returns false on any error; next 5s poll retries |
</phase_requirements>

## Architecture Patterns

### Detection Strategy: Last-Line Parsing + Staleness Guard

**What:** Read the last line of each tracked agent's JSONL file during the `checkIdleAgents()` poll. If the last line is an `assistant` message with `stop_reason: "end_turn"` AND `mtime` is older than a completion threshold, the agent is done.

**Why the staleness guard:** An `end_turn` stop_reason could appear mid-conversation (e.g., the agent produces a text response, then continues with more tool use after the next user message). The staleness guard (file not modified for N seconds) ensures we only despawn agents that have truly stopped producing output.

**Recommended threshold:** 15 seconds after the last `end_turn`. This is longer than typical inter-message delays (~1-5s between Claude responses) but short enough that completed agents don't linger.

**Implementation location:** `src/agentManager.ts` in the `checkIdleAgents()` method.

```
checkIdleAgents() {
  for each tracked agent:
    1. If file doesn't exist -> removeAgent (existing)
    2. If file exists AND mtime > COMPLETION_THRESHOLD_MS:
       a. Read last line of file
       b. Parse as JSON
       c. If type === 'assistant' AND message.stop_reason === 'end_turn':
          -> removeAgent (NEW)
    3. Existing idle timeout logic (unchanged)
}
```

### Reading Last Line Efficiently

**What:** Use `fs.readSync` with a negative offset from the end of the file to read only the last ~8KB (JSONL lines for Claude transcripts are typically 1-4KB each). Split by newline and take the last non-empty line.

**Why not read the whole file:** Sub-agent JSONL files can be 100-300KB. Reading the entire file every 5 seconds for each agent is wasteful.

```typescript
function readLastLine(filePath: string): string | null {
  const stat = fs.statSync(filePath);
  const READ_SIZE = Math.min(stat.size, 8192);
  const buffer = Buffer.alloc(READ_SIZE);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, READ_SIZE, stat.size - READ_SIZE);
  fs.closeSync(fd);
  const text = buffer.toString('utf-8');
  const lines = text.split('\n').filter(l => l.trim());
  return lines.length > 0 ? lines[lines.length - 1] : null;
}
```

### Anti-Patterns to Avoid

- **Watching for process exit:** There is no PID or lock file in the Claude Code session structure. Process detection would require `ps` scanning which is fragile and platform-dependent.
- **Using `end_turn` without staleness guard:** An `end_turn` can appear mid-conversation. Without the staleness guard, the agent would be despawned prematurely while it's still thinking about its next step.
- **Re-reading the entire JSONL file:** Files can be 100KB+. Only the last few KB matter for completion detection.
- **Adding new message types:** The `agentRemoved` message already triggers the walk-to-booth + teleport flash despawn sequence. No new message types are needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Despawn animation | New despawn flow | Existing `removeAgent()` -> `agentRemoved` message | Walk-to-booth + teleport flash already fully working |
| Process detection | PID/process scanning | JSONL last-line parsing | No PID info available; JSONL is authoritative |
| File change detection | New watcher infrastructure | Existing `checkIdleAgents()` 5s poll + `fs.statSync().mtimeMs` | Already runs on schedule, already checks file existence |

## Common Pitfalls

### Pitfall 1: Premature Despawn on Mid-Conversation end_turn
**What goes wrong:** Agent sends a text-only response (`stop_reason: "end_turn"`), then the orchestrator sends another user message, and the agent continues. If we despawn on the first `end_turn`, the agent disappears while still working.
**Why it happens:** Claude's `end_turn` means "I'm done with this response" not "I'm done with the entire task."
**How to avoid:** Require BOTH `end_turn` in the last line AND file staleness (mtime > threshold). If new lines arrive, the mtime resets and the staleness check fails.
**Warning signs:** Agents disappearing and reappearing, or disappearing while the orchestrator is still talking to them.

### Pitfall 2: Reading Incomplete Last Line
**What goes wrong:** The JSONL file is being written to at the exact moment we read the last line, resulting in a partial JSON string that fails to parse.
**Why it happens:** No file locking between Claude Code writer and our reader.
**How to avoid:** Wrap the JSON parse in try/catch (already standard in the codebase). If parsing fails, skip this check cycle -- the next 5-second poll will catch it.

### Pitfall 3: Threshold Too Short
**What goes wrong:** Setting the staleness threshold too low (e.g., 5 seconds) causes false positives. Claude API calls can take 10+ seconds on complex prompts.
**How to avoid:** Use 15-30 seconds as the threshold. This is well above normal API latency but short enough that completed agents despawn promptly.

### Pitfall 4: Race with File Deletion
**What goes wrong:** The file is deleted between the `statSync` and `readSync` calls.
**How to avoid:** Wrap the entire read-last-line operation in a try/catch, returning null on any error. The existing file-deletion check in `checkIdleAgents()` handles the deletion case.

## Code Examples

### Completion Detection in checkIdleAgents()

```typescript
// Source: Empirical analysis of Claude Code sub-agent JSONL files
const COMPLETION_STALENESS_MS = 15_000; // 15 seconds after last write

private checkIdleAgents(): void {
  const now = Date.now();
  const toRemove: string[] = [];

  for (const [jsonlPath, agent] of this.agents) {
    // Existing: file deletion fallback
    if (!fs.existsSync(jsonlPath)) {
      toRemove.push(jsonlPath);
      continue;
    }

    // NEW: completion detection
    try {
      const stat = fs.statSync(jsonlPath);
      const staleness = now - stat.mtimeMs;
      if (staleness > COMPLETION_STALENESS_MS) {
        if (this.isAgentCompleted(jsonlPath)) {
          console.log(`[AgentManager] Agent completed (end_turn + ${Math.round(staleness/1000)}s stale): ${agent.agentId}`);
          toRemove.push(jsonlPath);
          continue;
        }
      }
    } catch {}

    // Existing: idle timeout
    if (agent.status === 'active' && now - agent.lastActivityMs > IDLE_TIMEOUT_MS) {
      agent.status = 'idle';
      this.onMessage({
        type: 'agentStatus',
        agentId: agent.agentId,
        status: 'idle',
      });
    }
  }

  for (const jsonlPath of toRemove) {
    this.removeAgent(jsonlPath);
  }
}
```

### Last-Line Reader

```typescript
// Source: Empirical analysis - JSONL lines are typically 1-4KB
private isAgentCompleted(jsonlPath: string): boolean {
  try {
    const stat = fs.statSync(jsonlPath);
    if (stat.size === 0) return false;

    const READ_SIZE = Math.min(stat.size, 8192);
    const buffer = Buffer.alloc(READ_SIZE);
    const fd = fs.openSync(jsonlPath, 'r');
    fs.readSync(fd, buffer, 0, READ_SIZE, stat.size - READ_SIZE);
    fs.closeSync(fd);

    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return false;

    const lastLine = lines[lines.length - 1];
    const entry = JSON.parse(lastLine);

    return (
      entry.type === 'assistant' &&
      entry.message?.stop_reason === 'end_turn'
    );
  } catch {
    return false; // Parse error or file access issue -- skip this cycle
  }
}
```

### JSONL Completion Signal (Empirical Evidence)

```json
// Last line of a COMPLETED sub-agent (stop_reason: "end_turn"):
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "stop_reason": "end_turn",
    "content": [{"type": "text", "text": "Summary of completed work..."}]
  },
  "agentId": "a8c3019e5f92cb47a",
  "timestamp": "2026-03-09T18:21:04.122Z"
}

// Last line of a STILL-RUNNING sub-agent (stop_reason: "tool_use"):
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "stop_reason": "tool_use",
    "content": [{"type": "tool_use", "name": "Read", "input": {...}}]
  }
}

// Other non-terminal line types: "user", "progress" -- never indicate completion
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSONL deletion triggers despawn | Manual JSONL deletion triggers despawn | Quick-4 (2026-03-09) | Works but requires manual cleanup |
| N/A | **Auto-detect completion via end_turn + staleness** | Phase 17.5 | Agents despawn automatically when task completes |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/agentManager.test.ts -x` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 17.5-01 | `isAgentCompleted()` returns true for end_turn last line | unit | `npx vitest run tests/agentManager.test.ts -x` | No - Wave 0 |
| 17.5-02 | `isAgentCompleted()` returns false for tool_use last line | unit | `npx vitest run tests/agentManager.test.ts -x` | No - Wave 0 |
| 17.5-03 | `checkIdleAgents()` calls removeAgent when completed + stale | unit | `npx vitest run tests/agentManager.test.ts -x` | No - Wave 0 |
| 17.5-04 | `checkIdleAgents()` does NOT remove when end_turn but not stale | unit | `npx vitest run tests/agentManager.test.ts -x` | No - Wave 0 |
| 17.5-05 | Graceful handling of partial/corrupt last line | unit | `npx vitest run tests/agentManager.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/agentManager.test.ts -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `tests/agentManager.test.ts` -- new file covering completion detection logic
- [ ] Mock fs operations for JSONL last-line reading tests

## Open Questions

1. **What if an agent errors out instead of completing normally?**
   - What we know: Error cases may produce `stop_reason: "end_turn"` with error text, or the process may crash leaving no final line
   - What's unclear: Whether crashed agents produce any distinguishing JSONL pattern
   - Recommendation: The staleness guard handles both cases -- crashed agents stop writing, so staleness triggers. Errored agents with `end_turn` are functionally "completed" from our perspective.

2. **Should we clean up the JSONL file after despawn?**
   - What we know: Currently JSONL files persist on disk after deletion-based despawn too
   - What's unclear: Whether Claude Code expects these files to remain
   - Recommendation: Do NOT delete JSONL files -- only trigger the despawn animation. File cleanup is out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- Empirical analysis of real sub-agent JSONL files at `~/.claude/projects/*/subagents/*.jsonl` -- verified 2026-03-09 with 5 real files (4 completed with end_turn, 1 active with tool_use)
- Source code: `src/agentManager.ts`, `src/fileWatcher.ts`, `src/transcriptParser.ts`
- `meta.json` files contain only `agentType` -- no process or completion info

### Secondary (MEDIUM confidence)
- Claude Code JSONL format inferred from real files -- `stop_reason: "end_turn"` is consistent with Anthropic API conventions

## Metadata

**Confidence breakdown:**
- Detection strategy: HIGH - empirically verified with real sub-agent JSONL files
- Implementation approach: HIGH - extends existing, well-understood `checkIdleAgents()` mechanism
- Threshold tuning: MEDIUM - 15s is a reasonable default but may need adjustment based on real-world usage
- Pitfalls: HIGH - based on direct analysis of the codebase and JSONL format

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- Claude Code JSONL format unlikely to change rapidly)