'use strict';
/**
 * Garlic — main process entry point: single instance, tray, windows, global shortcut, IPC.
 * Run with `pnpm start`. See docs/ARCHITECTURE.md for the overall layout.
 */
const { app, Tray, Menu, session, screen, BrowserWindow } = require('electron');
const fs = require('fs');

app.setName('Garlic');
app.setAppUserModelId('com.garlic.app');

const config = require('./config');
const i18n = require('./i18n');
const windows = require('./windows');
const hook = require('./hook');
const jobs = require('./jobs');
const ipc = require('./ipc');
const updates = require('./updates');
const { notify, appIcon } = require('./notify');
require('./media');
require('./archive');
require('./render');

/** Files passed on the command line (`garlic photo.png`, "Open with…", Send To). */
function filesFromArgs(argv) {
  return argv.slice(app.isPackaged ? 1 : 2).filter(a => a && !a.startsWith('-') && fs.existsSync(a));
}
function openFromArgs(argv) {
  const f = filesFromArgs(argv)[0];
  if (!f) return false;
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  windows.showWheel(f, { x: wa.x + wa.width / 2 - 140, y: wa.y + wa.height / 2 });
  return true;
}

function hardenSessions() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false)); // Garlic never needs camera, mic, location…
  ses.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_e, wc) => {
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));              // no pop-ups
    wc.on('will-navigate', e => e.preventDefault());                   // windows never leave their local page
    wc.on('will-attach-webview', e => e.preventDefault());
  });
}

function main() {
  let tray = null;
  const buildTray = () => {
    if (!tray) { tray = new Tray(appIcon(32)); tray.on('click', windows.showApp); }
    const c = config.get().combo, keys = [c.ctrl && 'Ctrl', c.shift && 'Shift', c.alt && (process.platform === 'darwin' ? 'Option' : 'Alt'), c.meta && (process.platform === 'darwin' ? 'Cmd' : 'Win')].filter(Boolean);
    tray.setToolTip('Garlic' + (keys.length ? ' — ' + keys.join(' + ') : ''));
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: i18n.t('Abrir ajustes'), click: windows.showApp },
      { type: 'separator' },
      { label: i18n.t('Salir'), click: quit }
    ]));
  };
  const quit = () => { windows.state.quitting = true; app.quit(); };

  app.on('second-instance', (_e, argv) => { if (!openFromArgs(argv)) windows.showApp(); });
  app.on('activate', windows.showApp);
  app.on('before-quit', () => { windows.state.quitting = true; hook.stop(); });
  app.on('window-all-closed', () => { /* keep running in the tray */ });

  app.whenReady().then(() => {
    config.load(); i18n.refresh();
    hardenSessions();
    jobs.init({ webPreferences: windows.webPreferences, notify });
    ipc.register({ onQuit: quit });
    windows.createApp(); windows.createWheel();
    hook.sync(); buildTray();
    updates.init({
      onChange: s => { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('update:state', s); },
      notify: r => notify({ title: i18n.t('Actualización disponible'), body: i18n.t('Garlic {v} ya está disponible.', { v: r.version }) })
    });
    updates.sync(config.get().updates);
    config.onChange((_c, patch) => { if ('lang' in patch || 'combo' in patch) buildTray(); });
    openFromArgs(process.argv);
  });
}

if (app.requestSingleInstanceLock()) main(); else app.quit();
