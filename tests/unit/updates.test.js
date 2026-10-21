'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isNewer, parseRelease, parseVersion } = require('../../src/main/updates');

test('version comparison', () => {
  assert.equal(isNewer('v1.2.0', '1.1.0'), true);
  assert.equal(isNewer('1.1.1', '1.1.0'), true);
  assert.equal(isNewer('2.0.0', '1.9.9'), true);
  assert.equal(isNewer('1.1.0', '1.1.0'), false);
  assert.equal(isNewer('1.0.9', '1.1.0'), false);
  assert.equal(isNewer('nonsense', '1.1.0'), false);
  assert.deepEqual(parseVersion('v10.2.3-beta.1'), [10, 2, 3]);
});

test('release parsing keeps only safe, expected fields', () => {
  const r = parseRelease({ tag_name: 'v1.2.0', body: '- new thing\n<!-- end-notes -->\ninstall text', html_url: 'https://github.com/Sltcrd/garlic/releases/tag/v1.2.0', published_at: '2026-10-21T10:00:00Z' });
  assert.equal(r.version, '1.2.0');
  assert.equal(r.notes, '- new thing');
  assert.equal(r.published, '2026-10-21');
  assert.equal(r.url, 'https://github.com/Sltcrd/garlic/releases/tag/v1.2.0');
});

test('a release page outside this repository is replaced by the repository page', () => {
  const r = parseRelease({ tag_name: 'v1.2.0', html_url: 'https://evil.example/download.exe' });
  assert.equal(r.url, 'https://github.com/Sltcrd/garlic/releases/latest');
});

test('drafts, pre-releases and garbage are ignored', () => {
  assert.equal(parseRelease({ tag_name: 'v9.0.0', draft: true }), null);
  assert.equal(parseRelease({ tag_name: 'v9.0.0', prerelease: true }), null);
  assert.equal(parseRelease({ tag_name: 'latest' }), null);
  assert.equal(parseRelease(null), null);
});
