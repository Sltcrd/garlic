# Privacy policy

*Last updated: 2026-10-22 · [Español](PRIVACY.es.md)*

Garlic is a free, open-source desktop application for Windows (macOS and Linux are experimental) that converts and edits files on your computer. This policy explains what data Garlic handles. The short version: **Garlic works on your computer, has no accounts, and sends no telemetry. Your files are never uploaded.**

## What Garlic does *not* do

- It does **not** collect, store or transmit personal data, usage statistics, crash reports or analytics.
- It does **not** require an account or a login.
- It does **not** upload your files, file names, file paths or any file content to any server.
- It does **not** show advertisements and does not share anything with third parties.

## Data that stays on your computer

| Data | Where | Why |
|---|---|---|
| **Settings** (theme, colors, language, shortcut combination, sound and update options) | `config.json` in the user data folder (`%APPDATA%\Garlic` on Windows) | To remember your preferences. It contains no personal data and never leaves your computer. |
| **Your files and the results of conversions** | Next to the original file, or in a folder you choose | Garlic reads only files and folders that **you** choose (file dialog, drag and drop, the click shortcut, or the command line) and writes results to their folder. |
| **Temporary files** | The system temporary folder | A temporary HTML file is created while a document is turned into a PDF and is deleted right after. |
| **Windows shortcuts / start-up entry** | Start menu, desktop, or the Windows "Run" registry key | Only if you press the buttons or the switch in *System*. You can remove them at any time. |

## How the click shortcut works (input monitoring)

To open the wheel when you hold a key combination (by default **Alt + left click**) Garlic listens to global mouse clicks and keyboard modifier keys while it is running. This is processed **locally and in memory** only to detect the combination and to close the wheel when you press a key; Garlic does **not** record, log, store or transmit what you type or where you click. When the combination is detected, Garlic asks the operating system which file is under the cursor (a local query to Windows Explorer) and opens the wheel for it. You can turn the shortcut off in the app at any time.

## The only network request: the update check

Garlic can check whether a newer version exists. This is the **only network connection Garlic makes**:

- It sends one HTTPS request to GitHub's public API (`api.github.com/repos/Sltcrd/garlic/releases/latest`) when it starts and every few hours.
- The request contains **no personal data and no identifier**: only the standard information any HTTPS request carries (your IP address, as GitHub sees it) and a user agent string `Garlic/<version>`.
- It reads the latest version number, its release notes and its page address. Nothing is downloaded or installed automatically; the button only opens the release page in your browser.
- **You can turn it off** in *System → Check for updates*. When it is off, Garlic makes no network requests at all.

GitHub processes that request under [its own privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). To the best of the author's knowledge, Garlic makes no other network connections; the source code is public so that anyone can verify this, and the user interface pages are restricted by a Content Security Policy that blocks all network access.

## Website and downloads

- The project website (<https://sltcrd.github.io/garlic/>) is hosted on GitHub Pages. It has no analytics and no cookies; it stores only your language choice (ES/EN) in your browser's local storage. GitHub may log visits as described in its privacy statement.
- Releases are downloaded from GitHub. Each release includes a SHA-256 checksum file so you can verify the download.

## Third-party components

Garlic includes open-source components (Electron/Chromium, ffmpeg, pdf.js and others, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). They run locally inside the application. Garlic does not enable telemetry or crash reporting in any of them.

## Children

Garlic does not collect personal data from anyone, including children.

## Your rights and data deletion

Because Garlic does not collect personal data, there is nothing to request or delete on a server. To remove everything Garlic stores locally, delete its folder, the `%APPDATA%\Garlic` settings folder, and any shortcut or start-up entry you created.

## Changes to this policy

Changes are published in this file in the public repository, with their history visible in Git. The date at the top shows the latest update.

## Contact

For privacy questions or concerns, open an issue or a discussion at <https://github.com/Sltcrd/garlic>. To report a security problem privately, use the *Report a vulnerability* form described in [SECURITY.md](SECURITY.md).
