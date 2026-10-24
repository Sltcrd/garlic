# Platform notes

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Status | Developed and tested (Windows 11) | Written, **never run by the author** | Written, **never run by the author** |
| File under the cursor | Explorer: UIA + `Shell.Application`; Desktop: list-view hit test (`LVM_HITTEST`) | `osascript` asking Finder for the selection | Not possible in general (no common API; Wayland forbids global hooks) |
| Global click hook | `uiohook-napi` | `uiohook-napi` — needs **Accessibility** and **Input Monitoring** permission | `uiohook-napi` works on X11 only |
| Window material | Acrylic/Mica via `backgroundMaterial` | Vibrancy | Plain translucent colour |
| Autostart | `setLoginItemSettings` | `setLoginItemSettings` | not implemented |
| Packaging | `pnpm run package` → folder + `Garlic.vbs` | `Garlic.app` copied from Electron (unsigned: right-click → Open) | folder + `garlic.sh` |

## macOS

- Grant Garlic **Accessibility** and **Input Monitoring** in *System Settings → Privacy & Security*, otherwise the shortcut cannot be detected.
- The resolver only returns the file that is *selected* in Finder, so click-to-select, then use the shortcut.
- Unsigned apps are quarantined; use *right-click → Open* the first time, or `xattr -dr com.apple.quarantine Garlic.app`.
- Please report what works and what doesn't.

## Linux

- There is no click-on-file shortcut. Use **Choose file…**, drag and drop, or `garlic <file>` (for instance from a file manager's "Open with" or a custom action).
- Electron's sandbox needs either unprivileged user namespaces or a setuid `chrome-sandbox`. Distributions that restrict user namespaces (e.g. Ubuntu 24.04) make the packaged build fail to start; the generated `garlic.sh` falls back to `--no-sandbox` **only in that case**, which weakens Chromium's isolation. Prefer fixing the sandbox: `sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox`.
- Running with `pnpm start` uses the same Electron and the same rules.
- ffmpeg comes from `ffmpeg-static`; it is a prebuilt GPL binary.

## Windows

- **Smart App Control / SmartScreen:** the build uses the unmodified official `electron.exe`. If a policy still blocks it, run from source (`pnpm start`).
- The click resolver starts a long-lived hidden PowerShell. Execution policy is not changed; the script is passed inline.
- A real signed installer would need a code-signing certificate and a tool such as electron-builder; contributions welcome.

## Trying Garlic on macOS without building it (experimental)

There is no official macOS release yet. A manual workflow builds an **Apple-silicon** `Garlic.app`:

1. On GitHub open **Actions → "macOS build (experimental)" → Run workflow** (needs a GitHub account; the repository owner runs it).
2. When it finishes, open the run and download the artifact **Garlic-macOS-arm64-experimental** (a zip that contains `Garlic-darwin-arm64.zip` and its `.sha256`).
3. Unzip it, then unzip `Garlic-darwin-arm64.zip` to get `Garlic.app`; move it to `Applications` (or anywhere).
4. The app is only **ad-hoc signed** (no Apple Developer ID, not notarised), so Gatekeeper blocks the first launch. Either right-click `Garlic.app` → **Open** → **Open**, or run `xattr -dr com.apple.quarantine /path/to/Garlic.app`.
5. Give it the permissions below. Because the signature is ad hoc and changes with every build, macOS may ask for the permissions again after each update.

Running from source (`pnpm install --frozen-lockfile && pnpm start`) also works and is the way to test changes.

## macOS permissions, step by step

Garlic listens to the mouse and modifier keys to detect **Alt (Option) + click**, and asks Finder which file is selected. macOS protects both, so it asks for permission.

**Accessibility (required)**
1. Open **System Settings → Privacy & Security → Accessibility**.
2. Find the entry and turn its switch **on**. Which entry depends on how you start Garlic:
   - the packaged app → **Garlic**;
   - `pnpm start` → **Electron** (the one inside `node_modules/electron/dist`) **or the terminal app** you ran it from (Terminal, iTerm, VS Code…); macOS attributes the request to either, so turn on whichever appears.
3. If **Electron** is not in the list: click **+**, press **Cmd+Shift+G**, paste the path to `node_modules/electron/dist/Electron.app` inside your `garlic` folder, choose it and turn it on.
4. Garlic notices the permission by itself within a couple of seconds. If it does not, quit it from the menu-bar icon and start it again.

**Input Monitoring** — macOS may also ask for it the first time the shortcut is used. Allow it in **Privacy & Security → Input Monitoring** (same entry as above).

**Automation → Finder / System Events** — the first time you use the shortcut on a file, macOS asks whether Garlic may control Finder. Click **OK**. If you refused by mistake, enable it in **Privacy & Security → Automation**.

**If a permission seems stuck** (for example after moving or rebuilding the app): remove its entry with the **–** button and add it again, or reset it from a terminal and start Garlic again:
```bash
tccutil reset Accessibility com.sltcrd.garlic      # packaged app
tccutil reset Accessibility com.github.Electron    # running from source
```

## How to report macOS problems or send improvements

- **Report:** open an issue with the **macOS / Linux test report** template: macOS version, chip (Apple silicon or Intel), how you started Garlic, what worked, and the terminal output or a screenshot.
- **Suggest or ask:** use [Discussions](https://github.com/Sltcrd/garlic/discussions).
- **Send a fix:** fork the repository, create a branch (`fix/macos-…`), make the change, run `pnpm run verify`, and open a pull request against `develop` with a Conventional Commit title. macOS-specific code lives in `src/main/resolvers/darwin.js`, `src/main/hook.js` and the macOS part of `scripts/package.js`; see [CONTRIBUTING.md](../CONTRIBUTING.md).
