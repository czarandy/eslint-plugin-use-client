# eslint-plugin-use-client

An ESLint rule that enforces the [`'use client'`](https://react.dev/reference/rsc/use-client)
directive in files that use client-only React features — so React Server
Components consumers (Next.js App Router, etc.) don't hit runtime errors from
missing directives.

Unlike the existing plugins, this one:

- **Runs on flat-config ESLint 9/10** (uses the modern `context.sourceCode` API,
  not the removed `context.getSourceCode()`/`getScope()`/`getFilename()`).
- **Is scope-agnostic** — it flags hooks used inside components, inside custom
  `useXxx` hooks, and at module scope. Plugins that only look inside PascalCase
  components miss standalone hook and context files.
- **Detects `createContext`**, `use()` (React 19), `React.useX()`, browser globals,
  and JSX event handlers.
- **Reports precisely** — the error points at the offending call/attribute, not
  the whole file.
- **Auto-fixes** — `--fix` inserts `'use client';` at the top of the file.

## Install

```bash
npm install -D eslint-plugin-use-client
# or: pnpm add -D eslint-plugin-use-client
```

Requires ESLint `>= 9`.

## Usage (flat config)

```js
// eslint.config.js
import useClient from 'eslint-plugin-use-client';

export default [
  // Use the recommended preset...
  useClient.configs.recommended,

  // ...or wire the rule up yourself, e.g. scoped to your component source:
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {'use-client': useClient},
    rules: {'use-client/require-use-client': 'error'},
  },
];
```

## Rule: `require-use-client`

Reports a file that uses a client-only React feature but is missing the
`'use client'` directive, and (with `--fix`) inserts it. A file that already has
`'use client'` or `'use server'` is left alone.

### What it detects

| Feature | Example |
| --- | --- |
| Hooks (`use[A-Z]`) | `useState(...)`, `useEffect(...)`, `useTheme(...)` |
| React 19 `use()` | `use(SomeContext)` |
| Member-call hooks | `React.useState(...)` |
| `createContext` | `createContext(null)`, `React.createContext(null)` |
| Browser globals | `window.*`, `document.*`, `navigator.*`, `localStorage.*`, `sessionStorage.*` |
| JSX event handlers | `<button onClick={...} />` |

### Options

```js
'use-client/require-use-client': ['error', {
  hooks: true,            // detect hook calls (default true)
  createContext: true,    // detect createContext(...) (default true)
  browserApis: true,      // detect browser globals; pass an array to override the set
  eventHandlers: true,    // detect JSX on* handlers (default true)
  allowedHooks: [],       // exact callee names to treat as server-safe
  additionalHooks: '',    // regex (source string) for hook-like names not matching /^use[A-Z]/
}]
```

- **`allowedHooks`** — exempt a callable that looks like a hook but is
  server-safe, e.g. `allowedHooks: ['useMemoizedConstant']`.
- **`browserApis`** — set to `false` to disable, or pass an array
  (e.g. `['window', 'document']`) to override the default global set.
- **`additionalHooks`** — a regex source string matched against the simple callee
  name, for hook-like calls that don't follow the `use[A-Z]` convention
  (e.g. `'^atom$'`).

### Known trade-offs (v1)

- `createContext` is matched by callee **name**, not by verifying it's imported
  from `react` — this is deliberate, so re-exported/namespaced usage isn't missed.
  Disable with `createContext: false` or exempt via `allowedHooks` if needed.
- Computed member calls (`React['useState']()`) are out of scope.

## Development

```bash
pnpm install
pnpm test        # RuleTester suite
pnpm build       # tsup (JS) + tsc (declarations)
pnpm lint
pnpm check:exports
```

## Releasing

Releases use GitHub-Release-triggered **npm trusted publishing (OIDC)** — no npm
token is stored anywhere.

1. Run `pnpm release` (needs the `gh` CLI, authenticated). It runs the gates,
   bumps the version, tags, pushes, and creates a GitHub Release.
2. The published Release triggers `.github/workflows/publish.yml`, which publishes
   to npm via OIDC with automatic provenance.

**One-time setup** (before the first automated publish): on npmjs.com, add this
repo's `publish.yml` workflow as a **trusted publisher** for the package. The very
first publish may need to be done manually (`npm publish --access public`) to
create the package on npm before trusted publishing can be configured.

## License

MIT
