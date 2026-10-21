'use strict';
/** Native notifications and the app icon helpers. */
const { Notification, nativeImage, shell } = require('electron');
const fs = require('fs');
const paths = require('./paths');
const security = require('./security');

function appIcon(size = 32) {
  try {
    const img = nativeImage.createFromPath(paths.icon.png);
    if (!img.isEmpty()) return img.resize({ width: size, height: size, quality: 'best' });
  } catch { /* fall through */ }
  return nativeImage.createEmpty();
}
const windowIcon = () => (fs.existsSync(paths.icon.ico) && process.platform === 'win32' ? paths.icon.ico : paths.icon.png);

function notify({ title, body, path: p } = {}) {
  try {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: String(title || 'Garlic').slice(0, 120), body: String(body || '').slice(0, 300), icon: appIcon(64) });
    if (p && security.canTouch(p)) n.on('click', () => shell.showItemInFolder(p));
    n.show();
  } catch { /* notifications are best effort */ }
}

module.exports = { notify, appIcon, windowIcon };
