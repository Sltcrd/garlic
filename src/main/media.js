'use strict';
/** Audio/video through the bundled ffmpeg binary, with real progress (parsed from `-progress pipe:1`). */
const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const security = require('./security');
const jobs = require('./jobs');
const { t } = require('./i18n');

function ffmpegPath() {
  try { return require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked'); } catch { return null; }
}
const uniquePath = (dir, base, ext) => { let p = path.join(dir, base + ext), i = 1; while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`); return p; };
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function run(args, { collect = false, onLine, onChild } = {}) {
  return new Promise(resolve => {
    const bin = ffmpegPath();
    if (!bin || !fs.existsSync(bin)) return resolve({ ok: false, err: t('No se encontró ffmpeg dentro de la aplicación.') });
    let err = '', child;
    try { child = spawn(bin, args, { windowsHide: true }); } catch (e) { return resolve({ ok: false, err: t('El sistema bloqueó ffmpeg: {msg}', { msg: e.message }) }); }
    if (onChild) onChild(child);
    if (onLine) child.stdout.on('data', d => onLine(String(d)));
    child.stderr.on('data', d => { err += d; if (err.length > 60000) err = err.slice(-30000); });
    child.on('error', e => resolve({ ok: false, err: t('No se pudo iniciar ffmpeg (¿bloqueado por el sistema?): {msg}', { msg: e.message }) }));
    child.on('close', code => resolve({ ok: code === 0 || collect, code, err }));
  });
}

async function probe(input) {
  const r = await run(['-hide_banner', '-i', input], { collect: true }), text = r.err || '';
  const d = text.match(/Duration:\s*(\d+):(\d+):([\d.]+)/), v = text.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  const tags = (text.match(/Metadata:[\s\S]*?(?=\n\s*(Duration|Stream|Chapter)|$)/) || [''])[0].split('\n').slice(1).map(s => s.trim()).filter(Boolean).slice(0, 12);
  return {
    duration: d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0,
    hasVideo: /Stream #.*Video:/.test(text) && !/Video: (mjpeg|png)[^\n]*\(attached pic\)/.test(text),
    hasAudio: /Stream #.*Audio:/.test(text), width: v ? +v[1] : 0, height: v ? +v[2] : 0, tags
  };
}

/** Length of the processed range when the arguments contain -ss / -to (used to compute the percentage). */
function rangeLength(args) {
  const get = k => { const i = args.indexOf(k); return i >= 0 ? parseFloat(args[i + 1]) : null; };
  const ss = get('-ss'), to = get('-to');
  return to != null ? to - (ss || 0) : null;
}

ipcMain.handle('ff:probe', (_e, input) => {
  if (!security.canReadFile(input)) throw new Error('Access denied');
  return probe(input);
});

ipcMain.handle('ff:run', async (_e, o) => {
  const { input, outRel, pre = [], post = [], speed } = o || {}, jobId = Number.isInteger(o && o.jobId) ? o.jobId : 0;
  if (!security.canReadFile(input)) return { ok: false, err: 'Access denied' };
  if (!security.safeRel(outRel) || (outRel.includes('%') && !/^[^%]*%0?\d*d[^%]*$/.test(outRel))) return { ok: false, err: 'Invalid output name' };
  if (!security.validFfArgs(pre) || !security.validFfArgs(post)) return { ok: false, err: 'Invalid ffmpeg options' };
  if (!fs.existsSync(input)) return { ok: false, err: t('El archivo ya no existe.') };

  const dir = path.dirname(input), pattern = outRel.includes('%');
  let out;
  if (pattern) { out = path.join(dir, outRel); fs.mkdirSync(path.dirname(out), { recursive: true }); }
  else { const ext = path.extname(outRel); out = uniquePath(dir, outRel.slice(0, outRel.length - ext.length), ext); }

  let dur = 0, child = null, cancelled = false;
  if (jobId) {
    dur = rangeLength([...pre, ...post]) || (await probe(input)).duration;
    if (typeof speed === 'number' && speed >= 0.1 && speed <= 20) dur /= speed;   // the output is shorter/longer than the input (speed change)
    jobs.setCancel(jobId, () => { cancelled = true; try { child && child.kill(); } catch { /* ended */ } });
    jobs.progress(jobId, dur ? 0 : null, t('Procesando…'));
  }
  const onLine = jobId ? text => {
    const m = [...text.matchAll(/out_time_(?:us|ms)=(\d+)/g)].pop();
    if (m && dur) { const s = (+m[1]) / 1e6; jobs.progress(jobId, Math.min(0.99, s / dur), t('{a} de {b}', { a: mmss(s), b: mmss(dur) })); }
  } : null;

  const r = await run(['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', ...(jobId ? ['-progress', 'pipe:1', '-nostats'] : []), ...pre, '-i', input, ...post, out], { onLine, onChild: c => { child = c; } });
  if (cancelled) { try { if (!pattern) fs.unlinkSync(out); } catch { /* nothing written */ } return { ok: false, err: t('Cancelado'), cancelled: true }; }
  if (!r.ok) { try { if (!pattern) fs.unlinkSync(out); } catch { /* nothing written */ } return { ok: false, err: (r.err || '').trim().split('\n').slice(-3).join(' ') || t('ffmpeg falló.') }; }
  return { ok: true, out: pattern ? path.dirname(out) : out };
});
