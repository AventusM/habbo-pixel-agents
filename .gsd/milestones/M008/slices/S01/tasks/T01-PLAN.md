---
estimated_steps: 11
estimated_files: 1
skills_used: []
---

# T01: Write configure.mjs CLI wizard

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

## Inputs

- `.env.example`
- `src/extension.ts`

## Expected Output

- `scripts/configure.mjs`

## Verification

node scripts/configure.mjs --dry-run --yes 2>&1 | head -30
