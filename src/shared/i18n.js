/**
 * Tiny i18n layer shared by the main process (CommonJS) and the renderers (global `I18N`).
 *
 * Spanish is the source language: the Spanish sentence itself is the key, and `EN` (see ./i18n-en.js)
 * maps it to English. `t('Texto', {n: 3})` replaces `{n}` placeholders. Missing translations fall back to the key.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./i18n-en.js'));
  else root.I18N = factory(root.I18N_EN);
})(typeof self !== 'undefined' ? self : this, function (EN) {
  let lang = 'es';

  /** pref: 'auto' | 'es' | 'en'; locale: e.g. 'es-MX', 'en-US' */
  function resolve(pref, locale) {
    if (pref === 'es' || pref === 'en') return pref;
    return String(locale || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  }
  function t(key, params) {
    let out = lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key;
    if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
    return out;
  }
  return { t, resolve, setLang(l) { lang = l === 'en' ? 'en' : 'es'; }, getLang: () => lang, EN };
});
