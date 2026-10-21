'use strict';
/** Folder/file pickers. Automated tests can bypass the native dialog with GARLIC_TEST=1 + GARLIC_TEST_PICK=<path>. */
const { dialog } = require('electron');

const testPick = () => (process.env.GARLIC_TEST === '1' && process.env.GARLIC_TEST_PICK) || null;

async function pickFolder(options, parent) {
  const forced = testPick();
  if (forced) return forced;
  const r = await dialog.showOpenDialog(parent || undefined, { properties: ['openDirectory', 'createDirectory'], ...options });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
}
async function pickFile(options, parent) {
  const forced = testPick();
  if (forced) return forced;
  const r = await dialog.showOpenDialog(parent || undefined, { properties: ['openFile'], ...options });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
}

module.exports = { pickFolder, pickFile };
