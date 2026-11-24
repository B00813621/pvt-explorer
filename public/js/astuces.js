// Nos astuces : tri par pays et par thème, combinables, sans recharger la page.
(function () {
  'use strict';
  var nav = document.querySelector('.filters');
  if (!nav) return;
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry[data-theme]'));
  var shelves = Array.prototype.slice.call(document.querySelectorAll('.shelf'));
  var compte = nav.querySelector('.filters__compte');
  var vide = document.querySelector('.filters__vide');
  var params = new URLSearchParams(location.search);
  var etat = { pays: params.get('pays') || '', categorie: params.get('categorie') || '' };

  function plural(n) { return n + ' guide' + (n > 1 ? 's' : ''); }

  function appliquer() {
    var total = 0;
    entries.forEach(function (e) {
      var ok = (!etat.pays || (' ' + e.getAttribute('data-pays') + ' ').indexOf(' ' + etat.pays + ' ') !== -1) &&
        (!etat.categorie || e.getAttribute('data-theme') === etat.categorie);
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
    nav.querySelectorAll('a.chip[data-filtre]').forEach(function (a) {
      var g = a.getAttribute('data-filtre');
      if (a.getAttribute('data-valeur') === etat[g]) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    var qs = new URLSearchParams();
    if (etat.pays) qs.set('pays', etat.pays);
    if (etat.categorie) qs.set('categorie', etat.categorie);
    var url = location.pathname + (qs.toString() ? '?' + qs.toString() : '');
    history.replaceState(null, '', url);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-filtre]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    var g = a.getAttribute('data-filtre');
    if (g === 'raz') { etat.pays = ''; etat.categorie = ''; }
    else etat[g] = a.getAttribute('data-valeur') || '';
    appliquer();
  });
})();
