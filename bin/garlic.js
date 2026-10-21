#!/usr/bin/env node
'use strict';
/**
 * Command-line launcher:   garlic [--hidden] [file…]
 * Starts Garlic (or, if it is already running, asks it to open the wheel for the given file).
 * Run it from a clone with `node bin/garlic.js [file]` (or `pnpm link --global` to get a `garlic` command).
 */
const { spawn } = require('child_process');
const path = require('path');

let electron;
try { electron = require('electron'); } catch { console.error('Electron is not installed. Run "pnpm install" in the Garlic folder first.'); process.exit(1); }

const root = path.join(__dirname, '..');
const args = [root, ...process.argv.slice(2).map(a => (a.startsWith('-') ? a : path.resolve(a)))];
const child = spawn(electron, args, { detached: true, stdio: 'ignore', windowsHide: false });
child.unref();
