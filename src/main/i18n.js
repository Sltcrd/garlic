'use strict';
/** Main-process language helper: follows the `lang` setting ('auto' uses the OS locale). */
const { app } = require('electron');
const I18N = require('../shared/i18n');
const config = require('./config');

function refresh() { I18N.setLang(I18N.resolve(config.get().lang, app.getLocale())); }
config.onChange((_c, patch) => { if ('lang' in patch) refresh(); });

module.exports = { t: I18N.t, refresh, lang: I18N.getLang };
