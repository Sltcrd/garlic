'use strict';
/** Window creation and the show/hide rules for the main window, the floating wheel and the editor. */
const { app, BrowserWindow, screen } = require('electron');
const fs = require('fs');
const paths = require('./paths');
const config = require('./config');
const security = require('./security');
const { windowIcon } = require('./notify');

const WHEEL_W = 300, WHEEL_H = 350;
const EDITOR_TOOLS = new Set(['crop', 'bg', 'erase', 'compress', 'metadata', 'edit', 'redact', 'annotate',
  'a_compress', 'a_metadata', 'a_channels', 'a_normalize', 'a_trim', 'a_visualize',
  'v_compress', 'v_metadata', 'v_mute', 'v_trim', 'v_crop', 'v_speed', 'v_snapshot', 'v_split']);

const state = { app: null, wheel: null, editor: null, quitting: false, lastActivity: 0, shownAt: 0 };

/** Shared, locked-down web preferences: no Node in renderers, sandboxed, context isolated. */
function webPreferences() {
  return { preload: paths.PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false };
}

/* ---------------- main window ---------------- */
function createApp() {
  const cfg = config.get(), mac = process.platform === 'darwin', win = process.platform === 'win32';
  const opts = { width: 1000, height: 720, minWidth: 780, minHeight: 540, show: false, title: 'Garlic', icon: windowIcon(), webPreferences: webPreferences() };
  if (win) Object.assign(opts, { frame: false, backgroundColor: '#00000000', backgroundMaterial: cfg.material === 'none' ? 'none' : cfg.material });
  else if (mac) Object.assign(opts, { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 18 }, vibrancy: 'under-window', visualEffectState: 'active', backgroundColor: '#00000000' });
  else Object.assign(opts, { frame: false, backgroundColor: '#1b1217' });
  const w = state.app = new BrowserWindow(opts);
  w.setMenu(null);
  w.loadFile(paths.renderer('app'));
  w.on('maximize', () => w.webContents.send('win:state', true));
  w.on('unmaximize', () => w.webContents.send('win:state', false));
  w.on('close', e => { if (!state.quitting) { e.preventDefault(); w.hide(); } }); // closing hides to the tray
  w.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) w.show(); });
  return w;
}
function showApp() {
  const w = state.app; if (!w || w.isDestroyed()) return;
  if (w.isMinimized()) w.restore();
  w.show(); w.focus();
}
function applyMaterial() {
  if (process.platform !== 'win32' || !state.app) return;
  try { state.app.setBackgroundMaterial(config.get().material === 'none' ? 'none' : config.get().material); } catch { /* needs Windows 11 */ }
}

/* ---------------- floating wheel ---------------- */
function createWheel() {
  const w = state.wheel = new BrowserWindow({
    width: WHEEL_W, height: WHEEL_H, show: false, frame: false, transparent: true, hasShadow: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, webPreferences: webPreferences()
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  w.loadFile(paths.renderer('wheel'));
  w.on('blur', () => { if (Date.now() - state.shownAt < 800) w.focus(); else hideWheel('blur'); });   // ignore the focus shuffle right after it appears
  return w;
}
const wheelOpen = () => !!state.wheel && !state.wheel.isDestroyed() && state.wheel.isVisible();

function hideWheel() {
  const w = state.wheel; if (!w || w.isDestroyed()) return;
  w.hide();
}
/** Opens the wheel next to `pt` (screen DIP coordinates) for `file`. The user's choice grants access to the file. */
function showWheel(file, pt) {
  const w = state.wheel; if (!w || w.isDestroyed() || !security.grant(file)) return;
  pt = pt || screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(pt).workArea;
  let x = pt.x + 18; if (x + WHEEL_W > wa.x + wa.width) x = pt.x - 18 - WHEEL_W;
  let y = pt.y - 150;
  x = Math.max(wa.x, Math.min(x, wa.x + wa.width - WHEEL_W)); y = Math.max(wa.y, Math.min(y, wa.y + wa.height - WHEEL_H));
  state.lastActivity = state.shownAt = Date.now();
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setBounds({ x: Math.round(x), y: Math.round(y), width: WHEEL_W, height: WHEEL_H });
  let isDir = false; try { isDir = fs.statSync(file).isDirectory(); } catch { /* vanished */ }
  const send = () => w.webContents.send('wheel:open', { path: file, isDir });
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send); else send();   // first use right after start-up
  w.show(); w.moveTop(); w.focus(); app.focus({ steal: true });
}
function outsideWheel(e) {
  const pt = screen.screenToDipPoint({ x: e.x, y: e.y }), b = state.wheel.getBounds();
  return !(pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height);
}
/* Safety net: if the OS refuses to give the wheel keyboard focus its "blur" event never fires, so it also
   closes on an outside click / Esc (handled in hook.js) and after a few idle seconds. */
setInterval(() => { if (wheelOpen() && Date.now() - state.lastActivity > 12000) hideWheel(); }, 1000).unref();

/* ---------------- editor (movable, resizable, zoomable) ---------------- */
function openEditor(file, tool) {
  if (!EDITOR_TOOLS.has(tool) || !security.canReadFile(file)) return;
  if (state.editor && !state.editor.isDestroyed()) { state.editor.show(); state.editor.focus(); state.editor.webContents.send('editor:open', { path: file, tool }); return; }
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(860, wa.width - 40), height = Math.min(800, wa.height - 40);
  const w = state.editor = new BrowserWindow({
    width, height, x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + (wa.height - height) / 2), minWidth: 560, minHeight: 520,
    show: false, frame: false, resizable: true, hasShadow: true, backgroundColor: config.get().bg, title: 'Garlic', icon: windowIcon(), webPreferences: webPreferences()
  });
  w.setMenu(null);
  w.loadFile(paths.renderer('editor'));
  w.once('ready-to-show', () => { w.show(); w.focus(); });
  w.webContents.once('did-finish-load', () => w.webContents.send('editor:open', { path: file, tool }));
  w.on('maximize', () => w.webContents.send('win:state', true));
  w.on('unmaximize', () => w.webContents.send('win:state', false));
  w.on('closed', () => { state.editor = null; });
}

module.exports = { state, webPreferences, createApp, showApp, applyMaterial, createWheel, wheelOpen, hideWheel, showWheel, outsideWheel, openEditor, EDITOR_TOOLS, WHEEL_W, WHEEL_H };
