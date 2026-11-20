/* PDF tools of the editor window: organize pages, merge, split/extract, watermark, page numbers, document info.
 * The work is done by PdfTools (shared/pdftools.js, pdf-lib); results are always saved as new files next to the original. */

const pdfBytes = async () => new Uint8Array(await ST.file.arrayBuffer());
/** Runs a PdfTools call; turns its Spanish error keys into the user's language. */
async function pdfGuard(fn) {
  try { return await fn(); }
  catch (e) { throw new Error(e instanceof PdfTools.PdfToolError ? t(e.message, e.params) : t('No se pudo procesar el PDF.'), { cause: e }); }
}
const pdfBlob = async fn => new Blob([await pdfGuard(fn)], { type: 'application/pdf' });
/** open() of the PDF modes runs unawaited: show its errors instead of losing them */
const pdfSafe = fn => async function (...a) { try { return await fn.apply(this, a); } catch (e) { toast(e.message, true); } };
const pdfPage1Size = async () => { const vp = (await ST.pdf.getPage(1)).getViewport({ scale: 1 }); return { w: vp.width, h: vp.height }; };
const showPage1 = () => { setPC(W.width, W.height); pctx.drawImage(W, 0, 0); };
function colorChips(id, sel, fn) { chipRow(id, Object.keys(PDF_COLORS), sel, v => fn(PDF_COLORS[v])); }
const PDF_COLORS = { Gris: [0.5, 0.5, 0.5], Rojo: [0.85, 0.1, 0.1], Azul: [0.1, 0.3, 0.85], Negro: [0, 0, 0] };
const rgbCss = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;

async function pdfThumb(pageNo) {
  const pg = await ST.pdf.getPage(pageNo), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 220 / Math.max(v1.width, v1.height) });
  const c = newCanvas(Math.max(1, Math.round(vp.width)), Math.max(1, Math.round(vp.height))), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvas: c, canvasContext: x, viewport: vp }).promise; return c;
}

/* ---------- ORGANIZAR ---------- */
const PG = { items: [], sel: new Set(), thumbs: new Map(), req: new Set(), queue: Promise.resolve(), io: null, drag: null };
MODES.p_pages = {
  title: 'Organizar páginas', apply: 'Guardar PDF', own: true,
  open: pdfSafe(async function () {
    PG.items = Array.from({ length: ST.pages }, (_, p) => ({ p, rot: 0 })); PG.sel.clear(); PG.req.clear();
    if (PG.io) PG.io.disconnect();
    PG.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) this.need(+e.target.dataset.p); }), { root: $('#pgrid'), rootMargin: '300px' });
    ctl(`<div class="chips" id="pgt"><button data-a="ccw">⟲ Girar</button><button data-a="cw">⟳ Girar</button><button data-a="left">◀ Mover</button><button data-a="right">Mover ▶</button><button data-a="del">Eliminar</button><button data-a="all">Seleccionar todo</button><button data-a="rev">Invertir orden</button></div><div class="info" id="pgi"></div>`);
    $('#pgt').onclick = e => { const b = e.target.closest('button'); if (b) this.act(b.dataset.a); };
    const g = $('#pgrid');
    g.onclick = e => {
      const c = e.target.closest('.pgc'); if (!c) return; const it = PG.items.find(i => i.p === +c.dataset.p), b = e.target.closest('button');
      if (b && b.dataset.a === 'r') { it.rot = (it.rot + 90) % 360; this.render(); }
      else if (b && b.dataset.a === 'd') { this.remove([it.p]); }
      else { PG.sel.has(it.p) ? PG.sel.delete(it.p) : PG.sel.add(it.p); c.classList.toggle('sel'); this.info(); }
    };
    g.ondragstart = e => { const c = e.target.closest('.pgc'); if (!c) return; const p = +c.dataset.p; PG.drag = PG.sel.has(p) ? new Set(PG.sel) : new Set([p]); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(p)); };
    g.ondragover = e => { if (!PG.drag) return; e.preventDefault(); g.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); const c = e.target.closest('.pgc'); if (c) c.classList.add('drop'); };
    g.ondrop = e => { if (!PG.drag) return; e.preventDefault(); const c = e.target.closest('.pgc'); this.move(PG.drag, c ? +c.dataset.p : null); PG.drag = null; };
    g.ondragend = () => { PG.drag = null; g.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); };
    this.render();
  }),
  need(p) {
    if (PG.thumbs.has(p) || PG.req.has(p)) return; PG.req.add(p);
    PG.queue = PG.queue.then(async () => {
      try { PG.thumbs.set(p, await pdfThumb(p + 1)); } catch { return; }
      document.querySelectorAll(`#pgrid .pgc[data-p="${p}"]`).forEach(c => this.paint(c.querySelector('canvas'), PG.items.find(i => i.p === p)));
    });
  },
  paint(cv, it) {
    const base = PG.thumbs.get(it.p);
    if (!base) { cv.width = 120; cv.height = 160; return; }
    const q = it.rot % 180 !== 0, w = q ? base.height : base.width, h = q ? base.width : base.height; cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.translate(w / 2, h / 2); x.rotate(it.rot * Math.PI / 180); x.drawImage(base, -base.width / 2, -base.height / 2);
  },
  render() {
    const g = $('#pgrid'), top = g.scrollTop; g.innerHTML = '';
    PG.items.forEach((it, i) => {
      const c = document.createElement('div'); c.className = 'pgc' + (PG.sel.has(it.p) ? ' sel' : ''); c.draggable = true; c.dataset.p = it.p;
      c.innerHTML = '<div class="th"><canvas></canvas></div><div class="n"></div><div class="tb"><button data-a="r" title="Girar">⟳</button><button data-a="d" title="Eliminar">✕</button></div>';
      c.querySelector('.n').textContent = String(i + 1) + (it.p !== i ? '  ·  ' + t('antes {n}', { n: it.p + 1 }) : '');
      g.appendChild(c); this.paint(c.querySelector('canvas'), it); PG.io.observe(c);
    });
    g.scrollTop = top; this.info();
  },
  info() { const el = $('#pgi'); if (el) el.textContent = t('{n} páginas · {s} seleccionadas', { n: PG.items.length, s: PG.sel.size }) + (PG.items.length < ST.pages ? ' · ' + t('{n} eliminadas', { n: ST.pages - PG.items.length }) : ''); },
  remove(ps) {
    const gone = new Set(ps); if (gone.size >= PG.items.length) { toast(t('El PDF debe conservar al menos una página.'), true); return; }
    PG.items = PG.items.filter(i => !gone.has(i.p)); gone.forEach(p => PG.sel.delete(p)); this.render();
  },
  move(ids, beforeP) {
    const moving = PG.items.filter(i => ids.has(i.p)), rest = PG.items.filter(i => !ids.has(i.p));
    if (beforeP != null && ids.has(beforeP)) return;
    const at = beforeP == null ? rest.length : rest.findIndex(i => i.p === beforeP); rest.splice(at, 0, ...moving); PG.items = rest; this.render();
  },
  act(a) {
    const need = ['ccw', 'cw', 'left', 'right', 'del'].includes(a);
    if (need && !PG.sel.size) { toast(t('Elige primero alguna página (haz clic sobre ella).'), true); return; }
    if (a === 'cw' || a === 'ccw') PG.items.forEach(i => { if (PG.sel.has(i.p)) i.rot = (i.rot + (a === 'cw' ? 90 : 270)) % 360; });
    else if (a === 'left') { for (let i = 1; i < PG.items.length; i++) if (PG.sel.has(PG.items[i].p) && !PG.sel.has(PG.items[i - 1].p)) [PG.items[i - 1], PG.items[i]] = [PG.items[i], PG.items[i - 1]]; }
    else if (a === 'right') { for (let i = PG.items.length - 2; i >= 0; i--) if (PG.sel.has(PG.items[i].p) && !PG.sel.has(PG.items[i + 1].p)) [PG.items[i + 1], PG.items[i]] = [PG.items[i], PG.items[i + 1]]; }
    else if (a === 'del') { this.remove([...PG.sel]); return; }
    else if (a === 'all') { if (PG.sel.size === PG.items.length) PG.sel.clear(); else PG.items.forEach(i => PG.sel.add(i.p)); }
    else if (a === 'rev') PG.items.reverse();
    this.render();
  },
  async save() {
    const plan = PG.items.map(i => ({ s: 0, p: i.p, rot: i.rot }));
    if (plan.length === ST.pages && plan.every((e, i) => e.p === i && !e.rot)) throw new Error(t('No has cambiado nada.'));
    await saveBlob(await pdfBlob(async () => PdfTools.assemble([await pdfBytes()], plan)), t('_organizado'), 'pdf');
  }
};
document.addEventListener('keydown', e => { if (P === MODES.p_pages && e.key === 'Delete' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) MODES.p_pages.act('del'); });

/* ---------- UNIR ---------- */
const MG = { files: [] };
const MG_TOTAL = 400 * 1024 * 1024;
MODES.p_merge = {
  title: 'Unir PDF', apply: 'Unir y guardar', own: true,
  open: pdfSafe(async function () {
    const b = await pdfBytes(); MG.files = [{ name: ST.name + '.pdf', bytes: b, pages: ST.pages, size: b.length }];
    ctl('<div class="chips"><button id="mgadd">Añadir PDF…</button></div><div class="info">Las páginas se unen en el orden de la lista. Usa las flechas para cambiarlo.</div>');
    $('#mgadd').onclick = () => this.add();
    $('#pgrid').onclick = e => {
      const b2 = e.target.closest('button'), row = e.target.closest('.mrow'); if (!b2 || !row) return;
      const i = +row.dataset.i, f = MG.files;
      if (b2.dataset.a === 'up' && i > 0) [f[i - 1], f[i]] = [f[i], f[i - 1]];
      else if (b2.dataset.a === 'down' && i < f.length - 1) [f[i + 1], f[i]] = [f[i], f[i + 1]];
      else if (b2.dataset.a === 'x') f.splice(i, 1);
      this.render();
    };
    $('#pgrid').ondragstart = $('#pgrid').ondragover = $('#pgrid').ondrop = $('#pgrid').ondragend = null;
    this.render();
  }),
  async add() {
    let picked; try { picked = await nat.pickPdfs(); } catch { return; }
    for (const f of picked) {
      try {
        if (MG.files.reduce((s, x) => s + x.size, 0) + f.size > MG_TOTAL) throw new Error(t('Demasiado grande: la suma de los PDF no puede pasar de 400 MB.'));
        const bytes = new Uint8Array(await nat.readFile(f.path)), pages = await pdfGuard(() => PdfTools.pageCount(bytes));
        MG.files.push({ name: f.name, bytes, pages, size: f.size });
      } catch (e) { toast(f.name + ': ' + e.message, true); }
    }
    this.render();
  },
  render() {
    const g = $('#pgrid'); g.innerHTML = ''; g.classList.add('list');
    MG.files.forEach((f, i) => {
      const r = document.createElement('div'); r.className = 'mrow'; r.dataset.i = i;
      r.innerHTML = '<span class="mn"></span><span class="mi"></span><button data-a="up" title="Subir">▲</button><button data-a="down" title="Bajar">▼</button><button data-a="x" title="Quitar de la lista">✕</button>';
      r.querySelector('.mn').textContent = (i + 1) + '. ' + f.name; r.querySelector('.mi').textContent = t('{n} págs.', { n: f.pages }) + ' · ' + fmtSize(f.size);
      g.appendChild(r);
    });
  },
  async save() {
    if (MG.files.length < 2) throw new Error(t('Añade al menos otro PDF a la lista.'));
    const plan = []; MG.files.forEach((f, s) => { for (let p = 0; p < f.pages; p++) plan.push({ s, p }); });
    await saveBlob(await pdfBlob(() => PdfTools.assemble(MG.files.map(f => f.bytes), plan)), t('_unido'), 'pdf');
  }
};

/* ---------- DIVIDIR / EXTRAER ---------- */
const SP = { mode: 'Extraer páginas' };
MODES.p_split = {
  title: 'Dividir o extraer', apply: 'Guardar',
  open: pdfSafe(async function () {
    SP.mode = 'Extraer páginas'; showPage1();
    ctl(`<div class="info"><b>Páginas</b>${ST.pages}</div><div class="row"><label>Modo</label><div class="chips" id="spm"></div></div>
      <div class="row" id="sprow"><label>Cuáles</label><input type="text" id="spr" placeholder="1-3, 5, 8-"></div>
      <div class="row" id="spnrow" hidden><label>Cada</label><input type="number" id="spn" min="1" value="2"> <span>páginas</span></div><div class="info" id="spi" style="opacity:.85"></div>`);
    const note = { 'Extraer páginas': 'Crea un PDF nuevo solo con esas páginas.', 'Una por página': 'Crea una carpeta con un PDF por cada página.', 'Cada N páginas': 'Crea una carpeta con partes de N páginas.' };
    const sync = () => { $('#sprow').hidden = SP.mode !== 'Extraer páginas'; $('#spnrow').hidden = SP.mode !== 'Cada N páginas'; $('#spi').textContent = t(note[SP.mode]); };
    chipRow('spm', Object.keys(note), SP.mode, v => { SP.mode = v; sync(); }); sync();
  }),
  async save() {
    const bytes = await pdfBytes();
    if (SP.mode === 'Extraer páginas') {
      const idx = await pdfGuard(async () => PdfTools.parseRange($('#spr').value, ST.pages));
      await saveBlob(await pdfBlob(() => PdfTools.assemble([bytes], idx.map(p => ({ s: 0, p })))), t('_paginas'), 'pdf'); return;
    }
    const n = SP.mode === 'Una por página' ? 1 : Math.max(1, Math.floor(+$('#spn').value) || 0);
    const parts = await pdfGuard(() => PdfTools.split(bytes, n === 1 && SP.mode === 'Una por página' ? 'each' : 'every', n));
    const folder = ST.name + t('_partes'); let last = '';
    for (const part of parts) last = await nat.save({ dir: ST.dir, base: `${folder}/${ST.name}_${String(part.from).padStart(3, '0')}`, ext: '.pdf', bytes: part.bytes });
    Snd.play('ok'); nat.jobQuick({ title: t('{n} archivos guardados', { n: parts.length }), name: folder, out: dirname(last) });
  }
};

/* ---------- MARCA DE AGUA ---------- */
const WM = { text: 'CONFIDENCIAL', size: 64, opacity: 25, angle: 45, color: PDF_COLORS.Gris, pages: '', s1: null };
MODES.p_mark = {
  title: 'Marca de agua', apply: 'Guardar PDF',
  open: pdfSafe(async function () {
    Object.assign(WM, { text: t('CONFIDENCIAL'), size: 64, opacity: 25, angle: 45, color: PDF_COLORS.Gris, pages: '', s1: await pdfPage1Size() });
    WM.size = Math.round(Math.min(96, Math.max(24, 0.85 * Math.hypot(WM.s1.w, WM.s1.h) / (WM.text.length * 0.62))));   // starts as large as fits on the diagonal
    ctl(`<div class="row"><label>Texto</label><input type="text" id="wt" maxlength="120"></div>` + slider('ws', 'Tamaño', 12, 200, WM.size, '') + slider('wo', 'Opacidad', 5, 100, WM.opacity, '%') + slider('wa', 'Ángulo', -90, 90, WM.angle, '°') +
      `<div class="row"><label>Color</label><div class="chips" id="wc"></div></div><div class="row"><label>Páginas</label><input type="text" id="wp" placeholder="todas  ·  o por ejemplo 1-3, 5"></div><div class="info" style="opacity:.8">Vista previa de la página 1.</div>`);
    $('#wt').value = WM.text; $('#wt').oninput = e => { WM.text = e.target.value; this.render(); };
    onSlider('ws', '', v => { WM.size = v; this.render(); }); onSlider('wo', '%', v => { WM.opacity = v; this.render(); }); onSlider('wa', '°', v => { WM.angle = v; this.render(); });
    colorChips('wc', 'Gris', c => { WM.color = c; this.render(); }); $('#wp').oninput = e => { WM.pages = e.target.value; };
    this.render();
  }),
  render() {
    showPage1(); const k = W.width / WM.s1.w, x = pctx;
    x.save(); x.translate(W.width / 2, W.height / 2); x.rotate(-WM.angle * Math.PI / 180); x.globalAlpha = WM.opacity / 100;
    x.fillStyle = rgbCss(WM.color); x.font = `bold ${WM.size * k}px Helvetica, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(WM.text, 0, 0); x.restore();
  },
  async save() {
    const bytes = await pdfBytes(), pages = WM.pages.trim() ? await pdfGuard(async () => PdfTools.parseRange(WM.pages, ST.pages)) : null;
    await saveBlob(await pdfBlob(() => PdfTools.watermark(bytes, { text: WM.text, size: WM.size, opacity: WM.opacity / 100, angle: WM.angle, color: WM.color, pages })), t('_marca'), 'pdf');
  }
};

/* ---------- NUMERAR ---------- */
const NP_POS = { 'Abajo centro': 'bottom-center', 'Abajo derecha': 'bottom-right', 'Abajo izquierda': 'bottom-left', 'Arriba centro': 'top-center', 'Arriba derecha': 'top-right', 'Arriba izquierda': 'top-left' };
const NP_FMT = () => ({ '1': '{n}', '1 / N': '{n} / {total}', 'Página 1 de N': t('Página {n} de {total}') });
const NP = { pos: 'bottom-center', fmt: '1', size: 11, start: 1, from: 1, s1: null };
MODES.p_numbers = {
  title: 'Numerar páginas', apply: 'Guardar PDF',
  open: pdfSafe(async function () {
    Object.assign(NP, { pos: 'bottom-center', fmt: '1', size: 11, start: 1, from: 1, s1: await pdfPage1Size() });
    ctl(`<div class="row"><label>Posición</label><div class="chips" id="np"></div></div><div class="row"><label>Formato</label><div class="chips" id="nf"></div></div>` + slider('ns', 'Tamaño', 8, 28, NP.size, '') +
      `<div class="row"><label>Desde la página</label><input type="number" id="nfrom" min="1" max="${ST.pages}" value="1"> <label style="width:auto">Empieza en</label><input type="number" id="nst" min="0" value="1"></div><div class="info" style="opacity:.8">Vista previa de la página 1.</div>`);
    chipRow('np', Object.keys(NP_POS), 'Abajo centro', v => { NP.pos = NP_POS[v]; this.render(); }); chipRow('nf', Object.keys(NP_FMT()), '1', v => { NP.fmt = v; this.render(); });
    onSlider('ns', '', v => { NP.size = v; this.render(); });
    $('#nfrom').onchange = e => { NP.from = Math.min(ST.pages, Math.max(1, Math.floor(+e.target.value) || 1)); e.target.value = NP.from; this.render(); };
    $('#nst').onchange = e => { NP.start = Math.floor(+e.target.value) || 0; this.render(); };
    this.render();
  }),
  fmtString() { return NP_FMT()[NP.fmt]; },
  render() {
    showPage1(); const k = W.width / NP.s1.w, x = pctx, total = NP.start + ST.pages - NP.from;
    const text = this.fmtString().replace('{n}', NP.start).replace('{total}', total), size = NP.size * k, m = 28 * k;
    x.font = `bold ${size}px Helvetica, Arial, sans-serif`; x.fillStyle = '#333'; x.textBaseline = 'alphabetic';
    const w = x.measureText(text).width, p = NP.pos;
    const px = p.endsWith('center') ? (W.width - w) / 2 : p.endsWith('right') ? W.width - m - w : m, py = p.startsWith('bottom') ? W.height - m : m + size * 0.75;
    x.fillText(text, px, py);
  },
  async save() {
    const bytes = await pdfBytes();
    await saveBlob(await pdfBlob(() => PdfTools.numbers(bytes, { pos: NP.pos, format: this.fmtString(), size: NP.size, start: NP.start, from: NP.from })), t('_numerado'), 'pdf');
  }
};

/* ---------- METADATOS ---------- */
const MT = { strip: false, cur: null };
MODES.p_meta = {
  title: 'Metadatos del PDF', apply: 'Guardar PDF',
  open: pdfSafe(async function () {
    MT.strip = false; showPage1(); MT.cur = await pdfGuard(async () => PdfTools.info(await pdfBytes()));
    const c = MT.cur;
    ctl(`<div class="info"><b>Páginas</b>${c.pages}<br><b>Creado con</b><span id="mmk"></span></div><div class="row"><label>Qué hacer</label><div class="chips" id="mm"></div></div><div id="mf">` +
      [['Título', 'mt'], ['Autor', 'ma'], ['Asunto', 'ms'], ['Palabras clave', 'mk']].map(([l, id]) => `<div class="row"><label>${l}</label><input type="text" id="${id}" maxlength="500"></div>`).join('') + '</div>');
    $('#mmk').textContent = [c.creator, c.producer].filter(Boolean).join(' / ') || '—';
    $('#mt').value = c.title; $('#ma').value = c.author; $('#ms').value = c.subject; $('#mk').value = c.keywords;
    chipRow('mm', ['Editar', 'Quitar todos'], 'Editar', v => { MT.strip = v === 'Quitar todos'; $('#mf').hidden = MT.strip; });
  }),
  async save() {
    const bytes = await pdfBytes();
    const out = MT.strip ? { strip: true } : { title: $('#mt').value, author: $('#ma').value, subject: $('#ms').value, keywords: $('#mk').value };
    await saveBlob(await pdfBlob(() => PdfTools.setInfo(bytes, out)), MT.strip ? t('_limpio') : t('_editado'), 'pdf');
  }
};
