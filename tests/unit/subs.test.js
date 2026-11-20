'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Subs = require('../../src/renderer/shared/subs');

const SRT = '﻿1\r\n00:00:01,000 --> 00:00:03,500\r\nHola\r\nmundo\r\n\r\n2\r\n00:01:02,5 --> 01:00:00,042\r\nSegunda\r\n';
const VTT = 'WEBVTT\n\nNOTE nada\n\nintro\n00:01.000 --> 00:02.250 align:start\nUno\n\n00:00:03.000 --> 00:00:04.000\nDos\n';

test('parses SRT (BOM, CRLF, short fractions) and VTT (header, notes, ids, short times, settings)', () => {
  const a = Subs.parse(SRT);
  assert.deepEqual(a.map(c => [c.start, c.end, c.text]), [[1000, 3500, 'Hola\nmundo'], [62500, 3600042, 'Segunda']]);
  const b = Subs.parse(VTT);
  assert.deepEqual(b.map(c => [c.start, c.end, c.text, c.settings]), [[1000, 2250, 'Uno', 'align:start'], [3000, 4000, 'Dos', '']]);
});

test('formats both kinds and round-trips', () => {
  const cues = Subs.parse(SRT);
  const srt = Subs.format(cues, 'srt');
  assert.match(srt, /^1\n00:00:01,000 --> 00:00:03,500\nHola\nmundo\n\n2\n00:01:02,500 --> 01:00:00,042\nSegunda\n$/);
  assert.deepEqual(Subs.parse(srt), cues);
  const vtt = Subs.format(Subs.parse(VTT), 'vtt');
  assert.ok(vtt.startsWith('WEBVTT\n\n00:00:01.000 --> 00:00:02.250 align:start\nUno'));
  assert.deepEqual(Subs.parse(vtt), Subs.parse(VTT));
});

test('retime shifts, stretches, clamps and drops cues that end before zero', () => {
  const cues = [{ start: 1000, end: 2000, settings: '', text: 'a' }, { start: 10000, end: 12000, settings: '', text: 'b' }];
  assert.deepEqual(Subs.retime(cues, 500).map(c => [c.start, c.end]), [[1500, 2500], [10500, 12500]]);
  assert.deepEqual(Subs.retime(cues, -1500).map(c => [c.start, c.end, c.text]), [[0, 500, 'a'], [8500, 10500, 'b']]);
  assert.deepEqual(Subs.retime(cues, -2500).map(c => c.text), ['b']);
  assert.deepEqual(Subs.retime(cues, 0, 23.976 / 25).map(c => c.start), [959, 9590]);
});

test('garbage and empty input give no cues', () => {
  assert.deepEqual(Subs.parse(''), []);
  assert.deepEqual(Subs.parse('esto no es un subtítulo\n\n--> nada'), []);
});
