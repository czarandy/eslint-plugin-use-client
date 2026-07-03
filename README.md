# eslint-plugin-use-client

An ESLint rule that enforces the [`'use client'`](https://react.dev/reference/rsc/use-client)
directive in files that use client-only React features so that React Server
Components consumers (Next.js App Router, etc.) don't hit runtime errors from
missing directives.

Improvements compared to other similar plugins:

- **Runs on flat-config ESLint 9/10** - doesn't use deprecated APIs that require older eslint versions.
- **Scope-agnostic** — it flags hooks used inside components, inside custom
  `useXxx` hooks, and at module scope. 
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

Requires ESLint `>= 9` (also compatible with 10).

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

It also flags the **reverse** case (on by default): a file that carries a
`'use client'` directive but uses *none* of the client-only features below, so
the directive is dead weight and the module could render on the server. Removal
is offered as an editor **suggestion** rather than an auto-fix — the rule can't
see every reason a file might legitimately be a client boundary (e.g. it renders
an imported client component), so it never strips the directive on `--fix`.
Disable this half with `removeUnnecessary: false`. `'use server'` files are
never flagged.

### What it detects

| Feature            | Example                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Hooks (`use[A-Z]`) | `useState(...)`, `useEffect(...)`, `useTheme(...)`                            |
| React 19 `use()`   | `use(SomeContext)`                                                            |
| Member-call hooks  | `React.useState(...)`                                                         |
| `createContext`    | `createContext(null)`, `React.createContext(null)`                            |
| Browser globals    | `window.*`, `document.*`, `navigator.*`, `localStorage.*`, `sessionStorage.*` |
| JSX event handlers | `<button onClick={...} />`                                                    |

### Options

```js
'use-client/require-use-client': ['error', {
  hooks: true,            // detect hook calls (default true)
  createContext: true,    // detect createContext(...) (default true)
  browserApis: true,      // detect browser globals; pass an array to override the set
  eventHandlers: true,    // detect JSX on* handlers (default true)
  removeUnnecessary: true, // flag a 'use client' with no client feature (default true)
  allowedHooks: [],       // exact callee names to treat as server-safe
  additionalHooks: '',    // regex (source string) for hook-like names not matching /^use[A-Z]/
}]
```

- **`removeUnnecessary`** — set to `false` to stop reporting a `'use client'`
  directive that no detected client feature justifies.
- **`allowedHooks`** — exempt a callable that looks like a hook but is
  server-safe, e.g. `allowedHooks: ['useMemoizedConstant']`.
- **`browserApis`** — set to `false` to disable, or pass an array
  (e.g. `['window', 'document']`) to override the default global set.
- **`additionalHooks`** — a regex source string matched against the simple callee
  name, for hook-like calls that don't follow the `use[A-Z]` convention
  (e.g. `'^atom$'`).

### Known limitations

- `createContext` is matched by callee **name**, not by verifying it's imported
  from `react` — this is deliberate, so re-exported/namespaced usage isn't missed.
  Disable with `createContext: false` or exempt via `allowedHooks` if needed.
- Computed member calls (`React['useState']()`) are out of scope.

## License

MIT
