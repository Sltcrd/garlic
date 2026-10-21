'use strict';
/** Language test: in English no Spanish may remain anywhere in the UI, and switching back restores Spanish. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { launch, tempDir, sleep } = require('./lib');
const { makeFixtures, walkUI, TEXT_JS } = require('./walk');

// Spanish markers: diacritics / inverted punctuation, or very common Spanish words.
const SPANISH = /[áéíóúñ¿¡]|\b(archivos?|para|sin|una|del|los|las|que|nunca|licencia|carpeta|tu|tus)\b/i;
// Things that are allowed to look Spanish: the language name itself and user data (file names, sample content, tags).
const ALLOWED = [/^Español$/, /^(imagen|doc|nota|pagina|datos|sub|raro|paquete|tono|clip|carpeta|x|y|z)(\.\w+)?$/i, /\.(png|pdf|md|txt|html|csv|srt|bin|zip|mp3|mp4)\b/i, /garlic-(test|fx|harvest)/i, /^(compatible_brands|major_brand|minor_version|encoder)\b/, /→/];

let app, dir, fx;
test.before(async () => { app = await launch(); dir = tempDir(); fx = await makeFixtures(dir); });
test.after(async () => { if (app) await app.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

test('English: every screen, ring, tool and card is translated', async () => {
  const appPage = await app.page('app');
  await appPage.eval(`cfgSet({ lang: 'en' })`); await sleep(500);
  const seen = new Map();
  await walkUI(app, fx, async page => { for (const s of await page.eval(TEXT_JS)) if (!seen.has(s)) seen.set(s, true); });
  const bad = [...seen.keys()].filter(s => SPANISH.test(s) && !ALLOWED.some(r => r.test(s)));
  assert.deepEqual(bad, [], 'untranslated strings (add them to src/shared/i18n-en.js):\n' + bad.join('\n'));
});

test('Spanish is restored when switching back', async () => {
  const appPage = await app.page('app');
  await appPage.eval(`cfgSet({ lang: 'es' })`); await sleep(500);
  assert.match(await appPage.eval('document.querySelector("#ptitle").textContent'), /Inicio/);
  await appPage.eval(`cfgSet({ lang: 'en' })`); await sleep(500);
  assert.match(await appPage.eval('document.querySelector("#ptitle").textContent'), /Home/);
});
