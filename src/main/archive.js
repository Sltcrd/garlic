'use strict';
/** Pack a whole folder into ZIP / TAR / TAR.GZ on disk (streamed, so large folders do not fill the memory). */
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const security = require('./security');
const jobs = require('./jobs');
const { t } = require('./i18n');

const uniquePath = (dir, base, ext) => { let p = path.join(dir, base + ext), i = 1; while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`); return p; };

function walk(root, cb, rel = '') {
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;                       // never follow links out of the folder
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { cb(r, true); walk(root, cb, r); } else if (e.isFile()) cb(r, false);
  }
}
const octal = (n, l) => n.toString(8).padStart(l - 1, '0') + '\0';

function tarHeader(name, size, mtime, isDir) {
  const h = Buffer.alloc(512), enc = s => Buffer.from(s, 'utf8');
  let nm = name, prefix = '';
  if (enc(nm).length > 100) { const i = nm.lastIndexOf('/', 155); if (i > 0) { prefix = nm.slice(0, i); nm = nm.slice(i + 1); } }
  enc(nm).copy(h, 0, 0, 100); enc('0000644\0').copy(h, 100); enc('0000000\0').copy(h, 108); enc('0000000\0').copy(h, 116);
  enc(octal(isDir ? 0 : size, 12)).copy(h, 124); enc(octal(Math.floor(mtime / 1000), 12)).copy(h, 136); h.fill(32, 148, 156); h[156] = isDir ? 53 : 48;
  enc('ustar\0').copy(h, 257); enc('00').copy(h, 263); enc(prefix).copy(h, 345, 0, 155);
  let sum = 0; for (const b of h) sum += b;
  enc(sum.toString(8).padStart(6, '0') + '\0 ').copy(h, 148);
  return h;
}
const write = (ws, buf) => new Promise((res, rej) => { ws.once('error', rej); if (ws.write(buf)) res(); else ws.once('drain', res); });

async function writeTar(root, base, ws, onProgress) {
  const items = []; walk(root, (rel, isDir) => items.push({ rel, isDir }));
  const total = items.reduce((s, it) => s + (it.isDir ? 0 : fs.statSync(path.join(root, it.rel)).size), 0) || 1; let doneBytes = 0;
  for (const it of items) {
    const abs = path.join(root, it.rel), st = fs.statSync(abs);
    await write(ws, tarHeader(base + '/' + it.rel + (it.isDir ? '/' : ''), st.size, st.mtimeMs, it.isDir));
    if (!it.isDir) {
      for await (const chunk of fs.createReadStream(abs)) { await write(ws, chunk); doneBytes += chunk.length; if (onProgress) onProgress(doneBytes / total, it.rel); }
      const pad = (512 - st.size % 512) % 512; if (pad) await write(ws, Buffer.alloc(pad));
    }
  }
  await write(ws, Buffer.alloc(1024));
  await new Promise(r => ws.end(r));
}

ipcMain.handle('dir:pack', async (_e, o) => {
  const dir = o && o.dir, fmt = o && o.fmt, jobId = Number.isInteger(o && o.jobId) ? o.jobId : 0;
  if (!['zip', 'tar', 'tgz'].includes(fmt) || typeof dir !== 'string' || !security.canTouch(dir)) return { ok: false, err: 'Access denied' };
  let isDir = false; try { isDir = fs.statSync(dir).isDirectory(); } catch { /* handled below */ }
  if (!isDir) return { ok: false, err: t('La carpeta ya no existe.') };

  const name = path.basename(dir), ext = fmt === 'tgz' ? '.tar.gz' : '.' + fmt, out = uniquePath(path.dirname(dir), name, ext);
  const onProgress = jobId ? (p, f) => jobs.progress(jobId, Math.min(0.99, p), f ? t('Empaquetando {f}', { f }) : t('Empaquetando…')) : null;
  try {
    if (fmt === 'zip') {
      const JSZip = require('jszip'), z = new JSZip();
      walk(dir, (rel, isD) => { if (isD) z.folder(name + '/' + rel); else z.file(name + '/' + rel, fs.createReadStream(path.join(dir, rel))); });
      if (!fs.readdirSync(dir).length) z.folder(name);
      await new Promise((res, rej) => z.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' }, m => { if (onProgress) onProgress(m.percent / 100, m.currentFile); })
        .pipe(fs.createWriteStream(out)).on('finish', res).on('error', rej));
    } else {
      const file = fs.createWriteStream(out);
      if (fmt === 'tgz') { const gz = zlib.createGzip(); gz.pipe(file); const closed = new Promise(r => file.on('finish', r)); await writeTar(dir, name, gz, onProgress); await closed; }
      else await writeTar(dir, name, file, onProgress);
    }
    return { ok: true, out };
  } catch (e) { try { fs.unlinkSync(out); } catch { /* not created */ } return { ok: false, err: String(e.message || e) }; }
});
