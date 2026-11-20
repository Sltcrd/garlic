/**
 * PDF page tools on top of pdf-lib: bytes in, bytes out, no file or network access.
 * Works in the editor window (global PDFLib) and in Node (the unit tests).
 *
 * pdf-lib cannot open encrypted files and does not rebuild damaged ones: in those cases the tools refuse with a
 * clear message and the original file is never touched (results are always saved as new files).
 * Error messages are Spanish source strings (with optional {placeholders} in error.params); the UI passes them through t().
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('pdf-lib'));
  else root.PdfTools = factory(root.PDFLib);
})(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  const { PDFDocument, PDFName, StandardFonts, rgb, degrees } = PDFLib;
  const MAX_BYTES = 300 * 1024 * 1024, MAX_PAGES = 3000;

  class PdfToolError extends Error { constructor(m) { super(m); this.name = 'PdfToolError'; } }
  const bad = (m, params) => { const e = new PdfToolError(m); e.params = params; throw e; };
  const toBytes = b => (b instanceof Uint8Array ? b : new Uint8Array(b));
  const norm360 = a => ((a % 360) + 360) % 360;

  /** Opens a PDF; encrypted, damaged or oversized files are refused with a readable message. */
  async function load(bytes) {
    bytes = toBytes(bytes);
    if (bytes.length > MAX_BYTES) bad('El PDF es demasiado grande para editarlo (máximo 300 MB).');
    let doc;
    try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); }
    catch (e) { bad(/encrypt/i.test(String(e && e.message)) ? 'Este PDF está cifrado o protegido con contraseña; Garlic no puede modificarlo.' : 'No se pudo leer el PDF (¿está dañado?).'); }
    let n; try { n = doc.getPageCount(); } catch { bad('No se pudo leer el PDF (¿está dañado?).'); }   // a file can parse and still have no page tree
    if (n > MAX_PAGES) bad('El PDF tiene demasiadas páginas para editarlo (máximo 3000).');
    return doc;
  }
  async function pageCount(bytes) { return (await load(bytes)).getPageCount(); }

  /** "1-3, 5, 8-" → [0,1,2,4,7,...] (0-based, in the order written, no repeats). */
  function parseRange(text, total) {
    const out = [], seen = new Set();
    for (const raw of String(text || '').split(/[,;\s]+/)) {
      const tok = raw.trim(); if (!tok) continue;
      const m = tok.match(/^(\d*)(-?)(\d*)$/); if (!m || (!m[1] && !m[3])) bad('Rango no válido: usa por ejemplo 1-3, 5, 8-');
      let a = m[1] ? +m[1] : 1, b = m[2] ? (m[3] ? +m[3] : total) : a;
      if (a < 1 || b < 1 || a > total || b > total) bad('Hay páginas fuera del documento (tiene {n}).', { n: total });
      if (a > b) bad('Rango no válido: usa por ejemplo 1-3, 5, 8-');
      for (let i = a; i <= b; i++) if (!seen.has(i)) { seen.add(i); out.push(i - 1); }
    }
    if (!out.length) bad('Escribe qué páginas quieres.');
    return out;
  }

  /**
   * Builds a new PDF from pages of one or more PDFs.
   * @param {Array<Uint8Array|ArrayBuffer>} sources
   * @param {Array<{s:number,p:number,rot?:number}>} plan source index, 0-based page, extra clockwise rotation (0/90/180/270)
   */
  async function assemble(sources, plan) {
    if (!Array.isArray(plan) || !plan.length) bad('No queda ninguna página.');
    if (plan.length > MAX_PAGES) bad('El PDF tiene demasiadas páginas para editarlo (máximo 3000).');
    const docs = []; for (const s of sources) docs.push(await load(s));
    const keys = new Set();
    for (const e of plan) {
      if (!Number.isInteger(e.s) || e.s < 0 || e.s >= docs.length || !Number.isInteger(e.p) || e.p < 0 || e.p >= docs[e.s].getPageCount() || ![undefined, 0, 90, 180, 270].includes(e.rot)) bad('Orden de páginas no válido.');
      keys.add(e.s + ':' + e.p);
    }
    const rotate = (pg, extra) => { if (extra) pg.setRotation(degrees(norm360(pg.getRotation().angle + extra))); };

    if (docs.length === 1 && keys.size === plan.length) {   // one file, no repeats: edit in place so bookmarks, forms and document info survive
      const doc = docs[0], pages = doc.getPages(), keep = plan.map(e => { const pg = pages[e.p]; rotate(pg, e.rot); return pg; });
      for (let i = pages.length - 1; i >= 0; i--) doc.removePage(i);
      keep.forEach(pg => doc.addPage(pg));
      return doc.save();
    }
    const out = await PDFDocument.create();
    out.setProducer('Garlic'); out.setCreator('Garlic');
    const first = docs.map((d, si) => { const idx = [...new Set(plan.filter(e => e.s === si).map(e => e.p))]; return { idx, copies: null, d }; });
    for (const f of first) f.copies = f.idx.length ? new Map((await out.copyPages(f.d, f.idx)).map((pg, i) => [f.idx[i], pg])) : new Map();
    const used = new Set();
    for (const e of plan) {
      const k = e.s + ':' + e.p; let pg;
      if (!used.has(k)) { used.add(k); pg = first[e.s].copies.get(e.p); } else pg = (await out.copyPages(docs[e.s], [e.p]))[0];
      rotate(pg, e.rot); out.addPage(pg);
    }
    return out.save();
  }

  /** Splits one PDF into several. mode: 'each' (one file per page) or 'every' (n pages per file). */
  async function split(bytes, mode, n) {
    const src = await load(bytes), total = src.getPageCount(), size = mode === 'each' ? 1 : n;
    if (!Number.isInteger(size) || size < 1) bad('Escribe cuántas páginas quieres en cada parte.');
    const parts = [];
    for (let from = 0; from < total; from += size) {
      const out = await PDFDocument.create(); out.setProducer('Garlic'); out.setCreator('Garlic');
      const idx = []; for (let i = from; i < Math.min(total, from + size); i++) idx.push(i);
      for (const pg of await out.copyPages(src, idx)) out.addPage(pg);
      parts.push({ from: from + 1, to: idx[idx.length - 1] + 1, bytes: await out.save() });
    }
    return parts;
  }

  /* ---- text on pages. Coordinates are "visual" (as the reader sees the page) and mapped back to the page's own space, which differs when the page has /Rotate ---- */
  function view(page) {
    const b = page.getMediaBox(), r = norm360(page.getRotation().angle), odd = r === 90 || r === 270;
    return { b, r, W: odd ? b.height : b.width, H: odd ? b.width : b.height };
  }
  function toPage(v, x, y, a) {
    const { b, r } = v; let px, py;
    if (r === 0) { px = x; py = y; } else if (r === 90) { px = b.width - y; py = x; } else if (r === 180) { px = b.width - x; py = b.height - y; } else { px = y; py = b.height - x; }
    return { x: b.x + px, y: b.y + py, angle: a + r };
  }
  const color = c => rgb(...(Array.isArray(c) && c.length === 3 ? c.map(v => Math.min(1, Math.max(0, +v || 0))) : [0, 0, 0]));
  function drawVisual(page, font, text, size, x, y, a, opts) {
    const p = toPage(view(page), x, y, a);
    page.drawText(text, { x: p.x, y: p.y, size, font, rotate: degrees(p.angle), color: color(opts.color), opacity: opts.opacity });
  }
  async function withFont(doc, text, fn) {
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    try { font.widthOfTextAtSize(text, 12); } catch { bad('El texto tiene caracteres que el PDF no admite aquí (usa letras latinas, números y signos básicos).'); }
    return fn(font);
  }

  /** Diagonal (or any angle) text in the middle of the pages. opts: text, size, opacity 0-1, angle (degrees, counter-clockwise), color [r,g,b] 0-1, pages (0-based indexes or null = all) */
  async function watermark(bytes, o) {
    const text = String(o.text || '').trim().slice(0, 120); if (!text) bad('Escribe el texto de la marca de agua.');
    const size = Math.min(400, Math.max(6, +o.size || 64)), a = Math.min(180, Math.max(-180, +o.angle || 0)), opacity = Math.min(1, Math.max(0.02, o.opacity == null ? 0.25 : +o.opacity));
    const doc = await load(bytes), pages = doc.getPages(), want = o.pages ? new Set(o.pages) : null;
    await withFont(doc, text, font => {
      const w = font.widthOfTextAtSize(text, size), off = size * 0.35, rad = a * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
      pages.forEach((pg, i) => {
        if (want && !want.has(i)) return;
        const v = view(pg), cx = v.W / 2, cy = v.H / 2;
        drawVisual(pg, font, text, size, cx - (w / 2 * c - off * s), cy - (w / 2 * s + off * c), a, { color: o.color, opacity });
      });
    });
    return doc.save();
  }

  const POS = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'];
  /** Page numbers. opts: pos, format ("{n}", "{n} / {total}"…), start, from (first page numbered, 1-based), size, color */
  async function numbers(bytes, o) {
    const pos = POS.includes(o.pos) ? o.pos : 'bottom-center', size = Math.min(48, Math.max(6, +o.size || 11)), start = Number.isInteger(+o.start) ? +o.start : 1;
    const doc = await load(bytes), pages = doc.getPages(), from = Math.min(pages.length, Math.max(1, +o.from || 1)), fmt = String(o.format || '{n}').slice(0, 60);
    const total = start + pages.length - from;
    await withFont(doc, fmt.replace(/\{(n|total)\}/g, '0'), font => {
      pages.forEach((pg, i) => {
        if (i + 1 < from) return;
        const text = fmt.replace(/\{n\}/g, String(start + i + 1 - from)).replace(/\{total\}/g, String(total));
        const v = view(pg), w = font.widthOfTextAtSize(text, size), m = 28;
        const x = pos.endsWith('center') ? (v.W - w) / 2 : pos.endsWith('right') ? v.W - m - w : m, y = pos.startsWith('bottom') ? m : v.H - m - size * 0.75;
        drawVisual(pg, font, text, size, x, y, 0, { color: o.color || [0.2, 0.2, 0.2], opacity: 1 });
      });
    });
    return doc.save();
  }

  const FIELDS = { title: ['getTitle', 'setTitle', 'Title'], author: ['getAuthor', 'setAuthor', 'Author'], subject: ['getSubject', 'setSubject', 'Subject'], creator: ['getCreator', 'setCreator', 'Creator'], producer: ['getProducer', 'setProducer', 'Producer'] };
  async function info(bytes) {
    const doc = await load(bytes), out = { pages: doc.getPageCount(), keywords: doc.getKeywords() || '' };
    for (const k of Object.keys(FIELDS)) out[k] = doc[FIELDS[k][0]]() || '';
    return out;
  }
  /** Sets the document information; with strip, removes it all (including the XMP packet). */
  async function setInfo(bytes, o) {
    const doc = await load(bytes), dict = doc.getInfoDict();
    if (o.strip) {
      for (const k of Object.keys(FIELDS)) dict.delete(PDFName.of(FIELDS[k][2]));
      for (const k of ['Keywords', 'CreationDate', 'ModDate', 'Trapped']) dict.delete(PDFName.of(k));
      doc.catalog.delete(PDFName.of('Metadata'));
    } else {
      for (const k of Object.keys(FIELDS)) if (typeof o[k] === 'string') { if (o[k].trim()) doc[FIELDS[k][1]](o[k].trim().slice(0, 500)); else dict.delete(PDFName.of(FIELDS[k][2])); }
      if (typeof o.keywords === 'string') { if (o.keywords.trim()) doc.setKeywords(o.keywords.split(',').map(s => s.trim()).filter(Boolean)); else dict.delete(PDFName.of('Keywords')); }
    }
    return doc.save();
  }

  return { PdfToolError, MAX_BYTES, MAX_PAGES, POS, load, pageCount, parseRange, assemble, split, watermark, numbers, info, setInfo };
});
