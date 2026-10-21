/* Main window: navigation, settings bound to the config, shortcut editor and live previews. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const APPEARANCE = ['bg', 'op', 'ac', 'sg', 'rd', 'theme', 'glass', 'blur', 'sat', 'material', 'blobs', 'density', 'scale'];
const ACCENTS = ['#b8607a', '#c38aa1', '#8e4a6b', '#8a9a86', '#6f8f6a', '#a88f79', '#c9b79c', '#7c8fa6'];
const TITLES = () => ({ home: t('Inicio'), trigger: t('Atajo'), formats: t('Formatos'), look: t('Apariencia'), sound: t('Sonido'), system: t('Sistema') });
let page = 'home';

/* ---------- sidebar navigation ---------- */
function go(p) {
  page = p;
  $$('.pg').forEach(s => { s.hidden = s.dataset.p !== p; });
  $$('nav a').forEach(a => a.classList.toggle('on', a.dataset.page === p));
  $('#ptitle').textContent = TITLES()[p]; $('.content').scrollTop = 0;
}
$$('nav a').forEach(a => a.addEventListener('click', () => go(a.dataset.page)));

/* ---------- controls bound to the configuration (data-cfg / data-seg) ---------- */
function sync() {
  $$('[data-cfg]').forEach(el => {
    const k = el.dataset.cfg;
    if (el.type === 'checkbox') el.checked = !!CFG[k]; else if (el !== document.activeElement) el.value = CFG[k];
  });
  $$('[data-val]').forEach(v => { v.textContent = CFG[v.dataset.val] + (v.dataset.unit || ''); });
  $$('[data-seg]').forEach(g => g.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(CFG[g.dataset.seg]) === b.dataset.v)));
  $$('#swatches i').forEach(s => s.classList.toggle('on', s.dataset.c.toLowerCase() === CFG.ac.toLowerCase()));
  syncCombo();
}
$$('[data-cfg]').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
  const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
  cfgSet({ [el.dataset.cfg]: v }); sync(); if (el.dataset.cfg === 'hook') setTimeout(refreshStatus, 300);
}));
$$('[data-seg]').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { cfgSet({ [g.dataset.seg]: b.dataset.v }); sync(); } }));
$('#swatches').innerHTML = ACCENTS.map(c => `<i data-c="${c}" style="background:${c}"></i>`).join('');
$('#swatches').addEventListener('click', e => { const i = e.target.closest('i'); if (i) { cfgSet({ ac: i.dataset.c }); sync(); } });
$('#rap').onclick = () => { const patch = {}; APPEARANCE.forEach(k => { patch[k] = DEF[k]; }); cfgSet(patch); sync(); };
matchMedia('(prefers-color-scheme:light)').addEventListener('change', () => { if (CFG.theme === 'auto') applyCss(); });

/* ---------- window chrome and actions ---------- */
$('#bclose').onclick = () => nat.winCtl('close'); $('#bmin').onclick = () => nat.winCtl('min'); $('#bmax').onclick = () => nat.winCtl('max');
nat.onWinState(max => { $('#icMax').hidden = max; $('#icRes').hidden = !max; $('#bmax').title = max ? t('Restaurar') : t('Maximizar'); });
$('#stest').onclick = () => Snd.play('ok');
$('#squit').onclick = () => nat.quit();
if (PLATFORM === 'win32') {
  $('#shortcuts').hidden = false;
  for (const [id, where] of [['#scstart', 'start'], ['#scdesk', 'desktop']]) {
    const b = $(id), label = b.textContent;
    b.onclick = async () => { const r = await nat.createShortcut(where); b.textContent = t(r.ok ? 'Acceso directo creado' : 'No se pudo crear el acceso directo'); setTimeout(() => { b.textContent = t(label); }, 2500); };
  }
}
$('#pickTop').onclick = () => nat.pick();

const drop = $('#drop');
['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || !e.relatedTarget) drop.classList.remove('over'); }));
document.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) { const p = nat.pathOf(f); if (p) nat.openWheel(p); } });

/* ---------- shortcut status ---------- */
async function refreshStatus() {
  const s = await nat.hookStatus(), el = $('#status');
  el.textContent = s.on ? t('● Atajo activo') : !s.supported ? t('Atajo no disponible') : s.err ? t('Error del atajo') : t('Atajo desactivado');
  el.className = 'pill' + (s.on ? ' on' : ''); el.title = s.err || '';
  const note = $('#platnote');
  if (!s.supported) { note.textContent = t('En este sistema el atajo con clic no está disponible. Usa «Elegir archivo…», arrastra un archivo aquí o ejecuta «garlic <archivo>».'); note.hidden = false; }
  else if (s.platform === 'darwin') { note.textContent = t('macOS: concede los permisos de Accesibilidad y Automatización (Finder) a Garlic para que el atajo funcione. Compatibilidad experimental.'); note.hidden = false; }
  else note.hidden = true;
}

/* ---------- shortcut editor ---------- */
const MOD_LABEL = { ctrl: 'Ctrl', shift: 'Shift', alt: PLATFORM === 'darwin' ? 'Option' : 'Alt', meta: PLATFORM === 'darwin' ? 'Cmd' : PLATFORM === 'linux' ? 'Super' : 'Win' };
$$('[data-mod]').forEach(i => { i.nextElementSibling.textContent = MOD_LABEL[i.dataset.mod]; });

function syncCombo() {
  const c = CFG.combo, mods = c.ctrl || c.shift || c.alt || c.meta;
  $$('[data-mod]').forEach(i => { i.checked = !!c[i.dataset.mod]; }); $('#cbtn').value = c.button;
  $$('.combo-keys').forEach(el => { el.innerHTML = comboKeys(c).map(k => `<kbd>${k}</kbd>`).join('<i>+</i>'); });
  let msg = t('Sin conflictos conocidos con el gestor de archivos.'), cls = '';
  if (c.button === 2) { msg = t('El clic derecho abre el menú contextual del gestor de archivos: se abrirá a la vez.'); cls = 'warn'; }
  else if (!mods && c.button !== 3) { msg = t('Elige al menos una tecla (o usa el clic central): un clic izquierdo solo no se puede usar.'); cls = 'bad'; }
  else if (c.button === 1 && c.shift && !c.ctrl && !c.alt) { msg = t('Shift + clic también extiende la selección de archivos.'); cls = 'warn'; }
  else if (c.button === 1 && c.ctrl && !c.shift && !c.alt) { msg = t('Ctrl + clic también alterna la selección.'); cls = 'warn'; }
  const w = $('#cwarn'); w.textContent = msg; w.className = 'hint ' + cls;
}
function saveCombo() {
  const c = { button: +$('#cbtn').value };
  $$('[data-mod]').forEach(i => { c[i.dataset.mod] = i.checked; });
  if (!(c.ctrl || c.shift || c.alt || c.meta) && c.button !== 3) { CFG.combo = c; syncCombo(); return; }
  cfgSet({ combo: c }); syncCombo();
}
$$('[data-mod]').forEach(i => i.addEventListener('change', saveCombo));
$('#cbtn').addEventListener('change', saveCombo);
$('#rcombo').onclick = () => { cfgSet({ combo: DEF.combo }); syncCombo(); };

/* ---------- live previews of the wheel ---------- */
let pvLast = null;
function renderPreviews() {
  const opts = {
    main: 'JPG', sub: t('vista previa'), hoverSub: () => t('convertir a'),
    onHover: a => { if (a !== pvLast) { pvLast = a; Snd.play('hover'); } }, onLeave: () => { pvLast = null; }, onPick: () => { }
  };
  ['#pv1', '#pv2'].forEach(s => Orbit.render($(s), ['png', 'jpg', 'webp', 'pdf', 'docx', 'tiff', 'ico', 'svg'], opts));
}

/* ---------- start-up ---------- */
async function about() {
  const i = await nat.appInfo();
  $('#about').textContent = t('Garlic {v} · Electron {e} · Licencia MIT · Sin telemetría: tus archivos nunca salen de tu equipo.', { v: i.version, e: i.electron });
}
cfgInit().then(() => { sync(); refreshStatus(); renderPreviews(); about(); go(page); });
document.addEventListener('cfg', sync);
document.addEventListener('lang', () => { go(page); refreshStatus(); renderPreviews(); about(); syncCombo(); });
