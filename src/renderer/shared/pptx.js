/* PPTX → HTML (una sección por diapositiva) conservando posiciones, colores, formas e imágenes */
const PX = 9525;
const kids = (e, n) => e ? [...e.children].filter(c => !n || c.localName === n) : [];
const kid = (e, n) => kids(e, n)[0] || null;
const descs = (e, n) => e ? [...e.getElementsByTagNameNS('*', n)] : [];
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function rgbHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l];
}
function hslRgb(h, s, l) {
  if (!s) return [l * 255, l * 255, l * 255]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function colorOf(parent, T) {
  const c = kids(parent).find(e => /Clr$/.test(e.localName)); if (!c) return null; let hex = '#000000';
  if (c.localName === 'srgbClr') hex = '#' + c.getAttribute('val'); else if (c.localName === 'sysClr') hex = '#' + (c.getAttribute('lastClr') || '000000');
  else if (c.localName === 'schemeClr') { let v = c.getAttribute('val'); if (v === 'phClr') hex = T.ph || '#000000'; else { v = T.map[v] || v; hex = T.colors[v] || '#000000'; } }
  else if (c.localName === 'prstClr') hex = { black: '#000000', white: '#ffffff' }[c.getAttribute('val')] || '#808080';
  let [r, g, b] = hexRgb(hex), a = 1;
  for (const m of c.children) {
    const v = +m.getAttribute('val') / 100000, n = m.localName;
    if (n === 'alpha') a = v;
    else if (n === 'lumMod' || n === 'lumOff') { let [h, s, l] = rgbHsl(r, g, b); l = n === 'lumMod' ? l * v : l + v; [r, g, b] = hslRgb(h, s, Math.max(0, Math.min(1, l))); }
    else if (n === 'tint') { r = r + (255 - r) * (1 - v); g = g + (255 - g) * (1 - v); b = b + (255 - b) * (1 - v); }
    else if (n === 'shade') { r *= v; g *= v; b *= v; }
    else if (n === 'satMod') { let [h, s, l] = rgbHsl(r, g, b); [r, g, b] = hslRgb(h, Math.min(1, s * v), l); }
  }
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

async function pptxToSlides(bytes) {
  const z = await JSZip.loadAsync(bytes), parse = s => new DOMParser().parseFromString(s, 'application/xml');
  const read = async p => { const f = z.file(p); return f ? await f.async('string') : null; };
  const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
  const resolve = (base, t) => { const parts = (dirOf(base) + t).split('/'), out = []; for (const s of parts) { if (s === '..') out.pop(); else if (s !== '.') out.push(s); } return out.join('/'); };
  const relsOf = async p => { const x = await read(dirOf(p) + '_rels/' + p.split('/').pop() + '.rels'), m = {}; if (x) descs(parse(x), 'Relationship').forEach(r => m[r.getAttribute('Id')] = { t: resolve(p, r.getAttribute('Target')), type: r.getAttribute('Type') }); return m; };
  const pres = parse(await read('ppt/presentation.xml')), sz = descs(pres, 'sldSz')[0], W = +sz.getAttribute('cx') / PX, H = +sz.getAttribute('cy') / PX;
  const presRels = await relsOf('ppt/presentation.xml'), slidePaths = descs(pres, 'sldId').map(s => presRels[s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')]?.t).filter(Boolean);
  const T = { colors: {}, map: {}, major: 'Calibri', minor: 'Calibri', ph: null };
  const themePath = Object.keys(z.files).find(n => /^ppt\/theme\/theme\d+\.xml$/.test(n));
  if (themePath) {
    const th = parse(await read(themePath)), cs = descs(th, 'clrScheme')[0];
    if (cs) kids(cs).forEach(n => { const c = kids(n)[0]; if (c) T.colors[n.localName] = '#' + (c.localName === 'sysClr' ? c.getAttribute('lastClr') : c.getAttribute('val')); });
    T.major = descs(th, 'majorFont')[0]?.getElementsByTagNameNS('*', 'latin')[0]?.getAttribute('typeface') || 'Calibri';
    T.minor = descs(th, 'minorFont')[0]?.getElementsByTagNameNS('*', 'latin')[0]?.getAttribute('typeface') || 'Calibri';
  }
  const masterPath = Object.keys(z.files).find(n => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(n)), master = masterPath ? parse(await read(masterPath)) : null;
  const cm = master && descs(master, 'clrMap')[0]; if (cm) [...cm.attributes].forEach(a => T.map[a.name] = a.value); else Object.assign(T.map, { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' });
  const txStyle = n => descs(master, n)[0];

  const mediaCache = {};
  const mediaUri = async p => {
    if (mediaCache[p] !== undefined) return mediaCache[p]; const f = z.file(p), ext = (p.split('.').pop() || '').toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' }[ext];
    return mediaCache[p] = (f && mime) ? `data:${mime};base64,${await f.async('base64')}` : null;
  };
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  async function fillOf(spPr, rels) {
    if (!spPr) return null;
    const sf = kid(spPr, 'solidFill'); if (sf) return colorOf(sf, T);
    if (kid(spPr, 'noFill')) return 'transparent';
    const gf = kid(spPr, 'gradFill');
    if (gf) {
      const stops = descs(gf, 'gs').map(g => `${colorOf(g, T) || '#888'} ${(+g.getAttribute('pos')) / 1000}%`), lin = descs(gf, 'lin')[0], ang = lin ? (+lin.getAttribute('ang') || 0) / 60000 + 90 : 180;
      return `linear-gradient(${ang}deg,${stops.join(',')})`;
    }
    const bf = kid(spPr, 'blipFill'); if (bf) { const r = descs(bf, 'blip')[0]?.getAttributeNS(RNS, 'embed'), u = r && rels[r] ? await mediaUri(rels[r].t) : null; if (u) return `url(${u}) center/cover no-repeat`; }
    return null;
  }
  const xfrmOf = spPr => {
    const x = spPr && descs(spPr, 'xfrm')[0]; if (!x) return null; const o = kid(x, 'off'), e = kid(x, 'ext'); if (!o || !e) return null;
    return { x: +o.getAttribute('x') / PX, y: +o.getAttribute('y') / PX, w: +e.getAttribute('cx') / PX, h: +e.getAttribute('cy') / PX, rot: +(x.getAttribute('rot') || 0) / 60000, fh: x.getAttribute('flipH') === '1', fv: x.getAttribute('flipV') === '1' };
  };
  const phOf = sp => { const p = descs(sp, 'ph')[0]; return p ? { type: p.getAttribute('type') || '', idx: p.getAttribute('idx') || '' } : null; };
  const spTreeOf = doc => descs(doc, 'spTree')[0];
  const phShapes = doc => { const out = []; if (!doc) return out; for (const sp of kids(spTreeOf(doc), 'sp')) { const p = phOf(sp); if (p) out.push({ p, sp, x: xfrmOf(kid(sp, 'spPr')) }); } return out; };
  const findPh = (list, p) => list.find(s => p.idx && s.p.idx === p.idx && (!p.type || s.p.type === p.type)) || list.find(s => p.type && s.p.type === p.type) || list.find(s => p.idx && s.p.idx === p.idx);

  function sizeFor(ph, lvl, layoutSp) {
    const lv = 'lvl' + (lvl + 1) + 'pPr', own = layoutSp && descs(kid(layoutSp, 'txBody'), lv)[0]?.getElementsByTagNameNS('*', 'defRPr')[0];
    if (own && own.getAttribute('sz')) return { sz: +own.getAttribute('sz'), el: own };
    const t = ph ? (/title|ctrTitle/i.test(ph.type) ? 'titleStyle' : (ph.type === '' || /body|subTitle|obj/i.test(ph.type) || ph.idx ? 'bodyStyle' : 'otherStyle')) : 'otherStyle';
    const d = master && descs(txStyle(t), lv)[0]?.getElementsByTagNameNS('*', 'defRPr')[0];
    return { sz: d && d.getAttribute('sz') ? +d.getAttribute('sz') : (t === 'titleStyle' ? 4400 : t === 'bodyStyle' ? 2800 : 1800), el: d, style: t };
  }
  function runStyle(rPr, base, scale) {
    let sz = (rPr && rPr.getAttribute('sz')) ? +rPr.getAttribute('sz') : base.sz, css = `font-size:${(sz / 100 * 96 / 72 * scale).toFixed(1)}px;`;
    const b = rPr && rPr.getAttribute('b'), i = rPr && rPr.getAttribute('i'), u = rPr && rPr.getAttribute('u');
    if (b === '1' || (b == null && base.el && base.el.getAttribute('b') === '1')) css += 'font-weight:700;'; if (i === '1') css += 'font-style:italic;'; if (u && u !== 'none') css += 'text-decoration:underline;';
    const sf = rPr && kid(rPr, 'solidFill'), col = sf ? colorOf(sf, T) : (base.el && kid(base.el, 'solidFill') ? colorOf(kid(base.el, 'solidFill'), T) : null);
    css += `color:${col || base.defColor};`;
    const lat = rPr && kid(rPr, 'latin')?.getAttribute('typeface'), f = lat || (base.el && kid(base.el, 'latin')?.getAttribute('typeface')); const face = f === '+mj-lt' ? T.major : (f === '+mn-lt' || !f) ? (base.style === 'titleStyle' ? T.major : T.minor) : f;
    css += `font-family:'${face}','Segoe UI',Arial,sans-serif;`; return css;
  }
  function textHtml(tx, ph, layoutSp, T0) {
    const bp = kid(tx, 'bodyPr'), scale = (() => { const na = bp && kid(bp, 'normAutofit'); return na && na.getAttribute('fontScale') ? +na.getAttribute('fontScale') / 100000 : 1; })();
    const anchor = bp && bp.getAttribute('anchor') || (ph && /title|ctrTitle/i.test(ph.type) ? 'ctr' : 't'), ins = a => bp && bp.getAttribute(a) != null ? +bp.getAttribute(a) / PX : null;
    const pad = `padding:${ins('tIns') ?? 3.6}px ${ins('rIns') ?? 7.2}px ${ins('bIns') ?? 3.6}px ${ins('lIns') ?? 7.2}px;`;
    let h = '', num = {};
    for (const p of kids(tx, 'p')) {
      const pPr = kid(p, 'pPr'), lvl = pPr && +pPr.getAttribute('lvl') || 0, base = sizeFor(ph, lvl, layoutSp); base.defColor = ph && /title|ctrTitle/i.test(ph.type) ? (T.colors[T.map.tx1] || '#000') : (T.colors[T.map.tx1] || '#000');
      let algn = pPr && pPr.getAttribute('algn'); if (!algn && base.el) { const lp = base.el.parentNode; algn = lp && lp.getAttribute && lp.getAttribute('algn'); }
      const ta = { l: 'left', ctr: 'center', r: 'right', just: 'justify' }[algn] || (ph && /ctrTitle|subTitle/i.test(ph.type) ? 'center' : 'left');
      const runs = kids(p).filter(c => ['r', 'br', 'fld'].includes(c.localName)); let inner = '';
      for (const r of runs) { if (r.localName === 'br') inner += '<br>'; else { const t = kid(r, 't')?.textContent || ''; inner += `<span style="${runStyle(kid(r, 'rPr'), base, scale)}">${xmlEsc(t).replace(/\n/g, '<br>')}</span>`; } }
      const plain = runs.map(r => kid(r, 't')?.textContent || '').join('');
      const mar = pPr && pPr.getAttribute('marL') != null ? +pPr.getAttribute('marL') / PX : (ph && !/title|ctrTitle|subTitle/i.test(ph.type) ? 18 + lvl * 20 : 0), ind = pPr && pPr.getAttribute('indent') != null ? +pPr.getAttribute('indent') / PX : (ph && !/title|ctrTitle|subTitle/i.test(ph.type) ? -18 : 0);
      let bullet = ''; const bc = pPr && kid(pPr, 'buChar'), bn = pPr && kid(pPr, 'buAutoNum'), nob = pPr && kid(pPr, 'buNone');
      if (plain.trim() && !nob) { if (bc) bullet = bc.getAttribute('char'); else if (bn) { num[lvl] = (num[lvl] || 0) + 1; bullet = num[lvl] + '.'; } else if (ph && !/title|ctrTitle|subTitle|sldNum|dt|ftr/i.test(ph.type)) bullet = '•'; }
      const ls = pPr && kid(pPr, 'lnSpc') && kid(kid(pPr, 'lnSpc'), 'spcPct'), sb = pPr && kid(pPr, 'spcBef') && kid(kid(pPr, 'spcBef'), 'spcPts'), sa = pPr && kid(pPr, 'spcAft') && kid(kid(pPr, 'spcAft'), 'spcPts');
      h += `<div style="text-align:${ta};margin:${sb ? (+sb.getAttribute('val') / 100 * 96 / 72) : 0}px 0 ${sa ? (+sa.getAttribute('val') / 100 * 96 / 72) : 2}px;padding-left:${Math.max(0, mar)}px;text-indent:${bullet ? 0 : ind}px;line-height:${ls ? +ls.getAttribute('val') / 100000 : 1.15};min-height:1em;position:relative">${bullet ? `<span style="position:absolute;left:${Math.max(0, mar + ind)}px">${xmlEsc(bullet)}</span>` : ''}${inner || '&nbsp;'}</div>`;
    }
    return { html: h, anchor: { t: 'flex-start', ctr: 'center', b: 'flex-end' }[anchor] || 'flex-start', pad, wrap: !(bp && bp.getAttribute('wrap') === 'none') };
  }

  async function shapesHtml(tree, ctx, tf) {
    let out = '';
    for (const el of kids(tree)) {
      const ln = el.localName;
      if (ln === 'grpSp') {
        const gx = descs(kid(el, 'grpSpPr'), 'xfrm')[0]; let t2 = tf;
        if (gx) { const o = kid(gx, 'off'), e = kid(gx, 'ext'), co = kid(gx, 'chOff'), ce = kid(gx, 'chExt'); if (o && e && co && ce) { const sx = (+e.getAttribute('cx') / (+ce.getAttribute('cx') || 1)), sy = (+e.getAttribute('cy') / (+ce.getAttribute('cy') || 1)); t2 = { ox: tf.ox + (+o.getAttribute('x') / PX - +co.getAttribute('x') / PX * sx) * tf.sx, oy: tf.oy + (+o.getAttribute('y') / PX - +co.getAttribute('y') / PX * sy) * tf.sy, sx: tf.sx * sx, sy: tf.sy * sy }; } }
        out += await shapesHtml(el, ctx, t2); continue;
      }
      if (!['sp', 'pic', 'cxnSp', 'graphicFrame'].includes(ln)) continue;
      const spPr = kid(el, 'spPr'), ph = phOf(el); let x = xfrmOf(spPr);
      if (ln === 'graphicFrame') { const f = kid(el, 'xfrm'); if (f) { const o = kid(f, 'off'), e = kid(f, 'ext'); x = { x: +o.getAttribute('x') / PX, y: +o.getAttribute('y') / PX, w: +e.getAttribute('cx') / PX, h: +e.getAttribute('cy') / PX, rot: 0 }; } }
      let layoutSp = null;
      if (!x && ph) { layoutSp = (findPh(ctx.layoutPh, ph) || {}).sp; x = (findPh(ctx.layoutPh, ph) || {}).x || (findPh(ctx.masterPh, ph) || {}).x; }
      else if (ph) layoutSp = (findPh(ctx.layoutPh, ph) || {}).sp;
      if (!x) continue;
      const bx = tf.ox + x.x * tf.sx, by = tf.oy + x.y * tf.sy, bw = x.w * tf.sx, bh = x.h * tf.sy;
      let style = `left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;`;
      const tr = []; if (x.rot) tr.push(`rotate(${x.rot}deg)`); if (x.fh) tr.push('scaleX(-1)'); if (x.fv) tr.push('scaleY(-1)'); if (tr.length) style += `transform:${tr.join(' ')};`;
      if (ln === 'pic') {
        const bf = kid(el, 'blipFill'), rid = descs(bf, 'blip')[0]?.getAttributeNS(RNS, 'embed'), uri = rid && ctx.rels[rid] ? await mediaUri(ctx.rels[rid].t) : null; if (!uri) continue;
        const sr = descs(bf, 'srcRect')[0], l = sr ? +(sr.getAttribute('l') || 0) / 100000 : 0, t = sr ? +(sr.getAttribute('t') || 0) / 100000 : 0, r = sr ? +(sr.getAttribute('r') || 0) / 100000 : 0, b = sr ? +(sr.getAttribute('b') || 0) / 100000 : 0;
        out += `<div class="sh" style="${style}overflow:hidden"><img src="${uri}" style="position:absolute;width:${100 / (1 - l - r)}%;height:${100 / (1 - t - b)}%;left:${-l / (1 - l - r) * 100}%;top:${-t / (1 - t - b) * 100}%"></div>`; continue;
      }
      if (ln === 'graphicFrame') {
        const tbl = descs(el, 'tbl')[0]; if (!tbl) continue; const cols = descs(kid(tbl, 'tblGrid'), 'gridCol').map(c => +c.getAttribute('w') / PX);
        let rowsH = ''; for (const tr2 of kids(tbl, 'tr')) { rowsH += `<tr style="height:${+tr2.getAttribute('h') / PX}px">`; for (const tc of kids(tr2, 'tc')) { const tx = kid(tc, 'txBody'), tcPr = kid(tc, 'tcPr'), bg = tcPr ? await fillOf(tcPr, ctx.rels) : null, th = tx ? textHtml(tx, null, null).html : ''; rowsH += `<td style="border:1px solid rgba(128,128,128,.45);padding:3px 6px;${bg ? 'background:' + bg + ';' : ''}vertical-align:top">${th}</td>`; } rowsH += '</tr>'; }
        out += `<div class="sh" style="${style}"><table style="border-collapse:collapse;width:100%;table-layout:fixed"><colgroup>${cols.map(c => `<col style="width:${c * tf.sx}px">`).join('')}</colgroup>${rowsH}</table></div>`; continue;
      }
      // sp / cxnSp
      let fill = await fillOf(spPr, ctx.rels); const sty = kid(el, 'style');
      if (fill == null && sty) { const fr = kid(sty, 'fillRef'); if (fr && fr.getAttribute('idx') !== '0') fill = colorOf(fr, T); }
      const lnEl = spPr && kid(spPr, 'ln'); let border = '';
      if (lnEl && !kid(lnEl, 'noFill')) { const lc = kid(lnEl, 'solidFill') ? colorOf(kid(lnEl, 'solidFill'), T) : (sty && kid(sty, 'lnRef') ? colorOf(kid(sty, 'lnRef'), T) : null); if (lc || kid(lnEl, 'solidFill')) border = `border:${Math.max(1, +(lnEl.getAttribute('w') || 12700) / PX)}px solid ${lc || '#000'};`; }
      else if (!lnEl && sty && ln === 'cxnSp') { const lc = colorOf(kid(sty, 'lnRef'), T); border = `border-top:1.5px solid ${lc || '#000'};`; }
      const geom = spPr && descs(spPr, 'prstGeom')[0]?.getAttribute('prst') || 'rect', radius = geom === 'ellipse' ? '50%' : geom === 'roundRect' ? '12%' : '0';
      if (ln === 'cxnSp' && (bh < 2 || bw < 2)) { out += `<div class="sh" style="${style}${bw >= bh ? 'border-top' : 'border-left'}:${(lnEl && +lnEl.getAttribute('w') / PX) || 1.5}px solid ${(lnEl && kid(lnEl, 'solidFill') && colorOf(kid(lnEl, 'solidFill'), T)) || '#000'};height:${bw >= bh ? 0 : bh}px;width:${bw >= bh ? bw : 0}px"></div>`; continue; }
      let inner = ''; const tx = kid(el, 'txBody');
      if (tx && descs(tx, 'p').length) { const th = textHtml(tx, ph, layoutSp); inner = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:${th.anchor};${th.pad}${th.wrap ? '' : 'white-space:nowrap;'}overflow:hidden">${th.html}</div>`; }
      if (!fill && !border && !inner) continue;
      out += `<div class="sh" style="${style}${fill && fill !== 'transparent' ? `background:${fill};` : ''}${border}border-radius:${radius};box-sizing:border-box">${inner}</div>`;
    }
    return out;
  }

  async function bgOf(doc, rels) {
    const bg = doc && descs(doc, 'bg')[0]; if (!bg) return null;
    const pr = kid(bg, 'bgPr'); if (pr) return await fillOf(pr, rels);
    const ref = kid(bg, 'bgRef'); if (ref) return colorOf(ref, T);
    return null;
  }
  const masterRels = masterPath ? await relsOf(masterPath) : {}, masterPh = phShapes(master), mbg = await bgOf(master, masterRels), slides = [];
  for (const sp of slidePaths) {
    const doc = parse(await read(sp)), rels = await relsOf(sp), layRel = Object.values(rels).find(r => /slideLayout$/.test(r.type)), layDoc = layRel ? parse(await read(layRel.t)) : null, layRels = layRel ? await relsOf(layRel.t) : {};
    const bg = (await bgOf(doc, rels)) || (await bgOf(layDoc, layRels)) || mbg || '#ffffff';
    const ctx = { rels, layoutPh: phShapes(layDoc), masterPh };
    let body = '';
    if (master) body += await decor(master, masterRels);
    if (layDoc) body += await decor(layDoc, layRels);
    body += await shapesHtml(spTreeOf(doc), ctx, { ox: 0, oy: 0, sx: 1, sy: 1 });
    slides.push(`<section class="sl" style="background:${bg}">${body}</section>`);
  }
  async function decor(d, rels, ctx) { // formas no-marcador de la plantilla (logotipos, barras, fondos decorativos)
    const tree = spTreeOf(d), fake = d.createElementNS(tree.namespaceURI, 'p:spTree'); for (const e of kids(tree)) if (!(e.localName === 'sp' && phOf(e))) fake.appendChild(e.cloneNode(true));
    return await shapesHtml(fake, { rels, layoutPh: [], masterPh: [] }, { ox: 0, oy: 0, sx: 1, sy: 1 });
  }
  return { W, H, slides };
}
function pptxDoc(W, H, slides) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${W}px ${H}px;margin:0}html,body{margin:0;padding:0}.sl{position:relative;width:${W}px;height:${H}px;overflow:hidden;break-after:page;page-break-after:always}.sl:last-child{break-after:auto;page-break-after:auto}.sh{position:absolute}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${slides.join('')}</body></html>`;
}
