# T01: 18-architecture-documentation-lite-code-linked-diagrams-of-current-codebase-state-for-human-review 01

**Slice:** S19 — **Milestone:** M002

## Description

Create a top-level ARCHITECTURE.md with Mermaid diagrams documenting the current codebase state for human review. This is the "lite" documentation phase — enough for a developer to understand the system in 10 minutes.

Purpose: Phase 19 (Architecture Refactor) depends on this for planning. Accurate documentation of the as-is state is critical.
Output: Single ARCHITECTURE.md at repository root with 5-6 focused Mermaid diagrams and annotated prose.

## Must-Haves

- [ ] "A human can orient themselves in the codebase within 10 minutes by reading ARCHITECTURE.md"
- [ ] "Every diagram node references the actual source file path"
- [ ] "The extension host / webview boundary and postMessage bridge are explicitly documented"
- [ ] "The render pipeline draw order is documented with diagram"
- [ ] "The agent event data flow from JSONL to canvas is documented with diagram"
- [ ] "The asset pipeline from cortex-assets to canvas draw calls is documented with diagram"

## Files

- `ARCHITECTURE.md`
