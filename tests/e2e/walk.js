'use strict';
/** Shared by the i18n harvester and the language test: builds sample files and visits every screen/state of Garlic. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { makePng, sleep, waitFor } = require('./lib');

async function makeFixtures(dir) {
  const ffmpeg = require('ffmpeg-static'), JSZip = require('jszip'), { jsPDF } = require('jspdf');
  const w = (n, d) => { const p = path.join(dir, n); fs.writeFileSync(p, d); return p; };
  const f = {};
  f.png = w('imagen.png', makePng(160, 100, [58, 134, 255], [255, 255, 255]));
  const pdf = new jsPDF(); pdf.text('Hola', 20, 20); f.pdf = w('doc.pdf', Buffer.from(pdf.output('arraybuffer')));
  f.md = w('nota.md', '# Titulo\n\nTexto\n'); f.txt = w('nota.txt', 'hola'); f.html = w('pagina.html', '<h1>x</h1>'); f.csv = w('datos.csv', 'a,b\n1,2\n');
  f.srt = w('sub.srt', '1\n00:00:01,000 --> 00:00:02,000\nhola\n'); f.bin = w('raro.bin', Buffer.from([1, 2, 3]));
  fs.mkdirSync(path.join(dir, 'carpeta')); fs.writeFileSync(path.join(dir, 'carpeta', 'a.txt'), 'a'); f.folder = path.join(dir, 'carpeta');
  const ff = (name, args) => { spawnSync(ffmpeg, ['-y', '-loglevel', 'error', ...args, path.join(dir, name)]); return path.join(dir, name); };
  f.mp3 = ff('tono.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', '-c:a', 'libmp3lame']);
  f.mp4 = ff('clip.mp4', ['-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
  const z = new JSZip(); z.file('a.txt', 'x'); f.zip = w('paquete.zip', await z.generateAsync({ type: 'nodebuffer' }));
  return f;
}

/** Script run inside a page: returns every visible string (text nodes + title/placeholder/aria-label/alt). */
const TEXT_JS = `(() => {
  const out = new Set(), skip = new Set(['SCRIPT', 'STYLE', 'CODE']);
  const add = s => { s = (s || '').replace(/\\s+/g, ' ').trim(); if (s && /[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(s)) out.add(s); };
  (function walk(n) {
    if (n.nodeType === 3) { if (!skip.has(n.parentNode.tagName)) add(n.nodeValue); return; }
    if (n.nodeType !== 1 || skip.has(n.tagName)) return;
    for (const a of ['title', 'placeholder', 'aria-label', 'alt']) if (n.hasAttribute(a)) add(n.getAttribute(a));
    n.childNodes.forEach(walk);
  })(document.body);
  return [...out];
})()`;

const TOOLS = {
  png: ['crop', 'bg', 'erase', 'compress', 'metadata', 'edit', 'redact', 'annotate'],
  mp3: ['a_compress', 'a_metadata', 'a_channels', 'a_normalize', 'a_trim', 'a_visualize'],
  mp4: ['v_compress', 'v_metadata', 'v_mute', 'v_trim', 'v_crop', 'v_speed', 'v_snapshot', 'v_split']
};

/** Visits every page, wheel mode, ring chip, editor tool and job card; calls `grab(page)` on each state. */
async function walkUI(app, fx, grab) {
  const appPage = await app.page('app'), wheel = await app.page('wheel');
  for (const p of ['home', 'trigger', 'formats', 'look', 'sound', 'system']) { await appPage.eval(`go('${p}')`); await sleep(150); await grab(appPage); }
  await appPage.eval(`go('home')`);

  for (const kind of ['png', 'pdf', 'md', 'txt', 'html', 'csv', 'srt', 'bin', 'folder', 'mp3', 'mp4', 'zip']) {
    await appPage.eval(`nat.openWheel(${JSON.stringify(fx[kind])})`);
    await waitFor(() => wheel.eval(`ST.path === ${JSON.stringify(fx[kind])} && !!ST.kind`), { what: 'wheel ' + kind });
    await wheel.eval('ST.ready'); await sleep(150);
    for (let m = 0; m < 3; m++) {
      await grab(wheel);
      const acts = JSON.parse(await wheel.eval(`JSON.stringify([...document.querySelectorAll('[data-act]')].map(g => g.dataset.act))`));
      for (const a of acts) { await wheel.eval(`document.querySelector('[data-act="${a}"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`); await grab(wheel); }
      await wheel.eval('stepMode(1)'); await sleep(80);
    }
  }
  for (const [kind, list] of Object.entries(TOOLS)) for (const tool of list) {
    await appPage.eval(`nat.openWheel(${JSON.stringify(fx[kind])})`); await sleep(400);
    await wheel.eval(`nat.openEditor({ path: ${JSON.stringify(fx[kind])}, tool: '${tool}' })`);
    const ed = await app.page('editor');
    await waitFor(() => ed.eval(`typeof P !== 'undefined' && !!P && P === MODES['${tool}']`), { what: 'tool ' + tool, timeout: 15000 });
    await sleep(900); await grab(ed);
  }
  await wheel.eval(`(async () => {
    const a = await nat.jobStart({ title: 'x.png → WEBP', name: 'x' }); nat.jobProgress({ id: a, p: .4, label: 'Leyendo archivo…' });
    const b = await nat.jobStart({ title: 'y', name: 'y' }); nat.jobError({ id: b, msg: 'Error' });
    nat.jobQuick({ title: 'Guardado', name: 'z', out: ${JSON.stringify(fx.png)} });
  })()`);
  const jobs = await app.page('jobs'); await sleep(900); await grab(jobs);
}

module.exports = { makeFixtures, walkUI, TEXT_JS };
