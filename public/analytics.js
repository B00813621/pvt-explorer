// Google Analytics 4 avec consentement préalable (exigence CNIL) :
// gtag.js n'est chargé qu'après un clic sur « Accepter ». Le choix est conservé 13 mois maximum.
// L'identifiant de mesure se règle dans app-config.js (window.PVT_CONFIG.ga4Id). Vide = rien ne s'affiche.
(function () {
  var ID = (window.PVT_CONFIG && window.PVT_CONFIG.ga4Id) || '';
  if (!/^G-[A-Z0-9]+$/.test(ID)) return;
  var KEY = 'pvt-consent-v1', MAX_AGE = 395 * 24 * 3600 * 1000;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && Date.now() - v.t < MAX_AGE ? v.c : null;
    } catch (e) { return null; }
  }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify({ c: c, t: Date.now() })); } catch (e) {} }

  var loaded = false;
  function loadGa() {
    if (loaded) return; loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID);
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);
  }
  function clearGaCookies() {
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (/^_ga/.test(n)) {
        var host = location.hostname.replace(/^www\./, '');
        ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) {
          document.cookie = n + '=; Max-Age=0; path=/' + d;
        });
      }
    });
  }

  var css = '#pvt-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;background:#fff;color:#102b36;border:1px solid #e4eae6;border-radius:16px;box-shadow:0 14px 40px rgba(16,43,54,.18);padding:16px 18px;font:14px/1.5 Inter,system-ui,sans-serif}' +
    '#pvt-consent p{margin:0 0 12px}#pvt-consent a{color:#087e79;font-weight:600;text-decoration:underline}' +
    '#pvt-consent .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}' +
    '#pvt-consent button{border:1px solid #087e79;border-radius:999px;padding:8px 16px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;background:#fff;color:#087e79}' +
    '#pvt-consent button.ok{background:#087e79;color:#fff}';

  function banner() {
    if (document.getElementById('pvt-consent')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var b = document.createElement('div');
    b.id = 'pvt-consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Gestion des cookies');
    b.innerHTML = '<p>🍪 J\'utilise Google Analytics pour mesurer l\'audience du site et l\'améliorer. Ces cookies ne sont déposés qu\'avec votre accord. <a href="/confidentialite.html">En savoir plus</a></p>' +
      '<div class="row"><button type="button" data-c="0">Refuser</button><button type="button" class="ok" data-c="1">Accepter</button></div>';
    b.addEventListener('click', function (e) {
      var c = e.target && e.target.getAttribute('data-c');
      if (c === null) return;
      save(c === '1');
      b.remove();
      if (c === '1') { window['ga-disable-' + ID] = false; loadGa(); } else { window['ga-disable-' + ID] = true; clearGaCookies(); }
    });
    document.body.appendChild(b);
  }

  // Lien « Gérer les cookies » : <a href="#" data-cookie-settings>
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('[data-cookie-settings]');
    if (a) { e.preventDefault(); banner(); }
  });

  var choice = read();
  if (choice === true) loadGa();
  else if (choice === null) {
    if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);
  }
})();
