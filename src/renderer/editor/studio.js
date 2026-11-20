/* Video studio: a small timeline editor (cut, trim, reorder, speed, volume, titles, music) on top of the bundled ffmpeg.
 * The project is plain numbers + the files the user picked; the main process validates it and builds the ffmpeg graph (main/studio-graph.js).
 * The result is always a new file next to the original. */

const SD = { clips: [], texts: [], music: null, sel: { k: 'clip', i: 0 }, fmt: '16:9', res: '1080p', fit: 'contain', quality: 'Media', seq: 0, drag: null, play: false, idx: 0 };
const SD_RES = { '16:9': { '720p': [1280, 720], '1080p': [1920, 1080] }, '9:16': { '720p': [720, 1280], '1080p': [1080, 1920] }, '1:1': { '720p': [720, 720], '1080p': [1080, 1080] } };
const SD_MAX_CLIPS = 60, SD_MAX_TEXTS = 40;
const sdDur = c => (c.out - c.in) / c.speed;
const sdTotal = () => SD.clips.reduce((a, c) => a + sdDur(c), 0);
const sdSize = () => SD_RES[SD.fmt][SD.res];
const sdVideo = () => $('#sdv');
const sdFind = (list, id) => list.findIndex(x => x.id === id);

/** One clip from a file: probes it and starts with the whole length. */
async function sdClipFrom(f) {
  const info = await nat.ffProbe(f.path);
  if (!info.hasVideo || !info.duration) throw new Error(t('{name} no es un vídeo que Garlic pueda leer.', { name: f.name }));
  return { id: ++SD.seq, src: f.path, name: f.name, dur: info.duration, hasAudio: info.hasAudio, w: info.width, h: info.height, in: 0, out: Math.round(info.duration * 10) / 10 || info.duration, speed: 1, vol: 1 };
}

/* ---------------- playback: one <video>, swapped clip by clip ---------------- */
function sdLoadClip(i, srcTime) {
  const v = sdVideo(), c = SD.clips[i]; if (!v || !c) return;
  SD.idx = i;
  if (v.dataset.src !== c.src) { v.dataset.src = c.src; v.src = fileUrl(c.src); }
  v.playbackRate = c.speed; v.volume = Math.min(1, c.vol); v.muted = !c.hasAudio || c.vol === 0;
  try { v.currentTime = srcTime; } catch { /* metadata not ready: the browser keeps the position */ }
}
function sdGlobalTime() {
  const v = sdVideo(), c = SD.clips[SD.idx]; if (!v || !c) return 0;
  let g = 0; for (let k = 0; k < SD.idx; k++) g += sdDur(SD.clips[k]);
  return g + Math.max(0, Math.min(c.out, v.currentTime) - c.in) / c.speed;
}
function sdSeek(g) {
  let acc = 0;
  for (let k = 0; k < SD.clips.length; k++) {
    const d = sdDur(SD.clips[k]);
    if (g <= acc + d || k === SD.clips.length - 1) { sdLoadClip(k, SD.clips[k].in + Math.max(0, Math.min(d, g - acc)) * SD.clips[k].speed); break; }
    acc += d;
  }
  sdDraw();
}
function sdPlay(on) {
  const v = sdVideo(); if (!v || !SD.clips.length) return;
  SD.play = on; $('#sdp').textContent = on ? '❚❚' : '▶';
  const mu = $('#sdm'); if (mu) { if (on && SD.music) { try { mu.currentTime = sdGlobalTime() % (mu.duration || 1e9); mu.play(); } catch { /* blocked */ } } else mu.pause(); }
  if (on) { if (sdGlobalTime() >= sdTotal() - 0.05) sdSeek(0); v.play().catch(() => {}); sdTick(); } else v.pause();
}
function sdTick() {
  const v = sdVideo(); if (!SD.play || !v || !document.contains(v)) return;
  const c = SD.clips[SD.idx];
  if (c && (v.currentTime >= c.out - 0.03 || v.ended)) {
    if (SD.idx + 1 < SD.clips.length) { sdLoadClip(SD.idx + 1, SD.clips[SD.idx + 1].in); v.play().catch(() => {}); }
    else { sdPlay(false); sdDraw(); return; }
  }
  sdDraw(); requestAnimationFrame(sdTick);
}

/* ---------------- drawing ---------------- */
const sdPct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0);
function sdTextAt(g) { return SD.texts.filter(x => g >= x.start && g <= x.end); }
function sdPos(tx) { return tx.pos === 'top' ? 'top:7%' : tx.pos === 'middle' ? 'top:50%;transform:translateY(-50%)' : 'bottom:7%'; }
function sdOverlay(g) {
  const box = $('#sdo'), v = sdVideo(); if (!box || !v) return;
  const [w, h] = sdSize(), vr = v.getBoundingClientRect(), k = Math.min(vr.width / w, vr.height / h);   // the picture is letterboxed inside the element
  const bw = w * k, bh = h * k; Object.assign(box.style, { width: bw + 'px', height: bh + 'px', left: (vr.left - box.parentElement.getBoundingClientRect().left + (vr.width - bw) / 2) + 'px', top: (vr.top - box.parentElement.getBoundingClientRect().top + (vr.height - bh) / 2) + 'px' });
  box.innerHTML = sdTextAt(g).map(x => `<div class="sdt" style="${sdPos(x)};font-size:${(x.size / 100 * bh).toFixed(1)}px;color:${x.color}">${escH(x.text).replace(/\n/g, '<br>')}</div>`).join('');
}
function sdDraw() {
  const g = sdGlobalTime(), tot = sdTotal();
  const tm = $('#sdtime'); if (tm) tm.textContent = `${fmtT(g)} / ${fmtT(tot)}`;
  const ph = $('#sdph'), blocks = document.querySelectorAll('#sdtl .sdc'), c = SD.clips[SD.idx], b = blocks[SD.idx];
  if (ph && b && c) { const fr = (Math.min(c.out, Math.max(c.in, sdVideo().currentTime)) - c.in) / (c.out - c.in); ph.style.left = (b.offsetLeft + fr * b.offsetWidth) + 'px'; }
  sdOverlay(g);
}
function sdTimeline() {
  const tl = $('#sdtl'), tot = sdTotal() || 1;
  tl.innerHTML = `<div class="sdrow" id="sdclips">${SD.clips.map((c, i) => `<div class="sdc${SD.sel.k === 'clip' && SD.sel.i === i ? ' sel' : ''}" draggable="true" data-i="${i}" style="flex:${Math.max(sdDur(c), tot * 0.03).toFixed(3)} 1 0" title="${escH(c.name)}"><span>${escH(c.name)}</span><i>${fmtT(sdDur(c))}${c.speed !== 1 ? ' · ' + c.speed + '×' : ''}</i></div>`).join('')}</div>` +
    `<div class="sdrow sdtx" id="sdtxs">${SD.texts.map((x, i) => `<div class="sdp${SD.sel.k === 'text' && SD.sel.i === i ? ' sel' : ''}" data-i="${i}" style="left:${sdPct(x.start, tot)}%;width:${Math.max(2, sdPct(x.end - x.start, tot))}%" title="${escH(x.text)}">${escH(x.text)}</div>`).join('')}</div>` +
    `<div class="sdrow sdmu" id="sdmus">${SD.music ? `<div class="sdp mu" style="left:0;width:100%">♪ ${escH(SD.music.name)}</div>` : ''}</div><div id="sdph"></div>`;
  sdDraw();
}
function sdSide() {
  const s = $('#sdside'), sel = SD.sel;
  if (sel.k === 'text' && SD.texts[sel.i]) {
    const x = SD.texts[sel.i], tot = Math.max(sdTotal(), 0.1);
    s.innerHTML = `<h4>Título</h4><textarea id="sxt" rows="3" maxlength="200">${escH(x.text)}</textarea>
      <div class="row"><label>Desde</label><input type="range" id="sxs" min="0" max="${tot.toFixed(1)}" step="0.1" value="${x.start}"><span class="val" id="sxsv">${fmtT(x.start)}</span></div>
      <div class="row"><label>Hasta</label><input type="range" id="sxe" min="0" max="${tot.toFixed(1)}" step="0.1" value="${x.end}"><span class="val" id="sxev">${fmtT(x.end)}</span></div>
      ${slider('sxz', 'Tamaño', 3, 16, x.size, '%')}
      <div class="row"><label>Posición</label><div class="chips" id="sxp"></div></div><div class="row"><label>Color</label><div class="chips" id="sxc"></div></div>
      <div class="chips"><button id="sxd">Quitar título</button></div>`;
    const cut = () => sdTimeline();
    $('#sxt').oninput = e => { x.text = e.target.value; sdDraw(); };
    $('#sxt').onchange = cut;
    const a = $('#sxs'), b = $('#sxe');
    a.oninput = () => { x.start = +a.value; if (x.end <= x.start + 0.1) { x.end = Math.min(tot, x.start + 0.1); b.value = x.end; } $('#sxsv').textContent = fmtT(x.start); $('#sxev').textContent = fmtT(x.end); };
    b.oninput = () => { x.end = Math.max(+b.value, x.start + 0.1); $('#sxev').textContent = fmtT(x.end); };
    a.onchange = b.onchange = () => { sdTimeline(); };
    onSlider('sxz', '%', v => { x.size = v; sdDraw(); });
    chipRow('sxp', ['Arriba', 'Centro', 'Abajo'], { top: 'Arriba', middle: 'Centro', bottom: 'Abajo' }[x.pos], v => { x.pos = { Arriba: 'top', Centro: 'middle', Abajo: 'bottom' }[v]; sdDraw(); });
    chipRow('sxc', ['Blanco', 'Amarillo', 'Negro'], { '#ffffff': 'Blanco', '#ffe14a': 'Amarillo', '#111111': 'Negro' }[x.color], v => { x.color = { Blanco: '#ffffff', Amarillo: '#ffe14a', Negro: '#111111' }[v]; sdDraw(); });
    $('#sxd').onclick = () => { SD.texts.splice(sel.i, 1); SD.sel = { k: 'clip', i: Math.min(SD.idx, SD.clips.length - 1) }; sdRefresh(); };
    return;
  }
  const c = SD.clips[sel.i] || SD.clips[0]; if (!c) { s.innerHTML = ''; return; }
  const i = SD.clips.indexOf(c);
  s.innerHTML = `<h4>${t('Clip {i} de {n}', { i: i + 1, n: SD.clips.length })}</h4><div class="sdn">${escH(c.name)}</div>
    <div class="row"><label>Inicio</label><input type="range" id="sci" min="0" max="${c.dur.toFixed(1)}" step="0.1" value="${c.in}"><span class="val" id="scia">${fmtT(c.in)}</span></div>
    <div class="row"><label>Fin</label><input type="range" id="sco" min="0" max="${c.dur.toFixed(1)}" step="0.1" value="${c.out}"><span class="val" id="scoa">${fmtT(c.out)}</span></div>
    <div class="row"><label>Velocidad</label><div class="chips" id="scs"></div></div>
    ${c.hasAudio ? slider('scv', 'Volumen', 0, 200, Math.round(c.vol * 100), '%') : '<div class="info" style="opacity:.8">Este clip no tiene audio.</div>'}
    <div class="chips"><button id="scl">◀</button><button id="scr">▶</button><button id="scd">Quitar clip</button></div>`;
  const a = $('#sci'), b = $('#sco');
  const upd = () => {
    if (+a.value > +b.value - 0.1) { if (document.activeElement === a) a.value = Math.max(0, +b.value - 0.1); else b.value = Math.min(c.dur, +a.value + 0.1); }
    c.in = +a.value; c.out = +b.value; $('#scia').textContent = fmtT(c.in); $('#scoa').textContent = fmtT(c.out);
  };
  a.oninput = () => { upd(); sdTimeline(); sdSelectPlay(i, c.in); }; b.oninput = () => { upd(); sdTimeline(); sdSelectPlay(i, Math.max(c.in, c.out - 0.1)); };
  chipRow('scs', ['0.5×', '1×', '1.5×', '2×', '4×'], c.speed + '×', v => { c.speed = parseFloat(v); const vv = sdVideo(); if (SD.idx === i) vv.playbackRate = c.speed; sdTimeline(); });
  if (c.hasAudio) onSlider('scv', '%', v => { c.vol = v / 100; if (SD.idx === i) { const vv = sdVideo(); vv.volume = Math.min(1, c.vol); vv.muted = c.vol === 0; } });
  $('#scl').onclick = () => sdMoveClip(i, i - 1); $('#scr').onclick = () => sdMoveClip(i, i + 1);
  $('#scd').onclick = () => sdRemoveClip(i);
}
function sdSelectPlay(i, srcTime) { if (SD.play) sdPlay(false); sdLoadClip(i, srcTime); setTimeout(sdDraw, 60); }
function sdRefresh() { sdTimeline(); sdSide(); sdTotals(); }
function sdTotals() { const n = $('#sdinfo'); if (n) n.textContent = t('{n} clips · {d}', { n: SD.clips.length, d: fmtT(sdTotal()) }); }

function sdMoveClip(i, j) {
  if (j < 0 || j >= SD.clips.length || i === j) return;
  const [c] = SD.clips.splice(i, 1); SD.clips.splice(j, 0, c); SD.sel = { k: 'clip', i: j }; if (SD.play) sdPlay(false);
  sdLoadClip(j, c.in); sdRefresh();
}
function sdRemoveClip(i) {
  if (SD.clips.length < 2) { toast(t('Necesitas al menos un clip.'), true); return; }
  if (SD.play) sdPlay(false);
  SD.clips.splice(i, 1); SD.sel = { k: 'clip', i: Math.min(i, SD.clips.length - 1) }; sdLoadClip(SD.sel.i, SD.clips[SD.sel.i].in); sdRefresh();
}
function sdSplit() {
  const c = SD.clips[SD.idx], v = sdVideo(); if (!c) return;
  const at = Math.round(v.currentTime * 10) / 10;
  if (at - c.in < 0.1 || c.out - at < 0.1) { toast(t('Coloca el cabezal dentro del clip, lejos de los extremos.'), true); return; }
  if (SD.clips.length >= SD_MAX_CLIPS) { toast(t('Demasiados clips.'), true); return; }
  if (SD.play) sdPlay(false);
  const second = { ...c, id: ++SD.seq, in: at }; c.out = at;
  SD.clips.splice(SD.idx + 1, 0, second); SD.sel = { k: 'clip', i: SD.idx + 1 }; sdLoadClip(SD.idx + 1, at); sdRefresh();
}
async function sdAddClips() {
  const files = await nat.pickMedia('video'); if (!files.length) return;
  try {
    for (const f of files) { if (SD.clips.length >= SD_MAX_CLIPS) { toast(t('Demasiados clips.'), true); break; } SD.clips.push(await sdClipFrom(f)); }
    SD.sel = { k: 'clip', i: SD.clips.length - 1 }; sdRefresh();
  } catch (e) { toast(e.message, true); }
}
function sdAddText() {
  if (SD.texts.length >= SD_MAX_TEXTS) { toast(t('Demasiados títulos.'), true); return; }
  const g = sdGlobalTime(), tot = Math.max(sdTotal(), 0.2);
  SD.texts.push({ id: ++SD.seq, text: t('Tu título'), start: Math.round(g * 10) / 10, end: Math.round(Math.min(tot, g + 3) * 10) / 10 || tot, size: 8, color: '#ffffff', pos: 'bottom' });
  if (SD.texts[SD.texts.length - 1].end <= SD.texts[SD.texts.length - 1].start) SD.texts[SD.texts.length - 1].start = Math.max(0, SD.texts[SD.texts.length - 1].end - 0.5);
  SD.sel = { k: 'text', i: SD.texts.length - 1 }; sdRefresh();
}
async function sdAddMusic() {
  const [f] = await nat.pickMedia('audio'); if (!f) return;
  const info = await nat.ffProbe(f.path); if (!info.hasAudio) { toast(t('{name} no tiene audio.', { name: f.name }), true); return; }
  SD.music = { src: f.path, name: f.name, vol: 0.5 }; const mu = $('#sdm'); mu.src = fileUrl(f.path); mu.volume = 0.5; sdMusicUi(); sdTimeline();
}
function sdMusicUi() {
  const b = $('#sdmb'); if (!b) return;
  b.innerHTML = SD.music ? `<div class="row"><label>♪ Música</label><input type="range" id="smv" min="0" max="200" value="${Math.round(SD.music.vol * 100)}"><span class="val" id="smvv">${Math.round(SD.music.vol * 100)}%</span><button class="mini" id="smx">Quitar</button></div>` : '';
  if (SD.music) { onSlider('smv', '%', v => { SD.music.vol = v / 100; $('#sdm').volume = Math.min(1, SD.music.vol); }); $('#smx').onclick = () => { SD.music = null; const mu = $('#sdm'); mu.pause(); mu.removeAttribute('src'); sdMusicUi(); sdTimeline(); }; }
}

/* ---------------- titles → transparent PNGs the size of the output ---------------- */
function sdTextPng(x, w, h) {
  const c = newCanvas(w, h), g = c.getContext('2d'), px = Math.round(x.size / 100 * h), lines = x.text.split('\n');
  g.font = `700 ${px}px "Segoe UI", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(2, px / 7); g.strokeStyle = x.color === '#111111' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.75)'; g.fillStyle = x.color;
  const lh = px * 1.2, hh = lines.length * lh;
  const top = x.pos === 'top' ? h * 0.07 : x.pos === 'middle' ? (h - hh) / 2 : h * 0.93 - hh;
  lines.forEach((ln, i) => { const y = top + lh * (i + 0.5); g.strokeText(ln, w / 2, y, w * 0.92); g.fillText(ln, w / 2, y, w * 0.92); });
  return new Promise((res, rej) => c.toBlob(async b => (b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error('png'))), 'image/png'));
}

async function sdExport() {
  const [w, h] = sdSize(), outName = ST.name + t('_estudio');
  const texts = []; for (const x of SD.texts) if (x.text.trim()) texts.push({ start: x.start, end: x.end, png: await sdTextPng(x, w, h) });
  const id = await nat.jobStart({ title: `${t('Exportando vídeo…').replace(/…$/, '')} · ${ST.name}`, name: ST.name });
  const project = { anchor: ST.path, outName, w, h, fit: SD.fit, quality: SD.quality, jobId: id, texts,
    clips: SD.clips.map(c => ({ src: c.src, in: c.in, out: c.out, speed: c.speed, vol: c.hasAudio ? c.vol : 1 })), music: SD.music ? { src: SD.music.src, vol: SD.music.vol } : null };
  nat.studioExport(project).then(r => {
    if (r.ok) { Snd.play('ok'); nat.jobDone({ id, out: r.out }); }
    else if (r.cancelled) nat.jobAction({ id, action: 'close' });
    else { Snd.play('err'); nat.jobError({ id, msg: r.err }); }
  });
}

/* ---------------- the mode ---------------- */
MODES.v_studio = {
  title: 'Estudio de vídeo', apply: 'Exportar vídeo', own: true,
  async open() {
    if (SD.play) sdPlay(false);
    Object.assign(SD, { clips: [], texts: [], music: null, sel: { k: 'clip', i: 0 }, fit: 'contain', quality: 'Media', res: '1080p', idx: 0, play: false });
    const g = $('#pgrid'); g.className = 'studio';
    g.innerHTML = `<div id="sdstage"><video id="sdv" preload="auto"></video><div id="sdo"></div></div>
      <div id="sdside"></div>
      <div id="sdbar"><button class="mini" id="sdp" title="Espacio">▶</button><span id="sdtime">0:00.0 / 0:00.0</span><span id="sdinfo"></span></div>
      <div id="sdtl"></div><audio id="sdm" loop hidden></audio>`;
    ctl(`<div class="chips" id="sdtools"><button data-a="clip">＋ Clip</button><button data-a="split">✂ Dividir aquí</button><button data-a="text">＋ Título</button><button data-a="music">♪ Música</button></div><div id="sdmb"></div>
      <div class="row"><label>Formato</label><div class="chips" id="sdf"></div><div class="chips" id="sdr"></div></div>
      <div class="row"><label>Ajuste</label><div class="chips" id="sdt"></div><label style="width:auto;margin-left:8px">Calidad</label><div class="chips" id="sdq"></div></div>`);
    try { const info = await nat.ffProbe(ST.path); if (!info.hasVideo) throw new Error(t('Este archivo no es un vídeo que Garlic pueda leer.')); SD.clips.push(await sdClipFrom({ path: ST.path, name: ST.name + (ST.ext ? '.' + ST.ext : '') })); }
    catch (e) { toast(e.message, true); return; }
    const c0 = SD.clips[0]; SD.fmt = c0.h > c0.w * 1.1 ? '9:16' : Math.abs(c0.h - c0.w) < c0.w * 0.1 ? '1:1' : '16:9';
    SD.res = Math.min(c0.w, c0.h) >= 1000 ? '1080p' : '720p';
    chipRow('sdf', ['16:9', '9:16', '1:1'], SD.fmt, v => { SD.fmt = v; sdDraw(); });
    chipRow('sdr', ['720p', '1080p'], SD.res, v => { SD.res = v; });
    chipRow('sdt', ['Barras', 'Rellenar'], 'Barras', v => { SD.fit = v === 'Rellenar' ? 'cover' : 'contain'; });
    chipRow('sdq', ['Alta', 'Media', 'Baja'], 'Media', v => { SD.quality = v; });
    $('#sdtools').onclick = e => { const b = e.target.closest('button'); if (!b) return; ({ clip: sdAddClips, split: sdSplit, text: sdAddText, music: sdAddMusic })[b.dataset.a](); };
    $('#sdp').onclick = () => sdPlay(!SD.play);
    const v = sdVideo();
    v.onloadedmetadata = () => { sdDraw(); };
    v.onclick = () => sdPlay(!SD.play);
    new ResizeObserver(() => sdDraw()).observe($('#sdstage'));
    const tl = $('#sdtl');
    tl.onclick = e => {
      const p = e.target.closest('.sdp:not(.mu)'); if (p) { SD.sel = { k: 'text', i: +p.dataset.i }; sdRefresh(); return; }
      const b = e.target.closest('.sdc'); if (!b) return;
      const i = +b.dataset.i, r = b.getBoundingClientRect(), c = SD.clips[i], fr = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      if (SD.play) sdPlay(false);
      SD.sel = { k: 'clip', i }; sdLoadClip(i, c.in + fr * (c.out - c.in)); sdTimeline(); sdSide(); setTimeout(sdDraw, 60);
    };
    tl.ondragstart = e => { const b = e.target.closest('.sdc'); if (!b) return; SD.drag = +b.dataset.i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'clip'); } catch { /* ignore */ } };
    tl.ondragover = e => { if (SD.drag !== null) e.preventDefault(); };
    tl.ondrop = e => { if (SD.drag === null) return; e.preventDefault(); const b = e.target.closest('.sdc'), from = SD.drag; SD.drag = null; if (b) sdMoveClip(from, +b.dataset.i); };
    tl.ondragend = () => { SD.drag = null; };
    sdLoadClip(0, 0); sdRefresh(); sdMusicUi();
  },
  save() {
    if (!SD.clips.length) throw new Error(t('Necesitas al menos un clip.'));
    if (SD.play) sdPlay(false);
    return sdExport();
  }
};
document.addEventListener('keydown', e => {
  if (P !== MODES.v_studio || e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName) || !$('#sdv')) return;
  e.preventDefault(); sdPlay(!SD.play);
});
