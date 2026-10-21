# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private
*Security → Report a vulnerability* form on the repository (or contact the maintainer
listed in `package.json`). Include the version, your OS, and steps to reproduce.
You can expect an acknowledgement within a few days; this is a hobby project, so there is no SLA.

## Supported versions

Only the latest release receives fixes.

## Security model

Garlic is a local desktop app. It has no server, accounts or telemetry. Its only network request is the optional update check (below).

| Layer | Measure |
|---|---|
| Web pages | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; a strict per-page Content-Security-Policy (`connect-src 'none'`, no remote scripts, styles or images); navigation and `window.open` are denied; all permission requests are denied. |
| IPC | Every channel is validated in the main process (types, lengths, enums). The renderer cannot pass arbitrary paths or commands. |
| File access | The main process keeps a list of **grants**: only files/folders you picked (dialog, drag & drop, click shortcut, CLI) can be read, and writes are limited to the folder of a granted file or a folder you chose. Path traversal in output names is rejected (`safeRel`). |
| Executables | Garlic never executes or opens `.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.lnk`, `.msi`, … and refuses to write such extensions (except when extracting an archive you chose, where entries are never executed). |
| ffmpeg | Run without a shell, with an allow-list of arguments and validated numeric/enum values. |
| Document rendering | HTML/Markdown/Word/PowerPoint → PDF runs in a throw-away session with JavaScript disabled and all network and `file://` access outside the document's folder blocked. |
| Settings | `config.json` is validated against a schema on load and on every change; unknown keys are dropped. |
| Update check | One HTTPS GET from the main process to `api.github.com/repos/Sltcrd/garlic/releases/latest` (no token, no user data; the user agent is `Garlic/<version>`), every 6 hours and at start. Only the version, notes, date and a release URL are read; the URL must start with `https://github.com/Sltcrd/garlic/` or the repository page is used instead, and it is opened in the browser — nothing is downloaded or run by Garlic. Notes are shown as plain text. Disable it in System → Check for updates. |
| Dependencies | `npm run audit:prod` is part of the checks; third-party licenses are in `THIRD_PARTY_NOTICES.md`. |

## Known and accepted risks

- **`'unsafe-eval'` in the wheel and editor pages' CSP.** Required by `heic2any` (WebAssembly/eval) for HEIC input. The pages have no network access and no remote content, which limits what injected code could do.
- **Moderate advisories in the `mammoth` dependency chain** (DOCX reading) at the time of writing. They concern pathological input (denial of service), not code execution.
- **Renderer can ask the main process to open the wheel for a path** (`openWheel`), which grants that path. A compromised renderer could therefore grant itself a file. The renderers load only local, bundled code and have no network, so this is documented rather than eliminated.
- **Binaries are not code-signed.** Verify downloads against the release checksums / build from source.
- **ffmpeg** is GPL; see `THIRD_PARTY_NOTICES.md`.
- The macOS and Linux code paths are untested.
