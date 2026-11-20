'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { launch, tempDir, waitFor } = require('./lib');

let app, dir;
const f = n => path.join(dir, n);
const read = n => fs.readFileSync(f(n), 'utf8');
const MD = '﻿# Titulo\r\n\r\nhola  \r\n\r\n\r\n\r\nmundo\t\r\n';
const SRT = '1\n00:00:01,000 --> 00:00:03,000\nHola\n\n2\n00:00:05,000 --> 00:00:06,500\nAdiós\n';

test.before(async () => {
  dir = tempDir('garlic-text-');
  fs.writeFileSync(f('nota.md'), MD); fs.writeFileSync(f('peli.srt'), SRT); fs.writeFileSync(f('viejo.txt'), Buffer.from([0x63, 0x61, 0x66, 0xE9, 0x0A]));   // "café" in Windows-1252
  app = await launch();
  await (await app.page('app')).eval(`cfgSet({ lang: 'es' })`);    // output names follow the UI language (…_editado.md); the CI machine is English
  const wheel = await app.page('wheel');
  for (const n of ['nota.md', 'peli.srt', 'viejo.txt']) await wheel.eval(`nat.openWheel(${JSON.stringify(f(n))})`);
});
test.after(async () => { if (app) await app.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

async function tool(file, name, ready) {
  const wheel = await app.page('wheel');
  await wheel.eval(`nat.openEditor({ path: ${JSON.stringify(f(file))}, tool: '${name}' })`);
  const ed = await app.page('editor');
  await waitFor(() => ed.eval(`!!P && P === MODES.${name} && ${ready}`), { what: name + ' ready' });
  return ed;
}
async function apply(ed) {
  await ed.eval(`setTimeout(() => document.querySelector('#papply').click(), 0)`);   // answer first: the editor window closes itself after saving
  const main = await app.page('app');
  await waitFor(async () => JSON.parse(await main.eval('nat.testState().then(JSON.stringify)')).editor === false, { what: 'editor closed after saving', timeout: 20000 });
}

test('text editor: find and replace, sandboxed Markdown preview, line endings and BOM are kept', async () => {
  const ed = await tool('nota.md', 't_edit', `!!document.querySelector('#te') && document.querySelector('#te').value.includes('hola')`);
  assert.equal(await ed.eval(`document.querySelector('#tprev').getAttribute('sandbox')`), '', 'the preview has no sandbox permissions');
  await waitFor(() => ed.eval(`document.querySelector('#tprev').srcdoc.includes('<h1')`), { what: 'preview rendered' });
  await ed.eval(`document.querySelector('#tf').value = 'HOLA'; document.querySelector('#tf').dispatchEvent(new Event('input')); document.querySelector('#tr').value = 'adiós'`);
  await waitFor(() => ed.eval(`!document.querySelector('#trb').disabled`), { what: 'a match' });
  await ed.eval(`document.querySelector('#trb').click()`);
  assert.equal(await ed.eval(`document.querySelector('#te').value.includes('adiós')`), true);
  await apply(ed);
  assert.equal(read('nota_editado.md'), MD.replace('hola', 'adiós'));
  assert.equal(read('nota.md'), MD, 'the original stays untouched');
});

test('text cleaner: trailing spaces and repeated blank lines go, CRLF and BOM stay', async () => {
  const ed = await tool('nota.md', 't_clean', `document.querySelector('#te') && document.querySelector('#te').value.length > 0`);
  await apply(ed);
  assert.equal(read('nota_limpio.md'), '﻿# Titulo\r\n\r\nhola\r\n\r\nmundo\r\n');
});

test('a Windows-1252 file is read correctly and saved as UTF-8', async () => {
  const ed = await tool('viejo.txt', 't_edit', `!!document.querySelector('#te') && document.querySelector('#te').value.length > 0`);
  assert.equal(await ed.eval(`document.querySelector('#te').value`), 'café\n');
  await apply(ed);
  assert.equal(read('viejo_editado.txt'), 'café\n');
});

test('subtitle sync shifts every cue and keeps the format', async () => {
  const ed = await tool('peli.srt', 's_sync', `document.querySelectorAll('#pgrid .mrow').length === 2`);
  await ed.eval(`document.querySelector('#syn').value = '2.5'; document.querySelector('#syn').dispatchEvent(new Event('change'))`);
  await waitFor(() => ed.eval(`document.querySelector('#pgrid .mrow .mi').textContent.startsWith('00:00:03,500')`), { what: 'preview shifted' });
  await apply(ed);
  assert.equal(read('peli_sincronizado.srt'), '1\n00:00:03,500 --> 00:00:05,500\nHola\n\n2\n00:00:07,500 --> 00:00:09,000\nAdiós\n');
});

test('the wheel offers the right tools per file type', async () => {
  const wheel = await app.page('wheel');
  for (const [file, kind, ring] of [['nota.md', 'md', ['t_edit', 't_clean']], ['peli.srt', 'subs', ['s_sync', 't_edit']]]) {
    await wheel.eval(`nat.openWheel(${JSON.stringify(f(file))})`);
    await waitFor(() => wheel.eval(`ST.kind === '${kind}' && ST.path.endsWith('${file}')`), { what: 'wheel for ' + file });
    assert.deepEqual(await wheel.eval(`(modes().includes('edit') ? editRing() : [])`), ring);
  }
});
