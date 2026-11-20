'use strict';
/**
 * ffmpeg filter graph for the video studio. Pure: it only turns an already validated project (numbers and flags,
 * never user text) into a filter script, so nothing a renderer sends ever becomes part of a command line.
 *
 * Inputs are expected in this order: the clips (each opened with -ss/-t), then one PNG per text overlay
 * (full-frame, transparent, looped), then the optional music (looped).
 */
const num = n => String(Math.round(n * 1000) / 1000);

/** atempo only accepts 0.5–2 per instance, so 0.25× and 4× need two. */
function atempo(speed) {
  const parts = []; let s = speed;
  while (s > 2) { parts.push(2); s /= 2; }
  while (s < 0.5) { parts.push(0.5); s *= 2; }
  parts.push(s);
  return parts.map(p => 'atempo=' + num(p)).join(',');
}

/**
 * @param {{clips:{in:number,out:number,speed:number,vol:number,hasAudio:boolean}[], w:number, h:number, fps:number, fit:'contain'|'cover',
 *          texts:{start:number,end:number}[], music:{vol:number}|null}} s
 * @returns {{script:string, total:number}}
 */
function build(s) {
  const { w, h, fps } = s, n = s.clips.length, lines = [];
  let total = 0;
  const fit = s.fit === 'cover'
    ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
    : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`;
  s.clips.forEach((c, i) => {
    const dur = (c.out - c.in) / c.speed; total += dur;
    lines.push(`[${i}:v]setpts=(PTS-STARTPTS)/${num(c.speed)},${fit},setsar=1,fps=${fps},format=yuv420p[v${i}]`);
    if (c.hasAudio && c.vol > 0) {
      const chain = ['asetpts=PTS-STARTPTS'];
      if (c.speed !== 1) chain.push(atempo(c.speed));
      if (c.vol !== 1) chain.push('volume=' + num(c.vol));
      chain.push('aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo');
      lines.push(`[${i}:a]${chain.join(',')}[a${i}]`);
    } else lines.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${num(dur)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
  });
  lines.push(s.clips.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${n}:v=1:a=1[vc][ac]`);

  let cur = 'vc';
  s.texts.forEach((t, k) => {
    const out = k === s.texts.length - 1 ? 'vout' : 'vo' + k;
    lines.push(`[${cur}][${n + k}:v]overlay=0:0:enable='between(t,${num(t.start)},${num(t.end)})':shortest=1[${out}]`); cur = out;
  });
  if (!s.texts.length) lines.push('[vc]null[vout]');

  if (s.music) {
    const mi = n + s.texts.length, fade = Math.min(2, total / 2);
    lines.push(`[${mi}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${num(s.music.vol)},afade=t=out:st=${num(Math.max(0, total - fade))}:d=${num(fade)}[mu]`);
    lines.push('[ac][mu]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]');
  } else lines.push('[ac]anull[aout]');
  return { script: lines.join(';\n'), total };
}

module.exports = { build, atempo };
