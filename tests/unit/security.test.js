'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const security = require('../../src/main/security');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'garlic-sec-'));
const file = path.join(tmp, 'a.txt'); fs.writeFileSync(file, 'x');
const other = fs.mkdtempSync(path.join(os.tmpdir(), 'garlic-sec2-')); const secret = path.join(other, 'secret.txt'); fs.writeFileSync(secret, 's');
test.after(() => { fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(other, { recursive: true, force: true }); });

test('only files the user chose can be read; the rest is denied', () => {
  assert.equal(security.canReadFile(file), false);
  assert.equal(security.grant(file), true);
  assert.equal(security.canReadFile(file), true);
  assert.equal(security.canReadFile(secret), false);
  assert.equal(security.canReadFile(path.join(tmp, '..', path.basename(other), 'secret.txt')), false, 'no path tricks');
});

test('writing is limited to the folder of a granted file', () => {
  assert.equal(security.canWriteIn(tmp), true);
  assert.equal(security.canWriteIn(path.join(tmp, 'sub')), true);
  assert.equal(security.canWriteIn(other), false);
  assert.equal(security.canWriteIn(path.join(tmp, '..')), false);
});

test('grant() refuses things that do not exist', () => {
  assert.equal(security.grant(path.join(tmp, 'nope.txt')), false);
  assert.equal(security.grant(''), false);
  assert.equal(security.grant(null), false);
});

test('safeRel rejects absolute paths and traversal', () => {
  for (const bad of ['/etc/passwd', '\\windows\\x', 'C:\\x', '../x', 'a/../../x', 'a\\..\\x', '', 'a:b', 'x\0y', 'a|b']) assert.equal(security.safeRel(bad), false, bad);
  for (const good of ['file.pdf', 'folder/file.txt', 'my file (1).png', 'carpeta_extraida/a/b.txt']) assert.equal(security.safeRel(good), true, good);
});

test('executables and scripts are never opened', () => {
  for (const n of ['a.exe', 'a.BAT', 'a.cmd', 'a.ps1', 'a.vbs', 'a.js', 'a.lnk', 'a.sh', 'a.app', 'a.msi']) assert.equal(security.isExecutableName(n), true, n);
  for (const n of ['a.pdf', 'a.png', 'a.docx', 'a.mp4', 'a.txt']) assert.equal(security.isExecutableName(n), false, n);
});

test('ffmpeg arguments: Garlic\'s own options pass, everything dangerous is rejected', () => {
  const ok = [
    ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'], ['-ss', '1.5', '-to', '3', '-c', 'copy'], ['-vf', 'scale=-2:720', '-c:v', 'libx264', '-crf', '26'],
    ['-filter_complex', '[0:v]fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0'],
    ['-filter_complex', '[0:v]setpts=PTS/2[v];[0:a]atempo=2,atempo=2[a]', '-map', '[v]', '-map', '[a]'], ['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11'],
    ['-filter_complex', 'showwavespic=s=1600x400:colors=0xb8607a', '-frames:v', '1'], ['-f', 'segment', '-segment_time', '60', '-reset_timestamps', '1'], ['-vf', 'crop=1080:1080']
  ];
  for (const a of ok) assert.equal(security.validFfArgs(a), true, JSON.stringify(a));
  const bad = [
    ['-i', 'C:\\secret.mp4'], ['-y'], ['http://evil.example/x'], ['file:///etc/passwd'], ['concat:a|b'], ['pipe:1'], ['..\\x'], ['-vf', 'movie=C:\\secret.png[o]'],
    ['-filter_complex', 'amovie=x.mp3'], ['-vf', 'drawtext=textfile=/etc/passwd'], ['-f', 'lavfi'], ['-protocol_whitelist', 'file'], ['-filter_script', 'x'], 'not an array', ['a\nb'], new Array(100).fill('-an')
  ];
  for (const a of bad) assert.equal(security.validFfArgs(a), false, JSON.stringify(a));
});
