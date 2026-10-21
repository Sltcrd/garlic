#!/usr/bin/env node
'use strict';
/**
 * Repository health check (no dependencies, run it with `npm run check`):
 *   1. every JavaScript file parses;
 *   2. every renderer page references files that exist and declares a Content-Security-Policy;
 *   3. every t('…') key used in the sources has an English translation;
 *   4. the icons exist.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const problems = [];
const fail = msg => problems.push(msg);
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'out', 'dist', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);

/* 1 — syntax */
for (const f of files.filter(f => f.endsWith('.js') || f.endsWith('.mjs'))) {
  const src = fs.readFileSync(f, 'utf8');
  try {
    if (/\b(import\s+[\w{*]|export\s)/.test(src) && f.endsWith('pdf-loader.js')) new vm.SourceTextModule(src, { identifier: f }); // ES module
    else new vm.Script(src.replace(/^#!.*/, ''), { filename: f });
  } catch (e) {
    if (e.code === 'ERR_VM_MODULES_NOT_SUPPORTED' || /SourceTextModule/.test(String(e.message))) continue; // flag not set: skip module files
    if (/Cannot use import statement|Unexpected token 'export'/.test(e.message)) continue;
    fail(`${rel(f)}: ${e.message}`);
  }
}

/* 2 — pages */
for (const f of files.filter(f => /src[\\/]renderer[\\/][^\\/]+[\\/]index\.html$/.test(f))) {
  const html = fs.readFileSync(f, 'utf8');
  if (!/Content-Security-Policy/.test(html)) fail(`${rel(f)}: missing Content-Security-Policy`);
  if (/https?:\/\//.test(html.replace(/xmlns="[^"]*"/g, ''))) fail(`${rel(f)}: references a remote URL (Garlic must work offline)`);
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(data:|https?:)/.test(m[1])) continue;
    const target = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(target)) fail(`${rel(f)}: missing file ${m[1]}`);
  }
}

/* 3 — translations */
const EN = require('../src/shared/i18n-en.js');
const SAME_IN_BOTH = new Set(['Terminal', 'Error']);                       // identical in English, no entry needed
const used = new Set(), re = /\b(?:I18N\.)?t\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;
for (const f of files.filter(f => /src[\\/].*\.js$/.test(f) && !/i18n/.test(path.basename(f)))) {
  const s = fs.readFileSync(f, 'utf8'); let m;
  while ((m = re.exec(s))) if (!m[2].includes('${')) used.add(m[2].replace(/\\'/g, "'"));
}
for (const k of used) if (!(k in EN) && !SAME_IN_BOTH.has(k)) fail(`i18n: no English entry for "${k}"`);

/* 4 — assets */
for (const a of ['assets/icon.png', 'assets/icon.ico', 'assets/icon.svg']) if (!fs.existsSync(path.join(ROOT, a))) fail(`missing ${a}`);

if (problems.length) { console.error(problems.map(p => '✖ ' + p).join('\n')); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`✔ ${files.filter(f => f.endsWith('.js')).length} scripts, ${used.size} translated keys and all pages look good`);
