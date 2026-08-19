import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Downgraded from error to warning, deliberately.
      //
      // The rule flags any effect that CALLS a function which transitively sets
      // state — it does not distinguish a genuine synchronous cascade from ordinary
      // async data loading. Verified against this exact config: a plain
      // `useEffect(() => { load() }, [])` where `load` is `async` and only sets state
      // after an `await` is flagged identically to `useEffect(() => setX(1), [])`.
      // At error severity it therefore condemns every fetch-on-mount effect in the
      // app and would block CI on idiomatic code.
      //
      // Kept as a warning rather than switched off because three of the current sites
      // (AuthContext, TimerContext, MyWorkPanel) DO contain real synchronous cascades
      // worth removing. Those are scheduled for after the Phase 5 tests exist to
      // protect the change — see docs/testing-progress.md.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // A context module that exports a Provider component, a `useX` hook and the
    // context object is the standard React pattern, and shadcn/ui ships its
    // `*Variants` constants alongside the component they belong to. Splitting either
    // apart would touch every import site across the app to satisfy a rule that only
    // governs Fast Refresh behaviour in dev — no runtime or correctness effect.
    files: ['src/context/**/*.{js,jsx}', 'src/components/ui/**/*.{js,jsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Build and test configuration runs in Node, not the browser — `process`,
    // `import.meta.dirname` and friends are legitimate here.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Test utilities exist to export helpers, not components, so the Fast Refresh
    // rule (which requires a module to export components only) does not apply.
    files: ['src/tests/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
