# S07: Interactive CLI Prompt

## Objective

When `node bin/habbo-dashboard.mjs` is run with no arguments, interactively prompt for the GitHub repo and optional ADO board details instead of erroring out.

## Tasks

- [ ] **T01: Interactive prompts when no args given** `est:20m`
  Use Node readline to ask for: repo (required), ADO org (optional), ADO project (optional). Skip ADO PAT prompt if org/project not given. Pre-fill defaults from .env if available. Auto-build web client if needed, then start server.

- [ ] **T02: Verify all modes** `est:10m`
  - No args → interactive prompt
  - Positional arg → skip prompts, start directly
  - --help → show help, no prompts
  - .env defaults shown as placeholders in prompts

## Definition of Done

- Running `node bin/habbo-dashboard.mjs` with no args prompts for repo + board
- Entering values starts the dashboard with those values
- Pressing enter on optional fields skips them
- All existing arg/flag modes still work
- 442 tests pass
