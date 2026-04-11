# S02: VS Code command wizard — UAT

**Milestone:** M008
**Written:** 2026-04-11T13:31:05.140Z

# S02 UAT — VS Code Configure Integration Command

## Test: command appears in Command Palette
Open Command Palette (Cmd+Shift+P) → type "Habbo Configure" → "Habbo: Configure Integration" appears.

## Test: happy path — GitHub source
1. Run command
2. Select 'github' in QuickPick
3. Enter repo (owner/repo), token, GitHub Project owner/type/number
4. Expected: ✅ notification: '✅ .env updated (N vars changed)' with Reload Window button

## Test: happy path — AzDO source
1. Run command
2. Select 'azuredevops'
3. Enter GITHUB_REPO, GITHUB_TOKEN, then AZDO_ORG, AZDO_PROJECT, AZDO_PAT
4. Expected: ✅ notification

## Test: cancellation
1. Run command
2. Press Escape at any step
3. Expected: wizard closes silently, no notification, .env unchanged

## Test: Reload Window button
1. Complete wizard → notification shown
2. Click 'Reload Window'
3. Expected: VS Code reloads

## Test: no workspace folder
- Expected: error message 'Habbo: No workspace folder open — cannot write .env'

