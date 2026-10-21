'use strict';
/** "Actions" ring: copy path, reveal, open, terminal here, copy/move to… — for any file or folder. */
const { clipboard, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const security = require('./security');
const dialogs = require('./dialogs');
const { notify } = require('./notify');
const { t } = require('./i18n');

const uniqueIn = (dir, name) => {
  let p = path.join(dir, name), i = 1; const ext = path.extname(name), base = path.basename(name, ext);
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
  return p;
};

function openTerminal(dir) {
  const detached = { cwd: dir, detached: true, stdio: 'ignore' };
  const attempt = list => {
    const [cmd, args] = list[0] || [];
    if (!cmd) return notify({ title: t('Terminal'), body: t('No se encontró un terminal compatible.') });
    const c = spawn(cmd, args, detached); c.on('error', () => attempt(list.slice(1))); c.unref();
  };
  if (process.platform === 'win32') attempt([['wt.exe', ['-d', dir]], ['cmd.exe', ['/c', 'start', 'cmd.exe', '/K']]]);
  else if (process.platform === 'darwin') attempt([['open', ['-a', 'Terminal', dir]]]);
  else attempt([['x-terminal-emulator', []], ['gnome-terminal', ['--working-directory=' + dir]], ['konsole', ['--workdir', dir]], ['xfce4-terminal', ['--working-directory=' + dir]], ['xterm', []]]);
}

async function run(action, p) {
  if (typeof p !== 'string' || !security.grant(p) || !fs.existsSync(p)) return;
  const isDir = fs.statSync(p).isDirectory(), dir = isDir ? p : path.dirname(p);
  if (action === 'copypath') { clipboard.writeText(p); notify({ title: t('Ruta copiada'), body: p }); }
  else if (action === 'reveal') shell.showItemInFolder(p);
  else if (action === 'open') { if (security.isSafeToOpen(p)) await shell.openPath(p); else shell.showItemInFolder(p); }
  else if (action === 'terminal') openTerminal(dir);
  else if (action === 'copyto' || action === 'moveto') {
    const target = await dialogs.pickFolder({ title: action === 'copyto' ? t('Copiar a…') : t('Mover a…') });
    if (!target) return;
    const dest = uniqueIn(target, path.basename(p));
    try {
      if (action === 'copyto') { if (isDir) fs.cpSync(p, dest, { recursive: true }); else fs.copyFileSync(p, dest); }
      else { try { fs.renameSync(p, dest); } catch { if (isDir) { fs.cpSync(p, dest, { recursive: true }); fs.rmSync(p, { recursive: true }); } else { fs.copyFileSync(p, dest); fs.unlinkSync(p); } } }
      security.grantDir(target);
      notify({ title: action === 'copyto' ? t('Copiado') : t('Movido'), body: dest, path: dest });
    } catch (e) { notify({ title: t('No se pudo completar'), body: String(e.message || e) }); }
  }
}

module.exports = { run };
