/* Herramientas de audio y vídeo (ffmpeg en el proceso principal) */
const AV = { info: null };
const X264V = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p'];
const fileUrl = p => {
  const u = p.replace(/\\/g, '/');
  return 'file://' + (u.startsWith('/') ? '' : '/') + u.split('/').map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s)) ? s : encodeURIComponent(s)).join('/');
};
const fmtT = s => { s = Math.max(0, s); const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
const audioExt = () => AUDIO_ARGS[ST.ext] ? ST.ext : 'mp3';
const videoExt = () => VIDEO_ARGS[ST.ext] && ST.ext !== 'gif' ? ST.ext : 'mp4';

/* lanza el trabajo sin bloquear la ventana: avisa al empezar y al terminar */
async function ffJob(title, outRel, post, pre = [], speed) {
  const input = ST.path, name = ST.name + (ST.ext ? '.' + ST.ext : '');
  const id = await nat.jobStart({ title: `${t(title).replace(/…$/, '')} · ${name}`, name: ST.name });
  nat.ffRun({ input, outRel, pre, post, speed, jobId: id }).then(r => {
    if (r.ok) { Snd.play('ok'); nat.jobDone({ id, out: r.out }); }
    else if (r.cancelled) nat.jobAction({ id, action: 'close' });
    else { Snd.play('err'); nat.jobError({ id, msg: r.err }); }
  });
}
function avPrepare(label, withMedia = true) {
  const pm = $('#pm'); pm.src = fileUrl(ST.path); pm.load();
  $('#pstage').classList.toggle('audio', !AV.info?.hasVideo);
  return pm;
}
async function avLoad() { AV.info = await nat.ffProbe(ST.path); return AV.info; }
function timeRows(dur, withNow = true) {
  return `<div class="row"><label>Inicio</label><input type="range" id="ts" min="0" max="${dur}" step="0.1" value="0"><span class="val" id="tsv">0:00.0</span>${withNow ? '<button class="mini" id="tsn">Ahora</button>' : ''}</div>
    <div class="row"><label>Fin</label><input type="range" id="te" min="0" max="${dur}" step="0.1" value="${dur}"><span class="val" id="tev">${fmtT(dur)}</span>${withNow ? '<button class="mini" id="ten">Ahora</button>' : ''}</div>`;
}
function bindTime(pm, T) {
  const s = $('#ts'), e = $('#te');
  const upd = () => { if (+s.value > +e.value) { if (document.activeElement === s) e.value = s.value; else s.value = e.value; } T.s = +s.value; T.e = +e.value; $('#tsv').textContent = fmtT(T.s); $('#tev').textContent = fmtT(T.e); };
  s.oninput = () => { upd(); pm.currentTime = T.s; }; e.oninput = () => { upd(); pm.currentTime = T.e; };
  $('#tsn').onclick = () => { s.value = pm.currentTime; upd(); }; $('#ten').onclick = () => { e.value = pm.currentTime; upd(); };
  upd();
}
function noInfo() { return !AV.info || !AV.info.duration; }

const AVM = {
  a_compress: { title: 'Comprimir audio', apply: 'Comprimir', k: 96,
    async open() { await avLoad(); avPrepare(); this.k = 96; ctl(`<div class="info"><b>Duración</b>${fmtT(AV.info.duration)}</div><div class="row"><label>Calidad</label><div class="chips" id="ak"></div></div><div class="info" style="opacity:.8">Se guardará como MP3.</div>`); chipRow('ak', ['64 kbps', '96 kbps', '128 kbps', '192 kbps'], '96 kbps', v => this.k = parseInt(v)); },
    save() { ffJob('Comprimiendo audio…', `${ST.name}${t('_comprimido')}.mp3`, ['-vn', '-c:a', 'libmp3lame', '-b:a', this.k + 'k']); } },
  a_metadata: { title: 'Metadatos del audio', apply: 'Quitar metadatos y guardar',
    async open() { await avLoad(); avPrepare(); const i = AV.info; ctl(`<div class="info"><b>Duración</b>${fmtT(i.duration)}<br><b>Etiquetas</b>${i.tags.length ? '<br>' + i.tags.map(t => escH(t)).join('<br>') : 'ninguna'}</div>`); },
    save() { ffJob('Limpiando metadatos…', `${ST.name}${t('_limpio')}.${ST.ext}`, ['-map_metadata', '-1', '-c', 'copy']); } },
  a_channels: { title: 'Canales de audio', apply: 'Guardar', c: 1,
    async open() { await avLoad(); avPrepare(); this.c = 1; ctl(`<div class="row"><label>Canales</label><div class="chips" id="ac"></div></div>`); chipRow('ac', ['Mono', 'Estéreo'], 'Mono', v => this.c = v === 'Mono' ? 1 : 2); },
    save() { const e = audioExt(); ffJob('Cambiando canales…', `${ST.name}${this.c === 1 ? t('_mono') : t('_estereo')}.${e}`, [...AUDIO_ARGS[e] || AUDIO_ARGS.mp3, '-ac', String(this.c)]); } },
  a_normalize: { title: 'Normalizar volumen', apply: 'Normalizar',
    async open() { await avLoad(); avPrepare(); ctl('<div class="info">Ajusta el volumen medio a un nivel estándar (−16 LUFS) sin distorsionar.</div>'); },
    save() { const e = audioExt(); ffJob('Normalizando…', `${ST.name}${t('_normalizado')}.${e}`, ['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', ...AUDIO_ARGS[e] || AUDIO_ARGS.mp3]); } },
  a_trim: { title: 'Cortar audio', apply: 'Cortar', T: { s: 0, e: 0 },
    async open() { await avLoad(); const pm = avPrepare(); if (noInfo()) { ctl('<div class="info">No se pudo leer la duración.</div>'); return; } this.T = { s: 0, e: AV.info.duration }; ctl(timeRows(AV.info.duration)); bindTime(pm, this.T); },
    save() { const e = audioExt(), T = this.T; ffJob('Recortando audio…', `${ST.name}${t('_recorte')}.${e}`, ['-ss', String(T.s), '-to', String(T.e), ...AUDIO_ARGS[e] || AUDIO_ARGS.mp3]); } },
  a_visualize: { title: 'Forma de onda', apply: 'Generar imagen',
    async open() { await avLoad(); avPrepare(); ctl('<div class="info">Genera una imagen PNG con la forma de onda del audio.</div>'); },
    save() { ffJob('Generando onda…', `${ST.name}${t('_onda')}.png`, ['-filter_complex', `showwavespic=s=1600x400:colors=0x${CFG.ac.slice(1)}`, '-frames:v', '1']); } },

  v_compress: { title: 'Comprimir vídeo', apply: 'Comprimir', crf: 26, small: false,
    async open() { await avLoad(); avPrepare(); this.crf = 26; this.small = false; ctl(`<div class="info"><b>Duración</b>${fmtT(AV.info.duration)}<br><b>Tamaño</b>${AV.info.width}×${AV.info.height}</div><div class="row"><label>Calidad</label><div class="chips" id="vq"></div></div><div class="row"><label>Resolución</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="v7"> Reducir a 720p</label></div>`); chipRow('vq', ['Alta', 'Media', 'Baja'], 'Media', v => this.crf = { Alta: 21, Media: 26, Baja: 32 }[v]); $('#v7').onchange = e => this.small = e.target.checked; },
    save() { const a = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(this.crf), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart']; if (this.small) a.unshift('-vf', 'scale=-2:720'); ffJob('Comprimiendo vídeo…', `${ST.name}${t('_comprimido')}.mp4`, a); } },
  v_metadata: { title: 'Metadatos del vídeo', apply: 'Quitar metadatos y guardar',
    async open() { await avLoad(); avPrepare(); const i = AV.info; ctl(`<div class="info"><b>Duración</b>${fmtT(i.duration)}<br><b>Tamaño</b>${i.width}×${i.height}<br><b>Etiquetas</b>${i.tags.length ? '<br>' + i.tags.map(t => escH(t)).join('<br>') : 'ninguna'}</div>`); },
    save() { ffJob('Limpiando metadatos…', `${ST.name}${t('_limpio')}.${ST.ext}`, ['-map_metadata', '-1', '-c', 'copy']); } },
  v_mute: { title: 'Silenciar vídeo', apply: 'Quitar audio',
    async open() { await avLoad(); avPrepare(); ctl('<div class="info">Guarda una copia del vídeo sin pista de audio (sin recodificar).</div>'); },
    save() { ffJob('Quitando audio…', `${ST.name}${t('_mudo')}.${ST.ext}`, ['-an', '-c:v', 'copy']); } },
  v_trim: { title: 'Cortar vídeo', apply: 'Cortar', T: { s: 0, e: 0 }, precise: false,
    async open() { await avLoad(); const pm = avPrepare(); if (noInfo()) { ctl('<div class="info">No se pudo leer la duración.</div>'); return; } this.T = { s: 0, e: AV.info.duration }; this.precise = false; ctl(timeRows(AV.info.duration) + '<div class="row"><label>Modo</label><div class="chips" id="vt"></div></div>'); bindTime(pm, this.T); chipRow('vt', ['Rápido', 'Preciso'], 'Rápido', v => this.precise = v === 'Preciso'); },
    save() { const T = this.T, e = videoExt(); if (this.precise) ffJob('Recortando vídeo…', `${ST.name}${t('_recorte')}.${e}`, VIDEO_ARGS[e], ['-ss', String(T.s), '-to', String(T.e)]); else ffJob('Recortando vídeo…', `${ST.name}${t('_recorte')}.${ST.ext}`, ['-c', 'copy', '-avoid_negative_ts', 'make_zero'], ['-ss', String(T.s), '-to', String(T.e)]); } },
  v_crop: { title: 'Encuadre del vídeo', apply: 'Recortar', r: 1,
    async open() { await avLoad(); avPrepare(); this.r = 1; ctl(`<div class="row"><label>Proporción</label><div class="chips" id="vc"></div></div><div class="info" style="opacity:.8">Recorta desde el centro.<br>Original: <b style="width:auto">${AV.info.width}×${AV.info.height}</b></div>`); chipRow('vc', ['1:1', '16:9', '9:16', '4:3', '3:4'], '1:1', v => { const [a, b] = v.split(':').map(Number); this.r = a / b; }); },
    save() { const i = AV.info, R = this.r; let cw, ch; if (i.width / i.height > R) { ch = i.height; cw = Math.floor(ch * R / 2) * 2; } else { cw = i.width; ch = Math.floor(cw / R / 2) * 2; } ffJob('Recortando encuadre…', `${ST.name}${t('_encuadre')}.mp4`, ['-vf', `crop=${cw - cw % 2}:${ch - ch % 2}`, ...VIDEO_ARGS.mp4]); } },
  v_speed: { title: 'Velocidad', apply: 'Aplicar', f: 2,
    async open() { await avLoad(); avPrepare(); this.f = 2; ctl(`<div class="row"><label>Velocidad</label><div class="chips" id="vs"></div></div>`); chipRow('vs', ['0.5×', '1.5×', '2×', '4×'], '2×', v => this.f = parseFloat(v)); },
    save() {
      const F = this.f, at = F >= 2 ? Array(Math.round(Math.log2(F))).fill('atempo=2').join(',') : F < 1 ? 'atempo=0.5' : `atempo=${F}`, name = `${ST.name}_${F}x.mp4`;
      if (AV.info.hasAudio) ffJob('Cambiando velocidad…', name, ['-filter_complex', `[0:v]setpts=PTS/${F}[v];[0:a]${at}[a]`, '-map', '[v]', '-map', '[a]', ...X264V, '-c:a', 'aac'], [], F);
      else ffJob('Cambiando velocidad…', name, ['-vf', `setpts=PTS/${F}`, '-an', ...X264V], [], F);
    } },
  v_snapshot: { title: 'Captura de pantalla', apply: 'Guardar captura', t: 0,
    async open() { await avLoad(); const pm = avPrepare(); this.t = 0; ctl(`<div class="row"><label>Momento</label><input type="range" id="tt" min="0" max="${AV.info.duration}" step="0.1" value="0"><span class="val" id="ttv">0:00.0</span><button class="mini" id="ttn">Ahora</button></div>`); const t = $('#tt'); t.oninput = () => { this.t = +t.value; $('#ttv').textContent = fmtT(this.t); pm.currentTime = this.t; }; $('#ttn').onclick = () => { t.value = pm.currentTime; t.oninput(); }; },
    save() { ffJob('Guardando captura…', `${ST.name}${t('_captura')}.png`, ['-ss', String(this.t), '-frames:v', '1']); } },
  v_split: { title: 'Dividir vídeo', apply: 'Dividir', s: 60,
    async open() { await avLoad(); avPrepare(); this.s = 60; ctl(`<div class="row"><label>Cada</label><div class="chips" id="vp"></div></div><div class="info" style="opacity:.8">Crea una carpeta con las partes (sin recodificar; los cortes caen en el fotograma clave más cercano).</div>`); chipRow('vp', ['30 s', '1 min', '5 min', '10 min'], '1 min', v => this.s = { '30 s': 30, '1 min': 60, '5 min': 300, '10 min': 600 }[v]); },
    save() { ffJob('Dividiendo vídeo…', `${ST.name}${t('_partes')}/${ST.name}_%03d.${ST.ext}`, ['-f', 'segment', '-segment_time', String(this.s), '-c', 'copy', '-reset_timestamps', '1']); } }
};
for (const k of Object.keys(AVM)) { MODES[k] = { ...AVM[k], media: true }; }
