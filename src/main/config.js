'use strict';
/**
 * Persistent user settings (JSON in the OS user-data folder).
 * Every value coming from a renderer goes through `sanitize`: unknown keys are dropped and each
 * value is type/range checked, so a compromised renderer cannot write arbitrary data to disk.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = Object.freeze({
  bg: '#2a1a1f', op: 55, ac: '#b8607a', sg: '#f6f0e8', rd: 24,
  sound: true, vol: 60, hoverSound: true, jobCard: true,
  autostart: false, hook: true, lang: 'auto', updates: true,
  theme: 'dark', glass: 50, blur: 26, sat: 160, material: 'acrylic', blobs: true, density: 'comfortable', scale: 100,
  combo: Object.freeze({ shift: false, ctrl: false, alt: true, meta: false, button: 1 })
});

const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const num = (a, b) => v => Number.isFinite(v) && v >= a && v <= b;
const bool = v => typeof v === 'boolean';
const oneOf = (...l) => v => l.includes(v);

const SCHEMA = {
  bg: hex, ac: hex, sg: hex, op: num(0, 95), rd: num(0, 48), vol: num(0, 100), glass: num(0, 100), blur: num(0, 60), sat: num(100, 260), scale: num(85, 125),
  sound: bool, hoverSound: bool, jobCard: bool, autostart: bool, hook: bool, blobs: bool, updates: bool,
  theme: oneOf('dark', 'light', 'auto'), material: oneOf('acrylic', 'mica', 'none'), density: oneOf('comfortable', 'compact'), lang: oneOf('auto', 'es', 'en')
};

function cleanCombo(c) {
  if (!c || typeof c !== 'object') return null;
  const out = { shift: !!c.shift, ctrl: !!c.ctrl, alt: !!c.alt, meta: !!c.meta, button: c.button };
  if (![1, 2, 3].includes(out.button)) return null;
  if (!(out.shift || out.ctrl || out.alt || out.meta) && out.button === 1) return null; // a bare left click would hijack every click
  return out;
}

function sanitize(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch && typeof patch === 'object' ? patch : {})) {
    if (k === 'combo') { const c = cleanCombo(v); if (c) out.combo = c; }
    else if (SCHEMA[k] && SCHEMA[k](v)) out[k] = v;
  }
  return out;
}

let cfg = { ...DEFAULTS, combo: { ...DEFAULTS.combo } };
const listeners = new Set();
const file = () => path.join(app.getPath('userData'), 'config.json');

function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { /* first run or corrupt file: use defaults */ }
  cfg = { ...DEFAULTS, combo: { ...DEFAULTS.combo }, ...sanitize(saved) };
  return cfg;
}
function save() {
  try { fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(cfg, null, 2)); } catch (e) { console.error('config: could not save', e.message); }
}
function set(patch) {
  const clean = sanitize(patch);
  cfg = { ...cfg, ...clean };
  save();
  for (const l of listeners) l(cfg, clean);
  return cfg;
}

module.exports = { DEFAULTS, get: () => cfg, load, set, sanitize, onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
