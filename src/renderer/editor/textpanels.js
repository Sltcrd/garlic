/* Text tools of the editor window: editor with preview (txt, md, html, subtitles), cleaner, and subtitle sync.
 * Results are always saved as new files; the original is never changed. */

const TX = { raw: '', text: '', bom: false, crlf: false, legacy: false, undo: [], timer: 0 };
const BOM = String.fromCharCode(0xFEFF), stripBom = s => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);
const TEXT_MAX = 5 * 1024 * 1024;

/** Reads the file the editor was opened for as text (UTF-8, or Windows-1252 when it is not valid UTF-8). Lines are kept as \n inside. */
async function textLoad() {
  const bytes = new Uint8Array(await nat.readFile(ST.path));
  if (bytes.length > TEXT_MAX) throw new Error(t('El archivo es demasiado grande para este editor (máximo 5 MB).'));
  let s; TX.legacy = false;
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { s = new TextDecoder('windows-1252').decode(bytes); TX.legacy = true; }
  TX.bom = !TX.legacy && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;   // TextDecoder already dropped the mark from the text
  TX.raw = s; TX.crlf = /\r\n/.test(s); TX.text = s.replace(/\r\n?/g, '\n'); TX.undo = [];
}
const textEncode = (s, crlf = TX.crlf, bom = TX.bom) => (bom ? BOM : '') + (crlf ? s.replace(/\n/g, '\r\n') : s);
const textBlob = s => new Blob([s], { type: 'text/plain' });
const rxEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const textStats = s => ({ lines: s.split('\n').length, words: (s.match(/\S+/g) || []).length, chars: s.length });
const legacyNote = () => (TX.legacy ? '<br>' + t('El archivo no estaba en UTF-8: se guardará en UTF-8.') : '');

/* the preview lives in a sandboxed iframe (no scripts, no network, no forms) */
const PREVIEW_CSS = 'body{font:15px/1.6 system-ui,sans-serif;margin:16px;color:#222;background:#fff}img{max-width:100%}pre,code{background:#f3f3f3}pre{padding:8px;overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}blockquote{border-left:3px solid #ccc;margin:0;padding-left:12px;color:#555}';
function previewDoc(text) {
  const body = ST.kind === 'md' ? marked.parse(text, { async: false }) : text;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>${PREVIEW_CSS}</style>${body}`;
}

/* ---------- EDITAR TEXTO ---------- */
MODES.t_edit = {
  title: 'Editar texto', apply: 'Guardar copia', own: true,
  open: pdfSafe(async function () {
    await textLoad();
    const g = $('#pgrid'), preview = ST.kind === 'md' || ST.kind === 'html';
    g.className = 'edit'; g.innerHTML = '<textarea id="te" spellcheck="false" aria-label="Texto"></textarea>' + (preview ? '<iframe id="tprev" sandbox="" title="Vista previa"></iframe>' : '');
    const ta = $('#te'); ta.value = TX.text;
    ctl(`<div class="row"><label>Buscar</label><input type="text" id="tf"><label style="width:auto;display:flex;gap:4px;align-items:center"><input type="checkbox" id="tc"> Aa</label></div>
      <div class="row"><label>Reemplazar</label><input type="text" id="tr"><button class="mini" id="trb">Reemplazar todo</button><button class="mini" id="tub">↶ Deshacer</button></div><div class="info" id="tinfo"></div>`);
    const sync = () => {
      TX.text = ta.value; const s = textStats(TX.text);
      $('#tinfo').innerHTML = t('{l} líneas · {w} palabras · {c} caracteres', { l: s.lines, w: s.words, c: s.chars }) + legacyNote();
      this.find();
      if (preview) { clearTimeout(TX.timer); TX.timer = setTimeout(() => { $('#tprev').srcdoc = previewDoc(TX.text); }, 250); }
    };
    ta.oninput = sync; $('#tf').oninput = $('#tc').onchange = () => this.find();
    $('#trb').onclick = () => {
      const re = this.re(); if (!re) return; TX.undo.push(ta.value); if (TX.undo.length > 30) TX.undo.shift();
      const to = $('#tr').value; ta.value = ta.value.replace(re, () => to); sync();
    };
    $('#tub').onclick = () => { if (TX.undo.length) { ta.value = TX.undo.pop(); sync(); } };
    sync();
  }),
  re() { const f = $('#tf').value; return f ? new RegExp(rxEscape(f), $('#tc').checked ? 'g' : 'gi') : null; },
  find() {
    const re = this.re(), el = $('#tinfo'); if (!el) return;
    const n = re ? ($('#te').value.match(re) || []).length : 0;
    $('#trb').disabled = !n; $('#trb').textContent = n ? t('Reemplazar todo ({n})', { n }) : t('Reemplazar todo');
  },
  async save() {
    if (TX.text === TX.raw.replace(/\r\n?/g, '\n') && !TX.legacy) throw new Error(t('No has cambiado nada.'));
    await saveBlob(textBlob(textEncode(TX.text)), t('_editado'), ST.ext);
  }
};

/* ---------- LIMPIAR TEXTO ---------- */
const CL = { trim: true, blank: true, bom: false, eol: 'Mantener' };
MODES.t_clean = {
  title: 'Limpiar texto', apply: 'Guardar copia', own: true,
  open: pdfSafe(async function () {
    await textLoad(); Object.assign(CL, { trim: true, blank: true, bom: false, eol: 'Mantener' });
    const g = $('#pgrid'); g.className = 'edit'; g.innerHTML = '<textarea id="te" readonly spellcheck="false" aria-label="Resultado"></textarea>';
    ctl(`<div class="row"><label style="width:auto;display:flex;gap:6px;align-items:center"><input type="checkbox" id="ct" checked> Quitar espacios al final de cada línea</label></div>
      <div class="row"><label style="width:auto;display:flex;gap:6px;align-items:center"><input type="checkbox" id="cb" checked> Reducir las líneas vacías repetidas a una</label></div>
      <div class="row"><label style="width:auto;display:flex;gap:6px;align-items:center"><input type="checkbox" id="cm"${TX.bom ? '' : ' disabled'}> Quitar la marca BOM del principio</label></div>
      <div class="row"><label>Saltos de línea</label><div class="chips" id="ce"></div></div><div class="info" id="cinfo"></div>`);
    $('#ct').onchange = e => { CL.trim = e.target.checked; this.render(); }; $('#cb').onchange = e => { CL.blank = e.target.checked; this.render(); }; $('#cm').onchange = e => { CL.bom = e.target.checked; this.render(); };
    chipRow('ce', ['Mantener', 'Unix (LF)', 'Windows (CRLF)'], 'Mantener', v => { CL.eol = v; this.render(); });
    this.render();
  }),
  result() {
    let s = TX.text; if (CL.trim) s = s.replace(/[ \t]+$/gm, ''); if (CL.blank) s = s.replace(/\n{3,}/g, '\n\n');
    const crlf = CL.eol === 'Mantener' ? TX.crlf : CL.eol === 'Windows (CRLF)';
    return textEncode(s, crlf, TX.bom && !CL.bom);
  },
  render() {
    const out = this.result(), before = (TX.bom ? BOM : '') + TX.raw;
    $('#te').value = stripBom(out).replace(/\r\n/g, '\n');
    $('#cinfo').innerHTML = t('{a} → {b} caracteres', { a: before.length, b: out.length }) + legacyNote();
  },
  async save() {
    const out = this.result(); if (out === (TX.bom ? BOM : '') + TX.raw && !TX.legacy) throw new Error(t('No has cambiado nada.'));
    await saveBlob(textBlob(out), t('_limpio'), ST.ext);
  }
};

/* ---------- SINCRONIZAR SUBTÍTULOS ---------- */
const SY = { cues: [], off: 0, fac: 1 };
const SY_FAC = { 'Sin estirar': 1, '23.976 → 25': 23.976 / 25, '25 → 23.976': 25 / 23.976, '24 → 25': 24 / 25, '25 → 24': 25 / 24 };
MODES.s_sync = {
  title: 'Sincronizar subtítulos', apply: 'Guardar copia', own: true,
  open: pdfSafe(async function () {
    await textLoad(); SY.cues = Subs.parse(TX.text); SY.off = 0; SY.fac = 1;
    if (!SY.cues.length) throw new Error(t('No se encontraron subtítulos en el archivo.'));
    const g = $('#pgrid'); g.className = 'list'; g.innerHTML = '';
    ctl(`<div class="row"><label>Desplazar</label><input type="range" id="sy" min="-300" max="300" step="1" value="0"><input type="number" id="syn" step="0.1" value="0" style="width:84px"><span>s</span></div>
      <div class="row"><label>Estirar</label><div class="chips" id="syf"></div></div>
      <div class="info" style="opacity:.8">Positivo = los subtítulos salen más tarde. Si se van desfasando poco a poco, elige los fotogramas por segundo de los subtítulos → los del vídeo.</div><div class="info" id="syi"></div>`);
    const set = v => { SY.off = Math.max(-3600, Math.min(3600, Math.round(v * 10) / 10)); $('#sy').value = Math.round(SY.off * 10); $('#syn').value = SY.off; this.render(); };
    $('#sy').oninput = e => set(+e.target.value / 10); $('#syn').onchange = e => set(+e.target.value || 0);
    chipRow('syf', Object.keys(SY_FAC), 'Sin estirar', v => { SY.fac = SY_FAC[v]; this.render(); });
    this.render();
  }),
  retimed() { return Subs.retime(SY.cues, Math.round(SY.off * 1000), SY.fac); },
  render() {
    const cues = this.retimed(), g = $('#pgrid'); g.innerHTML = '';
    for (const c of cues.slice(0, 80)) {
      const r = document.createElement('div'); r.className = 'mrow'; r.innerHTML = '<span class="mi"></span><span class="mn"></span>';
      r.querySelector('.mi').textContent = Subs.stamp(c.start, ',') + ' → ' + Subs.stamp(c.end, ','); r.querySelector('.mn').textContent = c.text.replace(/\n/g, ' ⏎ '); g.appendChild(r);
    }
    $('#syi').textContent = t('{n} subtítulos', { n: cues.length }) + (SY.cues.length > cues.length ? ' · ' + t('{n} se quedan antes del inicio y se quitan', { n: SY.cues.length - cues.length }) : '') + (cues.length > 80 ? ' · ' + t('se muestran los 80 primeros') : '');
  },
  async save() {
    if (!SY.off && SY.fac === 1) throw new Error(t('No has cambiado nada.'));
    await saveBlob(textBlob(textEncode(Subs.format(this.retimed(), ST.ext === 'vtt' ? 'vtt' : 'srt'))), t('_sincronizado'), ST.ext);
  }
};
