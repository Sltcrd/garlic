'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { launch, tempDir, waitFor } = require('./lib');

let app, dir, A, B;
const pdf = async n => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([300 + i * 10, 400]); return Buffer.from(await d.save()); };
const open = async file => PDFDocument.load(fs.readFileSync(path.join(dir, file)));

test.before(async () => {
  dir = tempDir('garlic-pdf-'); A = path.join(dir, 'a.pdf'); B = path.join(dir, 'b.pdf');
  fs.writeFileSync(A, await pdf(4)); fs.writeFileSync(B, await pdf(2));
  app = await launch({ env: { GARLIC_TEST_PICK: B } });          // the "Add PDF…" dialog answers with b.pdf
  await (await app.page('app')).eval(`cfgSet({ lang: 'es' })`);    // output names follow the UI language (…_organizado.pdf); the CI machine is English
  const wheel = await app.page('wheel');
  await wheel.eval(`nat.openWheel(${JSON.stringify(A)})`);         // opening the wheel is what grants access to the file
  await wheel.eval(`nat.openWheel(${JSON.stringify(B)})`);
});
test.after(async () => { if (app) await app.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

/** Opens a PDF tool in the editor window and waits until the PDF is loaded and the tool is ready. */
async function tool(name) {
  const wheel = await app.page('wheel');
  await wheel.eval(`nat.openEditor({ path: ${JSON.stringify(A)}, tool: '${name}' })`);
  const ed = await app.page('editor');
  await waitFor(() => ed.eval(`!!P && P === MODES.${name} && ST.pages === 4 && !!ST.img && ($('#ptitle').textContent.length > 0)`), { what: name + ' ready' });
  return ed;
}
/** Presses the apply button; the editor window closes when the file is saved. */
async function apply(ed) {
  await ed.eval(`document.querySelector('#papply').click()`);
  const main = await app.page('app');
  await waitFor(async () => JSON.parse(await main.eval('nat.testState().then(JSON.stringify)')).editor === false, { what: 'editor closed after saving', timeout: 20000 });
}

test('organize: rotate, delete and reorder pages with the page grid', async () => {
  const ed = await tool('p_pages');
  await waitFor(() => ed.eval(`document.querySelectorAll('#pgrid .pgc').length === 4`), { what: 'four page cards' });
  const click = p => ed.eval(`document.querySelector('#pgrid .pgc[data-p="${p}"]').click()`);
  await click(0); await ed.eval(`document.querySelector('#pgt button[data-a="cw"]').click()`); await click(0);   // rotate page 1, then unselect it
  await click(1); await ed.eval(`document.querySelector('#pgt button[data-a="del"]').click()`);                   // delete page 2
  await waitFor(() => ed.eval(`document.querySelectorAll('#pgrid .pgc').length === 3`), { what: 'three cards' });
  await click(3); await ed.eval(`document.querySelector('#pgt button[data-a="left"]').click()`);                  // page 4 moves before page 3
  await apply(ed);
  const out = await open('a_organizado.pdf');
  assert.deepEqual(out.getPages().map(p => p.getWidth()), [300, 330, 320]);
  assert.deepEqual(out.getPages().map(p => p.getRotation().angle), [90, 0, 0]);
  assert.equal(fs.existsSync(path.join(dir, 'a.pdf')), true, 'the original stays untouched');
  assert.equal((await open('a.pdf')).getPageCount(), 4);
});

test('merge: adds another PDF with the dialog and joins them in list order', async () => {
  const ed = await tool('p_merge');
  await ed.eval(`document.querySelector('#mgadd').click()`);
  await waitFor(() => ed.eval(`MG.files.length === 2`), { what: 'second file in the list' });
  await apply(ed);
  const out = await open('a_unido.pdf');
  assert.deepEqual(out.getPages().map(p => p.getWidth()), [300, 310, 320, 330, 300, 310]);
});

test('split: extract a page range, and one file per page into a folder', async () => {
  let ed = await tool('p_split');
  await ed.eval(`document.querySelector('#spr').value = '2-3'`);
  await apply(ed);
  assert.deepEqual((await open('a_paginas.pdf')).getPages().map(p => p.getWidth()), [310, 320]);
  ed = await tool('p_split');
  await ed.eval(`document.querySelector('#spm button:nth-child(2)').click()`);
  await apply(ed);
  const parts = fs.readdirSync(path.join(dir, 'a_partes')).sort();
  assert.deepEqual(parts, ['a_001.pdf', 'a_002.pdf', 'a_003.pdf', 'a_004.pdf']);
});

test('watermark, page numbers and document info write valid PDFs', async () => {
  let ed = await tool('p_mark');
  await ed.eval(`document.querySelector('#wt').value = 'BORRADOR'; document.querySelector('#wt').dispatchEvent(new Event('input'))`);
  await apply(ed);
  assert.equal((await open('a_marca.pdf')).getPageCount(), 4);
  ed = await tool('p_numbers');
  await apply(ed);
  assert.equal((await open('a_numerado.pdf')).getPageCount(), 4);
  ed = await tool('p_meta');
  await ed.eval(`document.querySelector('#mt').value = 'Informe de prueba'`);
  await apply(ed);
  assert.equal((await open('a_editado.pdf')).getTitle(), 'Informe de prueba');
});

test('the wheel offers the PDF tools instead of the image tools for a PDF', async () => {
  const wheel = await app.page('wheel');
  await wheel.eval(`nat.openWheel(${JSON.stringify(A)})`);
  await waitFor(() => wheel.eval(`ST.kind === 'pdf' && ST.path.endsWith('a.pdf')`), { what: 'wheel for a.pdf' });
  assert.deepEqual(await wheel.eval(`(ST.mode = 'edit', editRing())`), ['p_pages', 'p_merge', 'p_split', 'p_mark', 'p_numbers', 'p_meta']);
});
