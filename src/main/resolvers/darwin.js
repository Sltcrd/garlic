'use strict';
/**
 * macOS (EXPERIMENTAL, untested by the author): ask Finder for its current selection.
 * Needs "Accessibility" (global mouse hook) and "Automation → Finder" permissions the first time.
 */
const { execFile } = require('child_process');

const SCRIPT = `
tell application "System Events" to set frontName to name of first application process whose frontmost is true
if frontName is not "Finder" then return ""
tell application "Finder"
  set sel to selection as alias list
  if (count of sel) is 0 then return ""
  return POSIX path of (item 1 of sel)
end tell`;

function resolve() {
  return new Promise(res => {
    setTimeout(() => {
      execFile('osascript', ['-e', SCRIPT], { timeout: 4000 }, (err, out) => res(err ? '' : String(out).trim().replace(/\/$/, '')));
    }, 150); // let Finder update the selection after the click
  });
}

module.exports = { name: 'darwin', supported: true, start() { }, stop() { }, resolve };
