/* Tarjetas de trabajos: progreso en vivo y, al terminar, dónde está el archivo nuevo */
const $ = s => document.querySelector(s);
const list = $('#list');
const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', WARN = '<svg viewBox="0 0 24 24"><path d="M12 6v7M12 17.5v.5"/></svg>';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = p => {
  const sep = p.includes('\\') ? '\\' : '/', parts = p.split(/[\\/]/).filter(Boolean);
  return parts.length > 3 ? '…' + sep + parts.slice(-3).join(sep) : p;
};

function body(j) {
  if (j.state === 'running') {
    const pct = j.p == null ? '' : Math.round(j.p * 100) + '%';
    return { pct, html: `<div class="ttl">${esc(j.title)}</div><div class="sub">${esc(j.label || '')}</div><div class="bar ${j.p == null ? 'ind' : ''}"><i style="width:${j.p == null ? 38 : Math.round(j.p * 100)}%"></i></div>${j.cancelable ? '<button class="btn cancel" data-a="cancel">Cancelar</button>' : ''}` };
  }
  if (j.state === 'error') return { pct: '', html: `<div class="ttl">No se pudo completar</div><div class="sub">${esc(j.err)}</div>` };
  const name = j.out ? j.out.split(/[\\/]/).pop() : j.name;
  return { pct: '', html: `<div class="ttl">${esc(name)}</div><div class="sub" title="${esc(j.out)}">${esc(j.note || short(j.out))}</div>
    <div class="btns"><button class="btn pri" data-a="reveal">Mostrar</button><button class="btn" data-a="open">Abrir</button><button class="btn" data-a="move">Mover a…</button></div>` };
}
function render(items) {
  const keep = new Set(items.map(j => 'j' + j.id));
  [...list.children].forEach(c => { if (!keep.has(c.id)) c.remove(); });
  for (const j of items) {
    let el = document.getElementById('j' + j.id);
    if (!el) {
      el = document.createElement('div'); el.id = 'j' + j.id; el.dataset.id = j.id;
      el.innerHTML = '<div class="ic"></div><div class="mid"></div><div class="pct"></div><button class="x" data-a="close" title="Cerrar">✕</button>';
      el.addEventListener('mouseenter', () => nat.jobsHover({ id: j.id, hover: true })); el.addEventListener('mouseleave', () => nat.jobsHover({ id: j.id, hover: false }));
      list.appendChild(el);
    }
    const b = body(j); el.className = 'card ' + j.state;
    const ic = el.querySelector('.ic'), want = j.state === 'done' ? CHECK : j.state === 'error' ? WARN : '<img src="../../../assets/icon.png" alt="">';
    if (ic.dataset.k !== j.state) { ic.innerHTML = want; ic.dataset.k = j.state; }
    const mid = el.querySelector('.mid'), sig = b.html;
    if (mid.dataset.sig !== sig) {
      /* la barra se actualiza sin recrearla para que la transición sea fluida */
      const bar = mid.querySelector('.bar i');
      if (j.state === 'running' && bar && mid.dataset.state === 'running') { bar.style.width = (j.p == null ? 38 : Math.round(j.p * 100)) + '%'; mid.querySelector('.sub').textContent = j.label || ''; }
      else mid.innerHTML = sig;
      mid.dataset.sig = sig; mid.dataset.state = j.state;
    }
    el.querySelector('.pct').textContent = b.pct;
  }
  requestAnimationFrame(() => nat.jobsSize(document.body.scrollHeight));
}
list.addEventListener('click', e => {
  const btn = e.target.closest('[data-a]'); if (!btn) return;
  const id = +btn.closest('.card').dataset.id; nat.jobAction({ id, action: btn.dataset.a });
});
nat.onJobs(render);   // register before anything async: the main process pushes the current state as soon as the page loads
cfgInit();
