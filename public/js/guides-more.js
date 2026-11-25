// Sur mobile, garder jusqu'à 3 articles visibles par étape et replier uniquement le surplus.
(function () {
  'use strict';
  var etapes = Array.prototype.slice.call(document.querySelectorAll('#guides .etape'));
  if (!etapes.length || !window.matchMedia) return;
  var mobile = window.matchMedia('(max-width: 600px)');
  var LIMITE = 3;

  function setup() {
    etapes.forEach(function (etape) {
      var bouton = etape.querySelector('[data-etape-more]');
      var liste = etape.querySelector('.guides');
      if (!bouton || !liste) return;
      var articles = Array.prototype.slice.call(liste.querySelectorAll('.guide'));
      var surplus = articles.slice(LIMITE);
      if (!mobile.matches || !surplus.length) {
        articles.forEach(function (article) { article.hidden = false; });
        bouton.hidden = true;
        bouton.setAttribute('aria-expanded', 'false');
        etape.classList.remove('is-expanded');
        return;
      }
      surplus.forEach(function (article) { article.hidden = true; });
      bouton.hidden = false;
      bouton.setAttribute('aria-expanded', 'false');
      bouton.innerHTML = 'Voir les ' + surplus.length + ' autres guides <span aria-hidden="true">↓</span>';
      etape.classList.remove('is-expanded');
    });
  }

  etapes.forEach(function (etape) {
    var bouton = etape.querySelector('[data-etape-more]');
    var liste = etape.querySelector('.guides');
    if (!bouton || !liste) return;
    bouton.addEventListener('click', function () {
      var articles = Array.prototype.slice.call(liste.querySelectorAll('.guide'));
      var surplus = articles.slice(LIMITE);
      var ouvert = bouton.getAttribute('aria-expanded') !== 'true';
      surplus.forEach(function (article) { article.hidden = !ouvert; });
      etape.classList.toggle('is-expanded', ouvert);
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      bouton.innerHTML = ouvert
        ? 'Voir moins <span aria-hidden="true">↑</span>'
        : 'Voir les ' + surplus.length + ' autres guides <span aria-hidden="true">↓</span>';
    });
  });

  setup();
  if (mobile.addEventListener) mobile.addEventListener('change', setup);
  else if (mobile.addListener) mobile.addListener(setup);
})();
