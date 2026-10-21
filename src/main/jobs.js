'use strict';
/**
 * Conversion jobs and their floating cards (progress while running; Show / Open / Move to… when done).
 * Jobs are created either by a renderer (document/image conversions) or by the main process itself
 * (ffmpeg, folder packing), which then reports real progress through `progress()`.
 */
const { BrowserWindow, ipcMain, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const security = require('./security');
const config = require('./config');
const dialogs = require('./dialogs');
const { t } = require('./i18n');

const W = 420, MARGIN = 8;
const jobs = new Map();
let seq = 0, win = null, lastH = 120, ctx = null;

const str = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');

function init(c) { ctx = c; }

function ensureWin() {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    width: W, height: lastH, show: false, frame: false, transparent: true, hasShadow: false, resizable: false, focusable: true,
    alwaysOnTop: true, skipTaskbar: true, webPreferences: ctx.webPreferences()
  });
  win.setAlwaysOnTop(true, 'floating');
  win.loadFile(paths.renderer('jobs'));
  win.webContents.on('did-finish-load', send);   // state that changed while the page was loading
  return win;
}
function place(h) {
  lastH = Math.max(80, Math.min(Number(h) || 120, 640));
  if (!win || win.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  win.setBounds({ x: wa.x + wa.width - W - MARGIN, y: wa.y + wa.height - lastH - MARGIN, width: W, height: lastH });
}
function push() { if (win && !win.isDestroyed() && !win.webContents.isLoading()) send(); }
function send() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('jobs:state', [...jobs.values()].map(j => ({
    id: j.id, title: j.title, name: j.name, state: j.state, p: j.p, label: j.label, out: j.out || '', note: j.note || '', err: j.err || '', cancelable: !!j.cancel
  })));
}
function refresh() {
  if (!config.get().jobCard) return;
  if (!jobs.size) { if (win && !win.isDestroyed()) win.hide(); return; }
  const w = ensureWin(); place(lastH); push();
  if (!w.isVisible()) w.showInactive();
}
function remove(id) { const j = jobs.get(id); if (j) clearTimeout(j.timer); jobs.delete(id); refresh(); }
function scheduleExpire(j, ms = 30000) {
  clearTimeout(j.timer);
  j.timer = setTimeout(() => { if (jobs.get(j.id) !== j) return; if (j.hover) scheduleExpire(j, 8000); else remove(j.id); }, ms);
}

/* ---- internal API (used by media.js / archive.js and the IPC handlers) ---- */
function start({ title, name, cancel }) { const id = ++seq; jobs.set(id, { id, title: str(title), name: str(name), state: 'running', p: null, label: t('Preparando…'), cancel: cancel || null }); refresh(); return id; }
function progress(id, p, label) { const j = jobs.get(id); if (!j || j.state !== 'running') return; if (typeof p === 'number') j.p = Math.max(0, Math.min(1, p)); if (label) j.label = str(label); push(); }
function setCancel(id, fn) { const j = jobs.get(id); if (j) { j.cancel = fn; push(); } }
function done(id, out, note) {
  const j = jobs.get(id); if (!j) return;
  j.state = 'done'; j.p = 1; j.cancel = null; j.note = str(note);
  j.out = typeof out === 'string' && security.canTouch(out) ? path.resolve(out) : '';
  if (!config.get().jobCard) { ctx.notify({ title: t('Listo'), body: path.basename(j.out || j.name), path: j.out }); jobs.delete(id); return; }
  scheduleExpire(j); push();
}
function fail(id, msg) {
  const j = jobs.get(id); if (!j) return;
  j.state = 'error'; j.err = str(msg) || t('Error'); j.cancel = null;
  if (!config.get().jobCard) { ctx.notify({ title: t('No se pudo convertir'), body: j.err }); jobs.delete(id); return; }
  scheduleExpire(j, 12000); push();
}
function quick({ title, name, out }) { const id = start({ title, name }); done(id, out); return id; }

/* ---- IPC ---- */
ipcMain.handle('job:start', (_e, o) => start({ title: o && o.title, name: o && o.name }));
ipcMain.on('job:progress', (_e, o) => { if (o) progress(+o.id, typeof o.p === 'number' ? o.p : undefined, o.label); });
ipcMain.on('job:done', (_e, o) => { if (o) done(+o.id, o.out, o.note); });
ipcMain.on('job:error', (_e, o) => { if (o) fail(+o.id, o.msg); });
ipcMain.on('job:quick', (_e, o) => { if (o) quick({ title: o.title, name: o.name, out: o.out }); });
ipcMain.on('jobs:size', (_e, h) => place(h));
ipcMain.on('jobs:hover', (_e, o) => { const j = o && jobs.get(+o.id); if (j) j.hover = !!o.hover; });

ipcMain.on('job:action', async (_e, o) => {
  const id = o && +o.id, action = o && o.action, j = jobs.get(id);
  if (!j) return;
  if (action === 'close') return remove(id);
  if (action === 'cancel') { if (j.cancel) { try { j.cancel(); } catch { /* process already ended */ } } return; }
  if (!j.out || !fs.existsSync(j.out) || !security.canTouch(j.out)) { j.note = t('El archivo ya no está en esa ubicación.'); return push(); }
  if (action === 'reveal') return shell.showItemInFolder(j.out);
  if (action === 'open') { if (security.isSafeToOpen(j.out)) shell.openPath(j.out); else shell.showItemInFolder(j.out); return; }
  if (action === 'move') {
    scheduleExpire(j, 90000);
    const dir = await dialogs.pickFolder({ title: t('Mover a…'), defaultPath: path.dirname(j.out) });
    if (!dir) return;
    const base = path.basename(j.out), ext = path.extname(base), stem = path.basename(base, ext);
    let dest = path.join(dir, base), i = 1;
    while (fs.existsSync(dest)) dest = path.join(dir, `${stem} (${i++})${ext}`);
    try {
      try { fs.renameSync(j.out, dest); } catch { // different drive: copy then delete
        if (fs.statSync(j.out).isDirectory()) { fs.cpSync(j.out, dest, { recursive: true }); fs.rmSync(j.out, { recursive: true }); } else { fs.copyFileSync(j.out, dest); fs.unlinkSync(j.out); }
      }
      security.grantDir(dir); j.out = dest; j.note = t('Movido a {dir}', { dir });
    } catch (e) { j.note = t('No se pudo mover: {msg}', { msg: e.message || e }); }
    scheduleExpire(j); push();
  }
});

module.exports = { init, start, progress, done, fail, quick, setCancel, list: () => [...jobs.values()].map(j => ({ id: j.id, state: j.state, p: j.p, out: j.out, title: j.title })) };
