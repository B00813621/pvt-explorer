// Recherche du site : la loupe de l'en-tête ouvre un petit menu déroulant.
// Champ vide : les recherches fréquentes. Dès la première lettre : suggestions (destinations, guides,
// actualités, pages), sans tenir compte des accents ni des majuscules, avec une faute de frappe tolérée.
(function () {
  'use strict';
  var panneau = document.getElementById('recherche');
  var bouton = document.querySelector('[data-recherche-ouvrir]');
  if (!panneau || !bouton) return;
  var champ = panneau.querySelector('#recherche-champ');
  var liste = panneau.querySelector('#recherche-liste');
  var titre = panneau.querySelector('#recherche-titre');
  var rien = panneau.querySelector('.recherche__vide');
  var statut = panneau.querySelector('.recherche__statut');
  var form = panneau.querySelector('form');
  var cover = document.querySelector('.cover');
  var accueil = location.pathname === '/' || location.pathname === '/index.html';
  var base = accueil ? '' : '/';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var LOUPE = '<svg class="recherche__puce" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15.2 15.2 4.6 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  // [clé des articles, code vignette, code ISO, nom, mots associés]
  var DESTINATIONS = [
    ['australie', 'AU', 'AUS', 'Australie', 'whv working holiday 417 oz sydney melbourne brisbane perth'],
    ['nouvelle-zélande', 'NZ', 'NZL', 'Nouvelle-Zélande', 'nz kiwi auckland wellington'],
    ['japon', 'JP', 'JPN', 'Japon', 'japan tokyo osaka'],
    ['corée-du-sud', 'KR', 'KOR', 'Corée du Sud', 'coree korea seoul'],
    ['hong-kong', 'HK', 'HKG', 'Hong Kong', 'hongkong'],
    ['taïwan', 'TW', 'TWN', 'Taïwan', 'taiwan taipei'],
    ['canada', 'CA', 'CAN', 'Canada', 'eic experience internationale quebec montreal toronto vancouver'],
    ['argentine', 'AR', 'ARG', 'Argentine', 'argentina buenos aires'],
    ['brésil', 'BR', 'BRA', 'Brésil', 'brazil rio sao paulo'],
    ['chili', 'CL', 'CHL', 'Chili', 'chile santiago'],
    ['colombie', 'CO', 'COL', 'Colombie', 'colombia bogota medellin'],
    ['équateur', 'EC', 'ECU', 'Équateur', 'ecuador quito'],
    ['mexique', 'MX', 'MEX', 'Mexique', 'mexico'],
    ['pérou', 'PE', 'PER', 'Pérou', 'peru lima cusco'],
    ['uruguay', 'UY', 'URY', 'Uruguay', 'montevideo']
  ];
  var ISO = {};
  DESTINATIONS.forEach(function (d) { ISO[d[0]] = d[2]; });

  var PAGES = [
    ['Quels PVT me sont ouverts ? Le test par âge', base + '#eligibilite', 'Outil', 'age limite eligibilite eligible 30 ans 35 ans quel pays choisir test'],
    ['Comparer les 15 PVT', base + '#comparer', 'Page', 'comparatif tableau budget duree age quotas'],
    ['Questions fréquentes sur le PVT', base + '#faq', 'Page', 'faq questions'],
    ['Services à comparer : assurance, eSIM, vols, logement', base + '#avant-de-partir', 'Page', 'assurance esim telephone vols billet avion logement auberge'],
    ['Dans le sac : l’équipement du départ', base + '#avant-de-partir', 'Page', 'sac a dos valise equipement adaptateur batterie cadenas serviette trousse'],
    ['Actualités PVT par pays', '/actualites', 'Page', 'actu actus news nouveautes tirages quotas prix ouverture'],
    ['Tous les guides', '/nos-astuces', 'Page', 'articles blog astuces guides'],
    ['À propos de l’auteur', '/a-propos', 'Page', 'auteur qui'],
    ['Écrire à l’auteur', base + '#ecrire', 'Page', 'contact question message email ecrire']
  ];
  var FREQUENTES = ['PVT Canada 2027', 'PVT Australie', 'Âge limite', 'Budget', 'Assurance', 'Trouver du travail', 'PVT Japon', '88 jours'];
  var CATEGORIES = { visa: 'Visa', budget: 'Budget', assurance: 'Assurance', travail: 'Travail', 'vie-pratique': 'Vie pratique', vols: 'Vols', 'hébergement': 'Hébergement', 'activités': 'Activités' };
  var POIDS = { Destination: 40, Outil: 32, Page: 20, Guide: 18, Actualité: 16, Thème: 14 };
  var VIDES = ['pvt', 'le', 'la', 'les', 'de', 'du', 'des', 'en', 'au', 'aux', 'un', 'une', 'pour', 'et', 'a', 'l', 'd', 'sur', 'dans', 'mon', 'ma', 'son', 'quel', 'quelle', 'comment', 'faire'];

  function norm(s) {
    return String(s || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function mots(q) {
    var t = norm(q).split(' ').filter(Boolean);
    var utiles = t.filter(function (w) { return VIDES.indexOf(w) === -1; });
    return utiles.length ? utiles : t;
  }
  function slugId(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  // Une faute de frappe tolérée sur les mots de 5 lettres et plus
  function proche(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, fautes = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++fautes > 1) return false;
      if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
    }
    return fautes + (a.length - i) + (b.length - j) <= 1;
  }

  function presque(w, m) { return proche(w, m) || proche(w, m.slice(0, w.length + 1)); }

  function item(label, href, type, code, kw) {
    var it = { label: label, href: href, type: type, code: code || '' };
    it.nl = ' ' + norm(label) + ' ';
    it.hay = ' ' + norm(label + ' ' + (kw || '') + ' ' + (code || '')) + ' ';
    it.mots = it.hay.trim().split(' ');
    it.motsTitre = it.nl.trim().split(' ');
    return it;
  }
  var index = DESTINATIONS.map(function (d) {
    return item('PVT ' + d[3], base + '#pvt-' + d[1], 'Destination', d[2], d[3] + ' ' + d[4] + ' visa vacances travail');
  }).concat(PAGES.map(function (p) { return item(p[0], p[1], p[2], '', p[3]); }));

  function score(it, ws, qn) {
    var s = POIDS[it.type] || 0;
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (it.nl.indexOf(' ' + w) !== -1) s += 12;
      else if (it.hay.indexOf(' ' + w) !== -1) s += 4;
      else if (w.length >= 5 && it.motsTitre.some(function (m) { return presque(w, m); })) s += 8;
      else if (w.length >= 5 && it.mots.some(function (m) { return presque(w, m); })) s += 2;
      else return -1;
    }
    if (it.nl.indexOf(' ' + qn) === 0) s += 30;
    else if (it.nl.indexOf(' ' + qn) !== -1) s += 15;
    return s;
  }
  function chercher(q, max) {
    var ws = mots(q), qn = norm(q);
    if (!ws.length) return [];
    return index.map(function (it) { return { it: it, s: score(it, ws, qn) }; })
      .filter(function (r) { return r.s >= 0; })
      .sort(function (a, b) { return b.s - a.s || a.it.label.length - b.it.label.length; })
      .slice(0, max || 7).map(function (r) { return r.it; });
  }

  // Met en valeur le début des mots qui correspondent à la saisie
  function surligner(label, ws) {
    var chars = Array.from(label);
    var plat = chars.map(function (c) { return (norm(c) || ' ').charAt(0); }).join('');
    var marque = new Array(chars.length).fill(false);
    ws.forEach(function (w) {
      var i = plat.indexOf(w);
      while (i !== -1) {
        if (i === 0 || plat[i - 1] === ' ') for (var k = i; k < i + w.length; k++) marque[k] = true;
        i = plat.indexOf(w, i + 1);
      }
    });
    var html = '', ouvert = false;
    chars.forEach(function (c, k) {
      if (marque[k] && !ouvert) { html += '<mark>'; ouvert = true; }
      if (!marque[k] && ouvert) { html += '</mark>'; ouvert = false; }
      html += esc(c);
    });
    return html + (ouvert ? '</mark>' : '');
  }

  var options = [], actif = -1;
  function rendre() {
    var q = champ.value.trim();
    var lignes = [];
    if (!q) {
      titre.textContent = 'Recherches fréquentes';
      FREQUENTES.forEach(function (f) {
        var meilleur = chercher(f, 1)[0];
        if (meilleur) lignes.push({ html: LOUPE + '<span class="recherche__nom">' + esc(f) + '</span>', type: '', href: meilleur.href });
      });
      lignes = lignes.slice(0, 6);
    } else {
      titre.textContent = 'Suggestions';
      var ws = mots(q);
      chercher(q, 7).forEach(function (it) {
        lignes.push({ html: '<span class="recherche__nom">' + surligner(it.label, ws) + '</span>', type: (it.code ? it.code + ' · ' : '') + it.type, href: it.href });
      });
      lignes.push({ html: LOUPE + '<span class="recherche__nom">Chercher « ' + esc(q) + ' » dans tous les guides</span>', type: '', href: '/nos-astuces?q=' + encodeURIComponent(q), tout: true });
    }
    liste.innerHTML = lignes.map(function (l, i) {
      return '<li class="recherche__option' + (l.tout ? ' recherche__option--tout' : '') + '" role="option" id="recherche-o' + i + '" aria-selected="false" data-href="' + esc(l.href) + '">' +
        l.html + (l.type ? '<span class="recherche__type data">' + esc(l.type) + '</span>' : '') + '</li>';
    }).join('');
    options = Array.prototype.slice.call(liste.children);
    actif = -1;
    champ.removeAttribute('aria-activedescendant');
    champ.setAttribute('aria-expanded', String(options.length > 0));
    var trouves = q ? options.length - 1 : options.length;
    if (rien) rien.hidden = !(q && trouves === 0);
    if (statut) statut.textContent = q ? (trouves ? trouves + ' suggestion' + (trouves > 1 ? 's' : '') : 'Aucune suggestion') : '';
  }

  function activer(i, survol) {
    if (!options.length) return;
    if (actif >= 0 && options[actif]) options[actif].setAttribute('aria-selected', 'false');
    actif = (i + options.length) % options.length;
    var o = options[actif];
    o.setAttribute('aria-selected', 'true');
    champ.setAttribute('aria-activedescendant', o.id);
    if (!survol) o.scrollIntoView({ block: 'nearest' });
  }

  function aller(href) {
    if (!href) return;
    if (href.charAt(0) === '#') {
      fermer(false);
      var cible = document.getElementById(href.slice(1));
      if (location.hash === href) {
        if (cible) cible.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        var m = href.match(/^#pvt-([A-Z]{2})$/);
        if (m && window.PVT && window.PVT.ouvrirFiche) window.PVT.ouvrirFiche('fiche-' + m[1]);
      } else {
        location.hash = href;
      }
      return;
    }
    location.href = href;
  }

  // Articles et actualités publiés, chargés à la première ouverture puis gardés le temps de la visite
  var charge = false;
  function ajouter(posts, actus) {
    var themes = {};
    (posts || []).forEach(function (p) {
      if (!p || !p.slug || !p.title) return;
      var pays = (p.countries || []).filter(function (k) { return ISO[k]; });
      var actu = p.category === 'actualites';
      if (!actu && CATEGORIES[p.category]) themes[p.category] = true;
      index.push(item(p.title, '/blog/' + p.slug, actu ? 'Actualité' : 'Guide', pays.length === 1 ? ISO[pays[0]] : '',
        (p.description || '') + ' ' + (p.tags || []).join(' ') + ' ' + pays.join(' ') + ' ' + (CATEGORIES[p.category] || '')));
    });
    (actus || []).forEach(function (a) {
      if (!a || !a.titre || index.some(function (it) { return it.label === a.titre; })) return;
      var pays = (a.pays || []).filter(function (k) { return ISO[k]; });
      index.push(item(a.titre, '/actualites#a-' + slugId(a.id || a.titre), 'Actualité', pays.length === 1 ? ISO[pays[0]] : '', (a.texte || '') + ' ' + pays.join(' ')));
    });
    Object.keys(themes).forEach(function (k) {
      index.push(item('Guides : ' + CATEGORIES[k], '/nos-astuces?categorie=' + encodeURIComponent(k), 'Thème', '', k));
    });
    if (!panneau.hidden) rendre();
  }
  function charger() {
    if (charge) return;
    charge = true;
    var cache = null;
    try { cache = JSON.parse(sessionStorage.getItem('pvt-recherche') || 'null'); } catch (e) { cache = null; }
    if (cache && Date.now() - cache.t < 600000) { ajouter(cache.posts, cache.actus); return; }
    var json = function (url) { return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); };
    Promise.all([json('/api/blog'), json('/api/actualites/feed')]).then(function (res) {
      var posts = (res[0].posts || []).map(function (p) { return { slug: p.slug, title: p.title, description: p.description, countries: p.countries, category: p.category, tags: p.tags }; });
      var actus = (res[1].actualites || []).map(function (a) { return { id: a.id, titre: a.titre, texte: a.texte, pays: a.pays }; });
      try { sessionStorage.setItem('pvt-recherche', JSON.stringify({ t: Date.now(), posts: posts, actus: actus })); } catch (e) { /* stockage indisponible */ }
      ajouter(posts, actus);
    });
  }

  function ouvrir() {
    if (cover && cover.hasAttribute('data-open')) {
      cover.removeAttribute('data-open');
      var t = cover.querySelector('.cover__toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    }
    panneau.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
    rendre();
    champ.focus();
    charger();
  }
  function fermer(rendreFocus) {
    if (panneau.hidden) return;
    panneau.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
    champ.setAttribute('aria-expanded', 'false');
    champ.removeAttribute('aria-activedescendant');
    if (rendreFocus) bouton.focus();
  }

  bouton.addEventListener('click', function () { if (panneau.hidden) ouvrir(); else fermer(true); });
  panneau.querySelector('[data-recherche-fermer]').addEventListener('click', function () { fermer(true); });
  champ.addEventListener('input', rendre);
  champ.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); activer(actif + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activer(actif - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); fermer(true); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var o = options[actif >= 0 ? actif : 0];
      if (o && (actif >= 0 || champ.value.trim())) aller(o.getAttribute('data-href'));
    }
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  liste.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('[role=option]');
    if (o) aller(o.getAttribute('data-href'));
  });
  liste.addEventListener('mousemove', function (e) {
    var o = e.target.closest && e.target.closest('[role=option]');
    var i = options.indexOf(o);
    if (i !== -1 && i !== actif) activer(i, true);
  });
  document.addEventListener('click', function (e) {
    if (!panneau.hidden && !panneau.contains(e.target) && !bouton.contains(e.target)) fermer(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    ouvrir();
  });
})();
