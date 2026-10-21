# Architecture

Garlic is an Electron app with three kinds of windows that share one preload bridge.

```text
                ┌──────────────────────────── main process (Node) ───────────────────────────┐
 mouse/keys ──► │ hook.js (uiohook)  ──► resolvers/<os>.js  "which file is under the cursor?" │
                │        │                                                                    │
                │        ▼                                                                    │
                │ windows.js ── app window · wheel window · editor window · jobs window       │
                │ ipc.js ── validated handlers ── security.js (grants) · config.js            │
                │          media.js (ffmpeg) · archive.js · render.js · fileactions.js        │
                └───────────────▲────────────────────────────────────────────────────────────┘
                                │ contextBridge: window.native  (src/preload/index.js)
                ┌───────────────┴──────────── renderers (sandboxed Chromium) ─────────────────┐
                │ app/  wheel/  editor/  jobs/   +  shared/ (engine, formats, pptx, orbit…)   │
                └─────────────────────────────────────────────────────────────────────────────┘
```

## Flow of a conversion

1. The global hook sees the configured click combination and asks the OS resolver for the file under the cursor (Windows: a persistent PowerShell using UI Automation + `Shell.Application`).
2. `security.grant(path)` registers the file; `windows.showWheel` opens the wheel next to the cursor and sends `wheel:open`.
3. The wheel renderer reads the file through `native.readFile` (only granted paths), lets the user pick a target, and `shared/formats.js#produce` converts it **in the renderer** (canvas, pdf.js, mammoth, jsPDF, SheetJS…).
4. Heavy or privileged work is delegated to main: ffmpeg (`media.js`, with `-progress` parsing), HTML→PDF (`render.js`), folder packing (`archive.js`).
5. `native.save` writes the result next to the original (granted directory only) and `jobs.js` shows the progress/result card.

## Directories

| Path | Responsibility |
|---|---|
| `src/main/index.js` | Single-instance lock, tray, CLI arguments, session hardening, lifecycle |
| `src/main/windows.js` | Creates the windows; positions the wheel; editor tool whitelist; idle-close timer |
| `src/main/hook.js` | Global input hook, modifier tracking, outside-click / Esc / typing closes the wheel |
| `src/main/resolvers/` | `win32.js` (UIA + Shell), `darwin.js` (AppleScript, experimental), `index.js` picks one (Linux: none) |
| `src/main/ipc.js` | One handler per channel; validates input before touching the filesystem |
| `src/main/security.js` | Path grants, `safeRel`, executable-extension block, ffmpeg argument validation |
| `src/main/config.js` | Defaults, schema, `sanitize`, persistence in the user-data folder |
| `src/main/i18n.js`, `src/shared/i18n*.js` | Language resolution and dictionaries |
| `src/preload/index.js` | Whitelisted API exposed as `window.native` |
| `src/renderer/shared/` | Conversion engine, format tables, PPTX renderer, theme/sounds, SVG wheel |
| `src/renderer/{app,wheel,editor,jobs}/` | One HTML/CSS/JS folder per window |
| `scripts/` | Repository tooling (check, package, screenshots, notices, icons) |
| `tests/unit`, `tests/e2e` | Fast logic tests; real-app tests through the Chrome DevTools Protocol |

## Internationalisation

Spanish strings are the keys. `t(key, params)` returns the English text when the language is English and the key otherwise. In the DOM, `renderer/shared/i18n-dom.js` translates text nodes and attributes in place and observes mutations, so static HTML needs no markup. The language (`auto`/`es`/`en`) is a setting; changing it broadcasts a `lang` event to every window.

## Testing

- Unit: `node --test` on `tests/unit` (security rules, config sanitising, i18n).
- E2E: `tests/e2e/lib.js` launches Electron with a temp user-data directory and talks to each page over CDP. `GARLIC_TEST=1` exposes state helpers; `GARLIC_BIN=<path to electron(.exe)>` runs the same tests against a packaged build; `GARLIC_TEST_PICK` bypasses native dialogs.
- Not covered automatically: the real Alt + click shortcut in Explorer (it needs a real desktop and was verified by hand), macOS and Linux.

## Packaging

`scripts/package.js` copies the stock Electron runtime unmodified and puts the app in `resources/app` with production dependencies only. Leaving `electron.exe` untouched avoids Windows Smart App Control blocks. There is no installer or code signing yet.
