'use strict';
/**
 * "Which file is under the mouse?" needs the file manager's own API, so it is implemented per platform.
 * Linux has no portable API (Nautilus, Dolphin, Thunar… all differ and Wayland blocks global input),
 * so there the shortcut is disabled and Garlic is used through the tray, drag & drop, the file picker or the CLI.
 */
const impl = process.platform === 'win32' ? require('./win32')
  : process.platform === 'darwin' ? require('./darwin')
    : { name: process.platform, supported: false, start() { }, stop() { }, resolve: async () => '' };

module.exports = Object.assign({ isReady: () => true }, impl);   // isReady: has the resolver finished starting?
