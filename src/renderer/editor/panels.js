/* Editor panels: crop, background, compress, metadata, adjust, redact, annotate (images/PDF) — the audio/video tools live in avtools.js. */
const pc = $('#pc'), pctx = pc.getContext('2d'), stage = $('#pstage');
let W = null, P = null;
const MODES = {};

/* ---------------- zoom & pan ---------------- */
const V = { z: 1, x: 0, y: 0, fit: true, hand: false, space: false };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function applyView() {
  pc.style.transform = `translate(${V.x}px,${V.y}px) scale(${V.z})`;
  pc.style.imageRendering = V.z > 2 ? 'pixelated' : 'auto';
  $('#zv').textContent = Math.round(V.z * 100) + '%';
  stage.classList.toggle('pan', V.hand || V.space);
}
function fitView() {
  if (!pc.width || !pc.height) return;
  const sw = stage.clientWidth, sh = stage.clientHeight, z = clamp(Math.min((sw - 28) / pc.width, (sh - 28) / pc.height), 0.02, 4);
  V.z = z; V.x = (sw - pc.width * z) / 2; V.y = (sh - pc.height * z) / 2; V.fit = true; applyView();
}
function setZoom(z, cx, cy) {
  z = clamp(z, 0.02, 40); const k = z / V.z;
  V.x = cx - (cx - V.x) * k; V.y = cy - (cy - V.y) * k; V.z = z; V.fit = false; applyView();
}
function zoomBy(f, cx, cy) { const r = stage.getBoundingClientRect(); setZoom(V.z * f, cx ?? r.width / 2, cy ?? r.height / 2); }
function actualSize() { const r = stage.getBoundingClientRect(); setZoom(1, r.width / 2, r.height / 2); }

function setPC(w, h) { pc.width = w; pc.height = h; if (V.fit) fitView(); }
function ctl(h) { $('#pctl').innerHTML = h; }
function mpos(e) { const r = pc.getBoundingClientRect(); return { x: (e.clientX - r.left) * pc.width / r.width, y: (e.clientY - r.top) * pc.height / r.height }; }
const outFmt = () => (ST.kind === 'image' && ['jpg', 'png', 'webp'].includes(ST.ext)) ? ST.ext : 'png';
async function saveCanvas(c, suffix) { const f = outFmt(); await saveBlob(await encode(c, f, 0.95), suffix, f); }
function slider(id, label, min, max, val, unit = '') {
  return `<div class="row"><label>${label}</label><input type="range" id="${id}" min="${min}" max="${max}" value="${val}"><span class="val" id="${id}v">${val}${unit}</span></div>`;
}
function onSlider(id, unit, fn) { const el = $('#' + id); el.oninput = () => { $('#' + id + 'v').textContent = el.value + unit; fn(+el.value); }; }
function chipRow(id, items, active, fn) {
  const box = document.getElementById(id);
  box.innerHTML = items.map(v => `<button data-v="${v}" class="${v === active ? 'on' : ''}">${v}</button>`).join('');
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); };
}

/* wheel = zoom with Ctrl, otherwise scroll; middle button / Space / hand tool = drag the view */
stage.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) { const r = stage.getBoundingClientRect(); setZoom(V.z * Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top); }
  else { V.x -= e.shiftKey ? e.deltaY : e.deltaX; V.y -= e.shiftKey ? 0 : e.deltaY; V.fit = false; applyView(); }
}, { passive: false });
let pan = null;
stage.addEventListener('pointerdown', e => {
  if (!(e.button === 1 || (e.button === 0 && (V.hand || V.space)))) return;
  e.preventDefault(); e.stopPropagation();
  pan = { sx: e.clientX, sy: e.clientY, x: V.x, y: V.y }; stage.setPointerCapture(e.pointerId); stage.classList.add('panning');
}, true);
stage.addEventListener('pointermove', e => { if (pan) { V.x = pan.x + e.clientX - pan.sx; V.y = pan.y + e.clientY - pan.sy; V.fit = false; applyView(); } });
const endPan = e => { if (pan) { pan = null; stage.classList.remove('panning'); try { stage.releasePointerCapture(e.pointerId); } catch { /* already released */ } } };
stage.addEventListener('pointerup', endPan); stage.addEventListener('pointercancel', endPan);
new ResizeObserver(() => { if (V.fit && W) fitView(); }).observe(stage);

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { V.space = true; applyView(); e.preventDefault(); }
  else if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomBy(1.25); }
  else if (mod && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomBy(0.8); }
  else if (mod && e.key === '0') { e.preventDefault(); fitView(); }
  else if (mod && e.key === '1') { e.preventDefault(); actualSize(); }
  else if (e.key === 'Escape') closePanel();
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { V.space = false; applyView(); } });
$('#zin').onclick = () => zoomBy(1.25); $('#zout').onclick = () => zoomBy(0.8); $('#zfit').onclick = fitView;
$('#zv').onclick = () => (V.fit || Math.abs(V.z - 1) > 0.01 ? actualSize() : fitView());
$('#zhand').onclick = () => { V.hand = !V.hand; $('#zhand').classList.toggle('on', V.hand); applyView(); };

/* ---------------- open / close ---------------- */
function openPanel(name) {
  const m = MODES[name]; if (!m) return;
  if (!m.media && !ST.img) { toast(t('No se pudo abrir la imagen.'), true); return; }
  P = m; W = ST.img;
  const pm = $('#pm'); pc.hidden = !!m.media; pm.hidden = !m.media; stage.classList.remove('audio');
  $('#zoomtools').hidden = !!m.media;
  if (!m.media) { try { pm.pause(); pm.removeAttribute('src'); } catch { /* no media */ } }
  $('#ptitle').textContent = P.title; $('#papply').textContent = P.apply || 'Aplicar';
  stage.classList.toggle('checker', name === 'erase');
  V.fit = true; P.open();
  if (!m.media) fitView();
}
function closePanel() { try { const pm = $('#pm'); pm.pause(); pm.removeAttribute('src'); pm.load(); } catch { /* no media */ } nat.winCtl('close'); }
$('#preset').onclick = () => P && P.open();
$('#papply').onclick = async () => {
  if (!P) return; const b = $('#papply'); b.disabled = true;
  try { await P.save(); closePanel(); } catch (e) { toast(e.message, true); }
  b.disabled = false;
};
pc.addEventListener('pointerdown', e => { if (P && P.down && !pan) { pc.setPointerCapture(e.pointerId); P.down(mpos(e), e); } });
pc.addEventListener('pointermove', e => { if (P && P.move && !pan) P.move(mpos(e), e); });
pc.addEventListener('pointerup', e => { if (P && P.up) P.up(mpos(e), e); });

/* ---------- RECORTAR ---------- */
const C = { r: null, ratio: null, d: null };
MODES.crop = {
  title: 'Recortar imagen', apply: 'Aplicar',
  open() {
    C.r = { x: 0, y: 0, w: W.width, h: W.height }; C.ratio = null; C.d = null; setPC(W.width, W.height);
    ctl(`<div class="chips" id="cr"></div><div class="row"><label>Tamaño</label><input type="number" id="cw" min="1"> <span>×</span> <input type="number" id="ch" min="1"> <span>px</span></div>`);
    chipRow('cr', ['Libre', '1:1', '16:9', '9:16', '4:3', '3:4'], 'Libre', v => {
      if (v === 'Libre') { C.ratio = null; } else {
        const [a, b] = v.split(':').map(Number); C.ratio = a / b;
        const w = Math.min(W.width, W.height * C.ratio), h = w / C.ratio, cx = C.r.x + C.r.w / 2, cy = C.r.y + C.r.h / 2;
        C.r = { x: clamp(cx - w / 2, 0, W.width - w), y: clamp(cy - h / 2, 0, W.height - h), w, h };
      }
      this.render();
    });
    $('#cw').onchange = () => this.setSize(true); $('#ch').onchange = () => this.setSize(false);
    this.render();
  },
  setSize(fromW) {
    const r = C.r; let w = clamp(+$('#cw').value || r.w, 1, W.width), h = clamp(+$('#ch').value || r.h, 1, W.height);
    if (C.ratio) { if (fromW) { h = w / C.ratio; if (h > W.height) { h = W.height; w = h * C.ratio; } } else { w = h * C.ratio; if (w > W.width) { w = W.width; h = w / C.ratio; } } }
    r.w = w; r.h = h; r.x = clamp(r.x, 0, W.width - w); r.y = clamp(r.y, 0, W.height - h); this.render();
  },
  corners() { const r = C.r; return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; },
  down(p) {
    const hs = 16 / V.z, r = C.r, cs = this.corners();
    for (let i = 0; i < 4; i++) if (Math.abs(p.x - cs[i][0]) < hs && Math.abs(p.y - cs[i][1]) < hs) { C.d = { t: 'c', i, a: cs[(i + 2) % 4] }; return; }
    if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) C.d = { t: 'm', s: p, r0: { ...r } };
  },
  move(p) {
    const d = C.d; if (!d) return;
    if (d.t === 'm') { C.r.x = clamp(d.r0.x + p.x - d.s.x, 0, W.width - C.r.w); C.r.y = clamp(d.r0.y + p.y - d.s.y, 0, W.height - C.r.h); }
    else {
      const [ax, ay] = d.a; const px = clamp(p.x, 0, W.width), py = clamp(p.y, 0, W.height);
      let dx = px - ax, dy = py - ay, w = Math.abs(dx), h = Math.abs(dy);
      if (C.ratio) { if (h * C.ratio < w) w = h * C.ratio; else h = w / C.ratio; }
      if (w < 8 || h < 8) return;
      const x = dx < 0 ? ax - w : ax, y = dy < 0 ? ay - h : ay;
      if (x < -0.5 || y < -0.5 || x + w > W.width + 0.5 || y + h > W.height + 0.5) return;
      C.r = { x, y, w, h };
    }
    this.render();
  },
  up() { C.d = null; },
  render() {
    const r = C.r, s = 1 / V.z, x = pctx;
    x.clearRect(0, 0, pc.width, pc.height); x.drawImage(W, 0, 0);
    x.fillStyle = 'rgba(0,0,0,.55)';
    x.fillRect(0, 0, W.width, r.y); x.fillRect(0, r.y + r.h, W.width, W.height - r.y - r.h);
    x.fillRect(0, r.y, r.x, r.h); x.fillRect(r.x + r.w, r.y, W.width - r.x - r.w, r.h);
    x.strokeStyle = '#fff'; x.lineWidth = 2 * s; x.strokeRect(r.x, r.y, r.w, r.h);
    x.lineWidth = s; x.globalAlpha = .5;
    for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(r.x + r.w * i / 3, r.y); x.lineTo(r.x + r.w * i / 3, r.y + r.h); x.moveTo(r.x, r.y + r.h * i / 3); x.lineTo(r.x + r.w, r.y + r.h * i / 3); x.stroke(); }
    x.globalAlpha = 1; x.fillStyle = CFG.ac; const hs = 8 * s;
    this.corners().forEach(([cx, cy]) => { x.fillRect(cx - hs, cy - hs, hs * 2, hs * 2); x.strokeRect(cx - hs, cy - hs, hs * 2, hs * 2); });
    $('#cw').value = Math.round(r.w); $('#ch').value = Math.round(r.h);
  },
  async save() {
    const r = C.r, w = Math.round(r.w), h = Math.round(r.h), c = newCanvas(w, h);
    c.getContext('2d').drawImage(W, Math.round(r.x), Math.round(r.y), w, h, 0, 0, w, h); await saveCanvas(c, t('_recorte'));
  }
};

/* ---------- FONDO ---------- */
const GRADS = [['#ff9a5c', '#f4505f'], ['#6a82fb', '#fc5c7d'], ['#00c6ff', '#0072ff'], ['#f6d365', '#fda085'], ['#84fab0', '#8fd3f4'], ['#a18cd1', '#fbc2eb'], ['#232526', '#5a5d60'], ['#ff0844', '#ffb199']];
const SOLIDS = ['#ffffff', '#eeeeee', '#ffe14d', '#ff9f1c', '#2ec4b6', '#3a86ff', '#8338ec', '#111111'];
const B = { bg: 'g0', pad: 12, corners: 6, shadow: 30, ratio: null };
MODES.bg = {
  title: 'Añadir fondo', apply: 'Guardar con fondo',
  open() {
    Object.assign(B, { bg: 'g0', pad: 12, corners: 6, shadow: 30, ratio: null });
    const sw = (arr, k) => arr.map((c, i) => `<i data-bg="${k}${i}" class="${B.bg === k + i ? 'on' : ''}" style="background:${k === 'g' ? `linear-gradient(135deg,${c[0]},${c[1]})` : c}"></i>`).join('');
    ctl(`<div class="sw" id="sw">${sw(GRADS, 'g')}</div><div class="sw" id="sw2">${sw(SOLIDS, 's')}</div>` +
      slider('bp', 'Margen', 0, 40, B.pad, '%') + slider('bc', 'Esquinas', 0, 50, B.corners, '%') + slider('bs', 'Sombra', 0, 100, B.shadow, '') +
      `<div class="row"><label>Proporción</label><div class="chips" id="br"></div></div>`);
    const pick = e => { const i = e.target.closest('i'); if (!i) return; B.bg = i.dataset.bg; document.querySelectorAll('#sw i,#sw2 i').forEach(x => x.classList.toggle('on', x === i)); this.render(); };
    $('#sw').onclick = pick; $('#sw2').onclick = pick;
    onSlider('bp', '%', v => { B.pad = v; this.render(); }); onSlider('bc', '%', v => { B.corners = v; this.render(); }); onSlider('bs', '', v => { B.shadow = v; this.render(); });
    chipRow('br', ['Auto', '1:1', '4:3', '16:9', '9:16'], 'Auto', v => { B.ratio = v === 'Auto' ? null : v.split(':').reduce((a, b) => a / b); this.render(); });
    this.render();
  },
  compose() {
    const w = W.width, h = W.height, m = Math.max(w, h), pad = Math.round(B.pad / 100 * m * 0.5), cw = w + 2 * pad, ch = h + 2 * pad;
    let ow = cw, oh = ch; if (B.ratio) { if (cw / ch > B.ratio) oh = Math.round(cw / B.ratio); else ow = Math.round(ch * B.ratio); }
    const c = newCanvas(ow, oh), x = c.getContext('2d');
    if (B.bg[0] === 'g') { const g = GRADS[+B.bg.slice(1)], gr = x.createLinearGradient(0, 0, ow, oh); gr.addColorStop(0, g[0]); gr.addColorStop(1, g[1]); x.fillStyle = gr; } else x.fillStyle = SOLIDS[+B.bg.slice(1)];
    x.fillRect(0, 0, ow, oh);
    const ix = Math.round((ow - w) / 2), iy = Math.round((oh - h) / 2), rad = B.corners / 100 * Math.min(w, h) * 0.5;
    x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = B.shadow / 100 * m * 0.06; x.shadowOffsetY = x.shadowBlur / 3; x.fillStyle = '#fff';
    x.beginPath(); x.roundRect(ix, iy, w, h, rad); x.fill(); x.restore();
    x.save(); x.beginPath(); x.roundRect(ix, iy, w, h, rad); x.clip(); x.drawImage(W, ix, iy); x.restore();
    return c;
  },
  render() { const c = this.compose(); setPC(c.width, c.height); pctx.drawImage(c, 0, 0); },
  async save() { await saveCanvas(this.compose(), t('_fondo')); }
};

/* ---------- COMPRIMIR ---------- */
const Z = { fmt: 'jpg', q: 75, s: 100, t: 0 };
MODES.compress = {
  title: 'Comprimir', apply: 'Guardar',
  open() {
    Object.assign(Z, { fmt: ['jpg', 'webp', 'png'].includes(outFmt()) ? outFmt() : 'jpg', q: 75, s: 100 });
    setPC(W.width, W.height); pctx.drawImage(W, 0, 0);
    ctl(`<div class="row"><label>Formato</label><div class="chips" id="zf"></div></div>` + slider('zq', 'Calidad', 5, 100, Z.q, '%') + slider('zs', 'Tamaño', 10, 100, Z.s, '%') + `<div class="info" id="ze"></div>`);
    chipRow('zf', ['jpg', 'webp', 'png'], Z.fmt, v => { Z.fmt = v; $('#zq').disabled = v === 'png'; this.est(); });
    onSlider('zq', '%', v => { Z.q = v; this.est(); }); onSlider('zs', '%', v => { Z.s = v; this.est(); });
    $('#zq').disabled = Z.fmt === 'png'; this.est();
  },
  est() {
    clearTimeout(Z.t); Z.t = setTimeout(async () => {
      try {
        const b = await encode(W, Z.fmt, Z.q / 100, Z.s), o = ST.file.size, el = $('#ze'); if (!el) return;
        el.innerHTML = `<b>Original</b>${fmtSize(o)}<br><b>Resultado</b>${fmtSize(b.size)} (${b.size <= o ? '−' : '+'}${Math.abs(Math.round((1 - b.size / o) * 100))}%)<br><b>Dimensiones</b>${Math.round(W.width * Z.s / 100)} × ${Math.round(W.height * Z.s / 100)} px`;
      } catch (e) { }
    }, 250);
  },
  async save() { await saveBlob(await encode(W, Z.fmt, Z.q / 100, Z.s), t('_comprimido'), Z.fmt); }
};

/* ---------- METADATOS ---------- */
MODES.metadata = {
  title: 'Metadatos', apply: 'Quitar metadatos y guardar',
  async open() {
    setPC(W.width, W.height); pctx.drawImage(W, 0, 0);
    ctl('<div class="info">Leyendo…</div>');
    const f = ST.file, buf = new Uint8Array(await f.arrayBuffer()), head = new TextDecoder('latin1').decode(buf.subarray(0, 200000));
    const found = [];
    if (head.includes('Exif\0\0') || head.includes('eXIf')) found.push('EXIF (cámara, fecha, posible GPS)');
    if (head.includes('ns.adobe.com/xap')) found.push('XMP');
    if (head.includes('Photoshop 3.0')) found.push('IPTC / Photoshop');
    if (head.includes('tEXt') || head.includes('iTXt')) found.push('Texto PNG');
    if (head.includes('ICC_PROFILE') || head.includes('iCCP')) found.push('Perfil de color');
    ctl(`<div class="info"><b>Archivo</b>${xmlEsc(f.name)}<br><b>Tipo</b>${f.type || ST.ext.toUpperCase()}<br><b>Tamaño</b>${fmtSize(f.size)}<br><b>Dimensiones</b>${W.width} × ${W.height} px<br><b>Modificado</b>${new Date(f.lastModified).toLocaleString()}<br><b>Metadatos</b>${found.length ? found.join(', ') : 'ninguno detectado'}</div>` +
      (ST.kind === 'pdf' ? '<div class="info" style="opacity:.85;margin-top:6px">Se guardará la página 1 como imagen limpia.</div>' : ''));
  },
  async save() { await saveCanvas(W, t('_limpio')); }
};

/* ---------- EDITAR ---------- */
const E = { b: 100, c: 100, s: 100, rot: 0, flip: false };
MODES.edit = {
  title: 'Editar', apply: 'Guardar',
  open() {
    Object.assign(E, { b: 100, c: 100, s: 100, rot: 0, flip: false });
    ctl(slider('eb', 'Brillo', 40, 160, 100, '%') + slider('ec', 'Contraste', 40, 160, 100, '%') + slider('es', 'Saturación', 0, 200, 100, '%') +
      `<div class="chips"><button id="erl">⟲ Girar</button><button id="err">⟳ Girar</button><button id="efl">⇋ Voltear</button><button id="egr">Blanco y negro</button></div>`);
    onSlider('eb', '%', v => { E.b = v; this.render(); }); onSlider('ec', '%', v => { E.c = v; this.render(); }); onSlider('es', '%', v => { E.s = v; this.render(); });
    $('#erl').onclick = () => { E.rot = (E.rot + 3) % 4; this.render(); }; $('#err').onclick = () => { E.rot = (E.rot + 1) % 4; this.render(); };
    $('#efl').onclick = () => { E.flip = !E.flip; this.render(); };
    $('#egr').onclick = () => { E.s = 0; $('#es').value = 0; $('#esv').textContent = '0%'; this.render(); };
    this.render();
  },
  draw(dst) {
    const q = E.rot % 2 === 1, w = q ? W.height : W.width, h = q ? W.width : W.height; dst.width = w; dst.height = h;
    const x = dst.getContext('2d'); x.filter = `brightness(${E.b}%) contrast(${E.c}%) saturate(${E.s}%)`;
    x.translate(w / 2, h / 2); x.rotate(E.rot * Math.PI / 2); if (E.flip) x.scale(-1, 1); x.drawImage(W, -W.width / 2, -W.height / 2);
  },
  render() { this.draw(pc); },
  async save() { const c = newCanvas(1, 1); this.draw(c); await saveCanvas(c, t('_editado')); }
};

/* ---------- CENSURAR ---------- */
const R = { boxes: [], style: 'Pixelar', d: null, cur: null };
MODES.redact = {
  title: 'Censurar', apply: 'Guardar',
  open() {
    R.boxes = []; R.d = null; R.cur = null; R.style = 'Pixelar'; setPC(W.width, W.height);
    ctl(`<div class="row"><label>Estilo</label><div class="chips" id="rs"></div></div><div class="info">Arrastra sobre la imagen para tapar zonas.</div><div class="chips"><button id="rundo">↶ Deshacer</button></div>`);
    chipRow('rs', ['Pixelar', 'Negro'], 'Pixelar', v => { R.style = v; this.render(); });
    $('#rundo').onclick = () => { R.boxes.pop(); this.render(); }; this.render();
  },
  box(a, b) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y), st: R.style }; },
  down(p) { R.d = p; },
  move(p) { if (!R.d) return; R.cur = this.box(R.d, p); this.render(true); },
  up(p) { if (!R.d) return; const b = this.box(R.d, p); R.d = null; R.cur = null; if (b.w > 4 && b.h > 4) R.boxes.push(b); this.render(); },
  render(prev) {
    pctx.clearRect(0, 0, pc.width, pc.height); pctx.drawImage(W, 0, 0);
    for (const b of R.boxes) {
      if (b.st === 'Negro') { pctx.fillStyle = '#000'; pctx.fillRect(b.x, b.y, b.w, b.h); }
      else {
        const s = Math.max(8, W.width / 60), tw = Math.max(1, Math.ceil(b.w / s)), th = Math.max(1, Math.ceil(b.h / s)), t = newCanvas(tw, th);
        t.getContext('2d').drawImage(W, b.x, b.y, b.w, b.h, 0, 0, tw, th);
        pctx.save(); pctx.imageSmoothingEnabled = false; pctx.drawImage(t, 0, 0, tw, th, b.x, b.y, b.w, b.h); pctx.restore();
      }
    }
    if (prev && R.cur) { pctx.strokeStyle = '#ff4f2b'; pctx.lineWidth = Math.max(2, W.width / 300); pctx.setLineDash([8, 6]); pctx.strokeRect(R.cur.x, R.cur.y, R.cur.w, R.cur.h); pctx.setLineDash([]); }
  },
  async save() { this.render(); await saveCanvas(pc, t('_censurado')); }
};

/* ---------- ANOTAR ---------- */
const A = { c: null, hist: [], tool: 'Lápiz', d: null };
MODES.annotate = {
  title: 'Anotar', apply: 'Guardar',
  open() {
    A.c = cloneCanvas(W); A.hist = []; A.d = null; A.tool = 'Lápiz'; setPC(W.width, W.height);
    ctl(`<div class="chips" id="at"></div><div class="row"><label>Color</label><input type="color" id="ac" value="#ff3d1f" style="width:46px;height:28px;border:0;background:none"><input type="range" id="az" min="1" max="20" value="4"></div><div class="row"><input type="text" id="atx" placeholder="Texto (para la herramienta Texto)"></div><div class="chips"><button id="aundo">↶ Deshacer</button></div>`);
    chipRow('at', ['Lápiz', 'Rectángulo', 'Flecha', 'Resaltar', 'Texto'], 'Lápiz', v => A.tool = v);
    $('#aundo').onclick = () => { const h = A.hist.pop(); if (h) { A.c = h; this.render(); } }; this.render();
  },
  lw() { return (+$('#az').value) * Math.max(1, W.width / 800); },
  snap() { A.hist.push(cloneCanvas(A.c)); if (A.hist.length > 20) A.hist.shift(); },
  shape(x, t, a, b) {
    x.save(); x.strokeStyle = x.fillStyle = $('#ac').value; x.lineWidth = this.lw(); x.lineCap = 'round';
    if (t === 'Rectángulo') x.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    else if (t === 'Resaltar') { x.globalAlpha = .35; x.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    else if (t === 'Flecha') {
      const an = Math.atan2(b.y - a.y, b.x - a.x), h = this.lw() * 4;
      x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
      x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(b.x - h * Math.cos(an - .45), b.y - h * Math.sin(an - .45)); x.lineTo(b.x - h * Math.cos(an + .45), b.y - h * Math.sin(an + .45)); x.closePath(); x.fill();
    }
    x.restore();
  },
  down(p) {
    if (A.tool === 'Texto') {
      const txt = $('#atx').value; if (!txt) { toast(t('Escribe el texto primero.'), true); return; }
      this.snap(); const x = A.c.getContext('2d'); x.fillStyle = $('#ac').value; x.font = `${Math.round(this.lw() * 5)}px sans-serif`; x.textBaseline = 'top'; x.fillText(txt, p.x, p.y); this.render(); return;
    }
    A.d = { a: p }; if (A.tool === 'Lápiz') { this.snap(); const x = A.c.getContext('2d'); x.strokeStyle = $('#ac').value; x.lineWidth = this.lw(); x.lineCap = x.lineJoin = 'round'; x.beginPath(); x.moveTo(p.x, p.y); }
  },
  move(p) {
    if (!A.d) return;
    if (A.tool === 'Lápiz') { const x = A.c.getContext('2d'); x.lineTo(p.x, p.y); x.stroke(); this.render(); }
    else { this.render(); this.shape(pctx, A.tool, A.d.a, p); }
  },
  up(p) { if (!A.d) return; if (A.tool !== 'Lápiz') { this.snap(); this.shape(A.c.getContext('2d'), A.tool, A.d.a, p); } A.d = null; this.render(); },
  render() { pctx.clearRect(0, 0, pc.width, pc.height); pctx.drawImage(A.c, 0, 0); },
  async save() { await saveCanvas(A.c, t('_anotado')); }
};
