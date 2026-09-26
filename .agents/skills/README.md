# Patterns.dev skills (curated)

Curated subset of [PatternsDev/skills](https://github.com/PatternsDev/skills), installed for OpenCode.
Selected for this stack (React 19 + Canvas 2D, esbuild, no SSR, Vite, or router). SSR, hydration,
Vue, and Vite-specific skills are intentionally excluded.

## Installed skills (16)

Design: `hooks-pattern`, `compound-pattern`, `render-props-pattern`,
`presentational-container-pattern`, `react-composition-2026`, `observer-pattern`,
`mediator-pattern`, `module-pattern`, `factory-pattern`

Performance: `react-render-optimization`, `js-performance-patterns`, `virtual-lists`,
`dynamic-import`, `bundle-splitting`

Rendering: `client-side-rendering`

AI UI: `ai-ui-patterns`

## Refresh and maintenance

```bash
# Update all project skills
npx skills update -p -y

# Reinstall from the lockfile (skills-lock.json at repo root)
npx skills experimental_install

# Add a skill
npx skills add PatternsDev/skills -s <skill-name> -a opencode -y --copy

# Remove a skill
npx skills remove -s <skill-name> -y
```

## Notes

- Installed with `--copy`, so real files are committed and shared by all worktrees.
- `skills-lock.json` (repo root) records versions and sources.
- OpenCode discovers these through `skills.paths` in `opencode.json` (`.agents/skills`).
- Re-running an install without `--copy` may create symlinks; keep `--copy` for committed files.
