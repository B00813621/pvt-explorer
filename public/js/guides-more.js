// Déplier chaque étape des guides indépendamment sur téléphone.
(function () {
  'use strict';
  var etapes = Array.prototype.slice.call(document.querySelectorAll('#guides .etape'));
  if (!etapes.length || !window.matchMedia) return;
  var mobile = window.matchMedia('(max-width: 600px)');
  etapes.forEach(function (etape) {
    var bouton = etape.querySelector('[data-etape-more]');
    var liste = etape.querySelector('.guides');
    if (!bouton || !liste) return;
    bouton.addEventListener('click', function () {
      var ouvert = !etape.classList.contains('is-expanded');
      etape.classList.toggle('is-expanded', ouvert);
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      bouton.innerHTML = ouvert
        ? 'Voir moins <span aria-hidden="true">↑</span>'
        : 'Voir les guides <span aria-hidden="true">↓</span>';
    });
  });
  function reset() {
    if (!mobile.matches) {
      etapes.forEach(function (etape) {
        etape.classList.remove('is-expanded');
        var bouton = etape.querySelector('[data-etape-more]');
        if (bouton) bouton.setAttribute('aria-expanded', 'false');
      });
    }
  }
  if (mobile.addEventListener) mobile.addEventListener('change', reset);
  else if (mobile.addListener) mobile.addListener(reset);
})();
