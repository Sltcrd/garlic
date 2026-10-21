/* Panel BORRAR: quitar fondo automático, varita y borrador manual (guarda PNG con transparencia) */
const X = { c: null, hist: [], tool: 'Borrador', size: 12, hard: 70, tol: 25, down: false, last: null, hover: null, tmp: null };

MODES.erase = {
  title: 'Borrar fondo / borrador', apply: 'Guardar PNG',
  open() {
    X.c = cloneCanvas(W); X.hist = []; X.down = false; X.hover = null; setPC(W.width, W.height);
    ctl(`<div class="chips" id="xt"></div>` +
      slider('xs', 'Tamaño', 2, 80, X.size, '') + slider('xh', 'Dureza', 0, 100, X.hard, '%') + slider('xo', 'Tolerancia', 1, 100, X.tol, '') +
      `<div class="chips"><button id="xauto">✨ Quitar fondo automático</button><button id="xundo">↶ Deshacer</button></div>` +
      `<div class="info" style="opacity:.8;margin-top:4px">Fondos lisos o de color uniforme funcionan mejor. Con «Restaurar» recuperas lo borrado.</div>`);
    chipRow('xt', ['Borrador', 'Restaurar', 'Varita', 'Varita global'], X.tool, v => { X.tool = v; this.render(); });
    onSlider('xs', '', v => X.size = v); onSlider('xh', '%', v => X.hard = v); onSlider('xo', '', v => X.tol = v);
    $('#xauto').onclick = () => this.auto(); $('#xundo').onclick = () => { const h = X.hist.pop(); if (h) { X.c = h; this.render(); } };
    this.render();
  },
  snap() { X.hist.push(cloneCanvas(X.c)); if (X.hist.length > 15) X.hist.shift(); },
  scale() { return Math.max(1, W.width / 800); },
  dab(p) {
    const r = Math.max(1, X.size * this.scale()), x = X.c.getContext('2d'), hard = X.hard / 100;
    const grad = ctx => { const g = ctx.createRadialGradient(0, 0, r * hard, 0, 0, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); return g; };
    if (X.tool === 'Borrador') {
      x.save(); x.translate(p.x, p.y); x.globalCompositeOperation = 'destination-out'; x.fillStyle = grad(x); x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.restore();
    } else {
      const d = Math.ceil(r * 2); if (!X.tmp || X.tmp.width < d) X.tmp = newCanvas(d, d);
      const t = X.tmp.getContext('2d'); t.clearRect(0, 0, X.tmp.width, X.tmp.height);
      t.globalCompositeOperation = 'source-over'; t.drawImage(W, p.x - r, p.y - r, d, d, 0, 0, d, d);
      t.save(); t.translate(r, r); t.globalCompositeOperation = 'destination-in'; t.fillStyle = grad(t); t.beginPath(); t.arc(0, 0, r, 0, 7); t.fill(); t.restore();
      x.drawImage(X.tmp, 0, 0, d, d, p.x - r, p.y - r, d, d);
    }
  },
  stroke(a, b) {
    const step = Math.max(1, X.size * this.scale() / 4), dist = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) this.dab({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
  },
  down(p) {
    if (X.tool === 'Varita' || X.tool === 'Varita global') { this.wand(p, X.tool === 'Varita global'); return; }
    this.snap(); X.down = true; X.last = p; this.dab(p); this.render(p);
  },
  move(p) {
    X.hover = p;
    if (X.down) { this.stroke(X.last, p); X.last = p; }
    this.render(p);
  },
  up() { X.down = false; },
  render(p) {
    pctx.clearRect(0, 0, pc.width, pc.height); pctx.drawImage(X.c, 0, 0);
    if (p && (X.tool === 'Borrador' || X.tool === 'Restaurar')) {
      const r = X.size * this.scale(); pctx.save(); pctx.lineWidth = Math.max(1, this.scale()); pctx.strokeStyle = '#fff'; pctx.shadowColor = '#000'; pctx.shadowBlur = 2;
      pctx.beginPath(); pctx.arc(p.x, p.y, r, 0, 7); pctx.stroke(); pctx.restore();
    }
  },
  /* --- algoritmos de color --- */
  fill(img, seeds, ref, T) {
    const w = img.width, h = img.height, d = img.data, mask = new Uint8Array(w * h), stack = new Int32Array(w * h), T2 = T * T;
    const near = i => { const k = i * 4; if (d[k + 3] < 10) return true; const dr = d[k] - ref[0], dg = d[k + 1] - ref[1], db = d[k + 2] - ref[2]; return dr * dr + dg * dg + db * db <= T2; };
    let sp = 0; for (const s of seeds) if (!mask[s] && near(s)) { mask[s] = 1; stack[sp++] = s; }
    while (sp) {
      const i = stack[--sp], x = i % w, y = (i - x) / w;
      if (x > 0 && !mask[i - 1] && near(i - 1)) { mask[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < w - 1 && !mask[i + 1] && near(i + 1)) { mask[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && !mask[i - w] && near(i - w)) { mask[i - w] = 1; stack[sp++] = i - w; }
      if (y < h - 1 && !mask[i + w] && near(i + w)) { mask[i + w] = 1; stack[sp++] = i + w; }
    }
    return mask;
  },
  commit(img, mask, ref, T) {
    const w = img.width, h = img.height, d = img.data, soft = T * 0.5 + 1;
    const out = Uint8ClampedArray.from(d);
    for (let i = 0; i < w * h; i++) {
      const k = i * 4;
      if (mask[i]) { out[k + 3] = 0; continue; }
      const x = i % w, y = (i - x) / w;
      if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) {
        const dr = d[k] - ref[0], dg = d[k + 1] - ref[1], db = d[k + 2] - ref[2], dist = Math.sqrt(dr * dr + dg * dg + db * db), a = Math.min(1, Math.max(0, (dist - T) / soft));
        if (a < 1) out[k + 3] = Math.round(d[k + 3] * a);
      }
    }
    d.set(out);
  },
  edit(fn) {
    this.snap(); const x = X.c.getContext('2d'), img = x.getImageData(0, 0, X.c.width, X.c.height); fn(img); x.putImageData(img, 0, 0); this.render();
  },
  auto() {
    const T = X.tol * 3;
    this.edit(img => {
      const w = img.width, h = img.height, d = img.data, seeds = [], bins = new Map();
      const add = i => { seeds.push(i); const k = i * 4, key = (d[k] >> 4) << 8 | (d[k + 1] >> 4) << 4 | (d[k + 2] >> 4); const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[k]; b.g += d[k + 1]; b.b += d[k + 2]; bins.set(key, b); };
      for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); } for (let y = 1; y < h - 1; y++) { add(y * w); add(y * w + w - 1); }
      let best = null; for (const b of bins.values()) if (!best || b.n > best.n) best = b;
      const ref = [best.r / best.n, best.g / best.n, best.b / best.n];
      this.commit(img, this.fill(img, seeds, ref, T), ref, T);
    });
  },
  wand(p, global) {
    const T = X.tol * 3, px = Math.floor(p.x), py = Math.floor(p.y);
    this.edit(img => {
      const w = img.width, h = img.height, d = img.data, i0 = py * w + px, k0 = i0 * 4; if (px < 0 || py < 0 || px >= w || py >= h) return;
      const ref = [d[k0], d[k0 + 1], d[k0 + 2]];
      let mask;
      if (global) {
        mask = new Uint8Array(w * h); const T2 = T * T;
        for (let i = 0; i < w * h; i++) { const k = i * 4, dr = d[k] - ref[0], dg = d[k + 1] - ref[1], db = d[k + 2] - ref[2]; if (dr * dr + dg * dg + db * db <= T2) mask[i] = 1; }
      } else mask = this.fill(img, [i0], ref, T);
      this.commit(img, mask, ref, T);
    });
  },
  async save() { await saveBlob(await encode(X.c, 'png'), t('_sinfondo'), 'png'); }
};
