# Contributing to Garlic

Thanks for helping! Bug reports, translations and macOS/Linux testing are especially welcome.

## Set up

```bash
git clone https://github.com/Sltcrd/garlic.git
cd garlic
npm install
npm start
```

Node.js 20+ runs the app and the unit tests; the end-to-end tests need Node.js 22+.

## Before you open a pull request

```bash
npm run verify    # lint + check + unit tests + end-to-end tests
```

- `npm run lint` — ESLint, must be clean.
- `npm run check` — syntax, page/CSP rules, no remote URLs, all visible text has an English translation, assets exist.
- `npm test` — unit tests (`tests/unit`).
- `npm run test:e2e` — launches the real app (`tests/e2e`); takes about two minutes and needs a desktop session.

If you change dependencies run `npm run notices` and commit `THIRD_PARTY_NOTICES.md`.
If you change the UI, `npm run screenshots` refreshes `docs/img`.

## Code guidelines

- Match the surrounding style (2 spaces, single quotes, no framework in the renderer).
- **Security first:** a renderer must never receive a capability it doesn't need. New IPC channels go in `src/main/ipc.js`, are exposed in `src/preload/index.js`, validate every argument, and check path grants through `security.js`. Don't loosen the CSP; don't add network access.
- Keep platform-specific code behind `process.platform` checks and in `src/main/resolvers/` or `fileactions.js`.

## Translations

Spanish is the source language: the Spanish text *is* the key passed to `t()`. English lives in `src/shared/i18n-en.js` (`'texto en español': 'English text'`). To add a language, add a dictionary in the same format, register it in `src/shared/i18n.js` and add the option to the language selector. `npm run i18n:harvest` prints all visible strings.

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
