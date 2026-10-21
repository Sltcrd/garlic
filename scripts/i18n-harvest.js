#!/usr/bin/env node
'use strict';
/**
 * Developer tool: runs Garlic in Spanish, visits every screen/state and collects every visible string,
 * then merges them with the t('…') calls found in the sources. The result (stdout / --out file) is the list of
 * keys that need an entry in src/shared/i18n-en.js.   Usage:  node scripts/i18n-harvest.js [--out keys.json]
 */
const fs = require('fs');
const path = require('path');
const { launch, tempDir, ROOT } = require('../tests/e2e/lib');
const { makeFixtures, walkUI, TEXT_JS } = require('../tests/e2e/walk');

const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? process.argv[outArg + 1] : null;

/* ---- static scan: t('…') calls ---- */
function staticKeys() {
  const keys = new Set(), re = /\b(?:I18N\.)?t\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.js') && !f.name.startsWith('i18n')) { const s = fs.readFileSync(p, 'utf8'); let m; while ((m = re.exec(s))) if (!m[2].includes('${')) keys.add(m[2].replace(/\\'/g, "'")); }
    }
  })(path.join(ROOT, 'src'));
  return keys;
}

(async () => {
  const dir = tempDir('garlic-harvest-'), fx = await makeFixtures(dir), app = await launch();
  const keys = new Set(staticKeys()), grab = async page => { for (const s of await page.eval(TEXT_JS)) keys.add(s); };
  try {
    const appPage = await app.page('app');
    await appPage.eval(`cfgSet({ lang: 'es' })`);
    await walkUI(app, fx, grab);
  } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }

  const list = [...keys].filter(k => !/^[\d\s%.:×·→x/\-–—+()]*$/.test(k)).sort((a, b) => a.localeCompare(b, 'es'));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(list, null, 1)); else console.log(JSON.stringify(list, null, 1));
  console.error(`harvested ${list.length} strings`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
