# T03: 03-asset-pipeline 03

**Slice:** S03 — **Milestone:** M001

## Description

Wire the VS Code webview asset serving pipeline — copy sprite assets to dist/webview-assets/ during build, generate webview URIs in extension host, update CSP for image loading, and validate chair atlas loads in browser.

Purpose: Complete the asset pipeline integration so sprite cache (Plan 03-01) can load real atlases from the webview; validate end-to-end flow before furniture rendering in Phase 4.

Output: Working asset pipeline with chair atlas loading as proof-of-concept.

## Must-Haves

- [ ] "Webview loads without 401/Access Denied errors for asset URIs"
- [ ] "CSP allows image loading from webview resource URIs"
- [ ] "Asset URIs use vscode-resource:// scheme (not file://)"
- [ ] "Chair atlas PNG and JSON load successfully in webview"

## Files

- `src/extension.ts`
- `src/webview.tsx`
- `esbuild.config.mjs`
