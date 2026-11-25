// Sur mobile, afficher deux articles par étape puis proposer « Voir plus ».
(function () {
  'use strict';
  var etapes = Array.prototype.slice.call(document.querySelectorAll('#guides .etape'));
  if (!etapes.length || !window.matchMedia) return;
  var mobile = window.matchMedia('(max-width: 600px)');
  var LIMITE = 2;

  function setup() {
    etapes.forEach(function (etape) {
      var bouton = etape.querySelector('[data-etape-more]');
      var liste = etape.querySelector('.guides');
      if (!bouton || !liste) return;
      var articles = Array.prototype.slice.call(liste.querySelectorAll('.guide'));
      var surplus = articles.slice(LIMITE);
      if (!mobile.matches || !surplus.length) {
        articles.forEach(function (article) { article.classList.remove('guide--mobile-extra'); });
        bouton.hidden = true;
        bouton.setAttribute('aria-expanded', 'false');
        etape.classList.remove('is-expanded');
        return;
      }
      surplus.forEach(function (article) { article.classList.add('guide--mobile-extra'); });
      bouton.hidden = false;
      bouton.setAttribute('aria-expanded', 'false');
      bouton.textContent = 'Voir plus';
      etape.classList.remove('is-expanded');
    });
  }

  etapes.forEach(function (etape) {
    var bouton = etape.querySelector('[data-etape-more]');
    var liste = etape.querySelector('.guides');
    if (!bouton || !liste) return;
    bouton.addEventListener('click', function () {
      var ouvert = bouton.getAttribute('aria-expanded') !== 'true';
      var surplus = Array.prototype.slice.call(liste.querySelectorAll('.guide')).slice(LIMITE);
      surplus.forEach(function (article) {
        article.classList.toggle('guide--mobile-extra', !ouvert);
      });
      etape.classList.toggle('is-expanded', ouvert);
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      bouton.textContent = ouvert ? 'Voir moins' : 'Voir plus';
    });
  });

  setup();
  if (mobile.addEventListener) mobile.addEventListener('change', setup);
  else if (mobile.addListener) mobile.addListener(setup);
})();
