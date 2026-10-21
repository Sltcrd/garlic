'use strict';
/**
 * Update check. Garlic's only network request: it asks GitHub's public API for the latest release of this
 * repository (no token, no user data) and, when it is newer than the running version, tells the app window so
 * it can show an indicator with the release notes. Nothing is downloaded or installed automatically; the
 * button opens the release page in the browser. Turn it off in System → Check for updates (setting `updates`).
 */
const REPO = 'Sltcrd/garlic';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const PAGE_PREFIX = `https://github.com/${REPO}/`;
const EVERY_MS = 6 * 60 * 60 * 1000;

/** "v1.2.3" / "1.2.3-beta" → [1, 2, 3] or null */
function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || '').trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}
/** true when `latest` is a higher version than `current` */
function isNewer(latest, current) {
  const a = parseVersion(latest), b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
/** Keeps only what the UI needs from a GitHub release JSON; the page URL must belong to this repository. */
function parseRelease(j) {
  if (!j || typeof j !== 'object' || j.draft || j.prerelease || !parseVersion(j.tag_name)) return null;
  const url = typeof j.html_url === 'string' && j.html_url.startsWith(PAGE_PREFIX) ? j.html_url : `${PAGE_PREFIX}releases/latest`;
  return { version: String(j.tag_name).replace(/^v/, ''), notes: String(j.body || '').split('<!-- end-notes -->')[0].trim().slice(0, 6000), url, published: String(j.published_at || '').slice(0, 10) };
}

let state = { available: false, checking: false, checkedAt: 0, error: false };
let timer = null, onState = () => {}, notifyOnce = () => {}, lastNotified = '';

const get = () => state;
function set(patch) { state = { ...state, ...patch }; onState(state); }

async function check() {
  const { app, net } = require('electron');
  if (state.checking) return state;
  set({ checking: true });
  try {
    const res = await net.fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Garlic/' + app.getVersion() }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rel = parseRelease(await res.json());
    if (rel && isNewer(rel.version, app.getVersion())) {
      set({ available: true, error: false, checking: false, checkedAt: Date.now(), ...rel });
      if (lastNotified !== rel.version) { lastNotified = rel.version; notifyOnce(rel); }
    } else set({ available: false, error: false, checking: false, checkedAt: Date.now(), version: rel ? rel.version : undefined });
  } catch {
    set({ error: true, checking: false, checkedAt: Date.now() });
  }
  return state;
}

/** Starts (or stops) the periodic check according to the setting. */
function sync(enabled) {
  clearInterval(timer); timer = null;
  if (!enabled) { set({ available: false, checking: false, error: false }); return; }
  if (process.env.GARLIC_TEST === '1') return;   // automated tests never touch the network
  setTimeout(() => { if (timer) check(); }, 8000).unref();
  timer = setInterval(check, EVERY_MS); timer.unref();
}

function init({ onChange, notify }) { onState = onChange; notifyOnce = notify; }

/** The page the "Download" button opens; always taken from the checked release, never from a renderer. */
function pageUrl() { return state.available && state.url && state.url.startsWith(PAGE_PREFIX) ? state.url : null; }

module.exports = { parseVersion, isNewer, parseRelease, get, check, sync, init, pageUrl, _test: { set: p => set(p) } };
