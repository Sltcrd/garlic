/* The floating wheel: convert / edit / actions rings for the file the user clicked. */
const EDIT_RING = ['crop', 'bg', 'erase', 'compress', 'metadata', 'edit', 'redact', 'annotate'];
const ACT_RING = ['copypath', 'reveal', 'terminal', 'copyto', 'moveto', 'open'];
const editRing = () => ST.kind === 'audio' ? AUDIO_TOOLS : ST.kind === 'video' ? VIDEO_TOOLS : EDIT_RING;
const isTool = a => EDIT_RING.includes(a) || AUDIO_TOOLS.includes(a) || VIDEO_TOOLS.includes(a);
const modeName = m => ({ convert: t('Convertir'), edit: t('Editar'), actions: t('Acciones') }[m]);

/** Saves the files produced by a conversion next to the original; returns the path to show (the file, or the folder when there are several). */
async function saveFiles(files) {
  if (files.length === 1 && files[0].done) return files[0].done;
  const dir = ST.dir; let last = '';
  for (const f of files) {
    const dot = f.rel.lastIndexOf('.'), slash = f.rel.lastIndexOf('/'), hasExt = dot > slash && dot > 0;
    last = await nat.save({
      dir, base: hasExt ? f.rel.slice(0, dot) : f.rel, ext: hasExt ? f.rel.slice(dot) : '', extract: ST.kind === 'archive',
      bytes: new Uint8Array(await f.blob.arrayBuffer())
    });
  }
  const top = files[0].rel.split('/')[0];
  return files.length > 1 && files.every(f => f.rel.startsWith(top + '/')) ? dir + '/' + top : last;
}

/* ---------- modes and ring ---------- */
function modes() {
  const m = [];
  if (outputsFor(ST.kind, ST.ext).length) m.push('convert');
  if (['image', 'pdf', 'audio', 'video'].includes(ST.kind)) m.push('edit');
  m.push('actions');
  return m;
}
function ringNow() {
  if (ST.mode === 'edit') return editRing();
  if (ST.mode === 'actions') return ACT_RING;
  const o = outputsFor(ST.kind, ST.ext);
  if (o.length <= 8) return o;
  const per = 7, pages = Math.ceil(o.length / per); ST.page %= pages;
  return [...o.slice(ST.page * per, ST.page * per + per), '__more'];
}
let lastHover = null;
function update() {
  const ms = modes(); if (!ms.includes(ST.mode)) ST.mode = ms[0];
  $('#mname').textContent = modeName(ST.mode);
  $('#dots').innerHTML = ms.map(m => `<i class="${m === ST.mode ? 'on' : ''}"></i>`).join('');
  $('#modebar').classList.toggle('single', ms.length < 2);
  Orbit.render($('#wheel'), ringNow(), {
    main: ST.kind === 'folder' ? 'DIR' : (ST.ext || '').toUpperCase().slice(0, 5), sub: ST.name,
    hoverSub: a => a === '__more' ? t('otros formatos') : ACT_RING.includes(a) ? t('acción') : isTool(a) ? t('herramienta') : a === 'extract' ? t('archivo') : t('convertir a'),
    onHover: a => { if (a !== lastHover) { lastHover = a; Snd.play('hover'); } }, onLeave: () => { lastHover = null; }, onPick: act
  });
  $('#fname').textContent = ST.name + (ST.ext ? '.' + ST.ext : '');
  if (ST.thumb) $('#wheel')._thumb(ST.thumb);
}
function stepMode(d) {
  const ms = modes(); if (ms.length < 2) return;
  ST.mode = ms[(ms.indexOf(ST.mode) + d + ms.length) % ms.length]; ST.page = 0; update();
}

/* ---------- actions ---------- */
async function act(a) {
  if (a === '__more') { ST.page++; update(); return; }
  if (ACT_RING.includes(a)) { nat.wheelHide(); nat.fileAction({ action: a, path: ST.path }); return; }
  try { await ST.ready; } catch { return; }
  if (isTool(a)) { nat.openEditor({ path: ST.path, tool: a }); return; }   // tools live in their own, resizable window
  await convert(a);
}

let busy = Promise.resolve();
async function convert(fmt) {
  const heavy = !['audio', 'video', 'folder'].includes(ST.kind);
  const id = await nat.jobStart({ title: `${ST.name}${ST.ext ? '.' + ST.ext : ''} → ${label(fmt)}`, name: ST.name });
  const run = (async () => {
    JP.id = id;
    try {
      nat.wheelHide();
      const files = await produce(fmt);
      const out = await saveFiles(files);
      Snd.play('ok'); nat.jobDone({ id, out });
    } catch (e) {
      Snd.play('err'); nat.jobError({ id, msg: e.message });
    } finally { if (JP.id === id) JP.id = 0; }
  })();
  if (heavy) busy = run;   // image/document conversions share this window's state; audio/video/folders run in the main process
  await run;
}

/* ---------- events ---------- */
$('#mprev').onclick = () => stepMode(-1);
$('#mnext').onclick = () => stepMode(1);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') nat.wheelHide();
  else if (e.key === 'ArrowRight') { Snd.play('click'); stepMode(1); }
  else if (e.key === 'ArrowLeft') { Snd.play('click'); stepMode(-1); }
});
let wheelLock = 0;
document.addEventListener('wheel', e => { if (Date.now() - wheelLock < 250) return; wheelLock = Date.now(); Snd.play('click'); stepMode(e.deltaY > 0 ? 1 : -1); }, { passive: true });

nat.onWheelOpen(async ({ path, isDir }) => {
  await busy;                       // a conversion is still using the stage: wait for it before switching files
  $('#toast').hidden = true;
  resetStage(path, isDir);
  ST.mode = modes()[0]; Snd.play('open'); update();
  const needsLoad = ST.kind === 'image' || ST.kind === 'pdf';
  ST.ready = needsLoad ? loadFromDisk(path) : Promise.resolve();
  ST.ready.then(() => {
    if (ST.img && ST.path === path) {
      const k = Math.max(1, Math.round(130 / Math.max(ST.img.width, ST.img.height) * 100));
      ST.thumb = scaled(ST.img, Math.min(100, k)).toDataURL('image/jpeg', .72); $('#wheel')._thumb(ST.thumb);
    }
  }).catch(() => { });
  ST.ready.catch(e => toast(e.message, true));
});
document.addEventListener('lang', update);
cfgInit().then(update);

/* tell the main process the wheel is still in use (it closes itself when idle) */
let pingAt = 0;
document.addEventListener('mousemove', () => { const now = Date.now(); if (now - pingAt > 600) { pingAt = now; nat.wheelPing(); } });
