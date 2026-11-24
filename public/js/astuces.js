// Nos astuces : tri par pays, par thème et par mots-clés (?q=, envoyé par la recherche du site), combinables, sans recharger la page.
(function () {
  'use strict';
  var nav = document.querySelector('.filters');
  if (!nav) return;
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry[data-theme]'));
  var shelves = Array.prototype.slice.call(document.querySelectorAll('.shelf'));
  var compte = nav.querySelector('.filters__compte');
  var ligneQ = nav.querySelector('.filters__recherche');
  var vide = document.querySelector('.filters__vide');
  var params = new URLSearchParams(location.search);
  var etat = { pays: params.get('pays') || '', categorie: params.get('categorie') || '', q: (params.get('q') || '').trim() };

  var VIDES = ['pvt', 'le', 'la', 'les', 'de', 'du', 'des', 'en', 'au', 'aux', 'un', 'une', 'pour', 'et', 'a', 'l', 'd', 'sur', 'dans', 'mon', 'son', 'quel', 'quelle', 'comment'];
  function norm(s) {
    return String(s || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function mots(q) {
    var t = norm(q).split(' ').filter(Boolean);
    var utiles = t.filter(function (w) { return VIDES.indexOf(w) === -1; });
    return utiles.length ? utiles : t;
  }
  entries.forEach(function (e) {
    e._texte = ' ' + norm(e.textContent + ' ' + e.getAttribute('data-pays') + ' ' + e.getAttribute('data-theme')) + ' ';
  });

  function plural(n) { return n + ' guide' + (n > 1 ? 's' : ''); }

  function appliquer() {
    var total = 0, cherche = mots(etat.q);
    entries.forEach(function (e) {
      var ok = (!etat.pays || (' ' + e.getAttribute('data-pays') + ' ').indexOf(' ' + etat.pays + ' ') !== -1) &&
        (!etat.categorie || e.getAttribute('data-theme') === etat.categorie) &&
        cherche.every(function (w) { return e._texte.indexOf(' ' + w) !== -1; });
      e.hidden = !ok;
      if (ok) total++;
    });
    shelves.forEach(function (s) {
      var n = s.querySelectorAll('.entry:not([hidden])').length;
      s.hidden = n === 0;
      var c = s.querySelector('.shelf__compte');
      if (c) c.textContent = plural(n);
    });
    if (compte) compte.textContent = plural(total);
    if (vide) vide.hidden = total !== 0;
    if (ligneQ) {
      ligneQ.hidden = !etat.q;
      var fort = ligneQ.querySelector('[data-q]');
      if (fort) fort.textContent = etat.q;
    }
    nav.querySelectorAll('a.chip[data-filtre]').forEach(function (a) {
      var g = a.getAttribute('data-filtre');
      if (a.getAttribute('data-valeur') === etat[g]) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    var qs = new URLSearchParams();
    if (etat.q) qs.set('q', etat.q);
    if (etat.pays) qs.set('pays', etat.pays);
    if (etat.categorie) qs.set('categorie', etat.categorie);
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs.toString() : ''));
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-filtre]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    var g = a.getAttribute('data-filtre');
    if (g === 'raz') { etat.pays = ''; etat.categorie = ''; etat.q = ''; }
    else etat[g] = a.getAttribute('data-valeur') || '';
    appliquer();
  });

  if (etat.q) appliquer();
})();
