# M011/S03 T01 — Vetted rule candidates + true/false probe snippets

Source research (2026-09-28, worker lane):
- `static-components`: real community rule, eslint-react —
  "Validates that components are static, not recreated every render"
  (https://eslint-react.xyz/docs/rules/static-components).
  Complement: `react/no-unstable-nested-components` (jsx-eslint/eslint-plugin-react) —
  "Disallow creating unstable components inside components."
- `no-unstable-dep-identity`: documented equivalent is the
  `react-hooks/exhaustive-deps` construction diagnostic (facebook/react,
  `ExhaustiveDeps.ts` `scanForConstructions`): "The 'X' object makes the
  dependencies of useEffect Hook change on every render. To fix this, wrap
  the initialization of 'X' in its own useMemo() Hook."
  (https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps —
  "Adding a function dependency causes infinite loops".)
- Weakest existing model rules (floor median 0.02, verdict skipped,
  from `abide report --json` 2026-09-28): no-derived-state-effect,
  no-listener-without-cleanup, lazy-loading-fallback,
  no-children-clone-for-state. Selected for criteria enrichment in T02.

## New rule 1: static-components

- true (must fire):
  `function Parent() { const Child = () => <div />; return <Child />; }`
  (quoted from eslint-react `static-components` docs, "Nesting component definitions").
- false (must stay clear):
  `function Parent() { return <Child />; } function Child() { return <div />; }`
  (quoted from eslint-react `static-components` docs, "declare components at the top level").

## New rule 2: no-unstable-dep-identity

- true (must fire):
  `const chartConfig = { width: 800, height: 600 }; useEffect(() => { initChart(chartConfig); }, [chartConfig]);`
  ("Never pass a raw object literal `{}` ... into a dependency array — they are
  new references on every render"; exhaustive-deps reports the construction
  "makes the dependencies ... change on every render".)
- false (must stay clear):
  `const chartConfig = useMemo(() => ({ width: 800, height: 600 }), []); useEffect(() => { initChart(chartConfig); }, [chartConfig]);`
  ("useMemo keeps the reference stable" / "useCallback keeps the function
  reference stable", react.dev exhaustive-deps docs.)

## Enrichment targets (criteria quoted verbatim from current rubric)

- no-derived-state-effect (median 0.02):
  true `useEffect(() => { setFullName(first + ' ' + last); }, [first, last]);`
  / false `useEffect(() => { document.title = name; }, [name]);`
- no-listener-without-cleanup (median 0.02):
  true `useEffect(() => { window.addEventListener('resize', handler); }, []);`
  / false `useEffect(() => { window.addEventListener('resize', handler); return () => window.removeEventListener('resize', handler); }, []);`
- lazy-loading-fallback (median 0.02):
  true `const Chart = React.lazy(() => import('./Chart')); // used with <Suspense fallback={null}>`
  / false `const Chart = React.lazy(() => import('./Chart')); <Suspense fallback={<Spinner />}><Chart /></Suspense>`
- no-children-clone-for-state (median 0.02):
  true `React.Children.map(children, child => React.cloneElement(child, { isSelected, onSelect }))`
  / false `<SelectionContext.Provider value={{ isSelected, onSelect }}>{children}</SelectionContext.Provider>`

T02 will land the two new rules as model questions (one idea per question,
≤60 words, concrete diff shape, criteria true/false from above, scope globs,
source.path/line at the AGENTS.md mirror) and enrich the four criteria above.
