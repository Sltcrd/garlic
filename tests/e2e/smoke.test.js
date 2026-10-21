'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { launch, makePng, tempDir, waitFor } = require('./lib');

let app, dir;
test.before(async () => { app = await launch(); dir = tempDir(); });
test.after(async () => { if (app) await app.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

test('main window loads and exposes the preload bridge', async () => {
  const page = await app.page('app');
  assert.equal(await page.eval('typeof window.native.cfgGet'), 'function');
  assert.equal(await page.eval('typeof require'), 'undefined', 'renderers must not have Node.js');
  assert.equal(await page.eval('typeof process'), 'undefined');
  assert.match(await page.eval('document.querySelector("h1").textContent'), /Inicio|Home/);
});

test('settings are validated by the main process', async () => {
  const page = await app.page('app');
  await page.eval(`nat.cfgSet({ ac: 'not-a-colour', op: 9999, evil: '<script>', theme: 'light' })`);
  const cfg = JSON.parse(await page.eval('nat.cfgGet().then(JSON.stringify)'));
  assert.equal(cfg.theme, 'light');
  assert.notEqual(cfg.ac, 'not-a-colour');
  assert.ok(cfg.op <= 95);
  assert.equal(cfg.evil, undefined);
});

test('wheel opens for a file, shows the right ring and converts it with a progress card', async () => {
  const png = path.join(dir, 'foto.png'); fs.writeFileSync(png, makePng(120, 80));
  const appPage = await app.page('app'), wheel = await app.page('wheel');
  await appPage.eval(`nat.openWheel(${JSON.stringify(png)})`);
  await waitFor(async () => (await app.page('app')).eval('nat.testState().then(s => s.wheel)'), { what: 'wheel visible' });
  const ring = await wheel.eval(`(async () => { await ST.ready; return ringNow().join(); })()`);
  assert.match(ring, /webp/); assert.match(ring, /pdf/); assert.doesNotMatch(ring, /(^|,)png(,|$)/, 'the source format is not offered');
  wheel.eval(`convert('webp')`);
  const out = path.join(dir, 'foto.webp');
  await waitFor(() => fs.existsSync(out) && fs.statSync(out).size > 50, { what: 'foto.webp' });
  const jobs = await app.page('jobs');
  await waitFor(async () => (await jobs.eval(`[...document.querySelectorAll('.card.done .ttl')].map(e => e.textContent).join()`)).includes('foto.webp'), { what: 'done card' });
});

test('the wheel is refused access to files the user never chose', async () => {
  const secret = path.join(dir, 'secret.txt'); fs.writeFileSync(secret, 'top secret');
  const wheel = await app.page('wheel');
  const r = await wheel.eval(`nat.readFile(${JSON.stringify(secret)}).then(() => 'READ', e => 'DENIED')`);
  assert.equal(r, 'DENIED');
  const w = await wheel.eval(`nat.save({ dir: ${JSON.stringify(path.join(dir, '..'))}, base: 'x', ext: '.exe', bytes: new Uint8Array([1]) }).then(p => 'WROTE ' + p, e => 'DENIED')`);
  assert.notEqual(w.startsWith('WROTE') && w.endsWith('.exe'), true, 'executables are never written');
});

test('editor is a separate, resizable window with zoom and pan', async () => {
  const png = path.join(dir, 'foto.png');
  const wheel = await app.page('wheel');
  await wheel.eval(`nat.openEditor({ path: ${JSON.stringify(png)}, tool: 'crop' })`);
  const ed = await app.page('editor');
  await waitFor(() => ed.eval('typeof P !== "undefined" && !!P && !!ST.img && ST.img.width === 120'), { what: 'image in editor' });
  const z0 = await ed.eval('V.z');
  await ed.eval(`document.querySelector('#zin').click()`);
  assert.ok(await ed.eval('V.z') > z0, 'zoom in');
  await ed.eval(`document.querySelector('#pstage').dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -240, clientX: 200, clientY: 200, bubbles: true, cancelable: true }))`);
  assert.ok(await ed.eval('V.z') > z0 * 1.25, 'ctrl+wheel zooms');
  await ed.eval(`document.querySelector('#zfit').click()`);
  assert.equal(await ed.eval('V.fit'), true);
  const info = JSON.parse(await (await app.page('app')).eval('nat.testState().then(JSON.stringify)'));
  assert.equal(info.editor, true);
  assert.ok(info.editorBounds.width >= 560 && info.editorBounds.height >= 520, 'editor has a usable size');
});
