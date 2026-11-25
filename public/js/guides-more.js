// Les listes de guides sont réellement repliées par défaut sur téléphone.
(function () {
  'use strict';
  var etapes = Array.prototype.slice.call(document.querySelectorAll('#guides .etape'));
  if (!etapes.length || !window.matchMedia) return;
  var mobile = window.matchMedia('(max-width: 600px)');

  function setup() {
    etapes.forEach(function (etape) {
      var bouton = etape.querySelector('[data-etape-more]');
      var liste = etape.querySelector('.guides');
      if (!bouton || !liste) return;
      if (mobile.matches) {
        etape.classList.remove('is-expanded');
        liste.hidden = true;
        bouton.hidden = false;
        bouton.setAttribute('aria-expanded', 'false');
        bouton.innerHTML = 'Voir les guides <span aria-hidden="true">↓</span>';
      } else {
        liste.hidden = false;
        etape.classList.remove('is-expanded');
        bouton.hidden = true;
        bouton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  etapes.forEach(function (etape) {
    var bouton = etape.querySelector('[data-etape-more]');
    var liste = etape.querySelector('.guides');
    if (!bouton || !liste) return;
    bouton.addEventListener('click', function () {
      var ouvert = liste.hidden;
      liste.hidden = !ouvert;
      etape.classList.toggle('is-expanded', ouvert);
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      bouton.innerHTML = ouvert
        ? 'Voir moins <span aria-hidden="true">↑</span>'
        : 'Voir les guides <span aria-hidden="true">↓</span>';
    });
  });
  setup();
  if (mobile.addEventListener) mobile.addEventListener('change', setup);
  else if (mobile.addListener) mobile.addListener(setup);
})();
