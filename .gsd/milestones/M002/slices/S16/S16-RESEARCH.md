# Phase 17.6: Azure DevOps Boards Integration - Research

**Researched:** 2026-03-10
**Domain:** Azure DevOps REST API, VS Code extension host, kanban board data fetching
**Confidence:** HIGH

## Summary

Phase 17.6 adds Azure DevOps Boards as a second kanban source alongside the existing GitHub Projects integration. The existing `src/githubProjects.ts` module + `src/isoKanbanRenderer.ts` already handle the full pipeline from data fetch to wall-mounted sticky notes. This phase needs to replicate that pattern for Azure DevOps, where the data source is the Azure DevOps REST API (not the `gh` CLI) and authentication is via a Personal Access Token (PAT) stored in VS Code settings.

The Azure DevOps REST API uses a two-step fetch: (1) POST a WIQL query to get work item IDs, then (2) POST to the workitemsbatch endpoint to get `System.Title` and `System.State` fields for those IDs. This is structurally similar to the GitHub Projects two-query pattern already in use. The API uses HTTP Basic auth with a Base64-encoded PAT (`:<PAT>`) — no CLI dependency required, making the implementation a pure Node.js `https` or native `fetch` call.

The `KanbanCard` type (`{ id: string; title: string; status: string }`) is already generic enough to represent Azure DevOps work items — the `status` field maps to `System.State`. The existing `isoKanbanRenderer.ts` consumes `KanbanCard[]` with no awareness of the source, so no renderer changes are needed. The only new code required is: `src/azureDevOpsBoards.ts` (data fetch), updates to `src/extension.ts` (config read + polling), and `package.json` settings contributions.

**Primary recommendation:** Use Node.js built-in `https` module (same process-level constraint as `execFileSync` in githubProjects.ts) with Base64 PAT auth. Follow the silent-fallback pattern exactly — catch all errors, return `[]`. Wire into the same `kanbanCards` message path already consumed by the webview.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `https` (built-in) | Node >=22 | HTTP requests to Azure DevOps REST API | Already in extension host environment; no new dependency; matches project constraint of zero new npm deps for integration plumbing |
| Azure DevOps REST API | v7.1 | Work item tracking endpoints (WIQL + workitemsbatch) | Official Microsoft API; stable; v7.1 is current LTS version |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Buffer` (Node built-in) | Node >=22 | Base64-encode PAT for HTTP Basic auth header | Required for PAT → Authorization header conversion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `https` built-in | `azure-devops-node-api` npm package | Package adds 5MB+ of transitive deps; built-in `https` is sufficient for 2 REST calls and keeps the extension lean |
| `https` built-in | `node-fetch` or `axios` | Not already in the project; no reason to add for 2 API calls |
| PAT in VS Code settings | OAuth device flow | OAuth is massively more complex to implement in a VS Code extension; PAT is the standard developer tool auth pattern for Azure DevOps |

**Installation:** No new npm packages needed.

## Architecture Patterns

### Recommended Project Structure

New file:
```
src/
└── azureDevOpsBoards.ts   # Azure DevOps data fetch (mirrors githubProjects.ts)
```

Modified files:
```
src/extension.ts           # Add azureDevOps config read + polling
package.json               # Add habboPixelAgents.azureDevOps.* settings
```

### Pattern 1: Two-Step Fetch (WIQL → Batch)

**What:** WIQL returns only IDs. A second call to workitemsbatch retrieves title + state.

**When to use:** Always — this is the only supported approach for getting fields from a WIQL query in the Azure DevOps REST API.

**Endpoint 1 — WIQL Query:**
```
POST https://dev.azure.com/{organization}/{project}/_apis/wit/wiql?api-version=7.1

Authorization: Basic <base64(':' + PAT)>
Content-Type: application/json

Body: { "query": "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '{project}' ORDER BY [System.ChangedDate] DESC" }
```

Response shape:
```json
{
  "workItems": [
    { "id": 42, "url": "https://..." },
    { "id": 17, "url": "https://..." }
  ]
}
```

**Endpoint 2 — Get Work Items Batch:**
```
POST https://dev.azure.com/{organization}/_apis/wit/workitemsbatch?api-version=7.1

Authorization: Basic <base64(':' + PAT)>
Content-Type: application/json

Body: {
  "ids": [42, 17],
  "fields": ["System.Id", "System.Title", "System.State"]
}
```

Response shape:
```json
{
  "count": 2,
  "value": [
    { "id": 42, "fields": { "System.Title": "Fix login bug", "System.State": "Active" } },
    { "id": 17, "fields": { "System.Title": "Add dark mode", "System.State": "New" } }
  ]
}
```

**Source:** [Wiql - Query By Wiql](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1), [Work Items - Get Work Items Batch](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1)

### Pattern 2: Silent Fallback (Mirror of githubProjects.ts)

**What:** All errors caught at top level, returning `[]` instead of throwing.

**When to use:** Always — matches the established project convention from Phase 8 audio and Phase 12 GitHub Projects.

```typescript
// Source: mirrors src/githubProjects.ts pattern
export function fetchAzureDevOpsCards(
  organization: string,
  project: string,
  pat: string,
): KanbanCard[] {
  try {
    // ... two-step fetch ...
    return cards;
  } catch (err) {
    console.error('[azureDevOpsBoards] fetchAzureDevOpsCards failed:', err);
    return [];
  }
}
```

### Pattern 3: PAT Authentication Header

```typescript
// Source: https://learn.microsoft.com/en-us/azure/devops/integrate/quickstarts/work-item-quickstart
const token = Buffer.from(':' + pat).toString('base64');
const headers = {
  'Authorization': `Basic ${token}`,
  'Content-Type': 'application/json',
};
```

Note: The colon prefix (`:` + PAT) is required. The username portion is intentionally empty for PAT auth.

### Pattern 4: Synchronous HTTPS helper

The existing extension.ts kanban code calls `fetchKanbanCards` synchronously (blocking the extension host thread briefly). The Azure DevOps fetch should follow the same synchronous pattern using Node.js `https` with a synchronous wrapper (using `Atomics.wait` + `SharedArrayBuffer` or simply using a synchronous HTTPS approach via `child_process.execFileSync` with `curl` / `node -e`).

**Simpler alternative that matches the existing pattern exactly:** Use `execFileSync` to call `curl` or `node` inline — but this creates a shell dependency.

**Better approach:** Use native `https` with a synchronous-style callback by running the fetch in the same blocking pattern. Since Node.js `https` is async, the cleanest approach for the extension host (which already calls `execFileSync` synchronously) is to use `spawnSync` with a small inline Node script:

```typescript
// Option A: spawnSync with inline node script (no shell, avoids curl dependency)
const result = spawnSync('node', ['-e', `
  const https = require('https');
  // ... fetch logic ...
`], { encoding: 'utf8' });
```

**Actually simpler:** Since Node 22 supports the `fetch` global and this runs in the extension host (Node process), the fetch can be made `async` and the kanban polling loop can be changed to `async`. The extension.ts already uses `async` in the `onDidReceiveMessage` handler. The polling `setInterval` can call an async function without issues.

**Recommended pattern:** Make `fetchAzureDevOpsCards` `async` and update the polling site to `await` it. This is cleaner than synchronous hacks and `fetch` is available in Node >=22 (pinned in package.json).

### Pattern 5: State → KanbanCard Status Mapping

Azure DevOps work item states vary by process template:
- **Agile process:** New, Active, Resolved, Closed
- **Scrum process:** New, Approved, Committed, Done, Removed
- **CMMI process:** Proposed, Active, Resolved, Closed

The existing `isoKanbanRenderer.ts` already handles unknown statuses gracefully (falls back to pink `#fda4af`). The phase should map common Azure DevOps states to the four existing kanban columns:

| Azure DevOps State | Maps To (KanbanCard.status) |
|-------------------|-----------------------------|
| New, Proposed, Approved | `Todo` |
| Active, Committed, In Progress | `In Progress` |
| Resolved, Done, Closed | `Done` |
| Removed | (skip — filter out) |
| Anything else | `No Status` |

This mapping can be configurable or hard-coded initially. The renderer already handles unrecognized statuses gracefully, so even if the mapping is wrong the notes still render.

### Anti-Patterns to Avoid

- **Throwing on error:** The GitHub Projects integration took significant effort to establish the silent-fallback pattern. Azure DevOps must follow the same convention — any error returns `[]`.
- **Adding azure-devops-node-api package:** Unnecessary 5MB+ dependency for 2 REST calls.
- **Requiring az CLI:** The existing pattern uses `gh` CLI but Azure DevOps should NOT require `az` CLI — PAT-based HTTP is simpler and more portable.
- **Storing PAT in plaintext settings.json committed to git:** The VS Code settings system stores PAT in user settings (not workspace settings), so it should not end up in committed files. Document this in the setting description.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request | Custom socket code | Node.js built-in `https` or global `fetch` (Node 22) | Handles TLS, redirects, chunked encoding |
| Base64 encoding | Manual char table | `Buffer.from(':' + pat).toString('base64')` | Node built-in, one line |
| WIQL query building | Custom query DSL | String template with the minimal `SELECT [System.Id] FROM WorkItems` | The query is trivial and static for this use case |
| State normalization | Complex regex | Simple lookup table with a default fallback | Azure DevOps states are well-known per process template |

**Key insight:** This is a thin data-fetching adapter. The hard work (rendering, kanban layout, sticky notes) is already done. The entire new module should be under 80 lines.

## Common Pitfalls

### Pitfall 1: WIQL Returns IDs Only
**What goes wrong:** Developer assumes the WIQL SELECT fields are returned in the response. They are not — only `workItems: [{id, url}]` is returned.
**Why it happens:** SQL-like WIQL syntax implies field selection works like SQL.
**How to avoid:** Always do step 2 (workitemsbatch call) to get actual field values.
**Warning signs:** Response has `workItems` array with only `id` and `url` fields, no titles.

### Pitfall 2: PAT Encoding
**What goes wrong:** Sending PAT directly in Authorization header without Base64 encoding and without the leading colon.
**Why it happens:** Developers familiar with Bearer tokens use the same pattern.
**How to avoid:** `Buffer.from(':' + pat).toString('base64')` — note the colon prefix.
**Warning signs:** 401 Unauthorized responses even with a valid PAT.

### Pitfall 3: Batch Size Limit
**What goes wrong:** Sending more than 200 IDs to workitemsbatch in a single call returns an error.
**Why it happens:** The WIQL query might return hundreds of work items.
**How to avoid:** Slice the IDs array to first 100 (sufficient for a kanban board view) or implement chunking.
**Warning signs:** 400 Bad Request from the batch endpoint.

### Pitfall 4: Project Name vs Project ID
**What goes wrong:** Using a team name where a project name is required (or vice versa).
**Why it happens:** Azure DevOps has both organizations, projects, and teams — they are distinct.
**How to avoid:** The VS Code setting should be labeled "project name" not "team name". The WIQL URL uses `{organization}/{project}`.
**Warning signs:** 404 Not Found from the WIQL endpoint.

### Pitfall 5: Async in setInterval
**What goes wrong:** `setInterval` calls an async function but doesn't await it, causing unhandled promise rejections if the fetch throws despite the try/catch wrapper.
**Why it happens:** `setInterval` callback return value is ignored.
**How to avoid:** Wrap the async call: `setInterval(() => { void fetchAndPost(); }, interval)` where `fetchAndPost` handles its own errors internally.

### Pitfall 6: Both Integrations Active Simultaneously
**What goes wrong:** GitHub Projects and Azure DevOps both configured — two `kanbanCards` messages overwrite each other in the webview.
**Why it happens:** The webview just replaces `kanbanCards` state on each message.
**How to avoid:** Decide on priority: if both configured, use Azure DevOps; or merge cards from both; or provide a `habboPixelAgents.kanbanSource` setting with values `github` | `azuredevops` | `both`. Simplest approach: last-write-wins is acceptable for v1 since users will typically use one or the other.

## Code Examples

Verified patterns from official sources:

### PAT Authorization Header
```typescript
// Source: https://learn.microsoft.com/en-us/azure/devops/integrate/quickstarts/work-item-quickstart
const token = Buffer.from(':' + pat).toString('base64');
const authHeader = `Basic ${token}`;
```

### WIQL Endpoint
```typescript
// Source: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1
const wiqlUrl = `https://dev.azure.com/${organization}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`;
const wiqlBody = JSON.stringify({
  query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' ORDER BY [System.ChangedDate] DESC`,
});
```

### Batch Endpoint
```typescript
// Source: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1
const batchUrl = `https://dev.azure.com/${organization}/_apis/wit/workitemsbatch?api-version=7.1`;
const batchBody = JSON.stringify({
  ids: workItemIds.slice(0, 100), // max 200 per call; 100 is safe for display
  fields: ['System.Id', 'System.Title', 'System.State'],
});
```

### Using native `fetch` (Node 22)
```typescript
// fetch is globally available in Node >=22 (confirmed in package.json engines)
const response = await fetch(wiqlUrl, {
  method: 'POST',
  headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
  body: wiqlBody,
});
if (!response.ok) throw new Error(`WIQL failed: ${response.status}`);
const data = await response.json() as { workItems: Array<{ id: number }> };
```

### VS Code Settings Block (package.json contributes.configuration.properties)
```json
"habboPixelAgents.azureDevOps.organization": {
  "type": "string",
  "default": "",
  "description": "Azure DevOps organization name (e.g. 'mycompany' from https://dev.azure.com/mycompany)"
},
"habboPixelAgents.azureDevOps.project": {
  "type": "string",
  "default": "",
  "description": "Azure DevOps project name to fetch work items from"
},
"habboPixelAgents.azureDevOps.pat": {
  "type": "string",
  "default": "",
  "description": "Azure DevOps Personal Access Token (read:work items scope). Store in user settings only — do not commit to workspace settings."
},
"habboPixelAgents.azureDevOps.pollIntervalSeconds": {
  "type": "number",
  "default": 60,
  "description": "How often (in seconds) to refresh Azure DevOps work items. Set to 0 to disable polling."
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| azure-devops-node-api package | Native `fetch` / `https` | Node 18+ (fetch), Node 22 in this project | No package dependency needed |
| OAuth device flow | PAT in settings | Established VS Code extension pattern | Much simpler; no redirect URI needed |
| VSTS API | dev.azure.com (Azure DevOps Services) | Rebranded 2018 | `dev.azure.com/{org}` is the current URL format |

**Deprecated/outdated:**
- `visualstudio.com` URL pattern: Old VSTS hostname; current is `dev.azure.com/{organization}`.
- API versions below 6.0: Not recommended; 7.1 is current stable.

## Open Questions

1. **Kanban source priority when both GitHub Projects and Azure DevOps are configured**
   - What we know: The webview replaces `kanbanCards` on each message; last write wins.
   - What's unclear: Whether users want both sources merged or a single active source.
   - Recommendation: Add a `habboPixelAgents.kanbanSource: 'github' | 'azuredevops'` setting defaulting to `'github'` to preserve backward compatibility. Only one source is polled at a time.

2. **WIQL query scope — all work items vs specific iteration/sprint**
   - What we know: The basic WIQL fetches all work items in the project.
   - What's unclear: Whether users want to filter by current sprint/iteration or get all open items.
   - Recommendation: Start with all non-closed items: `WHERE [System.State] <> 'Closed' AND [System.State] <> 'Removed'`. Iteration filtering can be a follow-up.

3. **Maximum work item count for display**
   - What we know: Batch endpoint supports up to 200 IDs; WIQL may return thousands for large projects.
   - What's unclear: What a reasonable cap is for the sticky note renderer.
   - Recommendation: Cap at 50 items (WIQL `$top=50` parameter or slice first 50 IDs). The sticky note renderer already handles overflow with `+N more` indicators.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest.config.ts`) |
| Config file | `vitest.config.ts` — `tests/**/*.test.ts`, `setup: ./tests/setup.ts` |
| Quick run command | `npm test -- --testPathPattern azureDevOps` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Requirements are TBD (phase has no formal requirement IDs yet). Based on the integration pattern, expected behaviors to test:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Returns `[]` on network error (fetch throws) | unit | `npm test` | ❌ Wave 0 |
| Returns `[]` on 401 Unauthorized | unit | `npm test` | ❌ Wave 0 |
| Returns `[]` on empty config (no org/project/PAT) | unit | `npm test` | ❌ Wave 0 |
| Correctly maps Azure DevOps states to KanbanCard.status | unit | `npm test` | ❌ Wave 0 |
| Handles WIQL response with 0 work items | unit | `npm test` | ❌ Wave 0 |
| Parses batch response into KanbanCard[] with correct title/status | unit | `npm test` | ❌ Wave 0 |
| Slices IDs to max 100 before batch call | unit | `npm test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/azureDevOpsBoards.test.ts` — covers all behaviors above. Follows `tests/githubProjects.test.ts` as model: mock `fetch` global with `vi.stubGlobal`, test happy path + all error branches.

## Sources

### Primary (HIGH confidence)
- [Wiql - Query By Wiql (REST API 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1) — WIQL POST endpoint, request/response shapes
- [Work Items - Get Work Items Batch (REST API 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1) — batch fetch endpoint, field selection
- [Get work items programmatically (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/devops/integrate/quickstarts/work-item-quickstart?view=azure-devops) — PAT auth pattern, Base64 encoding
- Project codebase: `src/githubProjects.ts`, `src/agentTypes.ts`, `src/isoKanbanRenderer.ts`, `src/extension.ts` — established patterns to mirror

### Secondary (MEDIUM confidence)
- [Work Items - List (REST API 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/list?view=azure-devops-rest-7.1) — alternative GET endpoint (not chosen, batch POST preferred)
- [Azure DevOps REST API Overview](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2) — URL format and versioning conventions

### Tertiary (LOW confidence)
- None — all major claims verified with official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Azure DevOps REST API is official Microsoft docs; Node 22 native fetch is confirmed by package.json engines field
- Architecture: HIGH — pattern is a direct mirror of the existing, working githubProjects.ts; no novel structure required
- Pitfalls: HIGH for PAT encoding and WIQL IDs-only behavior (documented in official quickstart); MEDIUM for batch size limit (official docs state 200 max, verified)

**Research date:** 2026-03-10
**Valid until:** 2026-09-10 (Azure DevOps REST API is stable; api-version 7.1 is LTS)