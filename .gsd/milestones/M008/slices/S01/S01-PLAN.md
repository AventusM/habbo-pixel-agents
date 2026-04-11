# S01: CLI configuration wizard

**Goal:** Ship `scripts/configure.mjs` — an interactive CLI wizard that walks through KANBAN_SOURCE → source-specific credentials → writes (or dry-runs) the .env file
**Demo:** `node scripts/configure.mjs` guides through KANBAN_SOURCE → GitHub or AzDO vars → writes .env. `node scripts/configure.mjs --dry-run` shows diff only.

## Must-Haves

- `node scripts/configure.mjs` runs without error, reads existing .env for defaults, steps through all questions, and writes a valid .env. `--dry-run` flag prints the diff without writing. Non-interactive `--yes` flag accepts all defaults for CI use.

## Proof Level

- This slice proves: integration

## Integration Closure

Script is runnable from repo root; existing .env is updated in-place; existing vars not touched by the wizard are preserved.

## Verification

- Shows coloured prompts with current values as defaults; confirms written/skipped file at the end.

## Tasks

- [x] **T01: Write configure.mjs CLI wizard** `est:40m`
  Create `scripts/configure.mjs` using Node.js built-in `readline/promises` (no new deps). Flow:
1. Parse CLI flags: --dry-run, --yes (accept defaults)
2. Load existing .env into a Map (preserve unknown vars)
3. Ask: Kanban source? (github / azuredevops) — default from existing KANBAN_SOURCE or 'github'
4. Required fields always asked: GITHUB_REPO, GITHUB_TOKEN
5. If github: ask GITHUB_PROJECT_OWNER, GITHUB_PROJECT_OWNER_TYPE (org|user), GITHUB_PROJECT_NUMBER (optional — skip if blank)
6. If azuredevops: ask AZDO_ORG, AZDO_PROJECT, AZDO_PAT; offer to also set GitHub vars for Copilot monitoring
7. Optional: PORT (default 3000)
8. Compute diff between existing .env and new values
9. --dry-run: print diff and exit 0; normal: write .env, print '✅ .env updated'
10. Use ANSI colour codes for prompts (cyan key, grey default, green confirmation)
  - Files: `scripts/configure.mjs`
  - Verify: node scripts/configure.mjs --dry-run --yes 2>&1 | head -30

- [x] **T02: Add configure script to package.json and verify end-to-end** `est:15m`
  Add `"configure": "node scripts/configure.mjs"` to package.json scripts. Run `node scripts/configure.mjs --dry-run --yes` and verify it outputs a valid diff. Run `node scripts/configure.mjs --yes` against a temp env and verify .env is written correctly.
  - Files: `package.json`
  - Verify: npm run configure -- --dry-run --yes 2>&1 | head -20

## Files Likely Touched

- scripts/configure.mjs
- package.json
