'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { build, atempo } = require('../../src/main/studio-graph');

const clip = (o = {}) => ({ in: 0, out: 4, speed: 1, vol: 1, hasAudio: true, ...o });
const base = { w: 1280, h: 720, fps: 30, fit: 'contain', texts: [], music: null };

test('atempo chains stay inside ffmpeg’s 0.5–2 range per filter', () => {
  assert.equal(atempo(1.5), 'atempo=1.5');
  assert.equal(atempo(4), 'atempo=2,atempo=2');
  assert.equal(atempo(0.25), 'atempo=0.5,atempo=0.5');
  assert.equal(atempo(0.5), 'atempo=0.5');
});

test('total length is the sum of trimmed, speed-adjusted clips', () => {
  const g = build({ ...base, clips: [clip({ in: 1, out: 5 }), clip({ out: 6, speed: 2 }), clip({ out: 2, speed: 0.5 })] });
  assert.equal(g.total, 4 + 3 + 4);
  assert.match(g.script, /concat=n=3:v=1:a=1\[vc\]\[ac\]/);
  assert.match(g.script, /\[1:v\]setpts=\(PTS-STARTPTS\)\/2/);
});

test('clips without sound (or muted) get silence so the concat keeps audio in sync', () => {
  const g = build({ ...base, clips: [clip({ hasAudio: false }), clip({ vol: 0 })] });
  assert.equal((g.script.match(/anullsrc/g) || []).length, 2);
  assert.doesNotMatch(g.script, /\[0:a\]/);
});

test('fit: bars pad, fill crops', () => {
  assert.match(build({ ...base, clips: [clip()] }).script, /pad=1280:720/);
  const c = build({ ...base, fit: 'cover', clips: [clip()] }).script;
  assert.match(c, /increase,crop=1280:720/); assert.doesNotMatch(c, /pad=/);
});

test('titles are overlaid in order after the clips; music follows them', () => {
  const g = build({ ...base, clips: [clip(), clip()], texts: [{ start: 1, end: 2.5 }, { start: 3, end: 4 }], music: { vol: 0.5 } }).script;
  assert.match(g, /\[vc\]\[2:v\]overlay=0:0:enable='between\(t,1,2.5\)'[^[]*\[vo0\]/);
  assert.match(g, /\[vo0\]\[3:v\]overlay[^[]*\[vout\]/);
  assert.match(g, /\[4:a\]aresample=48000[^[]*volume=0.5[^[]*afade=t=out:st=6:d=2\[mu\]/);
  assert.match(g, /amix=inputs=2:duration=first:dropout_transition=0:normalize=0\[aout\]/);
});

test('without titles or music the graph still ends in [vout] and [aout]', () => {
  const g = build({ ...base, clips: [clip()] }).script;
  assert.match(g, /\[vc\]null\[vout\]/); assert.match(g, /\[ac\]anull\[aout\]/);
});

test('the graph contains only numbers and fixed words, never user text', () => {
  const g = build({ ...base, clips: [clip({ in: 0.1234567, out: 3.7654321, speed: 1.5, vol: 1.25 })], texts: [{ start: 0.25, end: 1 }] }).script;
  assert.doesNotMatch(g, /NaN|undefined|Infinity/);
  assert.match(g, /volume=1.25/);
});
