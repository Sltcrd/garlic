#!/usr/bin/env node
'use strict';
/** Regenerates the screenshots used by the README into docs/img/ (npm run screenshots). */
const fs = require('fs');
const path = require('path');
const { launch, makePng, tempDir, sleep, waitFor, ROOT } = require('../tests/e2e/lib');

const OUT = path.join(ROOT, 'docs', 'img');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const dir = tempDir('garlic-shots-'), app = await launch();
  const shot = (page, name) => page.screenshot(path.join(OUT, name));
  try {
    const appPage = await app.page('app'), wheel = await app.page('wheel');
    await appPage.eval(`cfgSet({ lang: 'en', theme: 'dark', blobs: true })`);

    /* main window: the real window is translucent, so give the page a backdrop that looks like a wallpaper */
    await appPage.cmd('Emulation.setDeviceMetricsOverride', { width: 1040, height: 680, deviceScaleFactor: 1, mobile: false });
    await appPage.cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 74, g: 60, b: 78, a: 1 } });
    await sleep(600); await shot(appPage, 'app-home-dark.png');
    await appPage.eval(`go('look')`); await sleep(300); await shot(appPage, 'app-appearance.png');
    await appPage.eval(`cfgSet({ theme: 'light' }); go('home')`); await sleep(500);
    await appPage.cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 232, g: 220, b: 226, a: 1 } });
    await sleep(300); await shot(appPage, 'app-home-light.png');
    await appPage.eval(`cfgSet({ theme: 'dark' })`);

    /* wheel */
    const png = path.join(dir, 'photo.png'); fs.writeFileSync(png, makePng(320, 200, [58, 134, 255], [255, 214, 120]));
    await wheel.cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 226, g: 222, b: 232, a: 1 } });
    await appPage.eval(`nat.openWheel(${JSON.stringify(png)})`);
    await waitFor(() => wheel.eval(`ST.path === ${JSON.stringify(png)} && !!ST.img`), { what: 'wheel' }); await sleep(900);
    const c = JSON.parse(await wheel.eval(`(() => { const b = document.querySelector('[data-act="webp"]').getBoundingClientRect(); return JSON.stringify({ x: b.x + b.width / 2, y: b.y + b.height / 2 }); })()`));
    await wheel.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y }); await sleep(500);
    await shot(wheel, 'wheel-convert.png');
    await wheel.eval('stepMode(1)'); await sleep(500); await wheel.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await shot(wheel, 'wheel-edit.png');

    /* editor with zoom */
    await wheel.eval(`nat.openEditor({ path: ${JSON.stringify(png)}, tool: 'crop' })`);
    const ed = await app.page('editor');
    await waitFor(() => ed.eval(`typeof P !== 'undefined' && P === MODES.crop && !!ST.img`), { what: 'editor' }); await sleep(900);
    await ed.eval(`zoomBy(1.6)`); await sleep(300); await shot(ed, 'editor-crop-zoom.png');
    await ed.eval(`closePanel()`);

    /* progress / done cards */
    await wheel.eval(`(async () => { const a = await nat.jobStart({ title: 'holiday.mp4 → WEBM', name: 'holiday' }); nat.jobProgress({ id: a, p: 0.62, label: '0:28 of 0:45' });
      nat.jobQuick({ title: 'Saved', name: 'report.pdf', out: ${JSON.stringify(png)} }); })()`);
    const jobs = await app.page('jobs'); await sleep(900);
    await jobs.cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 226, g: 222, b: 232, a: 1 } }); await sleep(300);
    await shot(jobs, 'job-cards.png');
  } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log('screenshots written to docs/img');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
