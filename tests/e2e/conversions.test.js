'use strict';
/** Real conversions through the wheel's own pipeline: every output is produced and its content checked. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { launch, makePng, tempDir, sleep, waitFor } = require('./lib');
const { makeFixtures } = require('./walk');

let app, dir, fx, wheel, appPage;
test.before(async () => {
  app = await launch(); dir = tempDir(); fx = await makeFixtures(dir);
  fs.writeFileSync(path.join(dir, 'logo.png'), makePng(300, 160, [58, 134, 255]));
  fs.writeFileSync(path.join(dir, 'informe.md'), '# Informe de prueba\n\nTexto con **negrita**.<br>Tras un br.\n\n<div align="center"><b>Bloque div</b></div>\n\n![logo](logo.png)\n\n| Col A | Col B |\n|---|---|\n| 1 | 2 |\n\n- [x] hecho\n');
  appPage = await app.page('app'); wheel = await app.page('wheel');
  await appPage.eval(`cfgSet({ lang: 'en' })`);   // deterministic output names (…_nobg.png, …_cut.mp3)
  await sleep(300);
});
test.after(async () => { if (app) await app.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function open(file) {
  await appPage.eval(`nat.openWheel(${JSON.stringify(file)})`);
  await waitFor(() => wheel.eval(`ST.path === ${JSON.stringify(file)} && !!ST.kind`), { what: 'wheel for ' + path.basename(file) });
  await wheel.eval('ST.ready');
}
/** Runs produce(fmt) in the wheel and returns [{rel, size, head, text?}] */
const produce = (fmt, text = false) => wheel.eval(`(async () => {
  const files = await produce(${JSON.stringify(fmt)});
  return Promise.all(files.map(async f => f.done ? { done: f.done } : ({ rel: f.rel, size: f.blob.size, head: new TextDecoder('latin1').decode(new Uint8Array(await f.blob.slice(0, 8).arrayBuffer())), text: ${text} ? await f.blob.text() : '' })));
})()`);
/** Renders page n of a produced PDF and returns colour counts of interest. */
const pdfProbe = () => wheel.eval(`(async () => {
  const f = (await produce('pdf'))[0], doc = await loadPdf(new Uint8Array(await f.blob.arrayBuffer())), page = await doc.getPage(1);
  const text = (await page.getTextContent()).items.map(i => i.str).join(' ');
  const c = await renderPdfPage(doc, 1), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const near = (r, g, b, tol = 30) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) < tol && Math.abs(d[i + 1] - g) < tol && Math.abs(d[i + 2] - b) < tol) n++; return n; };
  return { pages: doc.numPages, text, w: c.width, h: c.height, blue: near(58, 134, 255), orange: near(255, 106, 61), green: near(46, 204, 113), navy: near(31, 58, 147) };
})()`);

test('Markdown → PDF renders html, tables, images and task lists like a preview', async () => {
  await open(path.join(dir, 'informe.md'));
  const p = await pdfProbe();
  assert.match(p.text, /Informe de prueba/); assert.match(p.text, /Bloque div/); assert.match(p.text, /Col A/); assert.match(p.text, /Tras un br/);
  assert.ok(p.blue > 5000, 'the local image is drawn in the PDF (blue pixels: ' + p.blue + ')');
});

test('Markdown → DOCX / HTML / EPUB / TXT', async () => {
  const docx = (await produce('docx'))[0]; assert.equal(docx.head.slice(0, 2), 'PK'); assert.ok(docx.size > 1500);
  const html = (await produce('html', true))[0]; assert.match(html.text, /<h1>Informe de prueba<\/h1>/); assert.match(html.text, /data:image\/png;base64,/, 'images are inlined');
  const epub = (await produce('epub'))[0]; assert.equal(epub.head.slice(0, 2), 'PK');
  const txt = (await produce('txt', true))[0]; assert.match(txt.text, /Informe de prueba/); assert.doesNotMatch(txt.text, /\*\*/);
});

test('PPTX → PDF keeps backgrounds, shapes, colours and pictures', async () => {
  const PptxGenJS = require('pptxgenjs'), p = new PptxGenJS();
  const s = p.addSlide(); s.background = { color: '1F3A93' };
  s.addText('Presentación a color', { x: .5, y: .4, w: 9, h: 1, fontSize: 36, bold: true, color: 'FFFFFF' });
  s.addShape(p.ShapeType.rect, { x: .5, y: 1.8, w: 4, h: 2, fill: { color: 'FF6A3D' } });
  s.addShape(p.ShapeType.ellipse, { x: 5.5, y: 1.8, w: 3, h: 2, fill: { color: '2ECC71' } });
  s.addImage({ path: path.join(dir, 'logo.png'), x: 1, y: 4.2, w: 2, h: 1 });
  const file = path.join(dir, 'pres.pptx'); await p.writeFile({ fileName: file });
  await open(file);
  const r = await pdfProbe();
  assert.equal(r.pages, 1); assert.match(r.text, /Presentación a color/);
  assert.ok(r.navy > 20000 && r.orange > 3000 && r.green > 2000 && r.blue > 500, JSON.stringify(r));
  const png = (await produce('png'))[0]; assert.match(png.rel, /_png\.zip$/);
});

test('spreadsheets, subtitles and archives', async () => {
  await open(fx.csv);
  const json = (await produce('json', true))[0]; assert.deepEqual(JSON.parse(json.text), [{ a: 1, b: 2 }]);
  assert.equal((await produce('xlsx'))[0].head.slice(0, 2), 'PK'); assert.ok((await produce('ods'))[0].size > 1000);
  await open(fx.srt);
  const vtt = (await produce('vtt', true))[0]; assert.match(vtt.text, /^WEBVTT/); assert.match(vtt.text, /00:00:01\.000 --> 00:00:02\.000/);
  await open(fx.zip);
  const ex = await produce('extract', true); assert.equal(ex[0].rel, 'paquete_extracted/a.txt'); assert.equal(ex[0].text, 'x');
  assert.ok((await produce('tar'))[0].size >= 1024); assert.equal((await produce('tgz'))[0].head.charCodeAt(0), 0x1f);
});

test('folders are packed to ZIP, TAR and TGZ on disk', async () => {
  await open(fx.folder);
  for (const [fmt, name] of [['zip', 'carpeta.zip'], ['tar', 'carpeta.tar'], ['tgz', 'carpeta.tar.gz']]) {
    const r = (await produce(fmt))[0]; assert.equal(path.basename(r.done), name);
    const buf = fs.readFileSync(r.done);
    if (fmt === 'zip') { const JSZip = require('jszip'); assert.ok(Object.keys((await JSZip.loadAsync(buf)).files).includes('carpeta/a.txt')); }
    else { const tar = fmt === 'tgz' ? zlib.gunzipSync(buf) : buf; assert.match(tar.toString('latin1', 0, 512), /carpeta\/a\.txt/); }
  }
});

test('audio and video through ffmpeg, with real progress', async () => {
  await open(fx.mp3);
  const wav = (await produce('wav'))[0]; assert.match(wav.done, /tono\.wav$/); assert.ok(fs.statSync(wav.done).size > 20000);
  await open(fx.mp4);
  const gif = (await produce('gif'))[0]; assert.equal(fs.readFileSync(gif.done).subarray(0, 3).toString(), 'GIF');
  const mp3 = (await produce('mp3'))[0]; assert.ok(fs.statSync(mp3.done).size > 5000);
  const info = JSON.parse(await appPage.eval(`nat.ffProbe(${JSON.stringify(fx.mp4)}).then(JSON.stringify)`)); assert.ok(info.hasVideo && info.hasAudio && info.width === 160);
});

test('editor tools write their results next to the original', async () => {
  const run = async (kind, tool, setup = '') => {
    await open(fx[kind]);
    await wheel.eval(`nat.openEditor({ path: ${JSON.stringify(fx[kind])}, tool: '${tool}' })`);
    const ed = await app.page('editor');
    await waitFor(() => ed.eval(`typeof P !== 'undefined' && P === MODES['${tool}']`), { what: tool });
    await sleep(700); if (setup) await ed.eval(setup);
    await ed.eval(`P.save()`);
  };
  await run('png', 'erase', `MODES.erase.auto()`);
  await waitFor(() => fs.existsSync(path.join(dir, 'imagen_nobg.png')), { what: 'transparent PNG' });
  assert.equal(fs.readFileSync(path.join(dir, 'imagen_nobg.png'))[25], 6, 'RGBA PNG (transparency)');
  await run('png', 'compress'); await waitFor(() => fs.existsSync(path.join(dir, 'imagen_compressed.jpg')) || fs.existsSync(path.join(dir, 'imagen_compressed.png')), { what: 'compressed image' });
  await run('mp3', 'a_trim', `MODES.a_trim.T = { s: 0.5, e: 1.5 }`);
  await waitFor(() => fs.existsSync(path.join(dir, 'tono_cut.mp3')), { what: 'trimmed audio', timeout: 40000 });
  await open(path.join(dir, 'tono_cut.mp3'));   // probing is only allowed for files the user chose
  const info = JSON.parse(await appPage.eval(`nat.ffProbe(${JSON.stringify(path.join(dir, 'tono_cut.mp3'))}).then(JSON.stringify)`)); assert.ok(Math.abs(info.duration - 1) < 0.3, 'duration ' + info.duration);
  await run('mp4', 'v_split', `MODES.v_split.s = 1`);
  await waitFor(() => fs.existsSync(path.join(dir, 'clip_parts')) && fs.readdirSync(path.join(dir, 'clip_parts')).length >= 1, { what: 'split parts', timeout: 40000 });
});

test('Markdown → PDF never splits a tall image across two pages', async () => {
  fs.writeFileSync(path.join(dir, 'alta.png'), makePng(400, 2400, [58, 134, 255]));
  fs.writeFileSync(path.join(dir, 'alta.md'), '# Imagen alta\n\nTexto previo.\n\n![alta](alta.png)\n\nTexto final.\n');
  await open(path.join(dir, 'alta.md'));
  const r = await wheel.eval(`(async () => {
    const f = (await produce('pdf'))[0], doc = await loadPdf(new Uint8Array(await f.blob.arrayBuffer())), out = [];
    for (let i = 1; i <= doc.numPages; i++) { const c = await renderPdfPage(doc, i), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - 58) < 30 && Math.abs(d[k + 1] - 134) < 30 && Math.abs(d[k + 2] - 255) < 30) n++; out.push(n); }
    return out;
  })()`);
  assert.equal(r.filter(n => n > 500).length, 1, 'the image is drawn on exactly one page: ' + JSON.stringify(r));
});

test('Markdown → PDF keeps the size an author chose with width="…" and never enlarges small images', async () => {
  fs.writeFileSync(path.join(dir, 'ancho.md'), '# Tamaños\n\n<img src="logo.png" width="60">\n');
  fs.writeFileSync(path.join(dir, 'natural.md'), '# Tamaños\n\n![logo](logo.png)\n');
  await open(path.join(dir, 'ancho.md')); const small = await pdfProbe();
  await open(path.join(dir, 'natural.md')); const natural = await pdfProbe();
  assert.ok(small.blue > 50 && small.blue < natural.blue / 3, `width="60" is honoured (blue pixels: ${small.blue} vs ${natural.blue} at natural size)`);
});
