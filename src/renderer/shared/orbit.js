/* Rueda Garlic: un bulbo de ajo con dientes opacos y piel semitransparente. La usan la rueda real y la vista previa de la app */
const LBL = {
  compress: 'COMPRIMIR', metadata: 'METADATOS', edit: 'EDITAR', bg: 'FONDO', crop: 'RECORTAR', redact: 'CENSURAR', erase: 'BORRAR', annotate: 'ANOTAR',
  copypath: 'COPIAR RUTA', reveal: 'MOSTRAR', terminal: 'TERMINAL', copyto: 'COPIAR A…', moveto: 'MOVER A…', open: 'ABRIR', extract: 'EXTRAER', __more: 'MÁS',
  a_compress: 'COMPRIMIR', a_metadata: 'METADATOS', a_channels: 'CANALES', a_normalize: 'NORMALIZAR', a_trim: 'CORTAR', a_visualize: 'ONDA',
  v_compress: 'COMPRIMIR', v_metadata: 'METADATOS', v_mute: 'SILENCIAR', v_trim: 'CORTAR', v_crop: 'ENCUADRE', v_speed: 'VELOCIDAD', v_snapshot: 'CAPTURA', v_split: 'DIVIDIR'
};
const ICON = {
  compress: 'M-6 -9L0 -3L6 -9M-6 9L0 3L6 9', metadata: 'M-8 -6H8M-8 0H8M-8 6H2', edit: 'M-8 -5H8M-8 5H8', bg: 'M-8 -8H8V8H-8Z',
  crop: 'M-5 -9V5H9M5 9V-5H-9', redact: 'M-9 -3H9V3H-9Z', annotate: 'M-7 7L-5 2L4 -7L8 -3L-1 6Z', erase: 'M-9 3L0 -7L8 0L-1 10H-5ZM-3 -2L5 5M-1 10H9',
  copypath: 'M-9 0H9M3 -6L9 0L3 6', reveal: 'M-9 -6H-2L0 -3H9V7H-9Z', terminal: 'M-9 -7H9V7H-9ZM-5 -3L-1 0L-5 3M1 3H6',
  copyto: 'M-4 -8H8V4H-4ZM-8 -4V8H4', moveto: 'M-9 0H7M2 -6L8 0L2 6M9 -8V8', open: 'M-8 -8H8V8H-8ZM-3 3L5 -5M0 -5H5V0', extract: 'M-8 -2V8H8V-2M0 -9V3M-5 -2L0 3L5 -2',
  __more: 'M-6 -4L0 2L6 -4',
  channels: 'M-8 -5H-2V5H-8ZM2 -5H8V5H2Z', normalize: 'M-8 2V-2M-4 5V-5M0 8V-8M4 5V-5M8 2V-2', wave: 'M-9 0H-6L-4 -6L-1 6L2 -4L4 0H9',
  trim: 'M-7 -7L-3 -3M-7 7L-3 3M-4 -4L8 8M-4 4L8 -8', mute: 'M-8 -3H-4L1 -7V7L-4 3H-8ZM4 -3L9 3M9 -3L4 3', speed: 'M-8 5A8 8 0 0 1 8 5M0 5L5 -3',
  snap: 'M-8 -4H-4L-2 -7H2L4 -4H8V7H-8ZM-3 1a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', split: 'M-8 -6H8V6H-8ZM0 -6V6'
};
Object.assign(ICON, { a_compress: ICON.compress, a_metadata: ICON.metadata, a_channels: ICON.channels, a_normalize: ICON.normalize, a_trim: ICON.trim, a_visualize: ICON.wave,
  v_compress: ICON.compress, v_metadata: ICON.metadata, v_mute: ICON.mute, v_trim: ICON.trim, v_crop: ICON.crop, v_speed: ICON.speed, v_snapshot: ICON.snap, v_split: ICON.split });
const ICON_EXTRA = { edit: '<circle cx="-2" cy="-5" r="2.4" class="f"/><circle cx="3" cy="5" r="2.4" class="f"/>', bg: '<circle cx="2" cy="2" r="3.5"/>', a_visualize: '', v_speed: '' };
const label = k => (LBL[k] ? t(LBL[k]) : String(k).toUpperCase());

const Orbit = {
  /* ring: lista de claves; opts: {main, sub, onPick, onHover, onLeave, hoverSub} */
  render(el, ring, opts = {}) {
    const n = ring.length, bulb = n >= 4, mid = 93, P = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
    let wedges = '', skin = '<circle class="rind" r="139"/><circle class="rind2" r="134"/>';
    if (bulb) {
      /* diente de ajo: punta estrecha hacia el centro y panza redondeada hacia fuera */
      const rin = 60, rv = 106, rp = 130, rvs = 118, rps = 139, step = 2 * Math.PI / n, half = step / 2 - 0.045;
      const cap = (rvv, rpp, h) => 2 * rpp - rvv * Math.cos(h);
      ring.forEach((k, i) => {
        const ca = -Math.PI / 2 + i * step, A0 = P(rin, ca - half * .42), A1 = P(rin, ca + half * .42), V0 = P(rv, ca - half), V1 = P(rv, ca + half);
        const C0 = P(80, ca - half * 1.05), C1 = P(80, ca + half * 1.05), CC = P(cap(rv, rp, half), ca), CI = P(rin - 7, ca);
        const d = `M${A0} Q${C0} ${V0} Q${CC} ${V1} Q${C1} ${A1} Q${CI} ${A0} Z`;
        const cx = +(mid * Math.cos(ca)).toFixed(1), cy = +(mid * Math.sin(ca)).toFixed(1), ox = (Math.cos(ca) * 3.5).toFixed(1), oy = (Math.sin(ca) * 3.5).toFixed(1);
        const body = ICON[k]
          ? `<g class="wi" transform="translate(${cx} ${cy - 8.5}) scale(.95)"><path d="${ICON[k]}"/>${ICON_EXTRA[k] || ''}</g><text class="wl s" x="${cx}" y="${cy + 12.5}">${label(k)}</text>`
          : `<text class="wl" x="${cx}" y="${cy}">${label(k)}</text>`;
        wedges += `<g class="wd" data-act="${k}" data-i="${i}" style="--i:${i};--ox:${ox}px;--oy:${oy}px"><g class="wb"><path class="wp" d="${d}"/>${body}</g></g>`;
      });
      /* piel del bulbo: contorno ondulado, un lóbulo por diente */
      let d = `M${P(rvs, -Math.PI / 2 - step / 2)}`;
      for (let i = 0; i < n; i++) { const ca = -Math.PI / 2 + i * step; d += ` Q${P(cap(rvs, rps, step / 2), ca)} ${P(rvs, ca + step / 2)}`; }
      skin = `<path class="rind" d="${d} Z"/><path class="rind2" d="${d} Z" transform="scale(.945)"/>`;
    } else {
      /* pocas opciones: gajos redondeados dentro de una piel de ajo de 6 lóbulos */
      const lob = 6, lstep = 2 * Math.PI / lob, rvs = 118, rps = 139; let d = `M${P(rvs, -Math.PI / 2 - lstep / 2)}`;
      for (let i = 0; i < lob; i++) { const ca = -Math.PI / 2 + i * lstep; d += ` Q${P(2 * rps - rvs * Math.cos(lstep / 2), ca)} ${P(rvs, ca + lstep / 2)}`; }
      skin = `<path class="rind" d="${d} Z"/><path class="rind2" d="${d} Z" transform="scale(.945)"/>`;
      const R0 = 60, R1 = 116, gap = n === 1 ? 0.14 : 0.06, r0 = R0 + 4.5, r1 = R1 - 4.5;
      ring.forEach((k, i) => {
        const ca = -Math.PI / 2 + i * 2 * Math.PI / n, half = n === 1 ? Math.PI - gap : Math.PI / n - gap, a0 = ca - half, a1 = ca + half, large = (a1 - a0) > Math.PI ? 1 : 0;
        const d = `M${P(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${P(r1, a1)} L${P(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${P(r0, a0)} Z`;
        const cx = n === 1 ? 0 : +(mid * Math.cos(ca)).toFixed(1), cy = n === 1 ? -mid : +(mid * Math.sin(ca)).toFixed(1), ox = (Math.cos(ca) * 3.5).toFixed(1), oy = (Math.sin(ca) * 3.5).toFixed(1);
        const body = ICON[k]
          ? `<g class="wi" transform="translate(${cx} ${cy - 8.5}) scale(.95)"><path d="${ICON[k]}"/>${ICON_EXTRA[k] || ''}</g><text class="wl s" x="${cx}" y="${cy + 12.5}">${label(k)}</text>`
          : `<text class="wl" x="${cx}" y="${cy}">${label(k)}</text>`;
        wedges += `<g class="wd" data-act="${k}" data-i="${i}" style="--i:${i};--ox:${ox}px;--oy:${oy}px"><g class="wb"><path class="wp" d="${d}"/>${body}</g></g>`;
      });
    }
    const uid = 'cp' + (Orbit._n = (Orbit._n || 0) + 1), esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const ext = esc((opts.main || '').slice(0, 6)), nm = opts.sub || '', short = esc(nm.length > 13 ? nm.slice(0, 12) + '…' : nm);
    el.innerHTML = `<svg viewBox="-140 -140 280 280">${skin}${wedges}
      <g class="ctrf"><rect class="sheet" x="-31" y="-42" width="62" height="84" rx="9"/>
        <clipPath id="${uid}"><rect x="-31" y="-42" width="62" height="58" rx="9"/></clipPath>
        <g class="glyph"><path class="gl" d="M-17 -27H17M-17 -18H17M-17 -9H8"/></g>
        <image class="thumb" x="-31" y="-42" width="62" height="58" preserveAspectRatio="xMidYMid slice" clip-path="url(#${uid})" style="display:none"/>
        <rect class="badge" x="-19" y="-2" width="38" height="15" rx="7.5"/><text class="bt" y="6">${ext}</text>
        <text class="fn" y="30">${short}</text></g>
      <g class="ctrh"><rect class="hcard" x="-50" y="-26" width="100" height="52" rx="14"/><text class="hc1" y="-9"></text><text class="hc2" y="9"></text></g></svg>`;
    const svg = el.querySelector('svg'), hc1 = el.querySelector('.hc1'), hc2 = el.querySelector('.hc2'), img = el.querySelector('.thumb');
    const set = act => {
      if (act) { const t = label(act); hc2.textContent = t; hc2.style.fontSize = t.length > 9 ? '10px' : t.length > 7 ? '12px' : t.length > 5 ? '14px' : '17px'; hc1.textContent = opts.hoverSub ? opts.hoverSub(act) : ''; svg.classList.add('hov'); }
      else svg.classList.remove('hov');
    };
    el._thumb = url => { if (!url) return; img.setAttribute('href', url); img.style.display = ''; svg.classList.add('hasthumb'); };
    set(null);
    el.onmouseover = e => { const g = e.target.closest('[data-act]'); if (g) { set(g.dataset.act); if (opts.onHover) opts.onHover(g.dataset.act); } };
    el.onmouseout = e => { const g = e.target.closest('[data-act]'); if (g && !g.contains(e.relatedTarget)) { set(null); if (opts.onLeave) opts.onLeave(); } };
    el.onclick = e => { const g = e.target.closest('[data-act]'); if (g && opts.onPick) opts.onPick(g.dataset.act); };
  }
};
