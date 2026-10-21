'use strict';
/**
 * Renders assets/icon.svg to assets/icon.png (512), icon-32.png and a multi-size assets/icon.ico.
 * Run with Electron (it needs a browser engine):   pnpm run icons
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets');
const SVG = fs.readFileSync(path.join(OUT, 'icon.svg'), 'utf8');
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const N = 1024;
  const win = new BrowserWindow({ show: false, width: N, height: N, transparent: true, frame: false, useContentSize: true });
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${SVG.replace('<svg ', `<svg width="${N}" height="${N}" style="display:block" `)}</body></html>`;
  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
  await new Promise(r => setTimeout(r, 600));
  const big = await win.webContents.capturePage({ x: 0, y: 0, width: N, height: N });
  const png = {};
  for (const n of SIZES) png[n] = big.resize({ width: n, height: n, quality: 'best' }).toPNG();
  win.destroy();

  fs.writeFileSync(path.join(OUT, 'icon.png'), png[512]);
  fs.writeFileSync(path.join(OUT, 'icon-32.png'), png[32]);

  // ICO container with embedded PNG images
  const ico = [16, 24, 32, 48, 64, 128, 256], head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4);
  let offset = 6 + 16 * ico.length; const dir = [], data = [];
  for (const n of ico) {
    const d = Buffer.alloc(16), p = png[n];
    d[0] = d[1] = n === 256 ? 0 : n; d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(p.length, 8); d.writeUInt32LE(offset, 12);
    offset += p.length; dir.push(d); data.push(p);
  }
  fs.writeFileSync(path.join(OUT, 'icon.ico'), Buffer.concat([head, ...dir, ...data]));
  console.log('icons written to', OUT);
  app.quit();
});
