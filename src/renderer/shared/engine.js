/* Motor: lectura de archivos y codificadores. Sin UI. */
/* pdf.js is an ES module (loaded by pdf-loader.js); this resolves once it is ready. */
window.pdfReady = window.pdfReady || new Promise(resolve => { window.__pdfResolve = resolve; });
async function pdfLib() { if (!window.pdfjsLib) await window.pdfReady; return window.pdfjsLib; }
async function loadPdf(data) { return (await pdfLib()).getDocument({ data, isEvalSupported: false }).promise; }

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif', svg: 'image/svg+xml', tiff: 'image/tiff', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', html: 'text/html', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'avif', 'svg', 'gif'];

function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function cloneCanvas(s) { const c = newCanvas(s.width, s.height); c.getContext('2d').drawImage(s, 0, 0); return c; }
function toBlob(c, type, q) { return new Promise(r => c.toBlob(r, type, q)); }
function flat(c) { const o = newCanvas(c.width, c.height), x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0); return o; }
function scaled(c, pct) {
  if (pct === 100) return c;
  const o = newCanvas(Math.max(1, Math.round(c.width * pct / 100)), Math.max(1, Math.round(c.height * pct / 100)));
  const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height); return o;
}
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB'; }

function blobToCanvas(blob) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(blob), im = new Image();
    im.onload = () => { const w = im.naturalWidth || 1024, h = im.naturalHeight || 768, c = newCanvas(w, h); c.getContext('2d').drawImage(im, 0, 0, w, h); URL.revokeObjectURL(u); res(c); };
    im.onerror = () => rej(new Error(t('No se pudo leer la imagen.')));
    im.src = u;
  });
}
async function renderPdfPage(pdf, n) {
  const pg = await pdf.getPage(n), v1 = pg.getViewport({ scale: 1 }), sc = Math.min(2.5, 3000 / v1.width), vp = pg.getViewport({ scale: sc });
  const c = newCanvas(Math.round(vp.width), Math.round(vp.height)), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvas: c, canvasContext: x, viewport: vp }).promise; return c;
}
async function pdfLines(pdf) {
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent(); let line = '', ly = null; const L = [];
    for (const it of tc.items) { const y = it.transform[5]; if (ly !== null && Math.abs(y - ly) > 2) { L.push(line); line = ''; } line += it.str; ly = y; }
    L.push(line); out.push(L);
  }
  return out;
}

/* ---- codificadores ---- */
function bmpBlob(c) {
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, size = 54 + w * h * 4, buf = new ArrayBuffer(size), v = new DataView(buf);
  v.setUint8(0, 66); v.setUint8(1, 77); v.setUint32(2, size, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true);
  v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 32, true); v.setUint32(34, w * h * 4, true);
  let o = 54; for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; v.setUint8(o++, d[i + 2]); v.setUint8(o++, d[i + 1]); v.setUint8(o++, d[i]); v.setUint8(o++, d[i + 3]); }
  return new Blob([buf], { type: MIME.bmp });
}
function tiffBlob(c) {
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, n = 11, bps = 8 + 2 + n * 12 + 4, data = bps + 8;
  const buf = new ArrayBuffer(data + w * h * 4), v = new DataView(buf);
  v.setUint16(0, 0x4949, true); v.setUint16(2, 42, true); v.setUint32(4, 8, true); v.setUint16(8, n, true);
  let o = 10;
  const e = (tag, type, cnt, val) => { v.setUint16(o, tag, true); v.setUint16(o + 2, type, true); v.setUint32(o + 4, cnt, true); if (type === 3 && cnt === 1) v.setUint16(o + 8, val, true); else v.setUint32(o + 8, val, true); o += 12; };
  e(256, 4, 1, w); e(257, 4, 1, h); e(258, 3, 4, bps); e(259, 3, 1, 1); e(262, 3, 1, 2); e(273, 4, 1, data);
  e(277, 3, 1, 4); e(278, 4, 1, h); e(279, 4, 1, w * h * 4); e(284, 3, 1, 1); e(338, 3, 1, 2);
  v.setUint32(o, 0, true);
  for (let i = 0; i < 4; i++) v.setUint16(bps + i * 2, 8, true);
  new Uint8Array(buf, data).set(d);
  return new Blob([buf], { type: MIME.tiff });
}
async function encode(c, fmt, q = 0.92, pct = 100) {
  c = scaled(c, pct);
  if (fmt === 'jpg') return toBlob(flat(c), MIME.jpg, q);
  if (fmt === 'png') return toBlob(c, MIME.png);
  if (fmt === 'webp') { const b = await toBlob(c, MIME.webp, q); if (!b || b.type !== MIME.webp) throw new Error(t('No se puede crear WEBP.')); return b; }
  if (fmt === 'avif') { const b = await toBlob(c, MIME.avif, q); if (!b || b.type !== MIME.avif) throw new Error(t('Este motor no puede crear AVIF. Prueba con WEBP.')); return b; }
  if (fmt === 'bmp') return bmpBlob(flat(c));
  if (fmt === 'tiff') return tiffBlob(c);
  if (fmt === 'svg') {
    const u = c.toDataURL('image/png');
    return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}"><image width="${c.width}" height="${c.height}" xlink:href="${u}"/></svg>`], { type: MIME.svg });
  }
  if (fmt === 'pdf') {
    const j = flat(c), { jsPDF } = window.jspdf;
    const d = new jsPDF({ orientation: j.width > j.height ? 'l' : 'p', unit: 'px', format: [j.width, j.height], compress: true });
    d.addImage(j.toDataURL('image/jpeg', q), 'JPEG', 0, 0, j.width, j.height); return d.output('blob');
  }
  throw new Error(t('Formato no soportado: {f}', { f: fmt }));
}

/* ---- DOCX ---- */
// eslint-disable-next-line no-control-regex -- XML 1.0 forbids these control characters
const xmlEsc = s => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function buildDocx(bodyXml, png) {
  const z = new JSZip();
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${png ? '<Default Extension="png" ContentType="image/png"/>' : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  if (png) {
    z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>');
    z.file('word/media/image1.png', png);
  }
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${bodyXml}</w:body></w:document>`);
  return z.generateAsync({ type: 'blob', mimeType: MIME.docx });
}
function docxFromLines(pages) {
  let body = '';
  pages.forEach((L, i) => {
    L.forEach(l => body += `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(l)}</w:t></w:r></w:p>`);
    if (i < pages.length - 1) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  });
  return buildDocx(body);
}
async function docxFromImage(c) {
  const png = await (await toBlob(c, MIME.png)).arrayBuffer();
  const k = Math.min(1, (6 * 914400) / (c.width * 9525)), cx = Math.round(c.width * 9525 * k), cy = Math.round(c.height * 9525 * k);
  const body = `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Imagen"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  return buildDocx(body, png);
}
async function docxToText(file) {
  const z = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await z.file('word/document.xml').async('string');
  return xml.replace(/<\/w:p>/g, '\n').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/* ---- Markdown ---- */
function mdBlocks(text) {
  const out = []; let code = null;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if (/^\s*```/.test(raw)) { if (code) { out.push({ t: 'code', s: code.join('\n') }); code = null; } else code = []; continue; }
    if (code) { code.push(raw); continue; }
    let m;
    if (!raw.trim()) out.push({ t: 'br' });
    else if ((m = raw.match(/^(#{1,6})\s+(.*)$/))) out.push({ t: 'h' + m[1].length, s: m[2] });
    else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) out.push({ t: 'hr' });
    else if ((m = raw.match(/^\s*[-*+]\s+(.*)$/))) out.push({ t: 'li', s: m[1], n: '•' });
    else if ((m = raw.match(/^\s*(\d+)[.)]\s+(.*)$/))) out.push({ t: 'li', s: m[2], n: m[1] + '.' });
    else if ((m = raw.match(/^>\s?(.*)$/))) out.push({ t: 'quote', s: m[1] });
    else out.push({ t: 'p', s: raw });
  }
  if (code) out.push({ t: 'code', s: code.join('\n') });
  return out;
}
function mdInline(s) {
  s = s.replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, '$1');
  const runs = []; const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g; let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) runs.push({ s: s.slice(last, m.index) });
    if (m[2] !== undefined) runs.push({ s: m[2], b: 1 }); else if (m[4] !== undefined) runs.push({ s: m[4], i: 1 }); else runs.push({ s: m[5], c: 1 });
    last = re.lastIndex;
  }
  if (last < s.length) runs.push({ s: s.slice(last) });
  return runs;
}
function stripMd(text) {
  return mdBlocks(text).map(b => b.t === 'br' || b.t === 'hr' ? '' : b.t === 'code' ? b.s : (b.t === 'li' ? b.n + ' ' : '') + mdInline(b.s).map(r => r.s).join('')).join('\n');
}
function docxFromMd(text) {
  const run = (r, bold, sz) => `<w:r><w:rPr>${r.c ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : ''}${r.b || bold ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${sz ? `<w:sz w:val="${sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xmlEsc(r.s)}</w:t></w:r>`;
  const SZ = { h1: 40, h2: 32, h3: 28, h4: 26, h5: 24, h6: 22 };
  let body = '';
  for (const b of mdBlocks(text)) {
    if (b.t === 'br') continue;
    if (b.t === 'hr') body += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>';
    else if (b.t === 'code') body += b.s.split('\n').map(l => `<w:p>${run({ s: l, c: 1 })}</w:p>`).join('');
    else if (SZ[b.t]) body += `<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>${mdInline(b.s).map(r => run(r, true, SZ[b.t])).join('')}</w:p>`;
    else if (b.t === 'li') body += `<w:p><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>${run({ s: b.n + ' ' })}${mdInline(b.s).map(r => run(r)).join('')}</w:p>`;
    else if (b.t === 'quote') body += `<w:p><w:pPr><w:ind w:left="480"/></w:pPr>${mdInline(b.s).map(r => run({ ...r, i: 1 })).join('')}</w:p>`;
    else body += `<w:p>${mdInline(b.s).map(r => run(r)).join('')}</w:p>`;
  }
  return buildDocx(body);
}
function htmlFromMd(text, title) {
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const inl = s => esc(s).replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '<img alt="$1" src="$2">').replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/(\*\*|__)(.+?)\1/g, '<b>$2</b>').replace(/(\*|_)(.+?)\1/g, '<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  let h = '', list = null;
  const close = () => { if (list) { h += `</${list}>`; list = null; } };
  for (const b of mdBlocks(text)) {
    if (b.t === 'li') { const tag = b.n === '•' ? 'ul' : 'ol'; if (list !== tag) { close(); h += `<${tag}>`; list = tag; } h += `<li>${inl(b.s)}</li>`; continue; }
    close();
    if (b.t === 'br') continue;
    if (b.t === 'hr') h += '<hr>'; else if (b.t === 'code') h += `<pre><code>${esc(b.s)}</code></pre>`;
    else if (b.t === 'quote') h += `<blockquote>${inl(b.s)}</blockquote>`; else if (b.t[0] === 'h') h += `<${b.t}>${inl(b.s)}</${b.t}>`; else h += `<p>${inl(b.s)}</p>`;
  }
  close();
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#222}pre{background:#f4f4f6;padding:12px;border-radius:8px;overflow:auto}code{background:#f4f4f6;padding:1px 5px;border-radius:4px;font-family:Consolas,monospace}blockquote{border-left:4px solid #ccc;margin:0;padding-left:12px;color:#555}</style></head><body>${h}</body></html>`;
}
function pdfFromText(text, md) {
  const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'pt', format: 'a4' }), W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), M = 50, max = W - 2 * M;
  const blocks = md ? mdBlocks(text) : text.split(/\r?\n/).map(s => s ? { t: 'p', s } : { t: 'br' });
  const SZ = { h1: 24, h2: 19, h3: 16, h4: 14, h5: 12.5, h6: 12 }; let y = M;
  const put = (s, size, style, indent = 0, mono) => {
    d.setFont(mono ? 'courier' : 'helvetica', style); d.setFontSize(size);
    for (const l of d.splitTextToSize(s || ' ', max - indent)) { if (y + size > H - M) { d.addPage(); y = M; } d.text(l, M + indent, y + size * .8); y += size * 1.4; }
  };
  for (const b of blocks) {
    if (b.t === 'br') y += 6;
    else if (b.t === 'hr') { d.setDrawColor(160); d.line(M, y + 4, W - M, y + 4); y += 12; }
    else if (b.t === 'code') b.s.split('\n').forEach(l => put(l, 10, 'normal', 8, true));
    else if (SZ[b.t]) { y += 6; put(mdInline(b.s).map(r => r.s).join(''), SZ[b.t], 'bold'); }
    else if (b.t === 'li') put(b.n + ' ' + mdInline(b.s).map(r => r.s).join(''), 11, 'normal', 14);
    else put(md ? mdInline(b.s).map(r => r.s).join('') : b.s, 11, 'normal', b.t === 'quote' ? 16 : 0);
  }
  return d.output('blob');
}
