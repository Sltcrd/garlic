# Changelog

## 1.2.1

- Fixed: Alt + click on a file on the **Desktop** opened an unrelated file selected in another Explorer window. Desktop icons are now identified by a list-view hit test at the cursor position (UI Automation does not expose them), independent of any Explorer selection.

## 1.2.0

- **Update check:** the app asks GitHub for the latest release and, if newer, shows a download indicator with the release notes (opens the release page; nothing is installed automatically). On by default; turn it off in System → Check for updates.
- Release notes are now generated from this changelog.

## 1.1.0

- CI now runs on Node 22; test runner no longer depends on shell globs.
- Windows: **System → Shortcut** can add Garlic to the Start menu (so it shows up in Windows search and can be pinned) or create a desktop shortcut.

## 1.0.0

First public release.

- Wheel that opens next to a file in Windows Explorer / Desktop (default Alt + click, configurable) with Convert, Edit and Actions modes.
- 60+ conversions across images, PDF, Word, PowerPoint, Markdown, HTML, EPUB, spreadsheets, subtitles, audio, video and archives; faithful PDF output through Chromium.
- Editor for images (crop, background removal, erase, adjust, redact, annotate…), audio and video, with movable/resizable window and zoom.
- Floating progress/result cards with real percentage and Show / Open / Move to… actions.
- Folder packing to ZIP/TAR/TGZ.
- English and Spanish interface; dark/light themes; glass effect; sounds.
- Hardened architecture: sandboxed renderers, validated IPC, path grants, CSP, isolated PDF renderer.
- Experimental macOS support; Linux without click shortcut.
