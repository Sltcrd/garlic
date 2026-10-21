'use strict';
/** Absolute locations used by the main process (works unpackaged and packaged without asar). */
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

module.exports = {
  ROOT,
  ASSETS: path.join(ROOT, 'assets'),
  PRELOAD: path.join(ROOT, 'src', 'preload', 'index.js'),
  renderer: name => path.join(ROOT, 'src', 'renderer', name, 'index.html'),
  icon: { png: path.join(ROOT, 'assets', 'icon.png'), ico: path.join(ROOT, 'assets', 'icon.ico') }
};
