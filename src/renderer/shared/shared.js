/* Shared by every window: settings, theme variables, language and UI sounds. */
const nat = window.native || {};
const t = (key, params) => I18N.t(key, params);

/** Defaults come from the main process (src/main/config.js); this copy is only a fallback. */
let DEF = {
  bg: '#2a1a1f', op: 55, ac: '#b8607a', sg: '#f6f0e8', rd: 24, sound: true, vol: 60, hoverSound: true, jobCard: true, autostart: false, hook: true, lang: 'auto',
  theme: 'dark', glass: 50, blur: 26, sat: 160, material: 'acrylic', blobs: true, density: 'comfortable', scale: 100, combo: { shift: false, ctrl: false, alt: true, meta: false, button: 1 }
};
let CFG = { ...DEF };

const PLATFORM = /Mac/i.test(navigator.userAgent) ? 'darwin' : /Windows/i.test(navigator.userAgent) ? 'win32' : 'linux';
document.documentElement.dataset.platform = PLATFORM;

const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
const luma = hex => { const [r, g, b] = rgbOf(hex).split(',').map(Number); return 0.299 * r + 0.587 * g + 0.114 * b; };

function applyCss() {
  const root = document.documentElement, s = root.style;
  s.setProperty('--bgc', `rgba(${rgbOf(CFG.bg)},${CFG.op / 100})`);
  s.setProperty('--bgc2', `rgba(${rgbOf(CFG.bg)},${Math.min(1, CFG.op / 100 + .25)})`);
  s.setProperty('--bgc3', `rgba(${rgbOf(CFG.bg)},.97)`);
  s.setProperty('--acc', CFG.ac);
  s.setProperty('--hot', `color-mix(in srgb,${CFG.ac} 88%,#ff2a00)`);
  s.setProperty('--atx', luma(CFG.ac) > 165 ? '#2a1a1f' : '#ffffff');
  s.setProperty('--seg', `rgba(${rgbOf(CFG.sg)},.13)`);
  s.setProperty('--segh', `rgba(${rgbOf(CFG.sg)},.3)`);
  s.setProperty('--wsg', CFG.sg);
  s.setProperty('--wtx', luma(CFG.sg) > 150 ? '#2f2024' : '#ffffff');
  s.setProperty('--rad', CFG.rd + 'px');
  s.setProperty('--blur', CFG.blur + 'px'); s.setProperty('--sat', CFG.sat + '%'); s.setProperty('--glass', CFG.glass / 100);
  const theme = CFG.theme === 'auto' ? (matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark') : CFG.theme;
  root.dataset.theme = theme; root.dataset.density = CFG.density; root.dataset.blobs = CFG.blobs ? 'on' : 'off'; root.dataset.material = CFG.material;
  if (document.body && document.body.classList.contains('app')) s.zoom = CFG.scale / 100;
}
function applyLang() {
  const lang = I18N.resolve(CFG.lang, navigator.language);
  I18N.setLang(lang); document.documentElement.lang = lang;
  if (window.I18nDom) I18nDom.apply();
}
async function cfgInit() {
  if (nat.cfgDefaults) DEF = await nat.cfgDefaults();
  if (nat.cfgGet) CFG = { ...DEF, ...await nat.cfgGet() };
  applyCss(); applyLang();
  if (nat.onCfg) nat.onCfg(c => { const langChanged = c.lang !== CFG.lang; CFG = { ...CFG, ...c }; applyCss(); if (langChanged) applyLang(); document.dispatchEvent(new Event('cfg')); if (langChanged) document.dispatchEvent(new Event('lang')); });
}
function cfgSet(patch) {
  const langChanged = 'lang' in patch && patch.lang !== CFG.lang;
  CFG = { ...CFG, ...patch }; applyCss();
  if (langChanged) { applyLang(); document.dispatchEvent(new Event('lang')); }
  if (nat.cfgSet) nat.cfgSet(patch);
}

/* ---- UI sounds, synthesised (no audio files) ---- */
const Snd = {
  ctx: null,
  play(kind) {
    if (!CFG.sound || (kind === 'hover' && !CFG.hoverSound)) return;
    try {
      const c = this.ctx || (this.ctx = new AudioContext()), v = CFG.vol / 100, now = c.currentTime;
      const tone = (f, t0, dur, type = 'sine', g = .3) => {
        const o = c.createOscillator(), a = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, now + t0);
        a.gain.setValueAtTime(0, now + t0); a.gain.linearRampToValueAtTime(g * v, now + t0 + .004); a.gain.exponentialRampToValueAtTime(.0001, now + t0 + dur);
        o.connect(a).connect(c.destination); o.start(now + t0); o.stop(now + t0 + dur + .02);
      };
      if (kind === 'hover') tone(2100, 0, .028, 'sine', .07);
      else if (kind === 'click') { tone(1500, 0, .035, 'square', .09); tone(820, 0, .05, 'sine', .22); }
      else if (kind === 'open') { tone(520, 0, .08, 'sine', .2); tone(780, .05, .1, 'sine', .18); }
      else if (kind === 'ok') { tone(660, 0, .12, 'sine', .25); tone(990, .09, .18, 'sine', .25); }
      else if (kind === 'err') { tone(220, 0, .18, 'sawtooth', .16); tone(180, .1, .2, 'sawtooth', .16); }
    } catch { /* audio is optional */ }
  }
};
document.addEventListener('pointerdown', e => {
  if (e.target.closest('button,[data-act],input[type=range],input[type=color],input[type=checkbox],label.switch,.sw i,#drop')) Snd.play('click');
}, true);

/** "Alt + left click" style labels for the shortcut. macOS calls Alt "Option" and Win "Cmd". */
function comboKeys(c) {
  const mac = PLATFORM === 'darwin', linux = PLATFORM === 'linux';
  const btn = { 1: t('clic izquierdo'), 2: t('clic derecho'), 3: t('clic central') }[c.button];
  return [c.ctrl && 'Ctrl', c.shift && 'Shift', c.alt && (mac ? 'Option' : 'Alt'), c.meta && (mac ? 'Cmd' : linux ? 'Super' : 'Win'), btn].filter(Boolean);
}
