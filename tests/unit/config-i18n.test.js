'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../src/main/config');
const I18N = require('../../src/shared/i18n');
const EN = require('../../src/shared/i18n-en');

test('config.sanitize drops unknown keys and bad values', () => {
  const c = config.sanitize({ ac: '#ff00aa', op: 50, theme: 'light', lang: 'en', blobs: false, evil: 1, __proto__: { x: 1 } });
  assert.deepEqual(c, { ac: '#ff00aa', op: 50, theme: 'light', lang: 'en', blobs: false });
  assert.deepEqual(config.sanitize({ ac: 'red', op: 500, theme: 'neon', lang: 'fr', blobs: 'yes', vol: -1, scale: NaN }), {});
  assert.deepEqual(config.sanitize(null), {});
  assert.deepEqual(config.sanitize('x'), {});
});

test('the shortcut can never be a bare left click', () => {
  assert.equal(config.sanitize({ combo: { shift: false, ctrl: false, alt: false, meta: false, button: 1 } }).combo, undefined);
  assert.deepEqual(config.sanitize({ combo: { alt: true, button: 1 } }).combo, { shift: false, ctrl: false, alt: true, meta: false, button: 1 });
  assert.ok(config.sanitize({ combo: { button: 3 } }).combo, 'middle click without modifiers is allowed');
  assert.equal(config.sanitize({ combo: { alt: true, button: 9 } }).combo, undefined);
});

test('i18n resolves the language and replaces placeholders', () => {
  assert.equal(I18N.resolve('auto', 'es-MX'), 'es');
  assert.equal(I18N.resolve('auto', 'en-US'), 'en');
  assert.equal(I18N.resolve('auto', 'de-DE'), 'en');
  assert.equal(I18N.resolve('es', 'en-US'), 'es');
  I18N.setLang('es'); assert.equal(I18N.t('Página {i} de {n}', { i: 2, n: 5 }), 'Página 2 de 5');
  I18N.setLang('en'); assert.equal(I18N.t('Página {i} de {n}', { i: 2, n: 5 }), 'Page 2 of 5');
  assert.equal(I18N.t('texto sin traducir'), 'texto sin traducir', 'missing keys fall back to the source');
  I18N.setLang('es');
});

test('every English entry keeps its placeholders and no key is empty', () => {
  for (const [es, en] of Object.entries(EN)) {
    assert.ok(en && en.trim(), `empty translation for "${es}"`);
    const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
    assert.equal(ph(en), ph(es), `placeholders differ for "${es}"`);
  }
});
