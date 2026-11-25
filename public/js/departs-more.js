// Affichage progressif du tableau comparatif sur téléphone uniquement.
(function () {
  'use strict';
  var tableau = document.querySelector('[data-departs]');
  if (!tableau) return;
  var lignes = Array.prototype.slice.call(tableau.querySelectorAll('tbody .depart'));
  var bouton = tableau.querySelector('[data-departs-more]');
  if (!bouton || lignes.length <= 3 || !window.matchMedia) return;
  var mobile = window.matchMedia('(max-width: 600px)');
  var ouvert = false;
  var supplement = lignes.slice(3);
  function afficher() {
    supplement.forEach(function (ligne) {
      ligne.classList.toggle('depart--mobile-extra', mobile.matches && !ouvert);
    });
    bouton.hidden = !mobile.matches;
    bouton.setAttribute('aria-expanded', mobile.matches && ouvert ? 'true' : 'false');
    bouton.innerHTML = ouvert
      ? 'Voir moins <span aria-hidden="true">↑</span>'
      : 'Voir les ' + supplement.length + ' autres destinations <span aria-hidden="true">↓</span>';
  }
  bouton.addEventListener('click', function () { ouvert = !ouvert; afficher(); });
  if (mobile.addEventListener) mobile.addEventListener('change', function () { ouvert = false; afficher(); });
  else if (mobile.addListener) mobile.addListener(function () { ouvert = false; afficher(); });
  afficher();
})();
