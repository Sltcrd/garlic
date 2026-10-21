#!/usr/bin/env node
'use strict';
/**
 * Runs the test files of one folder with the built-in node:test runner:   node scripts/run-tests.js unit|e2e
 * Files are listed here instead of passing a glob to `node --test`, because Node 20 does not expand globs.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = path.join(__dirname, '..', 'tests', process.argv[2] || 'unit');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort().map(f => path.join(dir, f));
if (!files.length) { console.error('No test files in ' + dir); process.exit(1); }
process.exit(spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' }).status ?? 1);
