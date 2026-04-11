---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Add configure script to package.json and verify end-to-end

Add `"configure": "node scripts/configure.mjs"` to package.json scripts. Run `node scripts/configure.mjs --dry-run --yes` and verify it outputs a valid diff. Run `node scripts/configure.mjs --yes` against a temp env and verify .env is written correctly.

## Inputs

- `scripts/configure.mjs`

## Expected Output

- `package.json (configure script added)`

## Verification

npm run configure -- --dry-run --yes 2>&1 | head -20
