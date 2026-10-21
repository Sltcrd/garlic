'use strict';
/**
 * Path permissions and input validation for everything the renderers may ask the main process to do.
 *
 * Model: a renderer can only touch files the *user* pointed at (shortcut click, "Choose file…" dialog,
 * drag & drop, command line) and the folders next to them. Everything else is refused.
 */
const fs = require('fs');
const path = require('path');

const files = new Set();
const dirs = new Set();
const norm = p => path.resolve(String(p));
const within = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

/** The user chose this file or folder: allow reading it and writing next to it. */
function grant(p) {
  if (typeof p !== 'string' || !p) return false;
  p = norm(p);
  let st; try { st = fs.statSync(p); } catch { return false; }
  if (st.isDirectory()) { dirs.add(p); dirs.add(path.dirname(p)); } else { files.add(p); dirs.add(path.dirname(p)); }
  return true;
}
function grantDir(p) { if (typeof p === 'string' && p) dirs.add(norm(p)); }

const canReadFile = p => typeof p === 'string' && files.has(norm(p));
const canWriteIn = d => typeof d === 'string' && [...dirs].some(g => within(norm(d), g));
const canTouch = p => typeof p === 'string' && (files.has(norm(p)) || [...dirs].some(g => within(norm(p), g)));

/** Relative output paths must stay relative and inside their folder. */
function safeRel(rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 400 || /[\0<>:"|?*]/.test(rel)) return false;
  if (path.isAbsolute(rel) || rel.startsWith('/') || rel.startsWith('\\')) return false;
  return !rel.split(/[\\/]/).some(s => s === '..');
}

/** Executable / script types are never launched by "Open". */
const EXEC_EXT = new Set(['.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.msp', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.lnk', '.reg', '.hta', '.cpl', '.jar', '.sh', '.command', '.app', '.desktop', '.appimage', '.pkg', '.dmg', '.dll']);
const isExecutableName = p => EXEC_EXT.has(path.extname(String(p)).toLowerCase());
const isSafeToOpen = p => { try { if (fs.statSync(p).isDirectory()) return true; } catch { return false; } return !isExecutableName(p); };

/* ---- ffmpeg argument validation: only the options Garlic itself generates ---- */
const FILTER_OK = /^[\w[\]=:.,;\-+*/ ()'"]+$/;
const FILTER_BAD = /movie|amovie|sendcmd|zmq|subtitles|ass=|drawtext|sofalizer|lavfi/i;
const URL_LIKE = /^(?:[a-z][a-z0-9+.-]{1,12}:)(?!\\)/i;            // http:, file:, concat:, pipe: …  (drive letters are 1 char, so not matched)
const FORMAT_OK = new Set(['segment', 'mp4', 'matroska', 'webm', 'avi', 'mov', 'wmv', 'gif', 'mp3', 'wav', 'flac', 'ogg', 'opus', 'aiff', 'image2']);

function validFfArgs(args) {
  if (!Array.isArray(args) || args.length > 80) return false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (typeof a !== 'string' || a.length > 500 || /[\0\r\n]/.test(a)) return false;
    if (a === '-i' || a === '-y' || a === '-n' || a === '-filter_script' || a === '-filter_complex_script' || a === '-protocol_whitelist' || a === '-dump_attachment') return false;
    if (URL_LIKE.test(a) || a.includes('..')) return false;
    if (a === '-f' && !FORMAT_OK.has(args[i + 1])) return false;
    if (['-vf', '-af', '-filter_complex'].includes(a)) { const g = args[i + 1]; if (typeof g !== 'string' || !FILTER_OK.test(g) || FILTER_BAD.test(g)) return false; }
  }
  return true;
}

module.exports = { grant, grantDir, canReadFile, canWriteIn, canTouch, safeRel, isExecutableName, isSafeToOpen, validFfArgs, within, norm };
