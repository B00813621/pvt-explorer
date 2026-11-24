// Bandeau d'actualités de l'accueil : les titres défilent en continu, comme un tableau d'aéroport ou un bandeau
// de journal télévisé. Pause au survol, au clavier et par le bouton ; immobile si l'on préfère moins d'animations.
(function () {
  'use strict';
  var piste = document.querySelector('[data-bandeau]');
  if (!piste) return;
  var bandeau = piste.closest('.bandeau');
  var fenetre = piste.parentElement;
  var pause = bandeau.querySelector('.bandeau__pause');
  var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var VITESSE = 60; // pixels par seconde : lisible sans être lent

  var ISO = { australie: 'AUS', canada: 'CAN', 'nouvelle-zélande': 'NZL', japon: 'JPN', 'corée-du-sud': 'KOR', 'hong-kong': 'HKG', 'taïwan': 'TWN', argentine: 'ARG', 'brésil': 'BRA', chili: 'CHL', colombie: 'COL', 'équateur': 'ECU', mexique: 'MEX', 'pérou': 'PER', uruguay: 'URY' };
  function code(pays) {
    var c = (pays || []).map(function (k) { return ISO[k]; }).filter(Boolean);
    return c.length === 1 ? c[0] : 'PVT';
  }
  function slugId(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  }
  function typo(s) { return String(s).replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« '); }
  function el(tag, cls, texte) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texte) n.textContent = texte;
    return n;
  }
  function ligne(codePays, type, titre, href) {
    var li = el('li', 'bandeau__item');
    li.appendChild(el('span', 'bandeau__code data', codePays));
    if (type) li.appendChild(el('span', 'bandeau__type', type));
    var a = el('a', '', typo(titre));
    a.href = href;
    li.appendChild(a);
    return li;
  }

  // Une seconde série, masquée aux lecteurs d'écran, rend la boucle continue
  function boucler() {
    piste.querySelectorAll('[data-copie]').forEach(function (n) { n.remove(); });
    piste.style.removeProperty('--distance');
    bandeau.classList.remove('is-anime');
    if (reduce.matches) return;
    var originaux = Array.prototype.slice.call(piste.children);
    var serie = piste.scrollWidth;
    if (!serie) return;
    var copies = Math.max(1, Math.ceil(fenetre.clientWidth / serie));
    for (var c = 0; c < copies; c++) {
      originaux.forEach(function (li) {
        var k = li.cloneNode(true);
        k.setAttribute('data-copie', '');
        k.setAttribute('aria-hidden', 'true');
        k.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; });
        piste.appendChild(k);
      });
    }
    piste.style.setProperty('--distance', -serie + 'px');
    piste.style.setProperty('--duree', Math.round(serie / VITESSE) + 's');
    bandeau.classList.add('is-anime');
  }

  if (pause) {
    pause.addEventListener('click', function () {
      var arret = pause.getAttribute('aria-pressed') !== 'true';
      pause.setAttribute('aria-pressed', String(arret));
      bandeau.classList.toggle('is-pause', arret);
    });
  }

  var attente;
  window.addEventListener('resize', function () { clearTimeout(attente); attente = setTimeout(boucler, 200); });
  if (reduce.addEventListener) reduce.addEventListener('change', boucler);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boucler); else boucler();

  // Les actualités publiées depuis l'admin remontent d'elles-mêmes, suivies des derniers guides
  fetch('/api/actualites/feed', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.actualites || !d.actualites.length) return;
      var lignes = d.actualites.slice(0, 8).map(function (a) {
        return ligne(code(a.pays), '', a.titre, '/actualites#a-' + slugId(a.id || a.titre));
      }).concat((d.guides || []).map(function (g) {
        return ligne(code(g.pays), 'Nouveau guide', g.titre, g.lien);
      }));
      if (lignes.length < piste.querySelectorAll('.bandeau__item:not([data-copie])').length) return;
      piste.replaceChildren.apply(piste, lignes);
      boucler();
    })
    .catch(function () { /* le bandeau garde ses titres de départ */ });
})();
