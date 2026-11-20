'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { launch, tempDir, waitFor } = require('./lib');

let app, dir, A, B, M;
const ff = (name, args) => { const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', ...args, path.join(dir, name)]); assert.equal(r.status, 0, String(r.stderr)); return path.join(dir, name); };
const info = file => {
  const text = String(spawnSync(ffmpeg, ['-hide_banner', '-i', file]).stderr), d = text.match(/Duration:\s*(\d+):(\d+):([\d.]+)/), v = text.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  return { dur: (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]), w: +v[1], h: +v[2], audio: /Audio:/.test(text) };
};

test.before(async () => {
  dir = tempDir('garlic-studio-');
  A = ff('uno.mp4', ['-f', 'lavfi', '-i', 'testsrc=duration=4:size=320x180:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
  B = ff('dos.mp4', ['-f', 'lavfi', '-i', 'testsrc2=duration=2:size=160x120:rate=15', '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);     // no audio, another size
  M = ff('musica.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=220:duration=1', '-c:a', 'libmp3lame']);
  app = await launch({ env: { GARLIC_TEST_PICK: B } });
  const wheel = await app.page('wheel');
  for (const f of [A, B, M]) await wheel.eval(`nat.openWheel(${JSON.stringify(f)})`);
});
test.after(async () => { if (app) await app.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

test('the wheel offers the studio first for video files', async () => {
  const wheel = await app.page('wheel');
  await wheel.eval(`nat.openWheel(${JSON.stringify(A)})`);
  await waitFor(() => wheel.eval(`ST.kind === 'video' && ST.path.endsWith('uno.mp4')`), { what: 'wheel for video' });
  assert.equal(await wheel.eval(`editRing()[0]`), 'v_studio');
});

test('studio: split, add a clip, speed, title, music, export → one new MP4 with the right length and size', async () => {
  const wheel = await app.page('wheel');
  await wheel.eval(`nat.openEditor({ path: ${JSON.stringify(A)}, tool: 'v_studio' })`);
  const ed = await app.page('editor');
  await waitFor(() => ed.eval(`!!P && P === MODES.v_studio && SD.clips.length === 1 && !!document.querySelector('#sdtl .sdc')`), { what: 'studio ready' });
  assert.equal(await ed.eval(`SD.fmt`), '16:9');

  // cut the 4 s clip in two at 1.5 s
  await ed.eval(`sdLoadClip(0, 1.5); sdSplit()`);
  await waitFor(() => ed.eval(`SD.clips.length === 2`), { what: 'split' });
  assert.deepEqual(await ed.eval(`SD.clips.map(c => [c.in, c.out])`), [[0, 1.5], [1.5, 4]]);

  // add dos.mp4 (2 s, no audio) through the "add clip" dialog, twice as fast → 1 s, and move it to the front
  await ed.eval(`sdAddClips()`);
  await waitFor(() => ed.eval(`SD.clips.length === 3`), { what: 'clip added' });
  await ed.eval(`SD.clips[2].speed = 2; sdMoveClip(2, 0)`);
  assert.equal(await ed.eval(`SD.clips[0].name`), 'dos.mp4');
  assert.equal(await ed.eval(`Math.round(sdTotal() * 10) / 10`), 5);

  // a title and background music
  await ed.eval(`sdAddText(); SD.texts[0].text = 'Hola'; SD.texts[0].start = 0.5; SD.texts[0].end = 2; SD.music = { src: ${JSON.stringify(M)}, name: 'musica.mp3', vol: 0.5 }; sdRefresh()`);
  assert.equal(await ed.eval(`document.querySelectorAll('#sdtl .sdc').length`), 3);
  assert.equal(await ed.eval(`document.querySelectorAll('#sdtl .sdp').length`), 2, 'title + music pills');

  await ed.eval(`P.save()`);
  const made = () => fs.readdirSync(dir).filter(n => /^uno_(studio|estudio)/.test(n));      // the suffix follows the UI language
  await waitFor(() => made().length === 1 && fs.statSync(path.join(dir, made()[0])).size > 2000, { what: 'exported video', timeout: 60000 });
  const out = path.join(dir, made()[0]);
  await waitFor(async () => { const j = JSON.parse(await (await app.page('app')).eval('nat.testJobs().then(JSON.stringify)').catch(() => '[]')); return !j.some(x => x.state === 'running'); }, { what: 'job finished', timeout: 60000 }).catch(() => {});
  const i = info(out);
  assert.ok(Math.abs(i.dur - 5) < 0.4, 'duration ' + i.dur);
  assert.deepEqual([i.w, i.h], [1280, 720]);
  assert.ok(i.audio, 'has audio (silence for the clip without sound, plus the music)');
  assert.equal(fs.statSync(A).size > 0 && fs.existsSync(path.join(dir, 'uno.mp4')), true, 'the originals stay');
});

test('the export refuses anything that is not a clean project', async () => {
  const ed = await app.page('editor');
  const bad = async patch => JSON.parse(await ed.eval(`(async () => {
    const p = { anchor: ${JSON.stringify(A)}, outName: 'x', w: 1280, h: 720, fit: 'contain', quality: 'Media', jobId: 0, texts: [], music: null, clips: [{ src: ${JSON.stringify(A)}, in: 0, out: 1, speed: 1, vol: 1 }] };
    return JSON.stringify(await nat.studioExport(Object.assign(p, JSON.parse(${JSON.stringify(JSON.stringify(patch))}))));
  })()`));
  for (const patch of [
    { clips: [{ src: ['C:', 'Windows', 'System32', 'drivers', 'etc', 'hosts'].join(String.fromCharCode(92)), in: 0, out: 1, speed: 1, vol: 1 }] },    // a file the user never picked
    { clips: [{ src: A, in: 0, out: 1, speed: 99, vol: 1 }] },
    { clips: [{ src: A, in: 2, out: 1, speed: 1, vol: 1 }] },
    { clips: [] },
    { w: 1281 },
    { outName: '..' + String.fromCharCode(92) + 'evil' },
    { outName: 'a/b' },
    { music: { src: 'http://example.com/x.mp3', vol: 1 } },
    { anchor: ['C:', 'Windows', 'notepad.exe'].join(String.fromCharCode(92)) }
  ]) { const r = await bad(patch); assert.equal(r.ok, false, JSON.stringify(patch)); }
  assert.equal((await bad({ texts: [{ start: 0, end: 1, png: { 0: 1, length: 9 } }] })).ok, false, 'a title that is not a PNG');
  assert.equal(fs.existsSync(path.join(dir, 'x.mp4')), false);
});
