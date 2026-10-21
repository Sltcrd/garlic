'use strict';
/** IPC surface exposed to the renderers (through src/preload). Every handler validates its input. */
const { app, ipcMain, BrowserWindow, shell, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const paths = require('./paths');
const security = require('./security');
const windows = require('./windows');
const hook = require('./hook');
const dialogs = require('./dialogs');
const fileActions = require('./fileactions');
const { notify } = require('./notify');

const ACTIONS = new Set(['copypath', 'reveal', 'terminal', 'copyto', 'moveto', 'open']);
/** Login-item settings. When run from source (npm start) the app folder must be passed too, otherwise Windows would start a blank Electron. */
function loginItem(open) {
  const args = process.defaultApp ? [app.getAppPath(), '--hidden'] : ['--hidden'];
  return { openAtLogin: open, path: process.execPath, args };
}
const MAX_SAVE = 1.5 * 1024 * 1024 * 1024;

function register({ onQuit }) {
  /* ---- settings ---- */
  ipcMain.handle('cfg:defaults', () => config.DEFAULTS);
  ipcMain.handle('cfg:get', () => config.get());
  ipcMain.handle('cfg:set', (_e, patch) => config.set(patch));
  config.onChange((cfg, patch) => {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('cfg:update', cfg);
    if ('autostart' in patch && process.platform !== 'linux') app.setLoginItemSettings(loginItem(!!cfg.autostart));
    if ('hook' in patch) hook.sync();
    if ('material' in patch) windows.applyMaterial();
  });

  /* ---- window chrome ---- */
  ipcMain.on('win:ctl', (e, a) => {
    const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
    if (a === 'close') w.close(); else if (a === 'min') w.minimize(); else if (a === 'max') (w.isMaximized() ? w.unmaximize() : w.maximize());
  });
  ipcMain.on('wheel:hide', () => windows.hideWheel('renderer'));
  ipcMain.on('wheel:ping', () => { windows.state.lastActivity = Date.now(); });
  ipcMain.on('editor:open', (_e, o) => { if (o) { windows.hideWheel('editor'); windows.openEditor(o.path, o.tool); } });

  /* ---- files the user chose ---- */
  ipcMain.on('app:open-wheel', (_e, p) => { if (typeof p === 'string' && p) windows.showWheel(p); });
  ipcMain.handle('app:pick', async () => {
    const file = await dialogs.pickFile({ filters: [{ name: 'All files', extensions: ['*'] }] }, windows.state.app);
    if (!file) return;
    const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    windows.showWheel(file, { x: wa.x + wa.width / 2 - 140, y: wa.y + wa.height / 2 });
  });
  ipcMain.handle('file:read', (_e, p) => {
    if (!security.canReadFile(p)) throw new Error('Access denied');
    return fs.readFileSync(p);
  });
  ipcMain.handle('save', (_e, o) => {
    const { dir, base, ext } = o || {};
    if (typeof dir !== 'string' || typeof base !== 'string' || typeof ext !== 'string' || !(o.bytes instanceof Uint8Array || Array.isArray(o.bytes)) || o.bytes.length > MAX_SAVE) throw new Error('Invalid request');
    const target = path.resolve(security.canWriteIn(dir) ? dir : app.getPath('downloads'));
    if (!security.safeRel(base + ext) || (ext && !/^\.[A-Za-z0-9]{1,12}$/.test(ext))) throw new Error('Invalid file name');
    // scripts/executables are only ever written when extracting an archive into its own sub-folder
    if (security.isExecutableName(base + ext) && !(o.extract && base.includes('/'))) throw new Error('Blocked file type');
    let p = path.resolve(target, base + ext), i = 1;
    if (!security.within(p, target)) throw new Error('Invalid path');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    while (fs.existsSync(p)) p = path.resolve(target, `${base} (${i++})${ext}`);
    fs.writeFileSync(p, Buffer.from(o.bytes));
    return p;
  });
  ipcMain.handle('file:action', (_e, o) => { if (o && ACTIONS.has(o.action)) return fileActions.run(o.action, o.path); });
  ipcMain.on('reveal', (_e, p) => { if (security.canTouch(p)) shell.showItemInFolder(p); });
  ipcMain.on('notify', (_e, o) => notify(o));

  /* ---- misc ---- */
  ipcMain.on('app:quit', onQuit);
  ipcMain.handle('hook:status', () => hook.status());
  /* Windows: a real .lnk so Garlic shows up in Start / search and can be pinned (the portable folder has no installer) */
  ipcMain.handle('shortcut:create', (_e, where) => {
    if (process.platform !== 'win32' || !['start', 'desktop'].includes(where)) return { ok: false };
    const lnk = where === 'start'
      ? path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Garlic.lnk')
      : path.join(app.getPath('desktop'), 'Garlic.lnk');
    const ok = shell.writeShortcutLink(lnk, 'create', {
      target: process.execPath, args: process.defaultApp ? '"' + app.getAppPath() + '"' : '', cwd: path.dirname(process.execPath),
      icon: path.join(paths.ASSETS, 'icon.ico'), iconIndex: 0, description: 'Garlic', appUserModelId: 'com.garlic.app'
    });
    return { ok, path: lnk };
  });
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, locale: app.getLocale(), electron: process.versions.electron }));
  if (process.env.GARLIC_TEST === '1') {          // state probe used only by the automated tests
    const w = windows.state;
    ipcMain.handle('test:jobs', () => require('./jobs').list());
    ipcMain.handle('test:state', () => ({
      wheel: windows.wheelOpen(), focused: windows.wheelOpen() && w.wheel.isFocused(),
      editor: !!w.editor && !w.editor.isDestroyed(), editorBounds: w.editor && !w.editor.isDestroyed() ? w.editor.getBounds() : null,
      app: w.app ? { vis: w.app.isVisible(), min: w.app.isMinimized(), max: w.app.isMaximized(), b: w.app.getBounds() } : null
    }));
  }
}

module.exports = { register };
