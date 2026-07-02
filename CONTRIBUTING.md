# Contributing

Thanks for your interest in improving `eslint-plugin-use-client`.

## Setup

Requires Node `>= 22` and [pnpm](https://pnpm.io/) (pinned via the
`packageManager` field).

```bash
pnpm install
```

## Common tasks

```bash
pnpm test           # run the RuleTester suite once
pnpm test:watch     # re-run tests on change
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint over the repo
pnpm build          # tsup (JS) + tsc (declarations) -> dist/
pnpm check:exports  # build, then validate the package with publint
```

## Project layout

```
src/
  index.ts                    plugin entry: meta + rules + recommended config
  rules/require-use-client.ts the single rule (all detectors)
  util/callee.ts              getCalleeName()
  util/directive.ts           hasClientOrServerDirective(), insertUseClientFix()
tests/
  require-use-client.test.ts  RuleTester suite (valid + invalid cases)
```

## Adding or changing rule behavior

- The rule is authored as a plain object typed with `@typescript-eslint/utils`
  **type-only** imports (no runtime dependency, keeping the published bundle small).
- Detection is call-expression / node based and **scope-agnostic** — hooks are
  flagged inside components, inside custom `useXxx` hooks, and at module scope.
- Report on the **specific offending node**, never the `Program` node, so the
  editor squiggle points at the violating code rather than the whole file.
- Every change needs RuleTester coverage: add `valid`/`invalid` cases in
  `tests/require-use-client.test.ts`. Invalid cases must assert the exact `output`
  for the auto-fixer.

## Build model

`tsup` emits the JS bundles (`dts: false`); declarations come from a separate
`tsc -p tsconfig.build.json` pass. Both feed the dual ESM/CJS `exports` map. `dist/`
is gitignored and produced fresh on build/publish.

## Before opening a PR

Run the full gate locally — it mirrors what CI enforces:

```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm build && pnpm exec publint
```
