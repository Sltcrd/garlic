# Contributing to Garlic

Thanks for helping! Bug reports, translations and macOS/Linux testing are especially welcome.

## Set up

```bash
git clone https://github.com/Sltcrd/garlic.git
cd garlic
pnpm install --frozen-lockfile
pnpm start
```

Node.js 20.19+ and pnpm 11 are required (`npm install -g pnpm`, or `corepack enable`). Node 20 runs the app and the unit tests; the end-to-end tests need Node.js 22+.

**Always install with `pnpm install --frozen-lockfile`.** Do not run `pnpm update`, `pnpm add` or `npm install` casually: see the dependency rules below.

## Before you open a pull request

```bash
pnpm run verify    # lint + check + unit tests + end-to-end tests
```

- `pnpm run lint` — ESLint, must be clean.
- `pnpm run check` — syntax, page/CSP rules, no remote URLs, all visible text has an English translation, assets exist.
- `pnpm test` — unit tests (`tests/unit`).
- `pnpm run test:e2e` — launches the real app (`tests/e2e`); takes about two minutes and needs a desktop session.

If you change dependencies run `pnpm run notices` and commit `THIRD_PARTY_NOTICES.md`.
Add a line for every user-visible change to the `Unreleased` section of `CHANGELOG.md`: on release it becomes the notes shown in GitHub Releases and in the app's update dialog (`scripts/release-notes.js`).
If you change the UI, `pnpm run screenshots` refreshes `docs/img`.

## Code guidelines

- Match the surrounding style (2 spaces, single quotes, no framework in the renderer).
- **Security first:** a renderer must never receive a capability it doesn't need. New IPC channels go in `src/main/ipc.js`, are exposed in `src/preload/index.js`, validate every argument, and check path grants through `security.js`. Don't loosen the CSP; don't add network access.
- Keep platform-specific code behind `process.platform` checks and in `src/main/resolvers/` or `fileactions.js`.

## Translations

Spanish is the source language: the Spanish text *is* the key passed to `t()`. English lives in `src/shared/i18n-en.js` (`'texto en español': 'English text'`). To add a language, add a dictionary in the same format, register it in `src/shared/i18n.js` and add the option to the language selector. `pnpm run i18n:harvest` prints all visible strings.

## Dependencies (supply-chain rules)

Garlic's users run the code of every dependency, so adding or updating one is a security decision.

- **Fewer is better.** Prefer a few lines of your own code or a built-in over a new package. Say in the PR why it is needed, who maintains it, and its license.
- **Exact versions** in `package.json` (no `^`/`~`); the lock file (`pnpm-lock.yaml`) is always committed, and its diff is reviewed in the PR.
- **No install scripts**: `pnpm-workspace.yaml` lists the only packages whose scripts may run (`allowBuilds`). A new package that needs one must be justified there.
- **Nothing younger than 3 days** (`minimumReleaseAge`): do not work around it, wait.
- Update dependencies in a clean, throw-away environment (a VM, Windows Sandbox or a container), not in your daily session.
- After changing dependencies: `pnpm run notices`, `pnpm audit --prod`, `pnpm run verify` and a packaged build test (`pnpm run package`, then `GARLIC_BIN=<path to the packaged electron(.exe)> pnpm run test:e2e`).

## Branching (Gitflow)

| Branch | Purpose |
|---|---|
| `main` | Released code only. Every commit here is tagged `vX.Y.Z`. |
| `develop` | Integration branch; all pull requests target it. |
| `feature/<short-name>` | New work, branched from `develop`, merged back with a PR. |
| `fix/<short-name>` | Bug fixes, same flow as features. |
| `release/X.Y.Z` | Stabilisation before a release: branched from `develop`, merged into `main` (tagged) and back into `develop`. |
| `hotfix/X.Y.Z` | Urgent fix branched from `main`, merged into `main` (tagged) and `develop`. |

## Commit messages (Conventional Commits)

Format: `type(scope): description` — imperative, lower case, no trailing period; use the body for the *why*.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scopes: `main`, `wheel`, `editor`, `app`, `jobs`, `i18n`, `security`, `media`, `deps`, `release`.
- Breaking changes: `feat(scope)!: …` or a `BREAKING CHANGE:` footer.

Examples: `fix(media): compute progress against the sped-up duration` · `feat(editor): add pan with the space bar`.

## Pull requests

Small, focused PRs with a clear description of what changed and how you tested it (say which OS). Mention if you could not test on a platform.
