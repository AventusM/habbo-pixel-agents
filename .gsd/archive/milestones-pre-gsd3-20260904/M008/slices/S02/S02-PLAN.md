# S02: VS Code command wizard

**Goal:** Add VS Code command `habbo-pixel-agents.configure` ("Habbo: Configure Integration") that steps through kanban source + credentials via QuickPick/InputBox and writes .env in the workspace root
**Demo:** Open Command Palette → `Habbo: Configure Integration` → step through kanban source + credentials → notification `✅ .env updated` with Reload button.

## Must-Haves

- Command appears in Command Palette as "Habbo: Configure Integration"; steps through kanban source + credentials; writes .env in workspace root; shows ✅ notification with Reload Window button.

## Proof Level

- This slice proves: contract

## Integration Closure

Command registered in extension.ts; declared in package.json contributes.commands; .env written to workspace root; notification includes Reload Window button.

## Verification

- Success notification: '✅ .env updated'. Cancelled steps abort gracefully with no notification. Errors show vscode.window.showErrorMessage.

## Tasks

- [x] **T01: Implement VS Code configure command** `est:35m`
  1. Extract .env read/write logic into `src/envConfig.ts`:
   - `readEnvFile(wsRoot): Map<string, string>` — parse .env, return key→value map
   - `writeEnvFile(wsRoot, updates: Map<string, string>): void` — merge updates into existing .env
   These are the same pure functions from configure.mjs but in TypeScript for reuse by extension.ts.
2. In `extension.ts`, register `habbo-pixel-agents.configure`:
   - Step 1: vscode.window.showQuickPick(['github', 'azuredevops'], {placeHolder: 'Kanban source'})
   - Step 2 (always): showInputBox for GITHUB_REPO, GITHUB_TOKEN with default from existing .env; password=true for token
   - Step 3a (github): showInputBox for GITHUB_PROJECT_OWNER, GITHUB_PROJECT_OWNER_TYPE (QuickPick), GITHUB_PROJECT_NUMBER
   - Step 3b (azuredevops): showInputBox for AZDO_ORG, AZDO_PROJECT, AZDO_PAT
   - Each step: if user cancels (undefined returned), abort entire flow silently
   - Collect all non-empty answers into a Map, call writeEnvFile
   - Show success notification: '\u2705 .env updated' with 'Reload Window' button → on click: vscode.commands.executeCommand('workbench.action.reloadWindow')
3. Add command to package.json contributes.commands and context.subscriptions
  - Files: `src/envConfig.ts`, `src/extension.ts`, `package.json`
  - Verify: npx tsc --noEmit 2>&1 | head -20

## Files Likely Touched

- src/envConfig.ts
- src/extension.ts
- package.json
