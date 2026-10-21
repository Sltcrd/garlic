/**
 * Translates the DOM in place, so the HTML can stay written in Spanish (the source language).
 * Text nodes and the title/placeholder/aria-label/alt attributes whose text has an English entry are swapped;
 * the original text is remembered, so switching language back and forth is lossless. A MutationObserver
 * keeps newly rendered content (jobs, panels, wheel) translated.
 */
(function () {
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
  const nodes = new WeakMap(); // text node -> { orig, shown }
  let observer = null, busy = false;

  const swap = (orig) => {
    const key = orig.trim();
    if (!key) return orig;
    const out = I18N.t(key);
    return out === key ? orig : orig.replace(key, out);
  };

  function text(n) {
    let s = nodes.get(n);
    if (!s || s.shown !== n.nodeValue) s = { orig: n.nodeValue, shown: n.nodeValue }; // new text written by the app
    const next = swap(s.orig);
    if (next !== n.nodeValue) n.nodeValue = next;
    s.shown = n.nodeValue; nodes.set(n, s);
  }
  function attrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const k = 'data-es-' + a, cur = el.getAttribute(a);
      if (!el.hasAttribute(k) || el.getAttribute(k + '-shown') !== cur) { el.setAttribute(k, cur); }
      const next = swap(el.getAttribute(k));
      if (next !== cur) el.setAttribute(a, next);
      el.setAttribute(k + '-shown', next);
    }
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { if (!SKIP.has(root.parentNode && root.parentNode.tagName)) text(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) { if (SKIP.has(root.tagName)) return; attrs(root); }
    for (const c of root.childNodes) walk(c);
  }
  function apply(root = document.body) {
    if (!root) return;
    busy = true; try { walk(root); } finally { busy = false; }
    if (!observer) {
      observer = new MutationObserver(list => {
        if (busy) return; busy = true;
        try {
          for (const m of list) {
            if (m.type === 'childList') m.addedNodes.forEach(walk);
            else if (m.type === 'characterData') text(m.target);
            else if (m.type === 'attributes') attrs(m.target);
          }
        } finally { busy = false; }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
  }
  window.I18nDom = { apply };
  document.addEventListener('DOMContentLoaded', () => apply());
})();
