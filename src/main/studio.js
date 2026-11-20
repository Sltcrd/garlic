'use strict';
/**
 * Video studio export. The editor sends a project made of numbers, file paths the user picked and PNG overlays;
 * everything is validated here and turned into an ffmpeg command by studio-graph.js. No option or filter text
 * from the renderer ever reaches ffmpeg.
 */
const { ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const security = require('./security');
const jobs = require('./jobs');
const media = require('./media');
const graph = require('./studio-graph');
const { t } = require('./i18n');

const MAX_CLIPS = 60, MAX_TEXTS = 40, MAX_PNG = 25 * 1024 * 1024, MAX_SECONDS = 6 * 3600;
const CRF = { Alta: 19, Media: 23, Baja: 28 };
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47];
const isNum = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const even = (v, a, b) => Number.isInteger(v) && v >= a && v <= b && v % 2 === 0;
const fail = msg => { const e = new Error(msg); e.invalid = true; throw e; };
const readable = p => typeof p === 'string' && p.length < 1000 && security.canReadFile(p) && security.validFfArgs([p]) && fs.existsSync(p);

/** Checks the whole project; returns a clean copy (only the fields used). Throws on anything unexpected. */
function validate(o) {
  if (!o || typeof o !== 'object') fail('Invalid project');
  if (!Array.isArray(o.clips) || !o.clips.length || o.clips.length > MAX_CLIPS) fail('Invalid clips');
  const clips = o.clips.map(c => {
    if (!c || !readable(c.src) || !isNum(c.in, 0, MAX_SECONDS) || !isNum(c.out, 0, MAX_SECONDS) || c.out - c.in < 0.05 || !isNum(c.speed, 0.25, 4) || !isNum(c.vol, 0, 2)) fail('Invalid clip');
    return { src: c.src, in: c.in, out: c.out, speed: c.speed, vol: c.vol };
  });
  if (!even(o.w, 240, 3840) || !even(o.h, 240, 3840)) fail('Invalid size');
  const texts = (Array.isArray(o.texts) ? o.texts : []).map(x => {
    if (!x || !isNum(x.start, 0, MAX_SECONDS) || !isNum(x.end, 0, MAX_SECONDS) || x.end <= x.start || !(x.png instanceof Uint8Array) || x.png.length < 8 || x.png.length > MAX_PNG || PNG_MAGIC.some((b, i) => x.png[i] !== b)) fail('Invalid text');
    return { start: x.start, end: x.end, png: x.png };
  });
  if (texts.length > MAX_TEXTS) fail('Too many texts');
  let music = null;
  if (o.music) { if (!readable(o.music.src) || !isNum(o.music.vol, 0, 2)) fail('Invalid music'); music = { src: o.music.src, vol: o.music.vol }; }
  if (!readable(o.anchor)) fail('Invalid file');
  if (!security.safeRel(o.outName) || /[\\/]/.test(o.outName)) fail('Invalid file name');
  return { clips, texts, music, w: o.w, h: o.h, fit: o.fit === 'cover' ? 'cover' : 'contain', crf: CRF[o.quality] || CRF.Media, outName: o.outName, anchor: o.anchor, jobId: Number.isInteger(o.jobId) ? o.jobId : 0 };
}

async function exportProject(raw) {
  let p; try { p = validate(raw); } catch (e) { return { ok: false, err: e.invalid ? e.message : String(e.message) }; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'garlic-studio-'));
  try {
    for (const c of p.clips) {
      const info = await media.probe(c.src);
      if (!info.hasVideo || !info.duration) return { ok: false, err: t('Uno de los clips no es un vídeo que Garlic pueda leer.') };
      c.hasAudio = info.hasAudio; c.out = Math.min(c.out, info.duration); if (c.out - c.in < 0.05) return { ok: false, err: t('Un clip quedó fuera de la duración del vídeo.') };
    }
    if (p.music && !(await media.probe(p.music.src)).hasAudio) return { ok: false, err: t('El archivo de música no tiene audio.') };
    const fps = 30, { script, total } = graph.build({ clips: p.clips, w: p.w, h: p.h, fps, fit: p.fit, texts: p.texts, music: p.music });
    if (total > MAX_SECONDS) return { ok: false, err: t('El vídeo final es demasiado largo.') };
    const scriptFile = path.join(tmp, 'graph.txt'); fs.writeFileSync(scriptFile, script);
    const args = [];
    for (const c of p.clips) args.push('-ss', String(c.in), '-t', String(c.out - c.in), '-i', c.src);
    p.texts.forEach((x, k) => { const f = path.join(tmp, `t${k}.png`); fs.writeFileSync(f, x.png); args.push('-loop', '1', '-framerate', String(fps), '-i', f); });
    if (p.music) args.push('-stream_loop', '-1', '-i', p.music.src);

    const dir = path.dirname(p.anchor);
    if (!security.canWriteIn(dir)) return { ok: false, err: 'Access denied' };
    const out = media.uniquePath(dir, p.outName, '.mp4');
    let child = null, cancelled = false;
    if (p.jobId) {
      jobs.setCancel(p.jobId, () => { cancelled = true; try { child && child.kill(); } catch { /* ended */ } });
      jobs.progress(p.jobId, 0, t('Procesando…'));
    }
    const onLine = p.jobId ? text => {
      const m = [...text.matchAll(/out_time_(?:us|ms)=(\d+)/g)].pop();
      if (m) { const s = (+m[1]) / 1e6; jobs.progress(p.jobId, Math.min(0.99, s / total), t('{a} de {b}', { a: media.mmss(s), b: media.mmss(total) })); }
    } : null;
    const r = await media.run(['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', '-progress', 'pipe:1', '-nostats', ...args,
      '-filter_complex_script', scriptFile, '-map', '[vout]', '-map', '[aout]', '-t', String(total),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(p.crf), '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out],
    { onLine, onChild: c => { child = c; } });
    if (cancelled) { try { fs.unlinkSync(out); } catch { /* nothing written */ } return { ok: false, err: t('Cancelado'), cancelled: true }; }
    if (!r.ok) { try { fs.unlinkSync(out); } catch { /* nothing written */ } return { ok: false, err: (r.err || '').trim().split('\n').slice(-3).join(' ') || t('ffmpeg falló.') }; }
    return { ok: true, out, seconds: total };
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp folder */ } }
}

ipcMain.handle('studio:export', (_e, o) => exportProject(o));

module.exports = { validate, exportProject };
