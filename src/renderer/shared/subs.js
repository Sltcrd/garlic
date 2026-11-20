/** SubRip (.srt) and WebVTT (.vtt) subtitles: parse, retime and write. Pure functions, shared by the editor and the unit tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Subs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TIME = '((?:\\d{1,2}:)?\\d{1,2}:\\d{2}[,.]\\d{1,3})';
  const LINE = new RegExp('^\\s*' + TIME + '\\s*-->\\s*' + TIME + '(.*)$');

  const stripBom = s => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);

  /** "01:02:03,456" or "02:03.456" → milliseconds */
  function toMs(s) {
    const [main, frac] = s.split(/[,.]/), p = main.split(':').map(Number);
    const h = p.length === 3 ? p[0] : 0, m = p[p.length - 2], sec = p[p.length - 1];
    return ((h * 60 + m) * 60 + sec) * 1000 + Number((frac + '00').slice(0, 3));
  }
  function stamp(ms, sep) {
    ms = Math.max(0, Math.round(ms)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, f = ms % 1000;
    const two = n => String(n).padStart(2, '0');
    return `${two(h)}:${two(m)}:${two(s)}${sep}${String(f).padStart(3, '0')}`;
  }

  /** Returns [{start, end, settings, text}] (times in ms). Blocks without a time line (WEBVTT header, NOTE, STYLE) are dropped. */
  function parse(text) {
    const cues = [];
    for (const block of stripBom(String(text)).replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
      const lines = block.split('\n'), i = lines.findIndex(l => l.includes('-->')); if (i < 0) continue;
      const m = lines[i].match(LINE); if (!m) continue;
      cues.push({ start: toMs(m[1]), end: toMs(m[2]), settings: m[3].trim(), text: lines.slice(i + 1).join('\n').replace(/\n+$/, '') });
    }
    return cues;
  }
  /** kind: 'srt' | 'vtt' */
  function format(cues, kind) {
    const vtt = kind === 'vtt', sep = vtt ? '.' : ',';
    const body = cues.map((c, i) => `${vtt ? '' : (i + 1) + '\n'}${stamp(c.start, sep)} --> ${stamp(c.end, sep)}${vtt && c.settings ? ' ' + c.settings : ''}\n${c.text}`).join('\n\n');
    return (vtt ? 'WEBVTT\n\n' : '') + body + '\n';
  }
  /** Moves and stretches the times: new = old * factor + offset. Cues that end before 0 are dropped; starts are clamped to 0. */
  function retime(cues, offsetMs, factor = 1) {
    return cues.map(c => ({ ...c, start: Math.round(c.start * factor + offsetMs), end: Math.round(c.end * factor + offsetMs) })).filter(c => c.end > 0).map(c => ({ ...c, start: Math.max(0, c.start) }));
  }
  return { parse, format, retime, toMs, stamp };
});
