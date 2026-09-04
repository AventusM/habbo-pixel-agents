# S01: CLI configuration wizard — UAT

**Milestone:** M008
**Written:** 2026-04-11T13:28:44.610Z

# S01 UAT — CLI Configuration Wizard

## Test: dry-run with defaults
```
npm run configure -- --dry-run --yes
```
Expected: wizard runs through all steps using existing .env values, prints "No changes" or a diff, exits 0. No file written.

## Test: empty .env produces adds
```
echo "" > .env && node scripts/configure.mjs --dry-run --yes
```
Expected: diff shows `+ KANBAN_SOURCE=github` (and any other defaulted values). No file written.

## Test: interactive (manual)
```
node scripts/configure.mjs
```
Expected: prompts appear with ANSI colour, existing values shown as defaults, accepts free-text input, writes .env on confirmation.

## Test: AzDO source path
```
# Answer 'azuredevops' at first prompt
node scripts/configure.mjs --yes  # after patching .env KANBAN_SOURCE=github
```
Expected: AzDO section shown, GitHub Projects section skipped.

