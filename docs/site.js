/* Language switch (ES/EN): remembers the choice, otherwise follows the browser language. */
(function () {
  var html = document.documentElement;
  function stored() { try { return localStorage.getItem('garlic-lang'); } catch { return null; } }
  function set(lang) {
    html.setAttribute('data-lang', lang); html.lang = lang;
    document.title = lang === 'en' ? 'Garlic · Convert and edit files with one click' : 'Garlic · Convierte y edita archivos con un clic';
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang)); });
    try { localStorage.setItem('garlic-lang', lang); } catch { /* storage unavailable */ }
  }
  var initial = stored() || (/^es/i.test(navigator.language || '') ? 'es' : 'en');
  set(initial === 'es' ? 'es' : 'en');
  document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-set-lang')); }); });
})();
