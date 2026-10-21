'use strict';
/**
 * HTML → PDF with Chromium (used for Markdown, HTML, DOCX and PPTX → PDF) and local-image inlining.
 *
 * The page is rendered in a throw-away window with JavaScript disabled, sandboxed, and in its own session
 * that blocks every network request and every file outside the document's folder. A converted document
 * therefore can neither phone home nor pull unrelated local files into the PDF.
 */
const { BrowserWindow, ipcMain, session } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');
const security = require('./security');

let counter = 0;

ipcMain.handle('html:pdf', async (_e, o) => {
  const html = o && o.html, baseDir = o && o.baseDir;
  if (typeof html !== 'string' || html.length > 80e6) throw new Error('Invalid document');
  if (typeof baseDir !== 'string' || !security.canWriteIn(baseDir)) throw new Error('Access denied');

  const tmp = path.join(os.tmpdir(), `garlic_${process.pid}_${Date.now()}_${counter++}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const partition = `garlic-render-${process.pid}-${counter}`, ses = session.fromPartition(partition);
  ses.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  ses.webRequest.onBeforeRequest((d, cb) => {
    try {
      if (d.url.startsWith('data:') || d.url.startsWith('blob:')) return cb({});
      if (d.url.startsWith('file:')) { const p = path.resolve(fileURLToPath(d.url)); return cb({ cancel: !(p === path.resolve(tmp) || security.within(p, path.resolve(baseDir))) }); }
    } catch { /* malformed URL: block */ }
    cb({ cancel: true });
  });
  const win = new BrowserWindow({ show: false, width: 1000, height: 1400, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, session: ses } });
  try {
    await win.loadFile(tmp);
    return await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, landscape: !!(o && o.landscape), pageSize: 'A4' });
  } finally { win.destroy(); fs.unlink(tmp, () => { }); }
});

/** Replaces <img src="relative/path"> by data: URIs so the resulting HTML is self-contained. */
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };
ipcMain.handle('html:inline', (_e, o) => {
  const html = o && o.html, baseDir = o && o.baseDir;
  if (typeof html !== 'string' || typeof baseDir !== 'string' || !security.canWriteIn(baseDir)) throw new Error('Access denied');
  const root = path.resolve(baseDir);
  return html.replace(/(<img\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi, (m, a, q, src) => {
    if (/^(https?:|data:|file:)/i.test(src)) return m;
    try {
      const p = path.resolve(root, decodeURIComponent(src)), mime = MIME[path.extname(p).toLowerCase()];
      if (!mime || !security.within(p, root) || !fs.existsSync(p) || fs.statSync(p).size > 25e6) return m;
      return `${a}${q}data:${mime};base64,${fs.readFileSync(p).toString('base64')}${q}`;
    } catch { return m; }
  });
});
