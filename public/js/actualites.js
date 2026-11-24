// Actualités : tri par pays sans recharger la page ; l'adresse (?pays=) suit le choix pour être partagée.
(function () {
  'use strict';
  var nav = document.querySelector('.filters');
  if (!nav) return;
  var depeches = Array.prototype.slice.call(document.querySelectorAll('.depeche'));
  var compte = nav.querySelector('.filters__compte');
  var vide = document.querySelector('.filters__vide');
  var nomVide = vide && vide.querySelector('[data-vide-nom]');
  var ficheVide = vide && vide.querySelector('[data-vide-fiche]');
  var pays = new URLSearchParams(location.search).get('pays') || '';

  function appliquer(chip) {
    var total = 0;
    depeches.forEach(function (d) {
      var ok = !pays || (' ' + d.getAttribute('data-pays') + ' ').indexOf(' ' + pays + ' ') !== -1;
      d.hidden = !ok;
      if (ok) total++;
    });
    if (compte) compte.textContent = total + ' actualité' + (total > 1 ? 's' : '');
    nav.querySelectorAll('a.chip[data-filtre]').forEach(function (a) {
      if (a.getAttribute('data-valeur') === pays) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (vide) {
      vide.hidden = total !== 0;
      if (chip && total === 0) {
        if (nomVide) nomVide.textContent = chip.getAttribute('data-nom');
        if (ficheVide) ficheVide.href = '/#pvt-' + chip.getAttribute('data-iso2');
      }
    }
    history.replaceState(null, '', location.pathname + (pays ? '?pays=' + encodeURIComponent(pays) : ''));
  }

  nav.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.chip[data-filtre]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    pays = a.getAttribute('data-valeur') || '';
    appliquer(a);
  });
})();
