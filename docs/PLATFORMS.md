# Platform notes

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Status | Developed and tested (Windows 11) | Written, **never run by the author** | Written, **never run by the author** |
| File under the cursor | Explorer: UIA + `Shell.Application`; Desktop: list-view hit test (`LVM_HITTEST`) | `osascript` asking Finder for the selection | Not possible in general (no common API; Wayland forbids global hooks) |
| Global click hook | `uiohook-napi` | `uiohook-napi` — needs **Accessibility** and **Input Monitoring** permission | `uiohook-napi` works on X11 only |
| Window material | Acrylic/Mica via `backgroundMaterial` | Vibrancy | Plain translucent colour |
| Autostart | `setLoginItemSettings` | `setLoginItemSettings` | not implemented |
| Packaging | `npm run package` → folder + `Garlic.vbs` | `Garlic.app` copied from Electron (unsigned: right-click → Open) | folder + `garlic.sh` |

## macOS

- Grant Garlic **Accessibility** and **Input Monitoring** in *System Settings → Privacy & Security*, otherwise the shortcut cannot be detected.
- The resolver only returns the file that is *selected* in Finder, so click-to-select, then use the shortcut.
- Unsigned apps are quarantined; use *right-click → Open* the first time, or `xattr -dr com.apple.quarantine Garlic.app`.
- Please report what works and what doesn't.

## Linux

- There is no click-on-file shortcut. Use **Choose file…**, drag and drop, or `garlic <file>` (for instance from a file manager's "Open with" or a custom action).
- Electron's sandbox needs either unprivileged user namespaces or a setuid `chrome-sandbox`. Distributions that restrict user namespaces (e.g. Ubuntu 24.04) make the packaged build fail to start; the generated `garlic.sh` falls back to `--no-sandbox` **only in that case**, which weakens Chromium's isolation. Prefer fixing the sandbox: `sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox`.
- Running with `npm start` uses the same Electron and the same rules.
- ffmpeg comes from `ffmpeg-static`; it is a prebuilt GPL binary.

## Windows

- **Smart App Control / SmartScreen:** the build uses the unmodified official `electron.exe`. If a policy still blocks it, run from source (`npm start`).
- The click resolver starts a long-lived hidden PowerShell. Execution policy is not changed; the script is passed inline.
- A real signed installer would need a code-signing certificate and a tool such as electron-builder; contributions welcome.
