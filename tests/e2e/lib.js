'use strict';
/**
 * Minimal end-to-end test harness: starts Garlic with an isolated user-data folder and drives its
 * windows through the Chrome DevTools Protocol (no extra dependencies, Node >= 20).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, { timeout = 20000, step = 150, what = 'condition' } = {}) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await sleep(step); }
  throw new Error(`Timed out waiting for ${what}${last ? ': ' + last.message : ''}`);
}

class Page {
  constructor(target) { this.target = target; this.id = 0; this.pending = new Map(); this.fail = new Map(); this.events = []; }
  async connect() {
    if (typeof WebSocket === 'undefined') throw new Error('The e2e tests need Node.js 22+ (global WebSocket).');
    this.ws = new WebSocket(this.target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); this.fail.delete(d.id); } else this.events.push(d);
    };
    this.ws.onclose = () => { for (const f of this.fail.values()) f('The page closed or crashed'); this.pending.clear(); this.fail.clear(); };
    return this;
  }
  /** Sends a DevTools command. It fails (instead of waiting forever) when the page crashes, closes or stops answering. */
  cmd(method, params = {}, timeout = 90000) {
    return new Promise((res, rej) => {
      const id = ++this.id, label = method + (params.expression ? ': ' + String(params.expression).slice(0, 120) : '');
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error('No answer from the page to ' + label)); }, timeout);
      this.pending.set(id, d => { clearTimeout(timer); res(d); });
      this.fail.set(id, e => { clearTimeout(timer); rej(new Error(e + ' (' + label + ')')); });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  /** Evaluates an expression (awaiting promises) and returns its value; throws on exceptions. */
  async eval(expression) {
    const r = await this.cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text);
    return r.result.result.value;
  }
  async screenshot(file) { const r = await this.cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); return file; }
  close() { try { this.ws.close(); } catch { /* closed */ } }
}

async function launch({ port = 9330 + Math.floor(Math.random() * 400), env = {}, args = [] } = {}) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'garlic-test-'));
  // GARLIC_BIN lets the same tests run against a packaged build (npm run package) instead of the source tree
  const bin = process.env.GARLIC_BIN, electron = bin || require(path.join(ROOT, 'node_modules', 'electron'));
  const proc = spawn(electron, [...(bin ? [] : [ROOT]), `--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, '--hidden', ...args], {
    env: { ...process.env, GARLIC_TEST: '1', ...env }, stdio: 'ignore', windowsHide: true
  });
  const pages = new Map();
  const targets = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter(t => t.type === 'page');
  await waitFor(async () => (await targets()).some(t => t.url.includes('/renderer/app/')) , { what: 'main window' });
  const app = {
    proc, port, userData,
    /** Returns a connected Page for the window whose URL contains `name` (app | wheel | editor | jobs). */
    async page(name, opts = {}) {
      const t = await waitFor(async () => (await targets()).find(x => x.url.includes(`/renderer/${name}/`)), { what: name + ' window', timeout: opts.timeout || 20000 });
      if (!pages.has(t.id)) {
        const page = await new Page(t).connect();
        await waitFor(() => page.eval(`document.readyState === 'complete' && typeof nat !== 'undefined' && typeof CFG !== 'undefined'`), { what: name + ' scripts' });
        pages.set(t.id, page);
      }
      return pages.get(t.id);
    },
    async close() {
      for (const p of pages.values()) p.close();
      proc.kill();
      await sleep(400);
      // a stuck Electron would keep the test process (and the CI job) alive for ever: end the whole process tree
      if (proc.exitCode === null && proc.signalCode === null) {
        try { if (process.platform === 'win32') require('child_process').spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill('SIGKILL'); } catch { /* already gone */ }
        await sleep(300);
      }
      proc.unref();
      try { fs.rmSync(userData, { recursive: true, force: true }); } catch { /* still locked: temp folder, harmless */ }
    }
  };
  return app;
}

/* ---- fixtures (generated, never committed) ---- */
function crc32(buf) { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
/** Solid-colour RGB PNG with an optional filled circle of another colour. */
function makePng(w, h, bg = [58, 134, 255], fg = null) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const inside = fg && Math.hypot(x - w / 2, y - h / 2) < Math.min(w, h) / 3, c = inside ? fg : bg, o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function tempDir(prefix = 'garlic-fx-') { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

module.exports = { ROOT, sleep, waitFor, launch, makePng, tempDir };
