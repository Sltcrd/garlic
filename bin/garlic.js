#!/usr/bin/env node
'use strict';
/**
 * Command-line launcher:   garlic [--hidden] [file…]
 * Starts Garlic (or, if it is already running, asks it to open the wheel for the given file).
 * Install it from a clone with `npm install -g .` or run it with `npx garlic`.
 */
const { spawn } = require('child_process');
const path = require('path');

let electron;
try { electron = require('electron'); } catch { console.error('Electron is not installed. Run "npm install" in the Garlic folder first.'); process.exit(1); }

const root = path.join(__dirname, '..');
const args = [root, ...process.argv.slice(2).map(a => (a.startsWith('-') ? a : path.resolve(a)))];
const child = spawn(electron, args, { detached: true, stdio: 'ignore', windowsHide: false });
child.unref();
