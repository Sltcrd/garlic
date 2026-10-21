'use strict';
/** Global mouse/keyboard hook (uiohook-napi): detects the user's click combination and asks the OS-specific resolver for the file. */
const { screen } = require('electron');
const config = require('./config');
const windows = require('./windows');
const resolver = require('./resolvers');

let uio = null, running = false, initialised = false, error = '';

/* Own modifier tracking: uiohook's internal mask can miss the first press after start-up. */
const MODIFIER = { 29: 'ctrl', 3613: 'ctrl', 42: 'shift', 54: 'shift', 56: 'alt', 3640: 'alt', 3675: 'meta', 3676: 'meta' };
const down = {};
const isDown = k => !!down[k] && Date.now() - down[k] < 20000; // expire stuck keys (e.g. released while another app had focus)
const ESC = 1;

function matches(e) {
  const c = config.get().combo;
  const sh = !!e.shiftKey || isDown('shift'), ct = !!e.ctrlKey || isDown('ctrl'), al = !!e.altKey || isDown('alt'), me = !!e.metaKey || isDown('meta');
  return e.button === c.button && sh === !!c.shift && ct === !!c.ctrl && al === !!c.alt && me === !!c.meta;
}

function onMouse(e) {
  if (windows.wheelOpen() && windows.outsideWheel(e)) windows.hideWheel('outside-click');
  if (!config.get().hook || !matches(e)) return;
  const pt = screen.screenToDipPoint({ x: e.x, y: e.y });
  resolver.resolve({ x: e.x, y: e.y }).then(file => { if (file) windows.showWheel(file, pt); });
}
function onKeyDown(k) {
  const m = MODIFIER[k.keycode];
  if (m && !down[m]) down[m] = Date.now();
  const w = windows.state.wheel;
  if (windows.wheelOpen()) { if (k.keycode === ESC) windows.hideWheel('esc'); else if (!m && !w.isFocused()) windows.hideWheel('typing'); }
}
function onKeyUp(k) { const m = MODIFIER[k.keycode]; if (m) delete down[m]; }

function sync() {
  if (!resolver.supported) { error = 'unsupported-platform'; return; }
  try { uio = uio || require('uiohook-napi').uIOhook; } catch (e) { error = String(e.message || e); return; }
  if (!initialised) { uio.on('keydown', onKeyDown); uio.on('keyup', onKeyUp); uio.on('mousedown', onMouse); initialised = true; }
  if (config.get().hook && !running) { uio.start(); running = true; resolver.start(); }
  else if (!config.get().hook && running) { uio.stop(); running = false; }
}
function stop() { try { if (running && uio) uio.stop(); } catch { /* shutting down */ } running = false; resolver.stop(); }
const status = () => ({ on: running, err: error, supported: resolver.supported, platform: process.platform });

module.exports = { sync, stop, status };
