/* Formatos: tipos de archivo, salidas posibles y conversores (sin UI) */
const EXT_KIND = {};
const addKind = (k, l) => l.forEach(e => EXT_KIND[e] = k);
addKind('pdf', ['pdf']);
addKind('image', ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'bmp', 'avif', 'svg', 'gif', 'ico', 'tif', 'tiff', 'heic', 'heif']);
addKind('txt', ['txt', 'text', 'log']); addKind('md', ['md', 'markdown']); addKind('docx', ['docx']); addKind('html', ['html', 'htm']);
addKind('rtf', ['rtf']); addKind('pptx', ['pptx']); addKind('epub', ['epub']);
addKind('sheet', ['xlsx', 'xlsm', 'xls', 'ods', 'csv', 'tsv']); addKind('subs', ['srt', 'vtt']);
addKind('audio', ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus', 'weba']);
addKind('video', ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi']);
addKind('archive', ['zip', 'tar', 'gz', 'tgz']);
const NORM = { jpeg: 'jpg', jfif: 'jpg', tif: 'tiff', markdown: 'md', text: 'txt', htm: 'html' };
const normExt = e => NORM[e] || e;
const kindOfExt = e => EXT_KIND[e] || 'other';

const OUT = {
  pdf: ['docx', 'txt', 'md', 'html', 'epub', 'jpg', 'png', 'webp', 'bmp', 'tiff'],
  image: ['png', 'jpg', 'webp', 'bmp', 'tiff', 'svg', 'ico', 'pdf', 'docx'],
  txt: ['docx', 'pdf', 'md', 'html', 'epub'], md: ['docx', 'pdf', 'html', 'epub', 'txt'], html: ['md', 'txt', 'docx', 'pdf', 'epub'],
  rtf: ['txt', 'md', 'docx', 'pdf', 'html', 'epub'], docx: ['txt', 'md', 'pdf', 'html', 'epub'], pptx: ['pdf', 'png', 'jpg', 'txt', 'md', 'docx', 'html'], epub: ['txt', 'md', 'docx', 'pdf', 'html'],
  sheet: ['xlsx', 'csv', 'tsv', 'ods', 'html', 'json', 'pdf'], subs: ['srt', 'vtt', 'txt'],
  audio: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff', 'wma'], video: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'gif', 'mp3', 'm4a', 'jpg', 'png'],
  archive: ['extract', 'zip', 'tar', 'tgz'], folder: ['zip', 'tar', 'tgz'], other: ['zip', 'gz']
};
function outputsFor(kind, ext) {
  const src = ext === 'xlsm' || ext === 'xls' ? 'xlsx' : ext;
  return (OUT[kind] || []).filter(f => f !== src && !(kind === 'archive' && f === 'tgz' && (ext === 'gz')) && !(kind === 'archive' && f === 'zip' && ext === 'zip'));
}

/* ---------- texto ---------- */
const dec = u => new TextDecoder('utf-8').decode(u);
let JP = { id: 0 };
const prog = (p, label) => { if (JP.id && nat.jobProgress) nat.jobProgress({ id: JP.id, p, label }); };
const blobOf = (s, type) => new Blob([s], { type });
function htmlToText(h) {
  h = h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, '\n').replace(/<[^>]+>/g, '');
  const t = document.createElement('textarea'); t.innerHTML = h; return t.value.replace(/\n{3,}/g, '\n\n').trim();
}
function rtfToText(s) {
  let out = '', depth = 0, skip = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') { depth++; if (skip < 0 && /^\{\\(\*|fonttbl|colortbl|stylesheet|info|pict)/.test(s.slice(i, i + 14))) skip = depth; }
    else if (c === '}') { if (depth === skip) skip = -1; depth--; }
    else if (skip < 0) out += c;
  }
  return out.replace(/\\par[d]?\b ?/g, '\n').replace(/\\line\b ?/g, '\n').replace(/\\tab\b ?/g, '\t').replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(n < 0 ? +n + 65536 : +n)).replace(/\\([{}\\])/g, '$1').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
async function docxBytesToText(bytes) {
  const z = await JSZip.loadAsync(bytes), xml = await z.file('word/document.xml').async('string');
  return xml.replace(/<\/w:p>/g, '\n').replace(/<w:br[^>]*\/>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
async function pptxModel(bytes) {
  const z = await JSZip.loadAsync(bytes), names = Object.keys(z.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  let plain = '', md = '';
  for (let i = 0; i < names.length; i++) {
    const xml = await z.file(names[i]).async('string'), t = xml.replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    plain += `${I18N.t('Diapositiva')} ${i + 1}\n${t}\n\n`; md += `## ${I18N.t('Diapositiva')} ${i + 1}\n\n${t.split('\n').filter(Boolean).map(l => '- ' + l).join('\n')}\n\n`;
  }
  return { plain: plain.trim(), md: md.trim() };
}
async function epubText(bytes) {
  const z = await JSZip.loadAsync(bytes); let files = [];
  try {
    const root = (await z.file('META-INF/container.xml').async('string')).match(/full-path="([^"]+)"/)[1], opf = await z.file(root).async('string'), base = root.includes('/') ? root.replace(/[^/]*$/, '') : '';
    const man = {}; for (const m of opf.matchAll(/<item\b[^>]*>/g)) { const id = (m[0].match(/\bid="([^"]+)"/) || [])[1], hr = (m[0].match(/\bhref="([^"]+)"/) || [])[1]; if (id && hr) man[id] = base + decodeURIComponent(hr); }
    for (const m of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)) if (man[m[1]]) files.push(man[m[1]]);
  } catch (e) { }
  if (!files.length) files = Object.keys(z.files).filter(n => /\.(x?html?)$/i.test(n)).sort();
  let out = []; for (const f of files) { const e = z.file(f); if (e) out.push(htmlToText(await e.async('string'))); }
  return out.filter(Boolean).join('\n\n');
}
async function textModel(kind, bytes) {
  switch (kind) {
    case 'txt': return { plain: dec(bytes) };
    case 'md': { const t = dec(bytes); return { plain: stripMd(t), md: t, bodyHtml: marked.parse(t) }; }
    case 'html': { const t = dec(bytes); return { plain: htmlToText(t), htmlRaw: t }; }
    case 'rtf': return { plain: rtfToText(dec(bytes)) };
    case 'docx': { const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); let bodyHtml = null; try { bodyHtml = (await mammoth.convertToHtml({ arrayBuffer: ab })).value; } catch (e) { } return { plain: await docxBytesToText(bytes), bodyHtml }; }
    case 'pptx': return await pptxModel(bytes);
    case 'epub': return { plain: await epubText(bytes) };
    case 'pdf': { const pages = await pdfLines(ST.pdf); if (!pages.some(p => p.some(l => l.trim()))) throw new Error(t('Este PDF no tiene texto seleccionable (escaneado); haría falta OCR.')); return { plain: pages.map(p => p.join('\n')).join('\n\n') }; }
  }
}
function htmlFromPlain(text, title) {
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem}</style></head><body>${text.split(/\r?\n/).filter(l => l.trim()).map(l => `<p>${esc(l)}</p>`).join('')}</body></html>`;
}
async function epubBlob(htmlDoc, title) {
  const body = ((htmlDoc.match(/<body>([\s\S]*)<\/body>/) || [])[1] || '').replace(/<(hr|br|img)([^>]*?)\/?>/g, '<$1$2/>'), t = xmlEsc(title);
  const z = new JSZip(), ns = 'xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"';
  z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  z.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${t}</dc:title><dc:language>es</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`);
  z.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html ${ns}><head><title>${t}</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">${t}</a></li></ol></nav></body></html>`);
  z.file('OEBPS/chapter.xhtml', `<?xml version="1.0" encoding="UTF-8"?><html ${ns}><head><title>${t}</title></head><body>${body}</body></html>`);
  return z.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
const MD_CSS = `@page{size:A4;margin:16mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:15px/1.65 -apple-system,"Segoe UI",system-ui,sans-serif;color:#1f2328;margin:0}
h1,h2,h3,h4,h5,h6{margin:1.4em 0 .6em;line-height:1.25;font-weight:600}h1{font-size:2em;border-bottom:1px solid #d8dee4;padding-bottom:.3em}h2{font-size:1.5em;border-bottom:1px solid #d8dee4;padding-bottom:.3em}h3{font-size:1.25em}
p,ul,ol,blockquote,pre,table{margin:0 0 1em}ul,ol{padding-left:2em}li+li{margin-top:.25em}
code{background:#eff1f3;padding:.2em .4em;border-radius:6px;font:.88em Consolas,"Cascadia Code",monospace}
pre{background:#f6f8fa;padding:14px 16px;border-radius:8px;white-space:pre-wrap;word-break:break-word;border:1px solid #e3e7eb}pre code{background:none;padding:0;font-size:.9em}
blockquote{border-left:4px solid #d0d7de;color:#59636e;margin-left:0;padding:0 1em}
table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #d0d7de;padding:6px 13px}th{background:#f6f8fa}tr:nth-child(2n) td{background:#fbfcfd}
img{max-width:100%;max-height:245mm;width:auto;height:auto;object-fit:contain;break-inside:avoid;page-break-inside:avoid}hr{border:0;border-top:1px solid #d8dee4;margin:1.6em 0}a{color:#0969da;text-decoration:none}kbd{border:1px solid #d0d7de;border-bottom-width:2px;border-radius:5px;padding:1px 6px;font-size:.85em;background:#f6f8fa}
input[type=checkbox]{margin-right:.5em}`;
const PLAIN_CSS = `@page{size:A4;margin:18mm}body{font:13px/1.6 "Segoe UI",system-ui,sans-serif;color:#222;margin:0}pre{white-space:pre-wrap;word-break:break-word;font:inherit;margin:0}`;
const escH = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const baseUrl = () => { const p = ST.dir.replace(/\\/g, '/'); return 'file://' + (p.startsWith('/') ? '' : '/') + encodeURI(p) + '/'; };
const docHtml = (body, title, css = MD_CSS, base = true) => `<!doctype html><html><head><meta charset="utf-8">${base ? `<base href="${baseUrl()}">` : ''}<title>${escH(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
async function chromePdf(html, landscape) { const buf = await nat.htmlPdf({ html, landscape, baseDir: ST.dir }); return new Blob([buf], { type: MIME.pdf }); }
async function standaloneHtml(m, name) {
  if (m.htmlRaw) return m.htmlRaw;
  const body = m.bodyHtml || m.plain.split(/\r?\n/).filter(l => l.trim()).map(l => `<p>${escH(l)}</p>`).join('');
  return await nat.htmlInline({ html: docHtml(body, name, MD_CSS, false), baseDir: ST.dir });
}
async function textOut(fmt, m, name) {
  if (fmt === 'txt') return blobOf(m.plain, MIME.txt);
  if (fmt === 'md') return blobOf(m.md || m.plain, MIME.md);
  if (fmt === 'html') return blobOf(await standaloneHtml(m, name), MIME.html);
  if (fmt === 'docx') return m.md ? docxFromMd(m.md) : docxFromLines([m.plain.split(/\r?\n/)]);
  if (fmt === 'pdf') {
    if (m.htmlRaw) return chromePdf(/<base\b/i.test(m.htmlRaw) ? m.htmlRaw : /<head[^>]*>/i.test(m.htmlRaw) ? m.htmlRaw.replace(/<head[^>]*>/i, x => x + `<base href="${baseUrl()}">`) : `<base href="${baseUrl()}">` + m.htmlRaw);
    if (m.bodyHtml) return chromePdf(docHtml(m.bodyHtml, name));
    return chromePdf(docHtml(`<pre>${escH(m.plain)}</pre>`, name, PLAIN_CSS));
  }
  if (fmt === 'epub') return epubBlob(await standaloneHtml(m, name), name);
  throw new Error(t('Formato no soportado: {f}', { f: fmt }));
}

/* ---------- subtítulos ---------- */
function subsConvert(text, from, to) {
  text = text.replace(/\r/g, '').replace(/^\uFEFF/, '');
  if (to === 'txt') return text.split('\n').filter(l => !/^\s*\d+\s*$/.test(l) && !/-->/.test(l) && !/^(WEBVTT|NOTE|STYLE)/.test(l)).join('\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (to === 'vtt') return 'WEBVTT\n\n' + text.replace(/(\d\d:\d\d:\d\d),(\d{3})/g, '$1.$2').replace(/^\d+\n(?=\d\d:\d\d)/gm, '');
  let t = text.replace(/^WEBVTT[^\n]*\n+/, '').replace(/(^|\n\n)NOTE[\s\S]*?(?=\n\n|$)/g, '').replace(/(\d\d:\d\d:\d\d)\.(\d{3})/g, '$1,$2');
  t = t.replace(/(^|\n)(\d\d:\d\d)\.(\d{3}) --> (\d\d:\d\d)\.(\d{3})/g, '$100:$2,$3 --> 00:$4,$5');
  return t.trim().split(/\n\n+/).map((b, i) => (i + 1) + '\n' + b).join('\n\n') + '\n';
}

/* ---------- hojas de cálculo ---------- */
function sheetPdf(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }), { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'l' });
  const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), M = 30; d.setFontSize(8);
  const cols = Math.max(1, ...rows.map(r => r.length)); let w = Array(cols).fill(30);
  rows.slice(0, 80).forEach(r => r.forEach((c, i) => w[i] = Math.min(180, Math.max(w[i], d.getTextWidth(String(c)) + 8))));
  const tot = w.reduce((a, b) => a + b, 0), f = Math.min(1, (W - 2 * M) / tot); w = w.map(x => x * f); let y = M;
  rows.forEach((r, ri) => {
    if (y + 14 > H - M) { d.addPage(); y = M; }
    let x = M; r.forEach((c, i) => { const s = d.splitTextToSize(String(c), w[i] - 6)[0] || ''; d.setFont('helvetica', ri === 0 ? 'bold' : 'normal'); d.text(String(s), x + 3, y + 10); x += w[i]; });
    d.setDrawColor(210); d.line(M, y + 14, W - M, y + 14); y += 14;
  });
  return d.output('blob');
}
function sheetOut(fmt, bytes, ext) {
  const txt = ext === 'csv' || ext === 'tsv', wb = txt ? XLSX.read(dec(bytes), { type: 'string' }) : XLSX.read(bytes, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
  if (fmt === 'xlsx' || fmt === 'ods') return new Blob([XLSX.write(wb, { bookType: fmt, type: 'array' })], { type: MIME[fmt] || 'application/octet-stream' });
  if (fmt === 'csv') return blobOf('\uFEFF' + XLSX.utils.sheet_to_csv(ws), 'text/csv');
  if (fmt === 'tsv') return blobOf('\uFEFF' + XLSX.utils.sheet_to_csv(ws, { FS: '\t' }), 'text/tab-separated-values');
  if (fmt === 'json') return blobOf(JSON.stringify(XLSX.utils.sheet_to_json(ws, { defval: '' }), null, 2), 'application/json');
  if (fmt === 'html') return blobOf(`<!doctype html><meta charset="utf-8"><style>table{border-collapse:collapse;font:14px system-ui}td,th{border:1px solid #ccc;padding:4px 8px}</style>${XLSX.utils.sheet_to_html(ws).replace(/^[\s\S]*?<body>|<\/body>[\s\S]*$/gi, '')}`, MIME.html);
  if (fmt === 'pdf') return sheetPdf(ws);
  throw new Error(t('Formato no soportado: {f}', { f: fmt }));
}

/* ---------- archivos comprimidos ---------- */
async function gzip(u8) { const cs = new CompressionStream('gzip'), w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
async function gunzip(u8) { const ds = new DecompressionStream('gzip'), w = ds.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
function tarBuild(files) {
  const enc = new TextEncoder(), chunks = [];
  for (const f of files) {
    const h = new Uint8Array(512), put = (s, o, l) => h.set(enc.encode(s).subarray(0, l), o);
    let name = f.name, prefix = '';
    if (enc.encode(name).length > 100) { const i = name.lastIndexOf('/', 155); if (i > 0) { prefix = name.slice(0, i); name = name.slice(i + 1); } }
    put(name, 0, 100); put('0000644\0', 100, 8); put('0000000\0', 108, 8); put('0000000\0', 116, 8);
    put(f.bytes.length.toString(8).padStart(11, '0') + '\0', 124, 12); put(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12);
    h.fill(32, 148, 156); h[156] = 48; put('ustar\0', 257, 6); put('00', 263, 2); put(prefix, 345, 155);
    let sum = 0; for (const b of h) sum += b; put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    chunks.push(h, f.bytes); const pad = (512 - f.bytes.length % 512) % 512; if (pad) chunks.push(new Uint8Array(pad));
  }
  chunks.push(new Uint8Array(1024)); return new Blob(chunks, { type: 'application/x-tar' });
}
function tarParse(u8) {
  const files = [], d = new TextDecoder(); let o = 0;
  while (o + 512 <= u8.length) {
    const h = u8.subarray(o, o + 512); if (h.every(b => b === 0)) break;
    const rd = (s, l) => d.decode(h.subarray(s, s + l)).replace(/\0[\s\S]*$/, ''); let name = rd(0, 100); const pre = rd(345, 155); if (pre) name = pre + '/' + name;
    const size = parseInt(rd(124, 12).trim() || '0', 8), type = String.fromCharCode(h[156]); o += 512;
    if (type === '0' || type === '\0') files.push({ name, bytes: u8.slice(o, o + size) });
    o += Math.ceil(size / 512) * 512;
  }
  return files;
}
const safeRel = n => n.replace(/\\/g, '/').split('/').filter(p => p && p !== '.' && p !== '..' && !/^[a-z]:$/i.test(p)).join('/');
async function archiveEntries(bytes, ext) {
  if (ext === 'zip') { const z = await JSZip.loadAsync(bytes), out = []; for (const e of Object.values(z.files)) if (!e.dir) out.push({ name: safeRel(e.name), bytes: await e.async('uint8array') }); return out; }
  if (ext === 'tar') return tarParse(bytes);
  const raw = await gunzip(bytes);
  if (ext === 'tgz' || String.fromCharCode(...raw.subarray(257, 262)) === 'ustar') return tarParse(raw);
  return [{ name: ST.name.replace(/\.tar$/, ''), bytes: raw }];
}

/* ---------- audio / vídeo / imagen ---------- */
async function decodeAudio(bytes) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try { return await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)); }
  catch (e) { throw new Error(t('No se pudo leer el audio (códec no soportado).')); } finally { ctx.close(); }
}
function wavBlob(buf) {
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2)), w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch).keys()].map(c => buf.getChannelData(c)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}
function mp3Blob(buf, kbps = 192) {
  const ch = Math.min(2, buf.numberOfChannels), enc = new lamejs.Mp3Encoder(ch, buf.sampleRate, kbps), to16 = f => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff; return o; };
  const L = to16(buf.getChannelData(0)), R = ch > 1 ? to16(buf.getChannelData(1)) : null, out = [];
  for (let i = 0; i < L.length; i += 1152) { const c = ch > 1 ? enc.encodeBuffer(L.subarray(i, i + 1152), R.subarray(i, i + 1152)) : enc.encodeBuffer(L.subarray(i, i + 1152)); if (c.length) out.push(new Uint8Array(c)); }
  const e = enc.flush(); if (e.length) out.push(new Uint8Array(e)); return new Blob(out, { type: 'audio/mpeg' });
}
async function videoFrame(blob) {
  const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(blob);
  await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error(t('No se pudo leer este vídeo (códec no soportado).'))); });
  v.currentTime = Math.min(1, (v.duration || 1) / 2); await new Promise(r => v.onseeked = r);
  const c = newCanvas(v.videoWidth, v.videoHeight); c.getContext('2d').drawImage(v, 0, 0); URL.revokeObjectURL(v.src); return c;
}
async function icoBlob(c) {
  const s = Math.min(256, Math.max(c.width, c.height)), sq = newCanvas(s, s), k = s / Math.max(c.width, c.height), w = c.width * k, h = c.height * k;
  sq.getContext('2d').drawImage(c, (s - w) / 2, (s - h) / 2, w, h);
  const png = new Uint8Array(await (await toBlob(sq, MIME.png)).arrayBuffer()), buf = new ArrayBuffer(22 + png.length), v = new DataView(buf);
  v.setUint16(2, 1, true); v.setUint16(4, 1, true); v.setUint8(6, s === 256 ? 0 : s); v.setUint8(7, s === 256 ? 0 : s); v.setUint16(10, 1, true); v.setUint16(12, 32, true); v.setUint32(14, png.length, true); v.setUint32(18, 22, true);
  new Uint8Array(buf, 22).set(png); return new Blob([buf], { type: 'image/x-icon' });
}
function tiffToCanvas(arrayBuf) {
  const ifds = UTIF.decode(arrayBuf); if (!ifds.length) throw new Error(t('TIFF vacío.')); UTIF.decodeImage(arrayBuf, ifds[0]);
  const c = newCanvas(ifds[0].width, ifds[0].height), x = c.getContext('2d'), id = x.createImageData(c.width, c.height); id.data.set(UTIF.toRGBA8(ifds[0])); x.putImageData(id, 0, 0); return c;
}

/* ---------- despachador ---------- */
/* Devuelve [{rel, blob}] (rel = ruta relativa al archivo de origen). */
async function produce(fmt) { prog(0.04, t('Leyendo archivo…')); const r = await produceInner(fmt); prog(0.92, t('Guardando…')); return r; }
async function produceInner(fmt) {
  const k = ST.kind, n = ST.name, e = ST.ext, one = (ext, blob, suf = '') => [{ rel: `${n}${suf}.${ext}`, blob }];
  const bytes = async () => new Uint8Array(await nat.readFile(ST.path));
  if (k === 'folder') { const r = await nat.packDir({ dir: ST.path, fmt, jobId: JP.id }); if (!r.ok) throw new Error(r.err); return [{ done: r.out }]; }
  if (k === 'pptx' && ['pdf', 'png', 'jpg'].includes(fmt)) {
    prog(0.12, t('Leyendo diapositivas…')); const { W, H, slides } = await pptxToSlides(await bytes()); prog(0.4, t('Generando PDF ({n} diapositivas)…', { n: slides.length })); const pdf = await chromePdf(pptxDoc(W, H, slides));
    if (fmt === 'pdf') return one('pdf', pdf);
    const doc = await loadPdf(new Uint8Array(await pdf.arrayBuffer())), z = new JSZip();
    for (let i = 1; i <= doc.numPages; i++) { prog(0.55 + 0.38 * (i - 1) / doc.numPages, t('Diapositiva {i} de {n}', { i, n: doc.numPages })); } for (let i = 1; i <= doc.numPages; i++) z.file(`${n}_${String(i).padStart(3, '0')}.${fmt}`, await encode(await renderPdfPage(doc, i), fmt));
    return [{ rel: `${n}_${fmt}.zip`, blob: await z.generateAsync({ type: 'blob' }) }];
  }
  if (k === 'audio' || k === 'video') return ffConvert(fmt);
  if (k === 'image') {
    prog(0.35, t('Codificando imagen…'));
    if (fmt === 'docx') return one('docx', await docxFromImage(ST.img));
    if (fmt === 'ico') return one('ico', await icoBlob(ST.img));
    return one(fmt, await encode(ST.img, fmt));
  }
  if (k === 'pdf') {
    if (['docx', 'txt', 'md', 'html', 'epub'].includes(fmt)) return one(fmt, await textOut(fmt, await textModel('pdf'), n));
    if (ST.pages === 1) return one(fmt, await encode(ST.img, fmt));
    const z = new JSZip();
    for (let i = 1; i <= ST.pages; i++) { prog(0.08 + 0.82 * (i - 1) / ST.pages, t('Página {i} de {n}', { i, n: ST.pages })); const c = i === 1 ? ST.img : await renderPdfPage(ST.pdf, i); z.file(`${n}_${String(i).padStart(3, '0')}.${fmt}`, await encode(c, fmt)); }
    return [{ rel: `${n}_${fmt}.zip`, blob: await z.generateAsync({ type: 'blob' }) }];
  }
  if (['txt', 'md', 'html', 'rtf', 'docx', 'pptx', 'epub'].includes(k)) { const mdl = await textModel(k, await bytes()); prog(0.45, t('Convirtiendo a {f}…', { f: fmt.toUpperCase() })); return one(fmt, await textOut(fmt, mdl, n)); }
  if (k === 'sheet') return one(fmt, sheetOut(fmt, await bytes(), e));
  if (k === 'subs') return one(fmt, blobOf(subsConvert(dec(await bytes()), e, fmt), MIME[fmt] || 'text/plain'));
  if (k === 'archive') {
    const files = await archiveEntries(await bytes(), e);
    if (fmt === 'extract') return files.map(f => ({ rel: `${n}${t('_extraido')}/${f.name}`, blob: new Blob([f.bytes]) }));
    if (fmt === 'zip') { const z = new JSZip(); files.forEach(f => z.file(f.name, f.bytes)); return one('zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' })); }
    const tar = new Uint8Array(await tarBuild(files).arrayBuffer());
    return fmt === 'tar' ? one('tar', new Blob([tar])) : one('tgz', new Blob([await gzip(tar)]));
  }
  /* cualquier otro archivo: comprimir */
  const data = await bytes(), full = `${n}.${e}`;
  if (fmt === 'zip') { const z = new JSZip(); z.file(full, data); return one('zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' })); }
  if (fmt === 'gz') return [{ rel: `${full}.gz`, blob: new Blob([await gzip(data)]) }];
  throw new Error(t('Formato no soportado: {f}', { f: fmt }));
}

/* ---------- audio / vídeo con ffmpeg ---------- */
const AUDIO_ARGS = {
  mp3: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'], m4a: ['-vn', '-c:a', 'aac', '-b:a', '192k'], wav: ['-vn', '-c:a', 'pcm_s16le'], flac: ['-vn', '-c:a', 'flac'],
  ogg: ['-vn', '-c:a', 'libvorbis', '-q:a', '5'], opus: ['-vn', '-c:a', 'libopus', '-b:a', '128k'], aiff: ['-vn', '-c:a', 'pcm_s16be'], wma: ['-vn', '-c:a', 'wmav2', '-b:a', '192k']
};
const X264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'];
const VIDEO_ARGS = {
  mp4: [...X264, '-movflags', '+faststart'], mkv: [...X264], mov: [...X264],
  webm: ['-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '6', '-c:a', 'libopus'],
  avi: ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'libmp3lame'], wmv: ['-c:v', 'wmv2', '-b:v', '2M', '-c:a', 'wmav2'],
  gif: ['-filter_complex', '[0:v]fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0', '-an']
};
async function ffConvert(fmt) {
  let post;
  if (AUDIO_ARGS[fmt]) post = AUDIO_ARGS[fmt];
  else if (fmt === 'jpg' || fmt === 'png') post = ['-ss', '1', '-frames:v', '1', ...(fmt === 'jpg' ? ['-q:v', '2'] : [])];
  else post = VIDEO_ARGS[fmt];
  const r = await nat.ffRun({ input: ST.path, outRel: `${ST.name}.${fmt}`, post, jobId: JP.id });
  if (!r.ok) throw new Error(r.err);
  return [{ done: r.out }];
}
