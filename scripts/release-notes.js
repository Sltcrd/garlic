#!/usr/bin/env node
'use strict';
/**
 * Prints the release notes for a version: its CHANGELOG.md section, then an end marker (the in-app update
 * dialog shows only what is above it) and the install instructions.   node scripts/release-notes.js v1.2.0
 */
const fs = require('fs');
const path = require('path');

const version = String(process.argv[2] || '').replace(/^v/, '');
const log = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const section = log.split(/^## /m).find(s => s.split('\n')[0].trim() === version);
if (!section) { console.error('No CHANGELOG.md section for ' + version); process.exit(1); }
const m = [null, section.split('\n').slice(1).join('\n')];

console.log(`${m[1].trim()}

<!-- end-notes -->

## Install (Windows portable)

1. Download \`Garlic-win32-x64.zip\`, right-click → Properties → **Unblock**, extract it, and run \`Garlic.vbs\`.
2. Windows SmartScreen may warn because the build is **not code-signed**: *More info → Run anyway*. Or build from source (see the README).

macOS and Linux: not packaged here (untested) — run from source.

**Licenses:** this zip includes the **ffmpeg** binary (GPL). Source: https://ffmpeg.org and https://github.com/eugeneware/ffmpeg-static. Full list: \`THIRD_PARTY_NOTICES.md\` inside the zip.`);
