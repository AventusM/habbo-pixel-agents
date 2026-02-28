---
phase: 03-asset-pipeline
plan: 02
status: complete
completed_at: "2026-02-28T23:21:00Z"
---

# 03-02 SUMMARY: Build System Configuration

## Overview

Configured dual esbuild bundling to separate Node.js extension code from browser webview code. Established build-time asset pipeline scaffolding with prebuild hooks and ensured extracted Sulake assets never reach the git repository.

## Implementation

### esbuild Dual Config Structure

**esbuild.config.mjs** created with two separate configurations:

1. **extensionConfig**
   - Entry: `src/extension.ts`
   - Output: `dist/extension.cjs`
   - Platform: `node`
   - Format: `cjs` (required for VS Code extension host)
   - External: `vscode` (provided by VS Code runtime)
   - Sourcemap: `true` (for debugging)

2. **webviewConfig**
   - Entry: `src/webview.tsx`
   - Output: `dist/webview.js`
   - Platform: `browser`
   - Format: `iife` (self-executing bundle for webview)
   - JSX: `automatic` (React 19 automatic runtime)
   - Sourcemap: `true`
   - Plugins: `[]` (asset copy plugin will be added in Plan 03-03)

### Build Script Organization

**package.json scripts updated:**

- `prebuild`: Placeholder echo statement (asset extraction deferred to Plan 03-03)
- `build:ext`: `node esbuild.config.mjs extension` (selective extension build)
- `build:webview`: `node esbuild.config.mjs webview` (selective webview build)
- `build`: `node esbuild.config.mjs` (full build of both)

The config supports optional target argument to build selectively.

### .gitignore Rules and Verification

**Added patterns:**

- `dist/` - All build output
- `dist/webview-assets/` - Extracted sprite assets
- `*.nitro` - Binary asset bundles
- `assets/extracted/` - Alternative extraction location
- `*.vsix` - VS Code extension packages
- `node_modules/`, `package-lock.json` - Dependencies
- `coverage/` - Test coverage reports
- `.DS_Store` - macOS system files

**Verification process:**

```bash
$ git check-ignore -v dist/extension.cjs
.gitignore:2:dist/	dist/extension.cjs

$ git check-ignore -v dist/webview-assets/chair_atlas.png
.gitignore:2:dist/	dist/webview-assets/chair_atlas.png
```

Both patterns confirmed working. `git status` does not show dist/ in untracked files.

## File Sizes

- `dist/extension.cjs`: 2.9KB (Node.js extension host code)
- `dist/webview.js`: 1.1MB (React 19 + webview code bundled)

Webview bundle is larger due to React runtime. This is expected and acceptable for VS Code webview.

## Verification Results

- `npm run build` exits 0 with success messages
- `npm run build:ext` builds extension only
- `npm run build:webview` builds webview only
- `npm run typecheck` exits 0 (no regressions)
- dist/ excluded from git tracking
- prebuild hook executes before build (currently placeholder)

## Issues Encountered

None.

## Deviations from Plan

None. Plan executed as specified.

## Next Steps

Plan 03-03 will add the asset copy plugin to esbuild.config.mjs, wire VS Code webview asset serving (asWebviewUri + CSP img-src), and validate the chair atlas loads in the browser.

The build infrastructure is now ready for asset integration.
