#!/usr/bin/env node
'use strict';
/**
 * Builds a portable, ready-to-run copy of Garlic for the CURRENT platform into out/Garlic-<platform>-<arch>/.
 *
 *   pnpm run package           build the folder
 *   pnpm run package --zip     also create a .zip next to it
 *
 * How it works: it copies the stock Electron runtime *unmodified* and puts the app (src, assets and the
 * production dependencies) in its resources/app folder. Not rewriting electron.exe matters on Windows:
 * Smart App Control blocks executables that were modified after they were built, but lets the original,
 * well-known Electron binary run. For a signed installer see docs/PLATFORMS.md.
 *
 * Windows and Linux layouts are tested by the author on Windows only; the macOS bundle is experimental.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const platform = process.platform, arch = process.arch;
const OUT = path.join(ROOT, 'out', `Garlic-${platform}-${arch}`);
const log = m => console.log('•', m);

/** Runs a fixed command line (no user input is ever interpolated). */
function run(commandLine, opts = {}) {
  const r = spawnSync(commandLine, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) { console.error(`Command failed: ${commandLine}`); process.exit(1); }
}
const copy = (from, to) => fs.cpSync(from, to, { recursive: true, force: true });

/* 1. the Electron runtime */
const electronDist = path.join(ROOT, 'node_modules', 'electron', 'dist');
if (!fs.existsSync(electronDist)) { log('downloading the Electron runtime'); run(`node "${path.join(ROOT, 'node_modules', 'electron', 'install.js')}"`); }
if (!fs.existsSync(electronDist)) { console.error('Electron runtime not found. Run "pnpm install" first.'); process.exit(1); }

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let appDir;
const launcherDir = OUT;
if (platform === 'darwin') {
  const bundle = path.join(OUT, 'Garlic.app');
  log('copying Electron.app → Garlic.app (experimental)');
  copy(path.join(electronDist, 'Electron.app'), bundle);
  appDir = path.join(bundle, 'Contents', 'Resources', 'app');
  const plist = path.join(bundle, 'Contents', 'Info.plist');
  let xml = fs.readFileSync(plist, 'utf8');
  xml = xml.replace(/(<key>CFBundleName<\/key>\s*<string>)[^<]*/, '$1Garlic').replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*/, '$1Garlic');
  fs.writeFileSync(plist, xml);
  fs.rmSync(path.join(bundle, 'Contents', 'Resources', 'default_app.asar'), { force: true });
} else {
  log(`copying the Electron runtime (${platform})`);
  copy(electronDist, OUT);
  appDir = path.join(OUT, 'resources', 'app');
  fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true });
}

/* 2. the application */
log('copying the application');
fs.mkdirSync(appDir, { recursive: true });
copy(path.join(ROOT, 'src'), path.join(appDir, 'src'));
copy(path.join(ROOT, 'assets'), path.join(appDir, 'assets'));
for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(appDir, f));
for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(platform === 'darwin' ? OUT : launcherDir, f));
const slim = { ...pkg }; delete slim.scripts;   // devDependencies stay so the lockfile still matches; --prod below skips them
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(slim, null, 2));

/* 3. production dependencies only (ffmpeg and the native hook are fetched for this platform) */
log('installing production dependencies');
run('pnpm install --frozen-lockfile --prod', { cwd: appDir });   // same lockfile and policies (no unreviewed scripts, release-age delay) as development

/* 4. launchers */
if (platform === 'win32') {
  fs.writeFileSync(path.join(launcherDir, 'Garlic.vbs'), 'Set sh = CreateObject("WScript.Shell")\r\nsh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)\r\nsh.Run """" & sh.CurrentDirectory & "\\electron.exe""", 1, False\r\n');
  fs.writeFileSync(path.join(launcherDir, 'Garlic.bat'), '@echo off\r\nstart "" "%~dp0electron.exe" %*\r\n');
} else if (platform === 'linux') {
  /* Chromium's sandbox needs a setuid chrome-sandbox or unprivileged user namespaces; only if neither is available fall back to --no-sandbox */
  const sh = `#!/bin/sh
cd "$(dirname "$0")" || exit 1
FLAGS=""
SB=./chrome-sandbox
userns=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)
apparmor=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)
if { [ ! -u "$SB" ] || [ "$(stat -c %U "$SB" 2>/dev/null)" != root ]; } && { [ "$userns" = 0 ] || [ "$apparmor" = 1 ]; }; then
  echo "garlic: Chromium sandbox unavailable, starting with --no-sandbox (see docs/PLATFORMS.md)" >&2
  FLAGS="--no-sandbox"
fi
exec ./electron $FLAGS "$@"
`;
  fs.writeFileSync(path.join(launcherDir, 'garlic.sh'), sh, { mode: 0o755 });
}

console.log(`\n✔ Built ${path.relative(ROOT, OUT)}`);
console.log(platform === 'win32' ? '  Run Garlic.vbs (or Garlic.bat). Pass a file path to open the wheel for it.' : platform === 'linux' ? '  Run ./garlic.sh' : '  Open Garlic.app (right-click → Open the first time).');

if (process.argv.includes('--zip')) {
  const JSZip = require('jszip'), zipPath = OUT + '.zip', z = new JSZip();
  (function add(dir, base) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name), r = path.posix.join(base, e.name); if (e.isDirectory()) add(p, r); else if (e.isFile()) z.file(r, fs.createReadStream(p), { unixPermissions: fs.statSync(p).mode & 0o777 }); } })(OUT, path.basename(OUT));
  z.generateNodeStream({ streamFiles: true, compression: 'DEFLATE', platform: 'UNIX' }).pipe(fs.createWriteStream(zipPath)).on('finish', () => console.log('✔ ' + path.relative(ROOT, zipPath)));
}
