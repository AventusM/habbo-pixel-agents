# M008: Env Var Configuration Wizard

## Vision
Replace manual .env editing with a guided wizard on two surfaces — a CLI script and a VS Code command — so any contributor can reconfigure GitHub Projects / Azure DevOps kanban sources and related settings in under two minutes without touching a text file.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | S01 | low | — | ✅ | `node scripts/configure.mjs` guides through KANBAN_SOURCE → GitHub or AzDO vars → writes .env. `node scripts/configure.mjs --dry-run` shows diff only. |
| S02 | S02 | medium | — | ✅ | Open Command Palette → `Habbo: Configure Integration` → step through kanban source + credentials → notification `✅ .env updated` with Reload button. |
