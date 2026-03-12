# T02: 03-asset-pipeline 02

**Slice:** S03 — **Milestone:** M001

## Description

Configure dual esbuild bundling (extension host + webview), establish build-time asset pipeline scaffolding, and ensure extracted Sulake assets never reach the git repository.

Purpose: Separate Node.js extension code from browser webview code to prevent Node.js built-ins leaking into browser bundle; prepare infrastructure for asset extraction without implementing .nitro parsing (deferred per research recommendation).

Output: Clean build system ready for asset integration in later plans.

## Must-Haves

- [ ] "npm run build executes successfully and produces dist/ output"
- [ ] "Extracted assets exist in dist/webview-assets/ after build"
- [ ] "Extracted Sulake assets are never committed to git"
- [ ] "Extension bundle and webview bundle are separate files"

## Files

- `package.json`
- `.gitignore`
- `esbuild.config.mjs`
