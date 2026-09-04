# Phase 18: Architecture Documentation Lite - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a top-level ARCHITECTURE.md with Mermaid diagrams documenting the current codebase state (system overview, module dependencies, render pipeline, agent data flow, asset pipeline, module index) for human review — accurate as-is documentation, not aspirational.

</domain>

<decisions>
## Implementation Decisions

### Document structure & depth
- Concise (~200-400 lines) — diagrams do the heavy lifting, minimal prose
- Format: Mermaid diagram first, then key points as bullet list per section
- Every mentioned module/file gets a relative path link (e.g., `src/agentManager.ts`)
- Table of contents at the top with anchor links
- No rationale/why context — pure factual "what exists, how it connects"

### Diagram style & coverage
- All 6 diagrams: system overview, module dependencies, render pipeline, agent data flow, asset pipeline, module index
- Flowcharts and block diagrams only (no class diagrams, no sequence diagrams)
- High-level granularity — modules/subsystems as single boxes, not individual functions
- Color coded by subsystem (rendering = blue, agents = green, assets = orange, etc.) via Mermaid styles

### Audience & tone
- Primary reader: personal reference (re-orientation after a break)
- Dry technical tone — straight facts, no personality, like a man page
- Assumes domain knowledge but includes a brief glossary for key terms (Nitro, cortex-assets, JSONL watching)

### Module boundaries
- Slice by subsystem/feature: Rendering, Agents, Assets, UI Overlays, Audio, Layout Editor, etc.
- Key files only in module index — entry points, renderers, managers; skip test files, configs, trivial helpers
- Clear separation between extension host (Node.js) and webview (browser) code — explicitly labeled
- Scripts and test infrastructure get their own subsystem section

### Claude's Discretion
- Exact subsystem groupings and naming
- Which files qualify as "key" vs trivial
- Glossary term selection
- Diagram layout and edge labeling

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-architecture-documentation-lite-code-linked-diagrams-of-current-codebase-state-for-human-review*
*Context gathered: 2026-03-09*
