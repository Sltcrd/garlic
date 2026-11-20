'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const T = require('../../src/renderer/shared/pdftools');

/** A PDF whose page i is (100 + i*10) points wide, so the order can be checked from the sizes. */
async function sample(n, rotate = []) {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) { const p = d.addPage([300 + i * 10, 400]); if (rotate[i]) p.setRotation({ type: 'degrees', angle: rotate[i] }); }
  return d.save();
}
const widths = async bytes => (await PDFDocument.load(bytes)).getPages().map(p => p.getWidth());
async function textOf(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise, out = [];
  for (let i = 1; i <= doc.numPages; i++) out.push((await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join(' '));
  return out;
}

test('parseRange: ranges, open ends, order and errors', () => {
  assert.deepEqual(T.parseRange('1-3, 5', 10), [0, 1, 2, 4]);
  assert.deepEqual(T.parseRange('8-', 10), [7, 8, 9]);
  assert.deepEqual(T.parseRange('-2', 10), [0, 1]);
  assert.deepEqual(T.parseRange('3,1,3', 10), [2, 0]);
  for (const bad of ['', 'abc', '0', '11', '5-3', '1--2', '2-x']) assert.throws(() => T.parseRange(bad, 10), T.PdfToolError, bad);
});

test('assemble (one file): reorder, delete and rotate keep the other pages', async () => {
  const src = await sample(5);
  const out = await T.assemble([src], [{ s: 0, p: 4 }, { s: 0, p: 0, rot: 90 }, { s: 0, p: 2 }]);
  const doc = await PDFDocument.load(out);
  assert.deepEqual(doc.getPages().map(p => p.getWidth()), [340, 300, 320]);
  assert.deepEqual(doc.getPages().map(p => p.getRotation().angle), [0, 90, 0]);
});

test('assemble: rotation adds to the page\'s own rotation', async () => {
  const src = await sample(2, [90, 0]);
  const doc = await PDFDocument.load(await T.assemble([src], [{ s: 0, p: 0, rot: 270 }, { s: 0, p: 1, rot: 180 }]));
  assert.deepEqual(doc.getPages().map(p => p.getRotation().angle), [0, 180]);
});

test('assemble (several files and repeated pages)', async () => {
  const a = await sample(3), b = await sample(2);
  const out = await T.assemble([a, b], [{ s: 0, p: 0 }, { s: 1, p: 1 }, { s: 0, p: 0 }, { s: 0, p: 2 }]);
  assert.deepEqual(await widths(out), [300, 310, 300, 320]);
});

test('assemble refuses invalid plans', async () => {
  const src = await sample(2);
  for (const plan of [[], [{ s: 0, p: 5 }], [{ s: 1, p: 0 }], [{ s: 0, p: 0, rot: 45 }], [{ s: 0, p: -1 }], 'x'])
    await assert.rejects(T.assemble([src], plan), T.PdfToolError);
});

test('split: one file per page and groups of n', async () => {
  const src = await sample(5);
  const each = await T.split(src, 'each');
  assert.equal(each.length, 5); assert.deepEqual(await widths(each[3].bytes), [330]);
  const by2 = await T.split(src, 'every', 2);
  assert.deepEqual(by2.map(p => [p.from, p.to]), [[1, 2], [3, 4], [5, 5]]);
  assert.deepEqual(await widths(by2[1].bytes), [320, 330]);
  await assert.rejects(T.split(src, 'every', 0), T.PdfToolError);
});

test('damaged input is refused with a readable error', async () => {
  await assert.rejects(T.assemble([new Uint8Array([1, 2, 3, 4])], [{ s: 0, p: 0 }]), /No se pudo leer/);
  await assert.rejects(T.info(new TextEncoder().encode('%PDF-1.4 nothing here')), T.PdfToolError);
});

test('watermark and numbers write the text on the right pages', async () => {
  const src = await sample(3);
  const wm = await T.watermark(src, { text: 'SECRETO', size: 40, opacity: 0.3, angle: 45, color: [1, 0, 0], pages: [0, 2] });
  const t1 = await textOf(wm);
  assert.deepEqual(t1.map(s => s.includes('SECRETO')), [true, false, true]);
  const num = await T.numbers(src, { pos: 'bottom-right', format: 'Página {n} de {total}', start: 1, from: 2 });
  const t2 = await textOf(num);
  assert.deepEqual(t2, ['', 'Página 1 de 2', 'Página 2 de 2']);
});

test('text works on rotated pages too and rejects characters the PDF font cannot encode', async () => {
  const src = await sample(2, [90, 270]);
  const out = await T.numbers(src, { format: '{n}', pos: 'top-left' });
  assert.deepEqual(await textOf(out), ['1', '2']);
  await assert.rejects(T.watermark(src, { text: '日本語' }), /caracteres/);
  await assert.rejects(T.watermark(src, { text: '   ' }), T.PdfToolError);
});

test('document information: read, edit, clear', async () => {
  const src = await sample(1);
  const set = await T.setInfo(src, { title: 'Informe', author: 'Ana', keywords: 'a, b' });
  const i = await T.info(set);
  assert.equal(i.title, 'Informe'); assert.equal(i.author, 'Ana'); assert.equal(i.keywords, 'a b'); assert.equal(i.pages, 1);
  const cleared = await T.info(await T.setInfo(set, { strip: true }));
  assert.equal(cleared.title, ''); assert.equal(cleared.author, ''); assert.equal(cleared.keywords, '');
  const part = await T.info(await T.setInfo(set, { title: '' }));
  assert.equal(part.title, ''); assert.equal(part.author, 'Ana');
});

test('numbers land in the visual corner even when the page is rotated', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  for (const rot of [0, 90, 180, 270]) {
    const out = await T.numbers(await sample(1, [rot]), { format: '{n}', pos: 'top-left' });
    const page = await (await pdfjs.getDocument({ data: new Uint8Array(out), isEvalSupported: false, verbosity: 0 }).promise).getPage(1);
    const vp = page.getViewport({ scale: 1 }), it = (await page.getTextContent()).items[0];
    const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);   // viewport origin is the top-left corner
    assert.ok(x < vp.width / 4 && y < vp.height / 4, 'rotation ' + rot + ' gave ' + Math.round(x) + ',' + Math.round(y) + ' in ' + vp.width + 'x' + vp.height);
  }
});
