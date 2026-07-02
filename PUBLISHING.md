# Publishing

Releases use a two-stage flow built around GitHub-Release-triggered **npm trusted
publishing (OIDC)** — no npm token or secret is stored anywhere, and every publish
gets an automatic, verified provenance badge.

1. **Local** — `scripts/release.sh` (run via `pnpm release`) runs the gates, bumps
   the version, creates a commit + tag, pushes, and creates a GitHub Release. It
   never publishes to npm itself.
2. **CI** — `.github/workflows/publish.yml` runs when that GitHub Release is
   published and does the actual `npm publish` from a clean runner, authenticating
   via OIDC.

## Cutting a release

Prerequisites: the [`gh` CLI](https://cli.github.com/) installed and authenticated
(`gh auth login`), a clean working tree on `main` in sync with origin.

```bash
pnpm release            # prompts for patch / minor / major / prerelease
pnpm release patch      # skip the type prompt
pnpm release minor --yes  # also skip confirmation prompts
pnpm release --dry-run  # run every gate + build, but do NOT bump/tag/push/release
```

The script:

- preflights (gh auth, clean tree, on `main`, in sync with origin),
- runs the gates: `pnpm typecheck && test && lint && build`, then `publint` and
  `pnpm pack --dry-run`,
- bumps the version with `npm version` (commit + `vX.Y.Z` tag),
- pushes with `git push --follow-tags` (rolling back the bump if the push fails),
- creates the GitHub Release (changelog auto-generated from commit titles since the
  previous tag; editable before submitting).

Release notes options: `--notes="..."`, `--notes-file=NOTES.md`, or `--edit` to
always open the changelog in `$EDITOR`.

## What CI does

On a published Release, `publish.yml`:

- re-runs the same gates on a clean checkout,
- verifies the release tag matches `package.json`'s version (so a mistagged release
  can never publish the wrong version),
- publishes: stable releases to the `latest` dist-tag, pre-releases to `next`
  (`npm install eslint-plugin-use-client@next`).

No `NODE_AUTH_TOKEN` — OIDC trusted publishing handles auth, and provenance is
generated automatically. (The workflow upgrades to the latest global npm first,
since OIDC trusted publishing requires npm ≥ 11.5.1, newer than the npm bundled with
Node 22.)

## One-time setup (before the first automated publish)

On [npmjs.com](https://www.npmjs.com/), add this repo's `publish.yml` workflow as a
**trusted publisher** for the `eslint-plugin-use-client` package
(package settings → _Publishing access_ / _Trusted Publisher_).

Trusted publishing can only be configured on a package that already exists on npm,
so the **very first** publish may need to be done manually to create it:

```bash
pnpm build
npm publish --access public
```

After that first publish and the trusted-publisher registration, all subsequent
releases go through `pnpm release` → GitHub Release → CI.
