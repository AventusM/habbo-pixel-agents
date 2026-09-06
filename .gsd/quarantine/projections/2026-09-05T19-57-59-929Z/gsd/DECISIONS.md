# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? |
|---|------|-------|----------|--------|-----------|------------|
| D001 | M005 | architecture | Where the extracted agent-dashboard package lives | Monorepo — packages/agent-dashboard/ inside this repo with npm workspaces | Simplest development workflow: one checkout, one PR, workspace link means the Habbo repo consumes it directly. No cross-repo coordination. Private package published from the same CI. | Yes |
| D002 | M005 | architecture | Default frontend shipped with agent-dashboard package | Lightweight React app as the default dashboard frontend | User preference. React is already a dependency of this repo. Provides richer UI out of the box (component composition, state management) compared to vanilla DOM. | Yes |
